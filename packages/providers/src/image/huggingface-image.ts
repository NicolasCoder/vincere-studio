import { ProviderError } from "../types";
import type { GenerateImageInput, GenerateImageResult } from "./gemini-image";

/**
 * Geração de imagem via Hugging Face Inference Providers (FLUX.1 [schnell] pelo fal-ai).
 *
 * A rota antiga (`hf-inference/models/...`) morreu: responde `410 The requested model is
 * deprecated and no longer supported by provider hf-inference`. A Hugging Face migrou para um
 * roteador que despacha para provedores parceiros, e o caminho que funciona é por provedor.
 *
 * Testei os quatro candidatos com o token real antes de escolher:
 *   hf-inference/SDXL          → 410 deprecated
 *   nebius/v1/images           → 404
 *   together/v1/images         → 400 "Model not supported by provider together"
 *   fal-ai/fal-ai/flux/schnell → 200, imagem 1024×768
 *
 * Vantagem sobre a Cloudflare: aceita proporção de verdade, enquanto o FLUX da Workers AI
 * devolve 1024×1024 sempre. Isso faz dele a melhor opção grátis para imagem COM composição.
 *
 * Sobre custo: o roteador consome os créditos mensais incluídos da conta Hugging Face. Sem meio
 * de pagamento cadastrado ele simplesmente para de responder quando o mês acaba — não cobra. É
 * por isso que continua classificado como motor grátis, mas com teto mensal, não ilimitado.
 */

const BASE = process.env.HUGGINGFACE_BASE_URL || "https://router.huggingface.co";
const ROTA = process.env.HUGGINGFACE_IMAGE_ROUTE || "fal-ai/fal-ai/flux/schnell";

export function huggingfaceConfigurado() {
  return !!process.env.HUGGINGFACE_TOKEN;
}

/** Nomes de tamanho do fal-ai; ele não aceita largura/altura livres nesta rota. */
function tamanho(aspectRatio?: string): string {
  if (aspectRatio?.includes("9:16")) return "portrait_16_9";
  if (aspectRatio?.includes("16:9")) return "landscape_16_9";
  return "square_hd";
}

export async function generateImageHuggingface(input: GenerateImageInput): Promise<GenerateImageResult> {
  const token = process.env.HUGGINGFACE_TOKEN;
  if (!token) throw new ProviderError("Hugging Face não configurado — falta HUGGINGFACE_TOKEN no .env.");

  const prompt = [input.prompt.trim(), input.negativePrompt?.trim() ? `avoid: ${input.negativePrompt.trim()}` : null]
    .filter(Boolean)
    .join(", ");

  const res = await fetch(`${BASE}/${ROTA}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ prompt, image_size: tamanho(input.aspectRatio), num_images: 1 }),
    signal: AbortSignal.timeout(120_000),
  });

  const texto = await res.text();
  if (!res.ok) {
    let detalhe = texto.slice(0, 200);
    try {
      const j = JSON.parse(texto) as { error?: string | { message?: string } };
      const e = j.error;
      if (typeof e === "string") detalhe = e;
      else if (e?.message) detalhe = e.message;
    } catch {
      /* corpo não era JSON */
    }
    throw new ProviderError(`Hugging Face ${res.status}: ${detalhe}`, res.status);
  }

  // O fal-ai devolve a URL da imagem, não os bytes — ainda falta baixar.
  let url: string | undefined;
  let tipo = "image/jpeg";
  try {
    const j = JSON.parse(texto) as { images?: { url?: string; content_type?: string }[] };
    url = j.images?.[0]?.url;
    tipo = j.images?.[0]?.content_type ?? tipo;
  } catch {
    throw new ProviderError("Hugging Face devolveu uma resposta que não é JSON.", 502);
  }
  if (!url) throw new ProviderError("Hugging Face não retornou imagem.", 502);

  const img = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!img.ok) throw new ProviderError(`Hugging Face: falha ao baixar a imagem (${img.status}).`, img.status);
  const buffer = Buffer.from(await img.arrayBuffer());
  if (buffer.length < 512) throw new ProviderError("Hugging Face retornou uma imagem vazia.");
  return { buffer, mimeType: tipo };
}
