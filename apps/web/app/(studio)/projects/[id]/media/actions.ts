"use server";
import path from "node:path";
import { writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@vincere-studio/db";
import { CAPTION_PRESET_IDS, FORMATS, sceneFileStem, type VideoFormat } from "@vincere-studio/core";
import { absPath, downloadTo, getStockProviders, probeDurationMs, probeMediaInfo, projectDir, relPath, type StockAsset } from "@vincere-studio/providers";
import { captionStyleFromForm } from "../render/caption-style";

const REROLL_STOPWORDS = new Set(["the", "a", "an", "of", "in", "on", "at", "to", "for", "and", "or", "with", "from", "by", "is", "are", "this", "that", "scene", "shot", "footage", "video", "image", "close", "up", "wide", "view"]);
function rerollTerms(keywords: string | null, description: string | null): string[] {
  const raw = `${keywords ?? ""} ${description ?? ""}`.toLowerCase();
  return Array.from(new Set(raw.split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !REROLL_STOPWORDS.has(w))));
}
/**
 * Pontua por sobreposição de tags/URL. Termos-âncora (tema do projeto inteiro) valem o dobro dos
 * termos só da cena — sem isso, uma keyword literal e isolada da cena (ex.: "disco girando" numa
 * frase sobre "girar" a situação) conseguia nota alta contra si mesma e trazia mídia fora do tema
 * do vídeo inteiro, mesmo com resultado tecnicamente "relevante" pra aquela palavra solta.
 */
function rerollScore(asset: { tags?: string; pageUrl?: string }, terms: string[], anchorTerms: string[]): { score: number; anchorHits: number; sceneHits: number } {
  const haystack = `${asset.tags ?? ""} ${asset.pageUrl ?? ""}`.toLowerCase();
  if (!haystack.trim()) return { score: 0, anchorHits: 0, sceneHits: 0 };
  const anchorHits = anchorTerms.reduce((s, t) => (haystack.includes(t) ? s + 1 : s), 0);
  const sceneHits = terms.reduce((s, t) => (haystack.includes(t) ? s + 1 : s), 0);
  return { score: anchorHits * 2 + sceneHits, anchorHits, sceneHits };
}
/** Termos mais recorrentes nas keywords do roteiro inteiro, pra ancorar a busca no tema do projeto. */
function rerollThemeAnchor(allKeywords: (string | null)[], minCount = 2, take = 3): string[] {
  const counts = new Map<string, number>();
  for (const kw of allKeywords) for (const t of rerollTerms(kw, null)) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()].filter(([, c]) => c >= minCount).sort((a, b) => b[1] - a[1]).slice(0, take).map(([t]) => t);
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
/**
 * Cenas cujo arquivo sumiu do disco (limpeza antiga, migração) continuam com filePath e por isso
 * o HUNT_BROLL as pula. Aqui elas voltam a "sem mídia" e, havendo chave de acervo, a busca roda.
 */
