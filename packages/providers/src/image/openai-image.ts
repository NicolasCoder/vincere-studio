import { ProviderError } from "../types";
import type { GenerateImageInput, GenerateImageResult } from "./gemini-image";

/**
 * Geração de imagem via OpenAI (GPT Image).
 *
 * Entra ao lado do Gemini como segunda opção paga, não como substituta. A diferença que importa
 * para nós: em layout, tipografia e composição gráfica o GPT Image tem ido melhor que o Nano
 * Banana — e é exatamente disso que a cronologia e os substratos de época precisam. Para foto
 * documental de objeto, os dois se equivalem.
 *
 * Precisa de OPENAI_API_KEY com faturamento. Nada gera enquanto o teto de orçamento estiver em
 * US$ 0: a trava vive no registro de motores, não aqui.
 */

const BASE = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const MODELO = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";

export function openaiConfigurado() {
  return !!process.env.OPENAI_API_KEY;
}

/**
 * Estimativa por imagem em USD, só para alimentar o checkBudget ANTES da chamada — não é o valor
 * de cobrança oficial. Sai por variável de ambiente porque preço de modelo muda sem aviso, e
 * cravar um número no código seria uma mentira com prazo de validade.
 */
export function estimateOpenAiImageCostUsd(): number {
  const n = Number(process.env.OPENAI_IMAGE_COST_USD ?? 0.04);
  return Number.isFinite(n) && n >= 0 ? n : 0.04;
}

/** O GPT Image aceita um conjunto fechado de tamanhos; proporção fora da lista é recusada. */
function tamanho(aspectRatio?: string): string {
  if (aspectRatio?.includes("9:16")) return "1024x1536";
  if (aspectRatio?.includes("16:9")) return "1536x1024";
  return "1024x1024";
}

export async function generateImageOpenAi(input: GenerateImageInput): Promise<GenerateImageResult> {
  const chave = process.env.OPENAI_API_KEY;
  if (!chave) throw new ProviderError("OpenAI não configurado — falta OPENAI_API_KEY no .env.");

  // Não há campo negativo nativo: o que não se quer entra como instrução no próprio texto.
  const prompt = [input.prompt.trim(), input.negativePrompt?.trim() ? `Do not include: ${input.negativePrompt.trim()}.` : null]
    .filter(Boolean)
    .join(" ");

  const res = await fetch(`${BASE}/images/generations`, {
    method: "POST",
    headers: { authorization: `Bearer ${chave}`, "content-type": "application/json" },
    body: JSON.stringify({ model: MODELO, prompt, size: tamanho(input.aspectRatio), n: 1 }),
    signal: AbortSignal.timeout(180_000),
  });

  const texto = await res.text();
  if (!res.ok) {
    let detalhe = texto.slice(0, 220);
    try {
      const j = JSON.parse(texto) as { error?: { message?: string } };
      if (j.error?.message) detalhe = j.error.message;
    } catch {
      /* corpo não era JSON */
    }
    throw new ProviderError(`OpenAI ${res.status}: ${detalhe}`, res.status);
  }

  let b64: string | undefined;
  try {
    b64 = (JSON.parse(texto) as { data?: { b64_json?: string }[] }).data?.[0]?.b64_json;
  } catch {
    throw new ProviderError("OpenAI devolveu uma resposta que não é JSON.", 502);
  }
  if (!b64) throw new ProviderError("OpenAI não retornou imagem.", 502);

  const buffer = Buffer.from(b64, "base64");
  if (buffer.length < 512) throw new ProviderError("OpenAI retornou uma imagem vazia.");
  return { buffer, mimeType: "image/png" };
}
