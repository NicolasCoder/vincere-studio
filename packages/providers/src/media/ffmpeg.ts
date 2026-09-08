import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/** Wrapper mínimo do FFmpeg/ffprobe (já instalados na máquina). */
export const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
export const FFPROBE = process.env.FFPROBE_PATH || "ffprobe";

export function run(cmd: string, args: string[], opts: { cwd?: string; onLine?: (l: string) => void } = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: opts.cwd, windowsHide: true });
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => { out += d.toString(); });
    p.stderr.on("data", (d) => {
      const s = d.toString();
      err += s;
      opts.onLine?.(s);
    });
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve(out || err) : reject(new Error(`${cmd} saiu com código ${code}: ${err.slice(-800)}`))));
  });
}

export async function probeDurationMs(file: string): Promise<number> {
  const out = await run(FFPROBE, ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", file]);
  return Math.round(parseFloat(out.trim()) * 1000) || 0;
}

/** Grava PCM 16-bit mono como WAV. */
export async function pcmToWav(pcm: Buffer, file: string, sampleRate = 24000) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, Buffer.concat([header, pcm]));
}

/** Concatena segmentos de áudio com silêncios entre eles e normaliza. */
export async function concatWithSilences(segments: { file: string; silenceAfterMs: number }[], out: string, opts: { normalize?: boolean; sampleRate?: number } = {}) {
  const sr = opts.sampleRate ?? 48000;
  const inputs: string[] = [];
  const filters: string[] = [];
  let idx = 0;
  const labels: string[] = [];
  for (const s of segments) {
    inputs.push("-i", s.file);
    filters.push(`[${idx}:a]aresample=${sr},aformat=sample_fmts=s16:channel_layouts=mono[a${idx}]`);
    labels.push(`[a${idx}]`);
    if (s.silenceAfterMs > 0) {
      filters.push(`anullsrc=r=${sr}:cl=mono,atrim=0:${(s.silenceAfterMs / 1000).toFixed(3)}[s${idx}]`);
      labels.push(`[s${idx}]`);
    }
    idx++;
  }
  filters.push(`${labels.join("")}concat=n=${labels.length}:v=0:a=1[cat]`);
  if (opts.normalize !== false) filters.push(`[cat]loudnorm=I=-16:TP=-1.5:LRA=11[out]`);
  else filters.push(`[cat]anull[out]`);
  await mkdir(path.dirname(out), { recursive: true });
  await run(FFMPEG, ["-y", "-hide_banner", "-loglevel", "error", ...inputs, "-filter_complex", filters.join(";"), "-map", "[out]", "-ar", String(sr), "-ac", "1", out]);
  return out;
}

export async function hasWhisperFilter(): Promise<boolean> {
  try {
    const out = await run(FFMPEG, ["-hide_banner", "-filters"]);
    return /\bwhisper\b/.test(out);
  } catch {
    return false;
  }
}

/**
 * Apara silêncios longos da locução: pausas acima de `maxSilenceMs` são encurtadas para `keepMs`,
 * e silêncios curtos entre frases ficam como estão. Mantém a voz intacta.
 * Implementação: detecta silêncio (silencedetect) e remonta o áudio só com os trechos desejados.
 */
export async function trimLongSilences(input: string, output: string, opts: { maxSilenceMs?: number; keepMs?: number; thresholdDb?: number } = {}) {
  const maxSilence = opts.maxSilenceMs ?? 1200;
  const keep = opts.keepMs ?? 900;
  const th = opts.thresholdDb ?? -38;
  const log = await run(FFMPEG, ["-hide_banner", "-i", input, "-af", `silencedetect=noise=${th}dB:d=${(maxSilence / 1000).toFixed(2)}`, "-f", "null", "-"]).catch((e) => String(e));
  const starts = [...log.matchAll(/silence_start: ([\d.]+)/g)].map((m) => parseFloat(m[1]));
  const ends = [...log.matchAll(/silence_end: ([\d.]+)/g)].map((m) => parseFloat(m[1]));
  const total = (await probeDurationMs(input)) / 1000;
  const silences = starts.map((s, i) => ({ start: s, end: ends[i] ?? total })).filter((x) => x.end - x.start > maxSilence / 1000);
  if (!silences.length) {
    await run(FFMPEG, ["-y", "-hide_banner", "-loglevel", "error", "-i", input, "-c", "copy", output]);
    return { removedMs: 0, count: 0 };
  }
  // Segmentos a manter: [0, s1.start + keep/2], [s1.end - keep/2, s2.start + keep/2], ...
  const half = keep / 2000;
  const parts: [number, number][] = [];
  let cursor = 0;
  for (const sil of silences) {
    parts.push([cursor, Math.min(sil.start + half, sil.end)]);
    cursor = Math.max(sil.end - half, sil.start);
  }
  parts.push([cursor, total]);
  const filters = parts.map(([a, b], i) => `[0:a]atrim=start=${a.toFixed(3)}:end=${b.toFixed(3)},asetpts=PTS-STARTPTS[p${i}]`);
  const concat = parts.map((_, i) => `[p${i}]`).join("") + `concat=n=${parts.length}:v=0:a=1[out]`;
  await run(FFMPEG, ["-y", "-hide_banner", "-loglevel", "error", "-i", input, "-filter_complex", [...filters, concat].join(";"), "-map", "[out]", output]);
  const removedMs = Math.round(silences.reduce((s, x) => s + Math.max(0, x.end - x.start - keep / 1000), 0) * 1000);
  return { removedMs, count: silences.length };
}
