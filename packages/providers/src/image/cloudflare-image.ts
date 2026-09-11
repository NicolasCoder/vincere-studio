import { ProviderError } from "../types";
import type { GenerateImageInput, GenerateImageResult } from "./gemini-image";

/**
 * Geração de imagem grátis via Cloudflare Workers AI (FLUX.1 [schnell]).
 *
 * Por que existe, tendo Pollinations: o Pollinations não tem cota, tem limite de taxa — num lote
 * de 9 evidências, 7 voltaram 429 e 3 nunca geraram nem com repetição. A conta gratuita da
 * Cloudflare tem uma cota DIÁRIA declarada, o que muda a natureza do problema: em vez de torcer
 * para o serviço atender, sabe-se quantas imagens cabem no dia. A qualidade do FLUX schnell
 * também é visivelmente melhor.
 *
 * Precisa de conta gratuita na Cloudflare: CLOUDFLARE_ACCOUNT_ID e CLOUDFLARE_API_TOKEN (token
 * com permissão de Workers AI). Sem cartão.
 */

const MODELO = process.env.CLOUDFLARE_IMAGE_MODEL || "@cf/black-forest-labs/flux-1-schnell";

export function cloudflareConfigurado() {
  return !!(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN);
}

export async function generateImageCloudflare(input: GenerateImageInput): Promise<GenerateImageResult> {
  const conta = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!conta || !token) {
    throw new ProviderError("Cloudflare Workers AI não configurado — falta CLOUDFLARE_ACCOUNT_ID ou CLOUDFLARE_API_TOKEN no .env.");
  }

  /**
   * O FLUX schnell da Workers AI sempre devolve 1024×1024 — medido: passar `width`/`height`
   * retorna 400 "Additional or unevaluated properties not allowed". A proporção entra só como
   * pista no texto, e o modelo obedece a composição, não a moldura.
   *
   * Consequência prática: serve muito bem para SUBSTRATO (textura, papel, fundo), que é usado com
   * recorte e não perde nada ao ser cortado. Para imagem com composição — assunto centrado,
   * elemento encostado na borda — o corte para 16:9 ou 9:16 come as pontas. Nesses casos o
   * prompt deve manter o assunto longe das bordas.
   */
  const prompt = [
    input.prompt.trim(),
    input.aspectRatio ? `${input.aspectRatio} aspect ratio, cinematic framing` : null,
    input.negativePrompt?.trim() ? `avoid: ${input.negativePrompt.trim()}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${conta}/ai/run/${MODELO}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ prompt, steps: 4 }),
    signal: AbortSignal.timeout(90_000),
  });

  const texto = await res.text();
  if (!res.ok) {
    // A resposta de erro da Cloudflare é JSON com `errors[]`; quando a cota do dia acaba, é ali
    // que isso aparece. Vale repassar a mensagem original em vez de um "falhou" genérico.
    let detalhe = texto.slice(0, 200);
    try {
      const j = JSON.parse(texto) as { errors?: { message?: string }[] };
      if (j.errors?.length) detalhe = j.errors.map((e) => e.message).filter(Boolean).join("; ");
    } catch {
      /* corpo não era JSON — fica o texto cru mesmo */
    }
    throw new ProviderError(`Cloudflare Workers AI ${res.status}: ${detalhe}`, res.status);
  }

  // O schnell devolve { result: { image: "<base64>" } }, não bytes crus.
  let base64: string | undefined;
  try {
    base64 = (JSON.parse(texto) as { result?: { image?: string } }).result?.image;
  } catch {
    throw new ProviderError("Cloudflare Workers AI devolveu uma resposta que não é JSON.", 502);
  }
  if (!base64) throw new ProviderError("Cloudflare Workers AI não retornou imagem.", 502);

  const buffer = Buffer.from(base64, "base64");
  if (buffer.length < 512) throw new ProviderError("Cloudflare Workers AI retornou uma imagem vazia.");
  return { buffer, mimeType: "image/jpeg" };
}
