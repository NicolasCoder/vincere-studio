import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { FFMPEG, run } from "@vincere-studio/providers";

export type SfxKind = "whoosh" | "impact" | "riser" | "click";

export const SFX_RECIPES: Record<SfxKind, { durationSec: number; filter: string; label: string }> = {
  whoosh: {
    durationSec: 0.6,
    filter: "anoisesrc=c=white:d=0.6:a=0.5,bandpass=f=800:width_type=h:w=500,volume=2,afade=t=in:ss=0:d=0.2,afade=t=out:st=0.3:d=0.3,loudnorm=I=-20:TP=-3",
    label: "Whoosh / Transição Dinâmica",
  },
  impact: {
    durationSec: 0.8,
    filter: "sine=f=80:d=0.8,asetrate=48000*0.8,aresample=48000,lowpass=f=160,afade=t=out:st=0.1:d=0.7,volume=2.5,loudnorm=I=-18:TP=-2",
    label: "Impact / Batida Dramática",
  },
  riser: {
    durationSec: 1.5,
    filter: "sine=f=120:d=1.5,asetrate=48000*1.5,aresample=48000,afade=t=in:ss=0:d=1.4,afade=t=out:st=1.3:d=0.2,loudnorm=I=-22:TP=-4",
    label: "Riser / Tensão de Transição",
  },
  click: {
    durationSec: 0.15,
    filter: "anoisesrc=c=white:d=0.15:a=0.3,highpass=f=2500,afade=t=out:st=0.02:d=0.13,volume=1.8",
    label: "Click / Estalo de Detalhe",
  },
};

/**
 * Gera proceduralmente efeitos sonoros em WAV sem dependência de download externo ou royalties.
 */
export async function ensureProceduralSfx(sfxDir: string, kind: SfxKind): Promise<string> {
  const recipe = SFX_RECIPES[kind] || SFX_RECIPES.whoosh;
  await mkdir(sfxDir, { recursive: true });
  const out = path.join(sfxDir, `sfx-${kind}.wav`);
  if (existsSync(out)) return out;

  await run(FFMPEG, [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    recipe.filter,
    "-ar",
    "48000",
    "-ac",
    "2",
    out,
  ]);
  return out;
}
