import path from "node:path";
import { existsSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { prisma } from "@docupulse/db";
import { FFMPEG, absPath, hasWhisperFilter, run, storageRoot } from "@docupulse/providers";
import type { JobContext } from "../queue";

interface Word { text: string; startMs: number; endMs: number }

/**
 * ALIGN_CAPTIONS: gera timestamps por palavra para cada faixa de voz.
 * 1) Se o FFmpeg tiver o filtro whisper e o modelo existir em storage/models/ggml-base.bin,
 *    usa os segmentos do whisper e distribui as palavras dentro de cada segmento.
 * 2) Senão, distribui proporcionalmente ao tamanho das palavras na duração da faixa.
 * payload: { projectId }
 */
export async function alignCaptions(ctx: JobContext) {
  const projectId = String(ctx.payload.projectId ?? ctx.job.projectId ?? "");
  const script = await prisma.script.findFirst({ where: { projectId }, orderBy: { version: "desc" }, include: { blocks: { orderBy: { order: "asc" }, include: { voiceTracks: true } } } });
  if (!script) throw new Error("Sem roteiro");
  const model = path.join(storageRoot(), "models", "ggml-base.bin");
  const whisper = (await hasWhisperFilter()) && existsSync(model);
  await ctx.log(whisper ? "Whisper (FFmpeg) disponível: alinhamento por segmentos" : "Whisper indisponível (modelo ausente): alinhamento proporcional");

  const tracks = script.blocks.flatMap((b) => b.voiceTracks.map((t) => ({ t, b })));
  if (!tracks.length) throw new Error("Sintetize a locução antes de alinhar as legendas.");
  let mode = whisper ? "whisper" : "proportional";

  for (let i = 0; i < tracks.length; i++) {
    const { t, b } = tracks[i];
    await ctx.progress({ percent: (i / tracks.length) * 95, message: `Ato ${b.act}: alinhando` });
    const clean = b.narration.replace(/\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim();
    const words = clean.split(" ").filter(Boolean);
    let result: Word[] | null = null;
    if (whisper) {
      try {
        result = await alignWithWhisper(absPath(t.filePath), model, words, t.durationMs);
      } catch (err) {
        await ctx.log(`Ato ${b.act}: whisper falhou (${String(err).slice(0, 120)}); usando proporcional`);
        mode = "mixed";
      }
    }
    if (!result) result = proportional(words, t.durationMs);
    await prisma.caption.deleteMany({ where: { voiceTrackId: t.id } });
    await prisma.caption.create({ data: { voiceTrackId: t.id, words: JSON.stringify(result) } });
  }
  await ctx.log(`Legendas alinhadas (${mode}) para ${tracks.length} faixa(s)`);
  return { tracks: tracks.length, mode };
}

function proportional(words: string[], durationMs: number): Word[] {
  const weights = words.map((w) => Math.max(1, w.replace(/[^\p{L}\p{N}]/gu, "").length) + 1.5);
  const total = weights.reduce((s, w) => s + w, 0);
  let t = 0;
  return words.map((w, i) => {
    const d = (weights[i] / total) * durationMs;
    const out = { text: w, startMs: Math.round(t), endMs: Math.round(t + d) };
    t += d;
    return out;
  });
}

async function alignWithWhisper(audio: string, model: string, words: string[], durationMs: number): Promise<Word[]> {
  const out = `${audio}.whisper.json`;
  await run(FFMPEG, ["-y", "-hide_banner", "-loglevel", "error", "-i", audio, "-af", `whisper=model=${model.replace(/\\/g, "/")}:language=pt:queue=3:destination=${out.replace(/\\/g, "/")}:format=json`, "-f", "null", "-"]);
  const raw = await readFile(out, "utf8").catch(() => "");
  await rm(out).catch(() => {});
  // O filtro grava um objeto JSON por linha: {"start":ms,"end":ms,"text":"..."}
  const segs = raw
    .split(/\r?\n/)
    .filter((l) => l.trim().startsWith("{"))
    .map((l) => JSON.parse(l) as { start: number; end: number; text: string })
    .filter((s) => s.text?.trim());
  if (!segs.length) throw new Error("whisper sem segmentos");
  // Distribui as palavras do roteiro pelos segmentos proporcionalmente ao texto reconhecido
  const totalChars = segs.reduce((s, x) => s + x.text.trim().length, 0);
  const result: Word[] = [];
  let wi = 0;
  for (let si = 0; si < segs.length; si++) {
    const seg = segs[si];
    const share = seg.text.trim().length / totalChars;
    const count = si === segs.length - 1 ? words.length - wi : Math.max(1, Math.round(share * words.length));
    const chunk = words.slice(wi, wi + count);
    wi += chunk.length;
    const start = Number(seg.start) < 1000 && Number(seg.end) < 1000 && durationMs > 2000 ? Number(seg.start) * 1000 : Number(seg.start);
    const end = Number(seg.end) < 1000 && durationMs > 2000 ? Number(seg.end) * 1000 : Number(seg.end);
    for (const w of proportional(chunk, Math.max(200, end - start))) result.push({ text: w.text, startMs: Math.round(start + w.startMs), endMs: Math.round(start + w.endMs) });
    if (wi >= words.length) break;
  }
  if (wi < words.length) {
    const last = result[result.length - 1]?.endMs ?? 0;
    for (const w of proportional(words.slice(wi), Math.max(500, durationMs - last))) result.push({ text: w.text, startMs: last + w.startMs, endMs: last + w.endMs });
  }
  return result;
}
