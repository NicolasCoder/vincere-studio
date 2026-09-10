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
 * Onde começa a faixa proibida no rodapé, em % da altura.
 *
 * Com legenda queimada: derivado do buildAss do DocuPulse — MarginV 7% da altura, fonte 4.2%,
 * até 2 linhas. É o caso do Short.
 * Sem legenda queimada (padrão do longo): sobra só a margem do player do YouTube, onde entram a
 * barra de progresso e os controles no hover. É aí que os canais de referência põem o lower third.
 */
export const CAPTION_BAND_TOP_PCT = 82;
export const PLAYER_SAFE_TOP_PCT = 92;

export const bottomBandTopPct = (burnedCaptions: boolean) =>
  burnedCaptions ? CAPTION_BAND_TOP_PCT : PLAYER_SAFE_TOP_PCT;

/** Margem lateral, alinhada com a das legendas do master (60px em 1920). */
export const SIDE_MARGIN_PCT = 3.125;
