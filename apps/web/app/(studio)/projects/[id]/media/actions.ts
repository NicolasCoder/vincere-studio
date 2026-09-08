"use server";
import path from "node:path";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@docupulse/db";
import { FORMATS, sceneFileStem, type VideoFormat } from "@docupulse/core";
import { downloadTo, getStockProviders, probeDurationMs, projectDir, relPath, type StockAsset } from "@docupulse/providers";

const REROLL_STOPWORDS = new Set(["the", "a", "an", "of", "in", "on", "at", "to", "for", "and", "or", "with", "from", "by", "is", "are", "this", "that", "scene", "shot", "footage", "video", "image", "close", "up", "wide", "view"]);
function rerollTerms(keywords: string | null, description: string | null): string[] {
  const raw = `${keywords ?? ""} ${description ?? ""}`.toLowerCase();
  return Array.from(new Set(raw.split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !REROLL_STOPWORDS.has(w))));
}
function rerollScore(asset: { tags?: string; pageUrl?: string }, terms: string[]): number {
  if (!terms.length) return 0;
  const haystack = `${asset.tags ?? ""} ${asset.pageUrl ?? ""}`.toLowerCase();
  return haystack.trim() ? terms.reduce((s, t) => (haystack.includes(t) ? s + 1 : s), 0) : 0;
}

const back = (projectId: string, job?: string) => redirect(`/projects/${projectId}/media${job ? `?job=${job}` : ""}`);
async function enqueue(projectId: string, type: string, payload: Record<string, unknown> = {}) {
  const job = await prisma.job.create({ data: { type, projectId, payload: JSON.stringify({ projectId, ...payload }) } });
  back(projectId, job.id);
}

export async function synthesizeVoice(projectId: string, blockIds: string[] = [], force = false) {
  await enqueue(projectId, "SYNTHESIZE_VOICE", { ...(blockIds.length ? { blockIds } : {}), force });
}
export async function alignCaptions(projectId: string) {
  await enqueue(projectId, "ALIGN_CAPTIONS");
}
export async function generateScenePrompts(projectId: string, density: "dense" | "sparse" = "dense") {
  await enqueue(projectId, "GENERATE_SCENE_PROMPTS", { density });
}
export async function importInbox(projectId: string) {
  await enqueue(projectId, "IMPORT_INBOX");
}
export async function huntBroll(projectId: string, onlyPreferVideo = false) {
  await enqueue(projectId, "HUNT_BROLL", { onlyPreferVideo });
}
export async function setVoiceProfile(projectId: string, formData: FormData) {
  const voiceProfileId = String(formData.get("voiceProfileId") ?? "") || null;
  await prisma.project.update({ where: { id: projectId }, data: { voiceProfileId } });
  revalidatePath(`/projects/${projectId}/media`);
}
export async function setVisualStyle(projectId: string, formData: FormData) {
  await prisma.project.update({ where: { id: projectId }, data: { visualStyle: String(formData.get("visualStyle") ?? "DARK_DOC") } });
  revalidatePath(`/projects/${projectId}/media`);
}
export async function clearScene(projectId: string, sceneId: string) {
  await prisma.scene.update({ where: { id: sceneId }, data: { filePath: null, status: "PENDING", source: "GENERATED", provider: "FLOW_MANUAL", thumbPath: null } });
  revalidatePath(`/projects/${projectId}/media`);
}

/**
 * Revisão manual (Passo 3): troca a mídia de UMA cena na hora, sem passar pela fila de jobs.
 * Usa as mesmas keywords da cena (ou um termo de busca digitado pelo usuário) e a mesma
 * pontuação de relevância por sobreposição de tags do HUNT_BROLL, mas nunca repete o
 * asset atual da cena — sempre troca por outra opção do acervo.
 */
export async function rerollScene(projectId: string, sceneId: string, formData: FormData) {
  const custom = String(formData.get("keywords") ?? "").trim();
  const scene = await prisma.scene.findUnique({ where: { id: sceneId }, include: { block: true } });
  if (!scene) return;
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const format = FORMATS[project.format as VideoFormat];
  const providers = getStockProviders();
  if (!providers.length) {
    revalidatePath(`/projects/${projectId}/media`);
    return;
  }
  const minDur = Math.ceil((scene.endMs - scene.startMs) / 1000);
  const keywords = custom || scene.keywords || scene.description || "";
  const terms = rerollTerms(keywords, scene.description);
  const excludeKey = scene.provider && scene.providerRef ? `${scene.provider}:${scene.providerRef}` : null;
  let hit: StockAsset | null = null;
  for (const type of scene.preferVideo ? (["video", "image"] as const) : (["image", "video"] as const)) {
    const pool: StockAsset[] = [];
    for (const p of providers) {
      try {
        const results = await p.search({ keywords, orientation: format.broll.imageOrientation, type, minDurationSec: type === "video" ? minDur : undefined }, 10);
        pool.push(...results.filter((r) => `${r.provider}:${r.id}` !== excludeKey));
      } catch {
        // ignora falha de um provedor e segue com o outro
      }
    }
    if (pool.length) {
      const scored = pool.map((r, i) => ({ r, score: rerollScore(r, terms), i }));
      scored.sort((a, b) => b.score - a.score || a.i - b.i);
      hit = scored[0].r;
      break;
    }
  }
  if (!hit) {
    revalidatePath(`/projects/${projectId}/media`);
    return;
  }
  const dir = await projectDir(projectId, "scenes");
  const ext = hit.type === "video" ? ".mp4" : ".jpg";
  const dest = path.join(dir, `${sceneFileStem(scene.block.act, scene.order)}${ext}`);
  await downloadTo(hit.url, dest);
  const durationMs = hit.type === "video" ? await probeDurationMs(dest).catch(() => null) : null;
  await prisma.scene.update({
    where: { id: sceneId },
    data: {
      filePath: relPath(dest),
      mediaType: hit.type,
      source: "STOCK",
      provider: hit.provider,
      providerRef: hit.id,
      sourceUrl: hit.pageUrl,
      width: hit.width,
      height: hit.height,
      durationMs,
      status: "READY",
      license: `${hit.license}${hit.author ? ` · ${hit.author}` : ""}`,
      ...(custom ? { keywords: custom } : {}),
    },
  });
  revalidatePath(`/projects/${projectId}/media`);
}
