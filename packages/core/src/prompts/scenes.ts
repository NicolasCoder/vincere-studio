import { z } from "zod";
import { FORMATS, type VideoFormat } from "../formats";
import type { VisualStyle } from "../visual-styles";

export const SCENES_PROMPT_VERSION = "scenes.v1";

export const SceneSchema = z.object({
  order: z.number().describe("Ordem da cena dentro do ato, começando em 1"),
  durationSec: z.number().describe("Duração da cena em segundos"),
  description: z.string().describe("Descrição visual concreta da cena em inglês, 1 a 2 frases: sujeito, ação, ambiente, época, enquadramento. Sem texto na imagem."),
  keywords: z.string().describe("3 a 5 palavras-chave em inglês para busca em banco de imagens/vídeos, separadas por vírgula"),
  preferVideo: z.boolean().describe("true se a cena pede movimento real (multidão, natureza, cidade); false se uma imagem gerada funciona melhor"),
});
export const ScenesResponseSchema = z.object({ scenes: z.array(SceneSchema) });

export type SceneDensity = "dense" | "sparse";
/** Segundos por cena: "dense" segue o ritmo do formato (acervo/API); "sparse" usa cenas longas para o Modo Flow (menos imagens à mão). */
export function secondsPerScene(format: VideoFormat, density: SceneDensity) {
  const f = FORMATS[format];
  const avg = (f.cutPace.min + f.cutPace.max) / 2;
  return density === "sparse" ? Math.max(8, avg * 2.5) : avg;
}

export function scenesPrompt(opts: { format: VideoFormat; style: VisualStyle; title: string; act: number; actTitle: string; narration: string; brollCue?: string | null; durationSec: number; density?: SceneDensity }) {
  const f = FORMATS[opts.format];
  const avg = secondsPerScene(opts.format, opts.density ?? "dense");
  const n = Math.max(1, Math.min(24, Math.round(opts.durationSec / avg)));
  return [
    `Vídeo: "${opts.title}" · Ato ${opts.act}: ${opts.actTitle} · duração do ato ${opts.durationSec}s.`,
    `Estilo visual do projeto: ${opts.style.label} — ${opts.style.description}.`,
    opts.brollCue ? `Direção visual do ato: ${opts.brollCue}` : "",
    `Divida a narração abaixo em exatamente ${n} cenas visuais em sequência, com durações que somem ${opts.durationSec}s (cada uma em torno de ${Math.round(avg)}s, entre ${Math.max(2, Math.round(avg * 0.6))} e ${Math.round(avg * 1.6)}s).`,
    "Cada cena ilustra o trecho da narração naquele momento. Descrições em inglês, concretas, sem texto/legendas na imagem, sem rostos de pessoas reais identificáveis.",
    "Retorne apenas o JSON.",
    "--- NARRAÇÃO ---",
    opts.narration,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Nome de arquivo esperado na pasta inbox para uma cena. */
export const sceneFileStem = (act: number, order: number) => `a${String(act).padStart(2, "0")}-s${String(order).padStart(2, "0")}`;
export const parseSceneFileStem = (name: string): { act: number; order: number } | null => {
  const m = /a(\d{1,2})[-_ ]?s(\d{1,2})/i.exec(name);
  return m ? { act: Number(m[1]), order: Number(m[2]) } : null;
};
