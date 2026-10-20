import { loadFont as loadPlayfair } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { DVP_PALETTE, captionSafeZone } from "../../../packages/core/src/edit-plan";

/**
 * Identidade DVP. Reexporta DVP_PALETTE de packages/core/src/edit-plan.ts — fonte única, não
 * cópia. `editor-ia` fica fora do workspace pnpm (não enxerga `@vincere-studio/core` pelo nome), mas
 * `edit-plan.ts` não tem nenhuma dependência própria, então o import relativo direto funciona sem
 * puxar nada além do arquivo.
 */
export const DVP = DVP_PALETTE;

export const titleFont = loadPlayfair("normal", { weights: ["500", "700"], subsets: ["latin"] }).fontFamily;
export const bodyFont = loadInter("normal", { weights: ["400", "600"], subsets: ["latin"] }).fontFamily;

/**
 * Faixa proibida pela legenda queimada, em % da altura.
 *
 * Histórico do bug que isto corrige: no longo a legenda fica no rodapé (MarginV 7%, alinhamento
 * 2); no Short ela foi para o MEIO do quadro (alinhamento 8, MarginV 47%) quando o tremor
 * vertical foi corrigido no `buildAss`. Esta faixa e `captionSafeZone` (`packages/core`) eram DUAS
 * cópias da mesma verdade sem nada ligando uma à outra — já divergiram uma vez em silêncio (o
 * lower third vertical caiu em cima da legenda, 52%–80% da altura, sem nada acusar).
 *
 * Agora `zonaProibida` chama `captionSafeZone` direto: só existe UMA implementação. Ainda expõe a
 * mesma forma simples { fromPct, toPct } porque a banda de posicionamento do editor-ia só usa
 * banda superior/inferior — as duas variantes de `EditPlanSafeZone` (`band-bottom`/`band-center`)
 * sempre carregam esses dois campos.
 */
export const PLAYER_SAFE_TOP_PCT = 92;

export type ZonaProibida = { fromPct: number; toPct: number };

export function zonaProibida(width: number, height: number, burnedCaptions: boolean): ZonaProibida {
  const zona = captionSafeZone(width, height, burnedCaptions);
  return { fromPct: zona.fromPct, toPct: zona.toPct };
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
