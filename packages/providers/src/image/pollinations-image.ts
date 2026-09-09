import { ProviderError } from "../types";
import type { GenerateImageInput, GenerateImageResult } from "./gemini-image";

/**
 * Geração de imagem 100% grátis via Pollinations.ai (sem chave, sem faturamento). Qualidade e
 * consistência entre gerações são bem inferiores ao Gemini/Nano Banana — não segue direito
 * referência de Avatar/Produto (o parâmetro é ignorado aqui, só citado no prompt como contexto
 * textual). Serve como opção pra testar o fluxo sem gastar nada; pra produção de verdade com
 * consistência de personagem/produto, o caminho pago (Gemini) continua sendo o recomendado.
 */
const BASE = "https://image.pollinations.ai/prompt";

export async function generateImagePollinations(input: GenerateImageInput): Promise<GenerateImageResult> {
  const promptText = [
    input.prompt.trim(),
    input.aspectRatio ? `aspect ratio ${input.aspectRatio}` : null,
    input.negativePrompt?.trim() ? `avoid: ${input.negativePrompt.trim()}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const [w, h] = aspectToSize(input.aspectRatio);
  const url = `${BASE}/${encodeURIComponent(promptText)}?width=${w}&height=${h}&nologo=true&seed=${Math.floor(Math.random() * 1_000_000)}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new ProviderError(`Pollinations.ai ${res.status}: falha ao gerar imagem grátis`, res.status);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length < 512) throw new ProviderError("Pollinations.ai retornou uma imagem inválida/vazia — tente de novo em instantes.");
  return { buffer, mimeType: res.headers.get("content-type") || "image/jpeg" };
}

function aspectToSize(aspectRatio?: string): [number, number] {
  if (aspectRatio?.includes("9:16")) return [768, 1344];
  if (aspectRatio?.includes("16:9")) return [1344, 768];
  return [1024, 1024];
}
