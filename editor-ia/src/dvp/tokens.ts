import { loadFont as loadPlayfair } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

/** Identidade DVP. Espelha DVP_PALETTE em packages/core/src/edit-plan.ts do DocuPulse. */
export const DVP = {
  creme: "#F2EBE0",
  areia: "#E4D9C8",
  pedra: "#A9A9A4",
  carvao: "#2E312E",
  cacau: "#5A3A28",
  olive: "#6E7A5A",
  terra: "#C4674A",
  ardosia: "#4A5F75",
  cobre: "#C06A38",
} as const;

export const titleFont = loadPlayfair("normal", { weights: ["500", "700"], subsets: ["latin"] }).fontFamily;
export const bodyFont = loadInter("normal", { weights: ["400", "600"], subsets: ["latin"] }).fontFamily;

/**
 * Faixa proibida pela legenda queimada, em % da altura — e ela NÃO está no mesmo lugar nos dois
 * formatos.
 *
 * No longo a legenda fica no rodapé (MarginV 7%, alinhamento 2). No Short ela foi para o MEIO do
 * quadro (alinhamento 8, MarginV 47% da altura) quando o tremor vertical foi corrigido no
 * `buildAss` — e esta constante ficou para trás, ainda descrevendo o rodapé. Resultado medido: o
 * lower third vertical caía em 52%–80% da altura, ou seja, em cima da legenda, e nada acusava.
 *
 * Espelha `captionSafeZone` em packages/core/src/edit-plan.ts, que já estava certo mas só alimenta
 * o prompt. Quem posiciona de verdade é isto aqui — se os dois divergirem de novo, o modelo propõe
 * uma coisa e o componente desenha outra.
 */
export const CAPTION_BAND_TOP_PCT = 82;
export const PLAYER_SAFE_TOP_PCT = 92;

export type ZonaProibida = { fromPct: number; toPct: number };

export function zonaProibida(width: number, height: number, burnedCaptions: boolean): ZonaProibida {
  if (!burnedCaptions) return { fromPct: PLAYER_SAFE_TOP_PCT, toPct: 100 };
  return height > width
    ? { fromPct: 40, toPct: 65 } // Short: legenda no meio, sobram os terços de cima e de baixo
    : { fromPct: CAPTION_BAND_TOP_PCT, toPct: 100 };
}

/**
 * Até onde uma peça ancorada embaixo pode descer, em % da altura.
 *
 * No vertical a faixa proibida é no miolo, então o rodapé volta a ser território livre e a peça
 * desce até a margem do player. No horizontal nada muda.
 */
export function baseSeguraPct(width: number, height: number, burnedCaptions: boolean): number {
  const z = zonaProibida(width, height, burnedCaptions);
  return z.toPct >= 100 ? z.fromPct : PLAYER_SAFE_TOP_PCT;
}

/**
 * Referência para dimensionar texto e espaçamento: o MENOR lado, nunca `height`.
 *
 * Dimensionar por `height` é invisível em 16:9 e catastrófico em 9:16, onde `height` é 1920: a
 * mesma expressão que dá 56px no longo dá 100px no Short. Foi assim que o OverlayDado estourou o
 * container e, pelo mesmo motivo, o lower third vertical saiu com 538px de altura contra 130px do
 * horizontal.
 */
export const escala = (width: number, height: number) => Math.min(width, height);

/** Margem lateral, alinhada com a das legendas do master (60px em 1920). */
export const SIDE_MARGIN_PCT = 3.125;
