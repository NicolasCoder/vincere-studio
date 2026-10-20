import { existsSync } from "node:fs";
import path from "node:path";
import { FFMPEG, run } from "@vincere-studio/providers";
import type { TimelineScene } from "./timeline";

/**
 * Piso de exposição do master.
 *
 * O estilo visual do canal pede noite, arquivo e penumbra — e tanto o acervo quanto os geradores de
 * imagem obedecem bem demais. Medindo as 61 cenas de um documentário real, 28 ficaram abaixo de
 * luma 35 e várias abaixo de 10. No monitor do editor isso ainda "lê" como cena escura; no celular,
 * com brilho automático e reflexo, é um retângulo preto — foi assim que uma estrada noturna ocupou
 * 25 segundos de tela sem que ninguém visse nada.
 *
 * O piso não é um look: só age abaixo do limiar e levanta só até o limiar. Cena bem exposta passa
 * intocada.
 */

/** Abaixo disto a cena deixa de ser "escura" e passa a ser "preta" num celular. */
export const LUMA_PISO = 52;

/**
 * Teto do gamma. Levantar sombra amplifica o ruído de compressão junto, e acima de ~2.2 o ganho de
 * legibilidade não paga o banding. Cena que bate no teto e ainda fica abaixo do piso não tem
 * informação para recuperar — é caso de gerar de novo, não de corrigir, e por isso ela é relatada
 * em vez de silenciosamente "consertada".
 */
const GAMMA_MAX = 2.2;

/**
 * Toda medida passa por `scale=out_range=full,format=gray` antes do `signalstats`.
 *
 * Sem isso os números não são comparáveis: JPEG chega como `yuvj420p` (range cheio, 0–255) e MP4
 * como range limitado (16–235). Medindo cru, um vídeo em Y=24 e uma foto em Y=24 parecem igualmente
 * escuros, quando na verdade o vídeo equivale a ~9 em range cheio. Foi esse detalhe que fez a
 * primeira versão desta calibração errar para os dois lados ao mesmo tempo.
 */
const MEDIR = "scale=out_range=full,format=gray,signalstats,metadata=print:key=lavfi.signalstats.YAVG";

/**
 * A correção roda em RGB (`format=gbrp`) e não em YUV.
 *
 * Mesma lição do bug magenta da thumbnail: operação de cor aplicada direto nos planos YUV depende
 * do range do arquivo e o resultado muda conforme a origem. Em RGB o gamma é inequívoco, e a volta
 * para `yuv420p` acontece no fim da cadeia de cada cena.
 */
const corrigir = (gamma: number, saturacao: number) =>
  `format=gbrp,eq=gamma=${gamma.toFixed(3)}:saturation=${saturacao.toFixed(3)}`;

async function yavg(args: string[]): Promise<number | null> {
  const out = await run(FFMPEG, ["-hide_banner", ...args, "-f", "null", "-"]).catch(() => "");
  const todos = [...out.matchAll(/lavfi\.signalstats\.YAVG=([\d.]+)/g)].map((m) => Number(m[1]));
  if (!todos.length) return null;
  return todos.reduce((s, x) => s + x, 0) / todos.length;
}

/** Média de luma (0–255, range cheio) de uma janela do arquivo. */
export async function medirLuma(file: string, inicioSec = 0, duracaoSec?: number): Promise<number | null> {
  if (!existsSync(file)) return null;
  // Três amostras dentro da janela que a cena realmente usa, não do arquivo inteiro: um clipe de
  // 120s pode começar claro e a cena pegar só o trecho noturno do fim. E medir só o frame 0 é pior
  // ainda — clipe com fade-in mede zero e não diz nada sobre o resto.
  const pontos = duracaoSec && duracaoSec > 1 ? [0.15, 0.5, 0.85].map((f) => inicioSec + duracaoSec * f) : [inicioSec];
  const medidas: number[] = [];
  for (const t of pontos) {
    const v = await yavg([...(t > 0 ? ["-ss", t.toFixed(3)] : []), "-i", file, "-frames:v", "1", "-vf", MEDIR]);
    if (v != null) medidas.push(v);
  }
  if (!medidas.length) return null;
  return medidas.reduce((s, x) => s + x, 0) / medidas.length;
}

/** Gamma que, pela curva teórica, levaria `luma` até o piso. Ponto de partida, não resposta final. */
function gammaTeorico(luma: number): number {
  const g = Math.log(luma / 255) / Math.log(LUMA_PISO / 255);
  return Math.max(1, Math.min(GAMMA_MAX, g));
}

const saturacaoPara = (g: number) => 1 + ((g - 1) / (GAMMA_MAX - 1)) * 0.18;

