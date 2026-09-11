import { ProviderError } from "../types";
import type { GenerateImageInput, GenerateImageResult } from "./gemini-image";

/**
 * Geração de imagem grátis via Together.ai (FLUX.1 [schnell] Free).
 *
 * Quarto motor grátis da cascata. A API segue o formato da OpenAI, então o corpo e a resposta são
 * os de sempre: `data[0].b64_json`.
 *
 * Precisa de chave gratuita: TOGETHER_API_KEY (api.together.xyz). O modelo com sufixo "-Free" tem
 * limite de requisições por minuto próprio; quando ele nega, a cascata segue para o próximo.
 */

const BASE = process.env.TOGETHER_BASE_URL || "https://api.together.xyz/v1";
const MODELO = process.env.TOGETHER_IMAGE_MODEL || "black-forest-labs/FLUX.1-schnell-Free";

export function togetherConfigurado() {
  return !!process.env.TOGETHER_API_KEY;
}

/** O schnell da Together aceita largura e altura, então a proporção sai certa sem depender do texto. */
function tamanho(aspectRatio?: string): { width: number; height: number } {
  if (aspectRatio?.includes("9:16")) return { width: 768, height: 1344 };
  if (aspectRatio?.includes("16:9")) return { width: 1344, height: 768 };
  return { width: 1024, height: 1024 };
}

export async function generateImageTogether(input: GenerateImageInput): Promise<GenerateImageResult> {
  const chave = process.env.TOGETHER_API_KEY;
  if (!chave) throw new ProviderError("Together.ai não configurado — falta TOGETHER_API_KEY no .env.");

  const { width, height } = tamanho(input.aspectRatio);
  const prompt = [input.prompt.trim(), input.negativePrompt?.trim() ? `avoid: ${input.negativePrompt.trim()}` : null]
    .filter(Boolean)
    .join(", ");

  const res = await fetch(`${BASE}/images/generations`, {
    method: "POST",
    headers: { authorization: `Bearer ${chave}`, "content-type": "application/json" },
    body: JSON.stringify({ model: MODELO, prompt, width, height, steps: 4, n: 1, response_format: "b64_json" }),
    signal: AbortSignal.timeout(120_000),
  });

  const texto = await res.text();
  if (!res.ok) {
    let detalhe = texto.slice(0, 200);
    try {
      const j = JSON.parse(texto) as { error?: { message?: string } };
      if (j.error?.message) detalhe = j.error.message;
    } catch {
      /* corpo não era JSON */
    }
    throw new ProviderError(`Together.ai ${res.status}: ${detalhe}`, res.status);
  }

  let b64: string | undefined;
  try {
    b64 = (JSON.parse(texto) as { data?: { b64_json?: string }[] }).data?.[0]?.b64_json;
  } catch {
    throw new ProviderError("Together.ai devolveu uma resposta que não é JSON.", 502);
  }
  if (!b64) throw new ProviderError("Together.ai não retornou imagem.", 502);

  const buffer = Buffer.from(b64, "base64");
  if (buffer.length < 512) throw new ProviderError("Together.ai retornou uma imagem vazia.");
  return { buffer, mimeType: "image/png" };
}
