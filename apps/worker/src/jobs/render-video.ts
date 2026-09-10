import path from "node:path";
import { existsSync } from "node:fs";
import { readdir, rm, stat, unlink } from "node:fs/promises";
import { prisma } from "@docupulse/db";
import { FORMATS, getVisualStyle, type VideoFormat } from "@docupulse/core";
import { absPath, probeDurationMs, projectDir, relPath, storageRoot } from "@docupulse/providers";
import { ACT_GAP_MS, borrowNeighborMedia, ensureProceduralMusic, fitScenesToVoice, profileFor, randomizeVideoOffsets, renderTimeline, type Timeline, type TimelineScene } from "@docupulse/render";
import type { JobContext } from "../queue";

// Quantos renders finais (mp4) manter por projeto — os mais antigos são apagados
// automaticamente depois de um render novo bem-sucedido, pra não acumular espaço em disco
// à toa (o histórico de "Renders" na UI já mostra o registro no banco, só o arquivo grande some).
const KEEP_LAST_RENDERS = 3;

async function cleanupWorkDir(workDir: string, log: (line: string) => Promise<void>) {
  // renders/work/ guarda só arquivos intermediários do ffmpeg (mix.wav, video-all.mp4, act-*.mp4 etc.)
  // — são recriados do zero a cada render, então não têm valor nenhum depois que o MP4 final sai.
  try {
    if (!existsSync(workDir)) return;
    const before = await readdir(workDir).catch(() => []);
    if (!before.length) return;
    await rm(workDir, { recursive: true, force: true });
    await log(`Limpeza: removidos ${before.length} arquivo(s) temporário(s) de renders/work`);
  } catch (err) {
    await log(`Limpeza de renders/work falhou (não crítico): ${(err as Error).message}`);
  }
}

async function pruneOldRenders(outDir: string, keptOutFile: string, log: (line: string) => Promise<void>) {
  try {
    const entries = await readdir(outDir).catch(() => []);
    const mp4s = entries.filter((f) => f.endsWith(".mp4") && path.join(outDir, f) !== keptOutFile);
    if (mp4s.length <= KEEP_LAST_RENDERS - 1) return;
    const withTimes = await Promise.all(
      mp4s.map(async (f) => {
        const full = path.join(outDir, f);
        const s = await stat(full);
        return { full, mtime: s.mtimeMs };
      }),
    );
    withTimes.sort((a, b) => b.mtime - a.mtime);
    const toDelete = withTimes.slice(KEEP_LAST_RENDERS - 1);
    for (const f of toDelete) await unlink(f.full).catch(() => {});
    if (toDelete.length) await log(`Limpeza: removidos ${toDelete.length} render(s) antigo(s) (mantendo os ${KEEP_LAST_RENDERS} mais recentes)`);
  } catch (err) {
    await log(`Limpeza de renders antigos falhou (não crítico): ${(err as Error).message}`);
  }
}

/**
 * RENDER_VIDEO: monta a timeline (voz + cenas + legendas) e renderiza o MP4 final.
 * payload: { projectId, profile?: "YOUTUBE_1080"|"SHORTS_1080x1920"|"WEB_720", captions?: boolean, renderJobId? }
 */
