import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

export interface StockQuery {
  keywords: string;
  orientation: "landscape" | "portrait";
  type: "video" | "image";
  minDurationSec?: number;
}
export interface StockAsset {
  provider: "PEXELS" | "PIXABAY" | "COVERR";
  id: string;
  type: "video" | "image";
  url: string; // download
  pageUrl: string;
  thumbUrl?: string;
  width: number;
  height: number;
  durationSec?: number;
  author?: string;
  license: string;
  tags?: string;
}
export interface StockProvider {
  readonly name: "PEXELS" | "PIXABAY" | "COVERR";
  search(q: StockQuery, limit?: number): Promise<StockAsset[]>;
}

export class PexelsProvider implements StockProvider {
  readonly name = "PEXELS" as const;
  constructor(private readonly key = process.env.PEXELS_API_KEY ?? "") {}
  get enabled() {
    return !!this.key;
  }
  async search(q: StockQuery, limit = 6): Promise<StockAsset[]> {
    if (!this.key) return [];
    const base = q.type === "video" ? "https://api.pexels.com/videos/search" : "https://api.pexels.com/v1/search";
    const url = `${base}?query=${encodeURIComponent(q.keywords)}&orientation=${q.orientation}&per_page=${limit}&size=medium`;
    const res = await fetch(url, { headers: { Authorization: this.key }, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`Pexels ${res.status}`);
    const json = (await res.json()) as { videos?: PexelsVideo[]; photos?: PexelsPhoto[] };
    if (q.type === "video") {
      return (json.videos ?? [])
        .filter((v) => !q.minDurationSec || v.duration >= q.minDurationSec)
        .map((v) => {
          const files = v.video_files.filter((f) => f.file_type === "video/mp4").sort((a, b) => Math.abs((a.height ?? 0) - 1080) - Math.abs((b.height ?? 0) - 1080));
          const f = files[0];
          return { provider: "PEXELS" as const, id: String(v.id), type: "video" as const, url: f?.link ?? "", pageUrl: v.url, thumbUrl: v.image, width: f?.width ?? v.width, height: f?.height ?? v.height, durationSec: v.duration, author: v.user?.name, license: "Pexels License (uso livre, atribuição opcional)" };
        })
        .filter((a) => a.url);
    }
    return (json.photos ?? []).map((p) => ({ provider: "PEXELS" as const, id: String(p.id), type: "image" as const, url: p.src.large2x ?? p.src.original, pageUrl: p.url, thumbUrl: p.src.medium, width: p.width, height: p.height, author: p.photographer, license: "Pexels License (uso livre, atribuição opcional)", tags: p.alt }));
  }
}
interface PexelsVideo { id: number; url: string; image: string; duration: number; width: number; height: number; user?: { name: string }; video_files: { link: string; file_type: string; width?: number; height?: number }[] }
interface PexelsPhoto { id: number; url: string; width: number; height: number; photographer: string; alt?: string; src: { original: string; large2x?: string; medium: string } }

export class PixabayProvider implements StockProvider {
  readonly name = "PIXABAY" as const;
  constructor(private readonly key = process.env.PIXABAY_API_KEY ?? "") {}
  get enabled() {
    return !!this.key;
  }
  async search(q: StockQuery, limit = 6): Promise<StockAsset[]> {
    if (!this.key) return [];
    const orientation = q.orientation === "portrait" ? "vertical" : "horizontal";
    const base = q.type === "video" ? "https://pixabay.com/api/videos/" : "https://pixabay.com/api/";
    const url = `${base}?key=${this.key}&q=${encodeURIComponent(q.keywords)}&per_page=${Math.max(3, limit)}&safesearch=true&lang=pt${q.type === "image" ? `&orientation=${orientation}&image_type=photo` : ""}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`Pixabay ${res.status}`);
    const json = (await res.json()) as { hits: PixabayHit[] };
    return (json.hits ?? [])
      .filter((h) => (q.type === "video" ? !!h.videos : true))
      .filter((h) => !q.minDurationSec || !h.duration || h.duration >= q.minDurationSec)
      .map((h) => {
        if (q.type === "video") {
          const v = h.videos!.large?.url ? h.videos!.large : h.videos!.medium;
          return { provider: "PIXABAY" as const, id: String(h.id), type: "video" as const, url: v.url, pageUrl: h.pageURL, thumbUrl: v.thumbnail, width: v.width, height: v.height, durationSec: h.duration, author: h.user, license: "Pixabay Content License (uso livre)", tags: h.tags };
        }
        return { provider: "PIXABAY" as const, id: String(h.id), type: "image" as const, url: h.largeImageURL ?? h.webformatURL ?? "", pageUrl: h.pageURL, thumbUrl: h.previewURL, width: h.imageWidth ?? 0, height: h.imageHeight ?? 0, author: h.user, license: "Pixabay Content License (uso livre)", tags: h.tags };
      })
      .filter((a) => a.url)
      .filter((a) => (q.type === "video" ? (q.orientation === "portrait" ? a.height >= a.width : a.width >= a.height) : true));
  }
}
interface PixabayHit { id: number; pageURL: string; user: string; tags?: string; duration?: number; previewURL?: string; webformatURL?: string; largeImageURL?: string; imageWidth?: number; imageHeight?: number; videos?: Record<string, { url: string; width: number; height: number; thumbnail?: string }> }

/**
 * Coverr: acervo de vídeo (só vídeo, sem imagem). Requer cadastro gratuito em coverr.co/developers
 * (tier "Demo": 50 requisições/hora). Terceira camada de redundância, opcional — some se
 * COVERR_API_KEY não estiver configurada, exatamente como Pexels/Pixabay.
 */
export class CoverrProvider implements StockProvider {
  readonly name = "COVERR" as const;
  constructor(private readonly key = process.env.COVERR_API_KEY ?? "") {}
  get enabled() {
    return !!this.key;
  }
  async search(q: StockQuery, limit = 6): Promise<StockAsset[]> {
    if (!this.key || q.type === "image") return []; // Coverr não tem banco de imagens, só vídeo
    const url = `https://api.coverr.co/videos?query=${encodeURIComponent(q.keywords)}&page_size=${limit}&urls=true&sort=popular`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${this.key}` }, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`Coverr ${res.status}`);
    const json = (await res.json()) as unknown;
    const list: CoverrVideo[] = Array.isArray(json) ? json : ((json as { hits?: CoverrVideo[]; videos?: CoverrVideo[] })?.hits ?? (json as { videos?: CoverrVideo[] })?.videos ?? []);
    return list
      .filter((v) => !q.minDurationSec || !v.duration || v.duration >= q.minDurationSec)
      .filter((v) => (q.orientation === "portrait" ? v.is_vertical !== false : v.is_vertical !== true))
      .map((v) => ({
        provider: "COVERR" as const,
        id: String(v.id),
        type: "video" as const,
        url: v.urls?.mp4_download || v.urls?.mp4 || "",
        pageUrl: `https://coverr.co/videos/${v.id}`,
        thumbUrl: v.thumbnail,
        width: v.max_width ?? 0,
        height: v.max_height ?? 0,
        durationSec: v.duration,
        license: "Coverr License (uso livre)",
        tags: (v.tags ?? []).join(", "),
      }))
      .filter((a) => a.url);
  }
}
interface CoverrVideo { id: string | number; tags?: string[]; duration?: number; is_vertical?: boolean; max_width?: number; max_height?: number; thumbnail?: string; urls?: { mp4?: string; mp4_download?: string; mp4_preview?: string } }

export function getStockProviders(): StockProvider[] {
  return [new PexelsProvider(), new PixabayProvider(), new CoverrProvider()].filter((p) => p.enabled);
}

export async function downloadTo(url: string, file: string) {
  await mkdir(path.dirname(file), { recursive: true });
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok || !res.body) throw new Error(`download ${res.status} ${url}`);
  await pipeline(Readable.fromWeb(res.body as import("node:stream/web").ReadableStream), createWriteStream(file));
  return file;
}
