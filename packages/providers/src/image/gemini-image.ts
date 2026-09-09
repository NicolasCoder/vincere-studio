import { readFile } from "node:fs/promises";
import { ProviderError } from "../types";

/**
 * Geração de imagem via Gemini ("Nano Banana", modelo image-capable). Diferente do texto e
 * do TTS, essa API normalmente exige uma chave do Google AI Studio com FATURAMENTO habilitado
 * (não entra na cota 100% grátis) — por isso usa GEMINI_IMAGE_API_KEY separada, com fallback
 * pra GEMINI_API_KEY caso o usuário já tenha faturamento na mesma chave.
 */

const BASE = "https://generativelanguage.googleapis.com/v1beta";
const MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";

/**
 * Estimativa de custo por imagem em USD, só pra alimentar o controle de orçamento (checkBudget)
 * ANTES de chamar a API — não é o valor de cobrança oficial (esse vem da fatura do Google Cloud).
 * Baseado no preço público por modelo (ai.google.dev/gemini-api/docs/pricing, consultado 09/2026):
 * Nano Banana 2 (3.1 Flash Image) ~US$0.067/imagem, Nano Banana Pro (3 Pro Image) ~US$0.134/imagem
 * (2K) ou US$0.24 (4K). Sem entrada específica pro modelo configurado, usa a estimativa mais alta
 * da família Flash como margem de segurança (superestimar é mais seguro que subestimar o teto).
 */
export function estimateImageCostUsd(model = MODEL): number {
  if (/pro-image|nano-banana-pro/i.test(model)) return 0.14;
  return 0.07;
}

export interface GenerateImageInput {
  /** Descrição do que gerar. */
  prompt: string;
  /** O que evitar (vira instrução textual — a API de imagem não tem campo negativo nativo). */
  negativePrompt?: string;
  /** Caminhos absolutos de imagens de referência (Avatar/Produto) — habilita image-to-image. */
  referenceImagePaths?: string[];
  /** Ex.: "9:16", "16:9", "1:1" — vira instrução textual de enquadramento. */
  aspectRatio?: string;
}

export interface GenerateImageResult {
  buffer: Buffer;
  mimeType: string;
}

function envKey() {
  const key = process.env.GEMINI_IMAGE_API_KEY || process.env.GEMINI_API_KEY;
  if (!key) {
    throw new ProviderError(
      "GEMINI_IMAGE_API_KEY não configurada (geração de imagem via Gemini/Nano Banana normalmente exige faturamento habilitado no Google AI Studio — não é o mesmo nível grátis do texto). Adicione a chave no .env e reinicie.",
    );
  }
  return key;
}

/** Gera 1 imagem a partir de um prompt (texto puro, ou image-to-image se referenceImagePaths vier preenchido). */
export async function generateImageGemini(input: GenerateImageInput): Promise<GenerateImageResult> {
  const apiKey = envKey();

  const promptText = [
    input.prompt.trim(),
    input.aspectRatio ? `Proporção/enquadramento: ${input.aspectRatio}.` : null,
    input.negativePrompt?.trim() ? `Evite completamente: ${input.negativePrompt.trim()}.` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [{ text: promptText }];
  for (const p of input.referenceImagePaths ?? []) {
    try {
      const buf = await readFile(p);
      const mimeType = /\.png$/i.test(p) ? "image/png" : "image/jpeg";
      parts.push({ inlineData: { mimeType, data: buf.toString("base64") } });
    } catch {
      // referência não encontrada no disco — segue sem ela, não derruba a geração.
    }
  }

  const body = {
    contents: [{ parts }],
    generationConfig: { responseModalities: ["IMAGE"] },
  };

  type Resp = {
    candidates?: { content?: { parts?: { inlineData?: { mimeType?: string; data?: string } }[] } }[];
    error?: { message?: string };
    promptFeedback?: { blockReason?: string };
  };

  const res = await fetch(`${BASE}/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  const json = (await res.json().catch(() => ({}))) as Resp;
  if (!res.ok) throw new ProviderError(`Gemini Image (${MODEL}) ${res.status}: ${json.error?.message ?? res.statusText}`, res.status, json);
  if (json.promptFeedback?.blockReason) {
    throw new ProviderError(`Gemini Image bloqueou a geração (${json.promptFeedback.blockReason}) — ajuste o prompt.`, 400, json);
  }

  const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part?.inlineData?.data) throw new ProviderError(`Gemini Image (${MODEL}) não retornou imagem`, 502, json);

  return { buffer: Buffer.from(part.inlineData.data, "base64"), mimeType: part.inlineData.mimeType ?? "image/png" };
}
