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