export async function repairMissingMedia(projectId: string) {
  const scenes = await prisma.scene.findMany({
    where: { filePath: { not: null }, block: { script: { projectId } } },
    select: { id: true, filePath: true },
  });
  const sumidas = scenes.filter((s) => s.filePath && !existsSync(absPath(s.filePath))).map((s) => s.id);
  if (sumidas.length) {
    await prisma.scene.updateMany({
      where: { id: { in: sumidas } },
      data: { filePath: null, status: "PENDING", thumbPath: null, durationMs: null },
    });
  }
  if (sumidas.length && getStockProviders().length) {
    await enqueue(projectId, "HUNT_BROLL", { onlyPreferVideo: false });
  }
  revalidatePath(`/projects/${projectId}/media`);
  back(projectId);
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

/**
 * Mesmo destino do "saveCaption" do Passo 4 (grava captionPreset/captionStyle no projeto), só que
 * disparável aqui no Passo 3 — assim o modelo já vem certo quando o Passo 4 gerar o primeiro
 * render, sem precisar renderizar de novo só para trocar a legenda.
 */
export async function setCaptionStyle(projectId: string, formData: FormData) {
  const presetRaw = String(formData.get("captionPreset") ?? "auto");
  const captionPreset = (CAPTION_PRESET_IDS as readonly string[]).includes(presetRaw) ? presetRaw : "auto";
  const captionStyle = JSON.stringify(captionStyleFromForm(formData));
  await prisma.project.update({ where: { id: projectId }, data: { captionPreset, captionStyle } });
  revalidatePath(`/projects/${projectId}/media`);
  redirect(`/projects/${projectId}/media?saved=caption`);
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
  const siblingScenes = await prisma.scene.findMany({ where: { block: { script: { projectId } } }, select: { keywords: true } });
  const anchor = rerollThemeAnchor(siblingScenes.map((x) => x.keywords));
  const query = anchor.length ? `${keywords}, ${anchor.join(", ")}` : keywords;
  const excludeKey = scene.provider && scene.providerRef ? `${scene.provider}:${scene.providerRef}` : null;
  let hit: StockAsset | null = null;
  for (const type of scene.preferVideo ? (["video", "image"] as const) : (["image", "video"] as const)) {
    const pool: StockAsset[] = [];
    for (const p of providers) {
      try {
        const results = await p.search({ keywords: query, orientation: format.broll.imageOrientation, type, minDurationSec: type === "video" ? minDur : undefined }, 10);
        pool.push(...results.filter((r) => `${r.provider}:${r.id}` !== excludeKey));
      } catch {
        // ignora falha de um provedor e segue com o outro
      }
    }
    if (pool.length) {
      const scored = pool.map((r, i) => {
        const { score, anchorHits, sceneHits } = rerollScore(r, terms, anchor);
        return { r, score: score + (type === "video" && r.provider === "PIXABAY" ? 0.25 : 0), anchorHits, sceneHits, i };
      });
      scored.sort((a, b) => b.score - a.score || a.i - b.i);
      const top = scored[0];
      // Com âncora de tema definida, o resultado precisa bater com o tema do vídeo inteiro OU ter
      // pelo menos 2 termos próprios da cena — uma cena de paisagem legítima não precisa também
      // mencionar "dark/vintage/ocean"; só a palavra isolada e literal não pode validar a si mesma.
      if (anchor.length > 0 ? top.anchorHits === 0 && top.sceneHits < 2 : terms.length > 0 && top.score === 0) continue;
      hit = top.r;
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

/**
 * Upload manual (Passo 3): sobe a imagem/vídeo de UMA cena direto do navegador, sem precisar
 * salvar na pasta inbox e clicar em Importar — mesmo destino/nome de arquivo que o import usa.
 */
export async function uploadSceneMedia(projectId: string, sceneId: string, formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    revalidatePath(`/projects/${projectId}/media`);
    return;
  }
  const scene = await prisma.scene.findUnique({ where: { id: sceneId }, include: { block: true } });
  if (!scene) return;
  const isVideo = file.type.startsWith("video/");
  const extFromName = path.extname(file.name || "").toLowerCase();
  const ext = extFromName || (isVideo ? ".mp4" : ".jpg");
  const dir = await projectDir(projectId, "scenes");
  const dest = path.join(dir, `${sceneFileStem(scene.block.act, scene.order)}${ext}`);
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(dest, buf);
  const info = await probeMediaInfo(dest).catch(() => ({ durationMs: null, width: null, height: null }));
  const durationMs = isVideo ? info.durationMs : null;
  await prisma.scene.update({
    where: { id: sceneId },
    data: {
      filePath: relPath(dest),
      mediaType: isVideo ? "video" : "image",
      source: "IMPORTED",
      provider: "FLOW_MANUAL",
      providerRef: null,
      durationMs,
      width: info.width,
      height: info.height,
      status: "READY",
      license: "Gerado pelo usuário (GPT/Flow/Gemini)",
    },
  });
  revalidatePath(`/projects/${projectId}/media`);
}
