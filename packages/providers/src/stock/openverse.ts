import type { StockAsset, StockProvider, StockQuery } from "./index";

/**
 * Openverse — o buscador de mídia aberta da Wikimedia Foundation.
 *
 * É o acervo que faltava para documentário. Pexels e Pixabay são bancos de foto contemporânea:
 * pedir "rodovia deserta 1995" devolve uma estrada bonita de hoje, e o B-roll genérico é hoje o
 * teto da qualidade dos nossos vídeos. O Openverse indexa Wikimedia Commons, Flickr Commons e
 * arquivos de museus — fotografia histórica de verdade, com data e procedência.
 *
 * Sem chave e sem cadastro: a API pública é aberta, com limite de taxa por IP.
 *
 * A licença vem por item e NÃO é uniforme (CC0, CC BY, CC BY-SA, domínio público). Por isso ela
 * viaja junto no StockAsset — material CC BY exige crédito, e publicar sem crédito é violação
 * mesmo sendo "grátis".
 */

const BASE = process.env.OPENVERSE_BASE_URL || "https://api.openverse.org/v1";

export class OpenverseProvider implements StockProvider {
  readonly name = "OPENVERSE" as const;

  /** Sempre ligado: não precisa de chave. */
  get enabled() {
    return process.env.OPENVERSE_DISABLED !== "1";
  }

  async search(q: StockQuery, limit = 6): Promise<StockAsset[]> {
    // Só imagem: o Openverse tem áudio, mas não vídeo — e o pipeline pede vídeo ou imagem.
    if (q.type !== "image") return [];

    const params = new URLSearchParams({
      q: q.keywords,
      page_size: String(limit),
      // Descarta o que exige compartilhar igual ou proíbe uso comercial: canal monetizado com
      // material NC é problema jurídico, e ND impede até o recorte que o Ken Burns faz.
      license_type: "commercial,modification",
      aspect_ratio: q.orientation === "portrait" ? "tall" : "wide",
      size: "large",
      mature: "false",
    });

    const res = await fetch(`${BASE}/images/?${params}`, {
      headers: { "user-agent": "VincereStudio/1.0 (documentario; uso proprio)" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`Openverse ${res.status}`);

    const json = (await res.json()) as { results?: OpenverseImage[] };
    return (json.results ?? [])
      .flatMap((r) => (r.url && (r.width ?? 0) >= 800 ? [{ ...r, url: r.url }] : []))
      .map((r) => ({
        provider: "OPENVERSE" as const,
        id: String(r.id),
        type: "image" as const,
        url: r.url,
        pageUrl: r.foreign_landing_url ?? r.url,
        thumbUrl: r.thumbnail,
        width: r.width ?? 0,
        height: r.height ?? 0,
        author: r.creator ?? undefined,
        // Guarda a licença exata, não um rótulo genérico: é ela que diz se precisa de crédito.
        license: [r.license?.toUpperCase(), r.license_version, r.source].filter(Boolean).join(" ") || "licença aberta",
        tags: r.title ?? undefined,
      }));
  }
}

interface OpenverseImage {
  id: string;
  title?: string;
  url?: string;
  thumbnail?: string;
  foreign_landing_url?: string;
  creator?: string;
  license?: string;
  license_version?: string;
  source?: string;
  width?: number;
  height?: number;
}
