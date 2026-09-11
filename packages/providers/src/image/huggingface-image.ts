import { ProviderError } from "../types";
import type { GenerateImageInput, GenerateImageResult } from "./gemini-image";

/**
 * Geração de imagem grátis via Hugging Face Inference (FLUX.1 [schnell]).
 *
 * Terceiro motor grátis, para redundância: Pollinations e Cloudflare falham por motivos
 * diferentes (limite de taxa num, cota diária no outro), então quando um nega o outro
 * costuma atender.
 *
 * Precisa de token gratuito: HUGGINGFACE_TOKEN (huggingface.co → Settings → Access Tokens).
 *
 * O endereço sai por variável de ambiente porque a Hugging Face migrou o endpoint de inferência
 * mais de uma vez; se mudarem de novo, é uma linha no .env em vez de um deploy.
 */

const BASE = process.env.HUGGINGFACE_BASE_URL || "https://router.huggingface.co/hf-inference/models";
const MODELO = process.env.HUGGINGFACE_IMAGE_MODEL || "black-forest-labs/FLUX.1-schnell";

export function huggingfaceConfigurado() {
  return !!process.env.HUGGINGFACE_TOKEN;
}

export async function generateImageHuggingface(input: GenerateImageInput): Promise<GenerateImageResult> {
  const token = process.env.HUGGINGFACE_TOKEN;
  if (!token) throw new ProviderError("Hugging Face não configurado — falta HUGGINGFACE_TOKEN no .env.");

  const prompt = [
    input.prompt.trim(),
    input.aspectRatio ? `${input.aspectRatio} aspect ratio, cinematic framing` : null,
    input.negativePrompt?.trim() ? `avoid: ${input.negativePrompt.trim()}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const res = await fetch(`${BASE}/${MODELO}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", accept: "image/png" },
    body: JSON.stringify({ inputs: prompt }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const detalhe = (await res.text().catch(() => "")).slice(0, 200);
    // 503 aqui costuma ser "modelo carregando", não erro de verdade — a cascata tenta o próximo.
    throw new ProviderError(`Hugging Face ${res.status}: ${detalhe || res.statusText}`, res.status);
  }

  const tipo = res.headers.get("content-type") || "";
  if (!tipo.startsWith("image/")) {
    const corpo = (await res.text().catch(() => "")).slice(0, 200);
    throw new ProviderError(`Hugging Face devolveu ${tipo || "conteúdo desconhecido"} em vez de imagem: ${corpo}`, 502);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length < 512) throw new ProviderError("Hugging Face retornou uma imagem vazia.");
  return { buffer, mimeType: tipo };
}
