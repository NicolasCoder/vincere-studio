import path from "node:path";
import { existsSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { prisma } from "@vincere-studio/db";
import { FFMPEG, absPath, hasWhisperFilter, run, storageRoot } from "@vincere-studio/providers";
import type { JobContext } from "../queue";

interface Word { text: string; startMs: number; endMs: number }

const PC_GPU_BRIDGECandidates = [
  path.resolve(process.cwd(), "scripts", "pc-gpu-bridge.py"),
  path.resolve(process.cwd(), "..", "..", "scripts", "pc-gpu-bridge.py"),
];

function resolvePcGpuBridge(): string | null {
  for (const p of PC_GPU_BRIDGECandidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

async function alignWithPcGpuWhisper(audioPath: string, bridgeScript: string): Promise<Word[] | null> {
  return new Promise((resolve) => {
    const payload = JSON.stringify({ audioPath, model: "base", language: "pt" });
    const proc = spawn("python", [bridgeScript, "transcribe", "--payload", payload], {
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      windowsHide: true,
    });
    let stdout = "";
    proc.stdout.on("data", (d) => {
      stdout += String(d);
    });
    proc.on("error", () => resolve(null));
    proc.on("close", () => {
      const lines = stdout
        .trim()
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      const last = lines[lines.length - 1] ?? "";
      try {
        const parsed = JSON.parse(last) as {
          ok?: boolean;
          words?: { word: string; start: number; end: number }[];
        };
        if (parsed.ok && Array.isArray(parsed.words) && parsed.words.length > 0) {
          resolve(
            parsed.words.map((w) => ({
              text: w.word,
              startMs: Math.round(Number(w.start) * 1000),
              endMs: Math.round(Number(w.end) * 1000),
            })),
          );
          return;
        }
      } catch {}
      resolve(null);
    });
  });
}

/**
 * ALIGN_CAPTIONS: gera timestamps por palavra para cada faixa de voz.
 * 0) Prioriza o Faster-Whisper na GPU Local do PC (`scripts/pc-gpu-bridge.py transcribe`, RTX 3060 CUDA float16)
 *    para obter timestamps exatos por palavra em fração de segundo.
 * 1) Se o FFmpeg tiver o filtro whisper e o modelo existir em storage/models/ggml-base.bin,
 *    usa os segmentos do whisper e distribui as palavras dentro de cada segmento.
 * 2) Senão, distribui proporcionalmente ao tamanho das palavras na duração da faixa.
 * payload: { projectId }
 */
export async function alignCaptions(ctx: JobContext) {
  const projectId = String(ctx.payload.projectId ?? ctx.job.projectId ?? "");
  const script = await prisma.script.findFirst({ where: { projectId }, orderBy: { version: "desc" }, include: { blocks: { orderBy: { order: "asc" }, include: { voiceTracks: true } } } });
  if (!script) throw new Error("Sem roteiro");
  const pcBridge = resolvePcGpuBridge();
  const model = path.join(storageRoot(), "models", "ggml-base.bin");
  const whisper = (await hasWhisperFilter()) && existsSync(model);
  await ctx.log(
    pcBridge
      ? "PC GPU Faster-Whisper (RTX 3060 CUDA) disponível: alinhamento exato palavra a palavra"
      : whisper
        ? "Whisper (FFmpeg) disponível: alinhamento por segmentos"
        : "Whisper indisponível (modelo ausente): alinhamento proporcional",
  );

  const tracks = script.blocks.flatMap((b) => b.voiceTracks.map((t) => ({ t, b })));
  if (!tracks.length) throw new Error("Sintetize a locução antes de alinhar as legendas.");
  let mode = pcBridge ? "pc_gpu_whisper" : whisper ? "whisper" : "proportional";

  for (let i = 0; i < tracks.length; i++) {
    const { t, b } = tracks[i];
    await ctx.progress({ percent: (i / tracks.length) * 95, message: `Ato ${b.act}: alinhando` });
    const clean = b.narration.replace(/\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim();
    const words = clean.split(" ").filter(Boolean);
    let result: Word[] | null = null;
    if (pcBridge) {
      result = await alignWithPcGpuWhisper(absPath(t.filePath), pcBridge).catch(() => null);
    }
    if (!result && whisper) {
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
  const esc = (p: string) => p.replace(/\\/g, "/").replace(/:/g, "\\:");
  await run(FFMPEG, ["-y", "-hide_banner", "-loglevel", "error", "-i", audio, "-af", `whisper=model=${esc(model)}:language=pt:queue=3:destination=${esc(out)}:format=json`, "-f", "null", "-"]);
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
    const start = Number(seg.start);
    const next = segs[si + 1];
    // Janelas do whisper se sobrepõem; o fim útil de um segmento é o início do próximo.
    const end = Math.min(Number(seg.end), next ? Number(next.start) : durationMs, durationMs);
    for (const w of proportional(chunk, Math.max(200, end - start))) result.push({ text: w.text, startMs: Math.round(start + w.startMs), endMs: Math.round(start + w.endMs) });
    if (wi >= words.length) break;
  }
  if (wi < words.length) {
    const last = result[result.length - 1]?.endMs ?? 0;
    for (const w of proportional(words.slice(wi), Math.max(500, durationMs - last))) result.push({ text: w.text, startMs: last + w.startMs, endMs: last + w.endMs });
  }
  return result;
}
