import { ProviderError } from "../types";
import type { GenerateImageInput, GenerateImageResult } from "./gemini-image";

/**
 * Geração de imagem paga via kie.ai — revendedor que expõe muitos modelos atrás de uma chave só.
 *
 * Entra como APOIO, nunca como base: a produção continua no motor grátis. O caso que justifica é
 * concreto — o grátis não faz image-to-image, então não há como manter consistência visual entre
 * as evidências de um mesmo vídeo, e foi isso que motivou trazer um pago para cá.
 *
 * Sendo um intermediário, disponibilidade e preço dependem de um terceiro que revende outros
 * terceiros. Por isso ele é um motor selecionável e o caminho grátis nunca sai do lugar: se o kie
 * cair, a produção não para.
 *
 * A chamada é assíncrona: cria-se uma tarefa e consulta-se até ficar pronta.
 */

const BASE = process.env.KIE_BASE_URL || "https://api.kie.ai";
const MODELO = process.env.KIE_IMAGE_MODEL || "google/nano-banana-pro";
const TIMEOUT_MS = Number(process.env.KIE_TIMEOUT_MS ?? 180_000);
const INTERVALO_MS = 3000;

export function kieConfigurado() {
  return !!process.env.KIE_API_KEY;
}

/**
 * Custo estimado por imagem, em USD. Existe para o `checkBudget` ter o que somar ANTES da
 * chamada. É estimativa declarada por variável de ambiente de propósito: o preço é do revendedor
 * e muda sem nos avisar — cravar um número no código seria uma mentira com prazo de validade.
 */
export function estimateKieImageCostUsd(): number {
  const n = Number(process.env.KIE_IMAGE_COST_USD ?? 0.05);
  return Number.isFinite(n) && n >= 0 ? n : 0.05;
}

const dorme = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function chamar(caminho: string, init: RequestInit): Promise<unknown> {
  const chave = process.env.KIE_API_KEY;
  if (!chave) throw new ProviderError("kie.ai não configurado — falta KIE_API_KEY no .env.");
  const res = await fetch(`${BASE}${caminho}`, {
    ...init,
    headers: { authorization: `Bearer ${chave}`, "content-type": "application/json", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(60_000),
  });
  const texto = await res.text();
  let corpo: unknown;
  try {
    corpo = JSON.parse(texto);
  } catch {
    throw new ProviderError(`kie.ai ${res.status}: resposta não-JSON (${texto.slice(0, 160)})`, res.status);
  }
  if (!res.ok) {
    const msg = (corpo as { msg?: string; message?: string })?.msg ?? (corpo as { message?: string })?.message ?? texto.slice(0, 160);
    throw new ProviderError(`kie.ai ${res.status}: ${msg}`, res.status, corpo);
  }
  return corpo;
}

export async function generateImageKie(input: GenerateImageInput): Promise<GenerateImageResult> {
  const criada = (await chamar("/api/v1/jobs/createTask", {
    method: "POST",
    body: JSON.stringify({
      model: MODELO,
      input: {
        prompt: input.prompt.trim(),
        ...(input.aspectRatio ? { aspect_ratio: input.aspectRatio } : {}),
        ...(input.negativePrompt?.trim() ? { negative_prompt: input.negativePrompt.trim() } : {}),
        // Referência de imagem (image-to-image) fica de fora nesta primeira versão de propósito.
        // O `referenceImagePaths` são caminhos locais e a API espera URL pública; qual formato
        // exato ela aceita (URL assinada? data URI?) eu não consigo verificar sem uma chave.
        // Entregar um palpite aqui daria erro só na hora de gerar, com o custo já debitado.
      },
    }),
  })) as { data?: { taskId?: string } };

  const taskId = criada.data?.taskId;
  if (!taskId) throw new ProviderError("kie.ai não devolveu taskId ao criar a tarefa.", 502);

  const limite = Date.now() + TIMEOUT_MS;
  while (Date.now() < limite) {
    await dorme(INTERVALO_MS);
    const st = (await chamar(`/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, { method: "GET" })) as {
      data?: { state?: string; failMsg?: string; resultJson?: string };
    };
    const estado = st.data?.state;
    if (estado === "fail") throw new ProviderError(`kie.ai: tarefa falhou — ${st.data?.failMsg ?? "sem detalhe"}`, 502);
    if (estado !== "success") continue;

    let urls: string[] = [];
    try {
      urls = (JSON.parse(st.data?.resultJson ?? "{}") as { resultUrls?: string[] }).resultUrls ?? [];
    } catch {
      throw new ProviderError("kie.ai: resultJson ilegível.", 502);
    }
    if (!urls.length) throw new ProviderError("kie.ai: tarefa concluiu sem imagem.", 502);

    const img = await fetch(urls[0], { signal: AbortSignal.timeout(60_000) });
    if (!img.ok) throw new ProviderError(`kie.ai: falha ao baixar a imagem (${img.status}).`, img.status);
    const buffer = Buffer.from(await img.arrayBuffer());
    if (buffer.length < 512) throw new ProviderError("kie.ai devolveu uma imagem vazia.");
    return { buffer, mimeType: img.headers.get("content-type") || "image/png" };
  }

  throw new ProviderError(`kie.ai: tarefa não concluiu em ${Math.round(TIMEOUT_MS / 1000)}s.`, 504);
}
