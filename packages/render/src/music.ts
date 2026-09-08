import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { FFMPEG, run } from "@docupulse/providers";

/**
 * Trilha ambiente procedural (sem download, sem direitos autorais): camadas de senos detunados com
 * tremolo lento, ruído rosa filtrado e eco. Serve como cama sonora sob a voz; um MP3 do usuário
 * em storage/music tem prioridade.
 */
const RECIPES: Record<string, { freqs: number[]; lowpass: number; noise: number; echo: string; label: string }> = {
  dark: { freqs: [55, 82.4, 110.6, 164.8], lowpass: 520, noise: 0.03, echo: "0.7:0.8:900|1700:0.35|0.25", label: "Dark ambient drone" },
  space: { freqs: [65.4, 98, 130.8, 196], lowpass: 700, noise: 0.02, echo: "0.6:0.8:1200|2400:0.4|0.3", label: "Cosmic pad" },
  history: { freqs: [73.4, 110, 146.8, 220], lowpass: 800, noise: 0.015, echo: "0.6:0.7:700|1300:0.3|0.2", label: "Warm drone" },
  light: { freqs: [130.8, 164.8, 196, 261.6], lowpass: 1600, noise: 0.005, echo: "0.5:0.6:400|800:0.25|0.15", label: "Soft pad" },
};

export function recipeForStyle(styleId: string): keyof typeof RECIPES {
  if (styleId === "SPACE_SCI") return "space";
  if (styleId === "HISTORIC_REAL" || styleId === "WATERCOLOR") return "history";
  if (styleId === "KIDS_3D") return "light";
  return "dark";
}

/** Hash simples e determinístico (mesma chave → mesma variação sempre). */
function seedFromKey(key: string): number {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

/**
 * @param seedKey Chave de variação (ex.: projectId). Com a mesma chave, sempre gera o mesmo arquivo
 * (cacheado); chaves diferentes recebem um leve detune/tremolo/lowpass distintos, para que projetos
 * do mesmo estilo visual não soem todos com a trilha idêntica. Sem seedKey, mantém o comportamento
 * antigo (um único arquivo por estilo).
 */
export async function ensureProceduralMusic(musicDir: string, styleId: string, durationSec = 180, seedKey?: string): Promise<string> {
  const key = recipeForStyle(styleId);
  const r = RECIPES[key];
  const seed = seedKey ? seedFromKey(seedKey) : 0;
  const variantTag = seedKey ? `-v${seed % 1000}` : "";
  await mkdir(musicDir, { recursive: true });
  const out = path.join(musicDir, `generated-${key}${variantTag}.wav`);
  if (existsSync(out)) return out;
  // Jitters pequenos e determinísticos por seed: detune (~±1.8%), tremolo e lowpass.
  const detune = (i: number) => 1 + (((seed >> (i * 3)) % 7) - 3) * 0.006;
  const freqs = r.freqs.map((f, i) => Math.round(f * detune(i) * 100) / 100);
  const tremoloShift = ((seed >> 10) % 5) * 0.015;
  const lowpass = r.lowpass + (((seed >> 14) % 9) - 4) * 20;
  const inputs = freqs.flatMap((f) => ["-f", "lavfi", "-i", `sine=f=${f}:d=${durationSec}`]);
  inputs.push("-f", "lavfi", "-i", `anoisesrc=c=pink:d=${durationSec}:a=${r.noise}`);
  const n = freqs.length;
  const layers = freqs.map((_, i) => `[${i}:a]tremolo=f=${Math.max(0.1, 0.1 + i * 0.04 + tremoloShift).toFixed(2)}:d=${(0.55 + i * 0.08).toFixed(2)},volume=${(1 - i * 0.22).toFixed(2)}[a${i}]`);
  const labels = freqs.map((_, i) => `[a${i}]`).join("");
  const fc = [...layers, `[${n}:a]lowpass=f=${lowpass + 400}[nz]`, `${labels}[nz]amix=inputs=${n + 1}:normalize=0,lowpass=f=${lowpass},aecho=${r.echo},loudnorm=I=-24:TP=-6,aformat=channel_layouts=stereo[out]`].join(";");
  await run(FFMPEG, ["-y", "-hide_banner", "-loglevel", "error", ...inputs, "-filter_complex", fc, "-map", "[out]", "-ar", "48000", out]);
  return out;
}
