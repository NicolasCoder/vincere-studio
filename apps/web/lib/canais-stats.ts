import { prisma } from "@vincere-studio/db";
import { getYoutubeConnection } from "@vincere-studio/providers";

// Estatísticas públicas de canais do YouTube (o seu e os de concorrentes) para o painel de
// Métricas. Usa a YouTube Data API v3 com uma chave simples (YOUTUBE_API_KEY, gratuita; cota
// diária de 10.000 unidades e cada canal custa ~4). Os números ficam no Setting e viram uma
// série histórica: um ponto a cada 6 h, no máximo, enquanto você atualiza.

const API = "https://www.googleapis.com/youtube/v3";
const PONTO_A_CADA_MS = 6 * 3600_000;
const MAX_PONTOS = 365;

export interface VideoRecente { id: string; titulo: string; views: number; publicadoEm: string }
export interface CanalStats {
  canalId: string;
  nome: string;
  avatar?: string;
  inscritos: number | null; // null quando o canal oculta a contagem
  views: number;
  videos: number;
  recentes: VideoRecente[];
  atualizadoEm: string;
}
export interface Ponto { t: number; inscritos: number | null; views: number; videos: number }
export interface CanalCache { stats?: CanalStats; pontos: Ponto[]; erro?: string }

export const temChaveYoutube = () => !!process.env.YOUTUBE_API_KEY;

async function yt<T>(rota: string, params: Record<string, string>): Promise<T> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("Falta a YOUTUBE_API_KEY no .env do servidor (grátis, no Google Cloud → YouTube Data API v3 → Credenciais).");
  const qs = new URLSearchParams({ ...params, key });
  const res = await fetch(`${API}/${rota}?${qs}`, { signal: AbortSignal.timeout(15_000), cache: "no-store" });
  const json = (await res.json().catch(() => null)) as (T & { error?: { message?: string } }) | null;
  if (!res.ok || !json) throw new Error(`YouTube API: ${json?.error?.message ?? `HTTP ${res.status}`}`.slice(0, 200));
  return json;
}

/** Aceita /channel/UC…, /@handle, ou o próprio id/handle solto. /c/ e /user/ exigem busca paga e não são suportados. */
export function identificarCanal(entrada: string): { id?: string; handle?: string } | null {
  const t = entrada.trim();
  const id = t.match(/(?:channel\/|^)(UC[\w-]{20,24})(?:[/?#]|$)/)?.[1];
  if (id) return { id };
  const handle = t.match(/@([\w.\-·]{3,40})/)?.[1];
  return handle ? { handle } : null;
}

interface ChannelsResp {
  items?: {
    id: string;
    snippet: { title: string; thumbnails?: { default?: { url: string }; medium?: { url: string } } };
    statistics: { subscriberCount?: string; viewCount?: string; videoCount?: string; hiddenSubscriberCount?: boolean };
    contentDetails: { relatedPlaylists: { uploads: string } };
  }[];
}

export async function buscarCanal(entrada: string): Promise<CanalStats> {
  const ident = identificarCanal(entrada);
  if (!ident) throw new Error("Use o link no formato youtube.com/@nome ou youtube.com/channel/UC… (links /c/ e /user/ não são suportados).");
  const c = await yt<ChannelsResp>("channels", {
    part: "snippet,statistics,contentDetails",
    ...(ident.id ? { id: ident.id } : { forHandle: `@${ident.handle}` }),
  });
  const item = c.items?.[0];
  if (!item) throw new Error("Canal não encontrado.");

  let recentes: VideoRecente[] = [];
  try {
    const pl = await yt<{ items?: { contentDetails: { videoId: string; videoPublishedAt?: string } }[] }>("playlistItems", {
      part: "contentDetails",
      playlistId: item.contentDetails.relatedPlaylists.uploads,
      maxResults: "10",
    });
    const ids = (pl.items ?? []).map((i) => i.contentDetails.videoId);
    if (ids.length) {
      const v = await yt<{ items?: { id: string; snippet: { title: string; publishedAt: string }; statistics: { viewCount?: string } }[] }>("videos", {
        part: "snippet,statistics",
        id: ids.join(","),
      });
      recentes = (v.items ?? [])
        .map((x) => ({ id: x.id, titulo: x.snippet.title, views: Number(x.statistics.viewCount ?? 0), publicadoEm: x.snippet.publishedAt }))
        .sort((a, b) => b.publicadoEm.localeCompare(a.publicadoEm));
    }
  } catch {
    // os números do canal já valem sozinhos; só o gráfico de vídeos fica vazio
  }

  return {
    canalId: item.id,
    nome: item.snippet.title,
    avatar: item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url,
    inscritos: item.statistics.hiddenSubscriberCount ? null : Number(item.statistics.subscriberCount ?? 0),
    views: Number(item.statistics.viewCount ?? 0),
    videos: Number(item.statistics.videoCount ?? 0),
    recentes,
    atualizadoEm: new Date().toISOString(),
  };
}

const chaveCache = (ref: string) => `canal:${ref}`;

export async function lerCache(ref: string): Promise<CanalCache> {
  const row = await prisma.setting.findUnique({ where: { key: chaveCache(ref) } });
  if (!row) return { pontos: [] };
  try {
    return JSON.parse(row.value) as CanalCache;
  } catch {
    return { pontos: [] };
  }
}

export async function salvarCache(ref: string, c: CanalCache) {
  const value = JSON.stringify(c);
  await prisma.setting.upsert({ where: { key: chaveCache(ref) }, update: { value }, create: { key: chaveCache(ref), value } });
}

export async function atualizarCanal(ref: string, entrada: string) {
  const atual = await lerCache(ref);
  try {
    const stats = await buscarCanal(entrada);
    const pontos = [...atual.pontos];
    const ultimo = pontos[pontos.length - 1];
    if (!ultimo || Date.now() - ultimo.t >= PONTO_A_CADA_MS) {
      pontos.push({ t: Date.now(), inscritos: stats.inscritos, views: stats.views, videos: stats.videos });
    }
    await salvarCache(ref, { stats, pontos: pontos.slice(-MAX_PONTOS) });
  } catch (e) {
    await salvarCache(ref, { ...atual, erro: e instanceof Error ? e.message : String(e) });
  }
}

export interface CanalMonitorado {
  ref: string;
  url: string;
  proprio: boolean;
  refId?: string;
  nicho?: string;
  nomeSalvo?: string | null;
  avatarSalvo?: string | null;
  cache: CanalCache;
}

/** O canal conectado (seu) e todos os canais da Biblioteca de Referências (concorrentes). */
export async function listarCanaisMonitorados(): Promise<CanalMonitorado[]> {
  const [conexao, refs] = await Promise.all([getYoutubeConnection().catch(() => null), prisma.referenceChannel.findMany({ orderBy: { createdAt: "asc" } })]);
  const lista: CanalMonitorado[] = [];
  if (conexao?.channel_id) {
    lista.push({ ref: "own", url: `https://www.youtube.com/channel/${conexao.channel_id}`, proprio: true, nomeSalvo: conexao.channel_title, avatarSalvo: conexao.channel_thumbnail, cache: await lerCache("own") });
  }
  for (const r of refs) {
    lista.push({ ref: `ref:${r.id}`, url: r.url, proprio: false, refId: r.id, nicho: r.niche, nomeSalvo: r.name, avatarSalvo: r.avatarUrl, cache: await lerCache(`ref:${r.id}`) });
  }
  return lista;
}