export interface ExposicaoDaCena {
  id: string;
  /** Luma medida na origem, range cheio. */
  luma: number;
  /** Luma estimada depois da correção. */
  lumaFinal: number;
  gamma: number;
  /** true quando bateu no teto e mesmo assim ficou abaixo do piso: precisa ser gerada de novo. */
  irrecuperavel: boolean;
}

const cache = new Map<string, { filtro: string | null; info: ExposicaoDaCena | null }>();

/**
 * Mede cada cena e resolve o gamma por medição, não por álgebra.
 *
 * A fórmula sozinha erra feio e para os dois lados — num MP4 escuro ela levou luma 8.8 para 74, e
 * num JPEG igualmente escuro parou em 30. O motivo é que gamma atua sobre a distribuição inteira e
 * a média de `pow()` não é `pow()` da média: um quadro 90% preto quase não se move, um quadro com
 * sombra cheia de informação dispara. Então: aplica o chute, mede o que saiu, e resolve o expoente
 * efetivo num único passo. Com isso as cenas caem em 48–52 em vez de 29–75.
 *
 * Custo: dois ffmpeg de um frame por cena escura. Contra um render de ~11 minutos, é troco.
 */
export async function planejarExposicao(
  scenes: TimelineScene[],
  workDir: string,
): Promise<{ filtros: Map<string, string>; levantadas: ExposicaoDaCena[]; irrecuperaveis: ExposicaoDaCena[]; medidas: number }> {
  const filtros = new Map<string, string>();
  const levantadas: ExposicaoDaCena[] = [];
  const irrecuperaveis: ExposicaoDaCena[] = [];
  let medidas = 0;
  const sonda = path.join(workDir, "expo-probe.png");

  for (const s of scenes) {
    if (!s.file) continue;
    const inicio = s.mediaType === "video" ? (s.startOffsetSec ?? 0) : 0;
    const dur = s.mediaType === "video" ? s.durationMs / 1000 : undefined;
    const chave = `${s.file}|${inicio}|${dur ?? 0}`;

    const guardado = cache.get(chave);
    if (guardado) {
      if (guardado.filtro) filtros.set(s.id, guardado.filtro);
      if (guardado.info) (guardado.info.irrecuperavel ? irrecuperaveis : levantadas).push({ ...guardado.info, id: s.id });
      medidas++;
      continue;
    }

    const luma = await medirLuma(s.file, inicio, dur);
    // Abaixo de 1 não há o que medir nem o que dividir (log de zero): a cena é reportada como
    // irrecuperável em vez de receber uma correção inventada.
    if (luma == null || luma < 1) {
      cache.set(chave, { filtro: null, info: null });
      continue;
    }
    medidas++;
    if (luma >= LUMA_PISO) {
      cache.set(chave, { filtro: null, info: null });
      continue;
    }

    const g0 = gammaTeorico(luma);
    const seek = inicio > 0 ? ["-ss", inicio.toFixed(3)] : [];
    await run(FFMPEG, ["-y", "-hide_banner", "-loglevel", "error", ...seek, "-i", s.file, "-frames:v", "1", "-vf", `${corrigir(g0, 1)},format=yuv420p`, sonda]).catch(() => {});
    const obtido = existsSync(sonda) ? await yavg(["-i", sonda, "-frames:v", "1", "-vf", MEDIR]) : null;

    let g = g0;
    if (obtido != null && obtido > 1 && obtido < 254) {
      // Expoente que o arquivo realmente respondeu ao gamma g0, e daí o gamma que leva ao piso.
      const efetivo = (g0 * Math.log(obtido / 255)) / Math.log(luma / 255);
      g = Math.max(1, Math.min(GAMMA_MAX, (efetivo * Math.log(luma / 255)) / Math.log(LUMA_PISO / 255)));
    }

    // Estimativa do resultado, pela mesma resposta medida — serve para dizer honestamente quando a
    // cena vai continuar abaixo do piso mesmo com o gamma no teto.
    const efetivoFinal = obtido != null && obtido > 1 ? (g0 * Math.log(obtido / 255)) / Math.log(luma / 255) : 1;
    const lumaFinal = 255 * Math.pow(luma / 255, efetivoFinal / g);
    const irrecuperavel = g >= GAMMA_MAX - 0.001 && lumaFinal < LUMA_PISO * 0.75;

    const filtro = g > 1.02 ? corrigir(g, saturacaoPara(g)) : null;
    const info: ExposicaoDaCena = {
      id: s.id,
      luma: Math.round(luma),
      lumaFinal: Math.round(lumaFinal),
      gamma: g,
      irrecuperavel,
    };
    cache.set(chave, { filtro, info });
    if (filtro) filtros.set(s.id, filtro);
    (irrecuperavel ? irrecuperaveis : levantadas).push(info);
  }
  return { filtros, levantadas, irrecuperaveis, medidas };
}