export async function renderVideo(ctx: JobContext) {
  const projectId = String(ctx.payload.projectId ?? ctx.job.projectId ?? "");
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error("Projeto não encontrado");
  const format = FORMATS[project.format as VideoFormat];
  const style = getVisualStyle(project.visualStyle);
  const profile = profileFor(project.format, ctx.payload.profile as string | undefined);
  const wantCaptions = ctx.payload.captions !== false;

  const script = await prisma.script.findFirst({ where: { projectId }, orderBy: { version: "desc" }, include: { blocks: { orderBy: { order: "asc" }, include: { voiceTracks: { include: { captions: true } }, scenes: { orderBy: { order: "asc" } } } } } });
  if (!script) throw new Error("Sem roteiro");
  const missingVoice = script.blocks.filter((b) => !b.voiceTracks.length);
  if (missingVoice.length) throw new Error(`Sintetize a locução dos atos ${missingVoice.map((b) => b.act).join(", ")} antes de renderizar.`);

  const renderJob = await prisma.renderJob.create({ data: { projectId, profile: profile.id, startedAt: new Date(), progress: 0 } });
  const appendLog = async (line: string) => {
    await ctx.log(line);
    await prisma.$executeRaw`UPDATE "RenderJob" SET log = log || ${line + "\n"} WHERE id = ${renderJob.id}`;
  };

  const acts = script.blocks.map((b) => {
    const t = b.voiceTracks[0];
    const words = JSON.parse(t.captions[0]?.words ?? "[]") as { text: string; startMs: number; endMs: number }[];
    const scenes: TimelineScene[] = b.scenes.map((s) => ({
      id: s.id,
      file: s.filePath ? absPath(s.filePath) : null,
      mediaType: (s.mediaType as "image" | "video") ?? "image",
      durationMs: Math.max(1, s.endMs - s.startMs),
      motion: (JSON.parse(s.motion || "{}").kind as TimelineScene["motion"]) ?? style.motion,
      title: b.title, // cartão de título em português (o prompt em inglês fica só para geração)
      mediaDurationMs: s.durationMs,
    }));
    const fitted = fitScenesToVoice(scenes.length ? scenes : [{ id: `card-${b.id}`, file: null, mediaType: "image" as const, durationMs: t.durationMs, motion: "static" as const, title: b.title }], t.durationMs);
    return { act: b.act, title: b.title, voiceFile: absPath(t.filePath), voiceDurationMs: t.durationMs, scenes: randomizeVideoOffsets(borrowNeighborMedia(fitted)), words };
  });

  // Trilha: storage/music/<projeto>.mp3 ou storage/music/default.mp3 (opcional)
  const musicDir = path.join(storageRoot(), "music");
  let musicFile: string | null = null;
  if (existsSync(musicDir)) {
    const files = await readdir(musicDir);
    const pick = files.find((f) => f.startsWith(projectId)) ?? files.find((f) => /^default\.(mp3|wav|m4a)$/i.test(f));
    if (pick) musicFile = path.join(musicDir, pick);
  }
  // Sem trilha do usuário: gera uma cama ambiente procedural no estilo do projeto (payload.music=false desliga)
  if (!musicFile && ctx.payload.music !== false) {
    musicFile = await ensureProceduralMusic(musicDir, project.visualStyle, 180, projectId);
    await ctx.log(`Trilha procedural: ${path.basename(musicFile)}`);
  }

  const timeline: Timeline = { acts, gapMs: ACT_GAP_MS, musicFile };
  const missing = acts.reduce((s, a) => s + a.scenes.filter((x) => !x.file).length, 0);
  const borrowed = acts.reduce((s, a) => s + a.scenes.filter((x) => x.borrowed).length, 0);
  await appendLog(`Timeline: ${acts.length} atos · ${acts.reduce((s, a) => s + a.scenes.length, 0)} cenas (${borrowed} herdadas da vizinha, ${missing} cartão) · perfil ${profile.label} · trilha ${musicFile ? path.basename(musicFile) : "nenhuma"}`);

  const outDir = await projectDir(projectId, "renders");
  const workDir = await projectDir(projectId, "renders/work");
  const outFile = path.join(outDir, `${profile.id.toLowerCase()}-${Date.now()}.mp4`);
  const captions = wantCaptions ? format.captions.style : "none";

  const res = await renderTimeline(timeline, {
    profile,
    captions,
    workDir,
    outFile,
    onLog: appendLog,
    onProgress: async (p) => {
      await ctx.progress(p);
      await prisma.renderJob.update({ where: { id: renderJob.id }, data: { progress: Math.round(p.percent) } });
    },
  });
  const durationMs = await probeDurationMs(outFile);
  await prisma.renderJob.update({ where: { id: renderJob.id }, data: { progress: 100, outputPath: relPath(outFile), finishedAt: new Date() } });
  await prisma.project.update({ where: { id: projectId }, data: { stage: project.stage === "MEDIA" || project.stage === "RENDER" ? "RENDER" : project.stage } });
  await appendLog(`Render concluído: ${relPath(outFile)} · ${(durationMs / 1000 / 60).toFixed(1)} min · encoder ${res.encoder}`);

  // Limpeza automática pós-render: arquivos de trabalho do ffmpeg (sempre) e renders
  // antigos demais (mantendo os mais recentes) — evita acumular gigabytes à toa a cada render.
  await cleanupWorkDir(workDir, appendLog);
  await pruneOldRenders(outDir, outFile, appendLog);

  return { outputPath: relPath(outFile), durationMs, encoder: res.encoder, renderJobId: renderJob.id };
}
