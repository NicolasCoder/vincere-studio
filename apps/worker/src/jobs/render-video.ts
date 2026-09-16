import path from "node:path";
import { existsSync } from "node:fs";
import { readdir, rm, stat, unlink } from "node:fs/promises";
import { prisma } from "@docupulse/db";
import { captionPresetFor, getVisualStyle, type VideoFormat, type Intensidade, eixosDe, legendaDe } from "@docupulse/core";
import { absPath, auditRenderedVideo, probeDurationMs, projectDir, relPath, storageRoot } from "@docupulse/providers";
import { ACT_GAP_MS, amostrarTimeline, borrowNeighborMedia, ensureProceduralMusic, fitScenesToVoice, profileFor, randomizeVideoOffsets, renderTimeline, type Timeline, type TimelineScene } from "@docupulse/render";
import type { JobContext } from "../queue";

// Quantos renders finais (mp4) manter por projeto — os mais antigos são apagados
// automaticamente depois de um render novo bem-sucedido, pra não acumular espaço em disco
// à toa (o histórico de "Renders" na UI já mostra o registro no banco, só o arquivo grande some).
const KEEP_LAST_RENDERS = 3;

type AlignedWord = { text: string; startMs: number; endMs: number };

/** Legenda vazia ou corrompida deve falhar no pré-voo, não durante o FFmpeg. */
function parseAlignedWords(raw?: string | null): AlignedWord[] {
  try {
    const parsed = JSON.parse(raw ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((word): word is AlignedWord => {
      if (!word || typeof word !== "object") return false;
      const item = word as Partial<AlignedWord>;
      return typeof item.text === "string" && item.text.trim().length > 0
        && Number.isFinite(item.startMs) && Number.isFinite(item.endMs)
        && Number(item.endMs) > Number(item.startMs);
    });
  } catch {
    return [];
  }
}

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
  const style = getVisualStyle(project.visualStyle);
  const profile = profileFor(project.format, ctx.payload.profile as string | undefined);
  const wantCaptions = ctx.payload.captions !== false;
  const captionPreset = captionPresetFor(ctx.payload.captionPreset, project.format as VideoFormat, legendaDe(null));

  const script = await prisma.script.findFirst({ where: { projectId }, orderBy: { version: "desc" }, include: { blocks: { orderBy: { order: "asc" }, include: { voiceTracks: { include: { captions: true } }, scenes: { orderBy: { order: "asc" } } } } } });
  if (!script) throw new Error("Sem roteiro");
  const missingVoice = script.blocks.filter((b) => !b.voiceTracks.length);
  if (missingVoice.length) throw new Error(`Sintetize a locução dos atos ${missingVoice.map((b) => b.act).join(", ")} antes de renderizar.`);
  const missingCaptions = script.blocks.filter((b) => parseAlignedWords(b.voiceTracks[0]?.captions[0]?.words).length === 0);
  if (wantCaptions && missingCaptions.length) {
    throw new Error(
      `Alinhe as legendas dos atos ${missingCaptions.map((b) => b.act).join(", ")} no Passo 3 antes de renderizar com legendas.`,
    );
  }

  /**
   * Render de prova: janelas curtas de atos diferentes, pelo mesmo caminho do render final.
   *
   * Não cria linha em RenderJob de propósito. O master é definido como "o último RenderJob com
   * outputPath" — uma prova registrada ali viraria o master do projeto e seria publicada no lugar
   * do vídeo. Prova também não mexe na etapa do projeto.
   */
  const prova = ctx.payload.preview === true;

  const renderJob = prova ? null : await prisma.renderJob.create({ data: { projectId, profile: profile.id, startedAt: new Date(), progress: 0 } });
  const appendLog = async (line: string) => {
    await ctx.log(line);
    if (!renderJob) return;
    await prisma.$executeRaw`UPDATE "RenderJob" SET log = log || ${line + "\n"} WHERE id = ${renderJob.id}`;
  };

  let brokenMediaRefs = 0;
  const acts = script.blocks.map((b) => {
    const t = b.voiceTracks[0];
    const words = parseAlignedWords(t.captions[0]?.words);
    const scenes: TimelineScene[] = b.scenes.map((s) => {
      const resolved = s.filePath ? absPath(s.filePath) : null;
      const usable = resolved && existsSync(resolved) ? resolved : null;
      if (s.filePath && !usable) brokenMediaRefs++;
      return {
        id: s.id,
        file: usable,
        mediaType: (s.mediaType as "image" | "video") ?? "image",
        durationMs: Math.max(1, s.endMs - s.startMs),
        motion: (JSON.parse(s.motion || "{}").kind as TimelineScene["motion"]) ?? style.motion,
        title: b.title, // cartão de título em português (o prompt em inglês fica só para geração)
        mediaDurationMs: s.durationMs,
      };
    });
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

  let timeline: Timeline = { acts, gapMs: ACT_GAP_MS, musicFile };
  const missing = acts.reduce((s, a) => s + a.scenes.filter((x) => !x.file).length, 0);
  const borrowed = acts.reduce((s, a) => s + a.scenes.filter((x) => x.borrowed).length, 0);
  await appendLog(`Timeline: ${acts.length} atos · ${acts.reduce((s, a) => s + a.scenes.length, 0)} cenas (${borrowed} herdadas da vizinha, ${missing} cartão) · perfil ${profile.label} · trilha ${musicFile ? path.basename(musicFile) : "nenhuma"}`);
  if (brokenMediaRefs) await appendLog(`Pré-voo: ${brokenMediaRefs} arquivo(s) de mídia não existem mais; aplicado fallback seguro.`);

  const outDir = await projectDir(projectId, prova ? "previews" : "renders");
  const workDir = await projectDir(projectId, "renders/work");
  const outFile = path.join(outDir, `${prova ? "prova" : profile.id.toLowerCase()}-${Date.now()}.mp4`);
  const captions = wantCaptions ? captionPreset.mode : "none";
  await appendLog(`Legendas: ${wantCaptions ? captionPreset.label : "desativadas"}`);

  if (prova) {
    const janelaMs = Number(ctx.payload.janelaMs ?? 7000);
    const maxAtos = Number(ctx.payload.maxAtos ?? 3);
    timeline = await amostrarTimeline(timeline, { janelaMs, maxAtos, workDir });
    const amostraSec = timeline.acts.reduce((s, a) => s + a.voiceDurationMs, 0) / 1000;
    await appendLog(`Prova: ${timeline.acts.length} janela(s) de ${(janelaMs / 1000).toFixed(0)}s (atos ${timeline.acts.map((a) => a.act).join(", ")}) · ${Math.round(amostraSec)}s no total`);
  }

  // O eixo de transições vem do perfil de edição, mesma fonte que o plano visual usa. Sem isso,
  // pedir um vídeo "mais calmo" mudaria as inserções e deixaria os cortes no mesmo ritmo.
  const eixos = eixosDe(null, project.format as VideoFormat, project.intensidade as Intensidade);
  const res = await renderTimeline(timeline, {
    profile,
    captions,
    workDir,
    outFile,
    transicoesPct: eixos.transicoes,
    legenda: captionPreset.style,
    onLog: appendLog,
    onProgress: async (p) => {
      await ctx.progress(p);
      if (renderJob) await prisma.renderJob.update({ where: { id: renderJob.id }, data: { progress: Math.round(p.percent) } });
    },
  });
  const durationMs = await probeDurationMs(outFile);
  const qualityAudit = await auditRenderedVideo(outFile);
  await appendLog(`Auditoria: ${qualityAudit.blackSegments} trecho(s) preto(s), maior ${qualityAudit.longestBlackSec.toFixed(1)}s · ${qualityAudit.silenceSegments} silêncio(s), maior ${qualityAudit.longestSilenceSec.toFixed(1)}s`);
  if (qualityAudit.longestBlackSec >= 1 || qualityAudit.longestSilenceSec >= 3) {
    await appendLog("⚠ Revisão recomendada: o master contém quadro preto >=1s ou silêncio >=3s.");
  }

  if (renderJob) {
    await prisma.renderJob.update({ where: { id: renderJob.id }, data: { progress: 100, outputPath: relPath(outFile), finishedAt: new Date() } });
    await prisma.project.update({ where: { id: projectId }, data: { stage: project.stage === "MEDIA" || project.stage === "RENDER" ? "RENDER" : project.stage } });
  }
  await appendLog(
    prova
      ? `Prova pronta: ${relPath(outFile)} · ${(durationMs / 1000).toFixed(0)}s · encoder ${res.encoder}`
      : `Render concluído: ${relPath(outFile)} · ${(durationMs / 1000 / 60).toFixed(1)} min · encoder ${res.encoder}`,
  );

  // Limpeza automática pós-render: arquivos de trabalho do ffmpeg (sempre) e renders
  // antigos demais (mantendo os mais recentes) — evita acumular gigabytes à toa a cada render.
  await cleanupWorkDir(workDir, appendLog);
  // Provas também acumulam: cada ajuste gera uma, e são dezenas de MB cada.
  await pruneOldRenders(outDir, outFile, appendLog);

  return { outputPath: relPath(outFile), durationMs, encoder: res.encoder, renderJobId: renderJob?.id ?? null, preview: prova, qualityAudit };
}
