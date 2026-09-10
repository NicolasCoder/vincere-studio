/**
 * Plano de edição: a camada visual que entra POR CIMA do master já renderizado.
 * Identidade DVP (Dacks Wenhell — Storytelling Aplicada). Ver Edição/EDITOR_IA.md.
 */

/** Paleta DVP. Valores amostrados das artes de referência em Edição/Assets/. */
export const DVP_PALETTE = {
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
export type DvpColor = keyof typeof DVP_PALETTE;

export const EDIT_LAYOUTS = [
  "lower-third",
  "overlay-dado",
  "insert-arquivo",
  "split-evidencia",
  "graphic-fullscreen",
] as const;
export type EditLayout = (typeof EDIT_LAYOUTS)[number];

/** Estilos de lower third das artes DVP. */
export const LOWER_THIRD_STYLES = ["AUTORIDADE", "EMOCIONAL", "DATADO"] as const;
export type LowerThirdStyle = (typeof LOWER_THIRD_STYLES)[number];

export const LAYOUT_META: Record<EditLayout, { label: string; description: string; defaultMs: number }> = {
  "lower-third": { label: "Lower third", description: "Placa inferior com nome, fonte ou data", defaultMs: 4000 },
  "overlay-dado": { label: "Destaque de dado", description: "Número ou estatística em evidência num canto", defaultMs: 3500 },
  "insert-arquivo": { label: "Inserção de arquivo", description: "Foto, print ou documento sobreposto em moldura", defaultMs: 5000 },
  "split-evidencia": { label: "Split de evidência", description: "Master de um lado, evidência do outro", defaultMs: 6000 },
  "graphic-fullscreen": { label: "Tela cheia gráfica", description: "Intertítulo, linha do tempo ou mapa cobrindo o quadro", defaultMs: 3000 },
};

export interface EditInsertion {
  id: string;
  act: number;
  layout: EditLayout;
  lowerThirdStyle?: LowerThirdStyle;
  /** Trecho exato da narração que dispara a inserção. */
  trigger: string;
  /** Absoluto no master, já somando o gap entre atos. */
  startMs: number;
  endMs: number;
  primary: string;
  secondary?: string;
  /** Por que esta inserção existe — aparece na revisão. */
  note?: string;
  /**
   * Média de luma (0–255) da região do master onde esta inserção vai aparecer, medida no frame
   * real do vídeo renderizado. Ausente quando não há render ou o layout cobre o quadro.
   */
  backdropLuma?: number;
  /** Derivado de backdropLuma: o que está atrás da inserção é claro ou escuro. */
  backdrop?: Backdrop;
  /**
   * Só em insert-arquivo e split-evidencia: prompt (em inglês) da imagem de evidência que o
   * layout precisa. O plano propõe a evidência, mas gerar é decisão à parte — quem dispara é o
   * botão na revisão, para não gastar sem escolha.
   */
  evidencePrompt?: string;
  /** Caminho relativo da evidência já gerada (GeneratedImage.filePath), quando existir. */
  evidencePath?: string;
  /**
   * false quando o trigger não casou com nenhuma palavra do áudio alinhado e o tempo
   * caiu num fallback. Inserção não resolvida NÃO deve ser renderizada sem revisão.
   */
  resolved: boolean;
}

export interface EditPlanSafeZone {
  /** Onde as legendas queimadas do master ficam — nada pode ser desenhado aqui. */
  kind: "band-bottom" | "band-center";
  fromPct: number;
  toPct: number;
  note: string;
}

export interface EditPlanData {
  promptVersion: string;
  totalMs: number;
  actCount: number;
  safeZone: EditPlanSafeZone;
  insertions: EditInsertion[];
}

/**
 * Faixa proibida para qualquer inserção, derivada de packages/render/src/captions.ts.
 *
 * Com legenda queimada — Longo: ancorada embaixo (MarginV 7% da altura, fonte 4.2%, até 2 linhas).
 * Vertical: alinhamento 5 (meio do quadro); renderizadores de ASS divergem sobre honrar MarginV
 * em alinhamento central, então a faixa cobre os dois casos.
 *
 * Sem legenda queimada (padrão do formato longo), sobra só a margem de segurança do player do
 * YouTube, onde entram a barra de progresso e os controles no hover.
 */
export function captionSafeZone(width: number, height: number, burnedCaptions: boolean): EditPlanSafeZone {
  if (!burnedCaptions) {
    return {
      kind: "band-bottom",
      fromPct: 92,
      toPct: 100,
      note: "Sem legenda queimada: sobra só a margem do player do YouTube (barra de progresso e controles).",
    };
  }
  return height > width
    ? {
        kind: "band-center",
        fromPct: 40,
        toPct: 65,
        note: "Short com legenda queimada no meio do quadro. Sobram o terço superior e o inferior.",
      }
    : {
        kind: "band-bottom",
        fromPct: 82,
        toPct: 100,
        note: "Longo com legenda queimada embaixo, podendo ocupar 2 linhas.",
      };
}

export type Backdrop = "light" | "dark";

/** Acima disso o fundo é claro demais para texto claro sem placa opaca. */
export const LIGHT_BACKDROP_LUMA = 110;

export const backdropFor = (luma: number): Backdrop => (luma > LIGHT_BACKDROP_LUMA ? "light" : "dark");

/**
 * Região do quadro que a inserção ocupa, para medir o brilho do master ali.
 *
 * Só faz sentido para layouts que deixam o master aparecer atrás. `insert-arquivo`,
 * `split-evidencia` e `graphic-fullscreen` cobrem a área com substrato opaco, então o que está
 * embaixo não importa — devolvem null e nem são medidos.
 */
export function insertionRegion(
  layout: EditLayout,
  width: number,
  height: number,
  burnedCaptions: boolean,
): { x: number; y: number; w: number; h: number } | null {
  const rect = (x: number, y: number, w: number, h: number) => ({
    // ffmpeg exige inteiros pares no crop
    x: Math.round((x * width) / 2) * 2,
    y: Math.round((y * height) / 2) * 2,
    w: Math.round((w * width) / 2) * 2,
    h: Math.round((h * height) / 2) * 2,
  });
  // Sem legenda queimada o lower third desce para o rodapé, que é onde os canais de referência
  // colocam; a medição de brilho tem que acompanhar, senão mede um pedaço do quadro que a
  // inserção nem ocupa.
  if (layout === "lower-third") return burnedCaptions ? rect(0.06, 0.62, 0.64, 0.18) : rect(0.06, 0.72, 0.64, 0.18);
  if (layout === "overlay-dado") return rect(0.6, 0.08, 0.34, 0.22);
  return null;
}

/**
 * Uma inserção de texto claro sobre fundo claro some. Quando o fundo medido é claro, o estilo
 * transparente (Emocional) não serve — precisa de placa opaca (Autoridade) ou texto escuro.
 */
export const needsOpaquePlate = (ins: EditInsertion) => ins.backdrop === "light";

const strip = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Localiza a frase-gatilho na lista de palavras alinhadas do ato.
 * Retorna o índice da primeira palavra, ou -1. Comparação sem acento nem pontuação,
 * porque a narração tem marcações ([Pausa 1.8s]) que não existem no alinhamento.
 */
export function findPhrase(words: { text: string }[], phrase: string): number {
  const needle = strip(phrase).split(" ").filter(Boolean);
  if (!needle.length) return -1;
  const hay = words.map((w) => strip(w.text));
  for (let i = 0; i + needle.length <= hay.length; i++) {
    let hit = true;
    for (let j = 0; j < needle.length; j++) {
      if (hay[i + j] !== needle[j]) {
        hit = false;
        break;
      }
    }
    if (hit) return i;
  }
  // Segunda tentativa: casar só o começo da frase (o modelo às vezes estende o trecho).
  if (needle.length > 3) return findPhrase(words, needle.slice(0, 3).join(" "));
  return -1;
}

/**
 * Remove sobreposição temporal: inserções em paralelo brigariam pelo mesmo espaço de tela.
 * Mantém a primeira e encurta/descarta a seguinte. Assume a lista já ordenada por startMs.
 */
export function resolveOverlaps(list: EditInsertion[], minGapMs = 400): EditInsertion[] {
  const out: EditInsertion[] = [];
  for (const item of list) {
    const prev = out[out.length - 1];
    if (!prev) {
      out.push(item);
      continue;
    }
    if (item.startMs < prev.endMs + minGapMs) {
      const trimmed = prev.endMs + minGapMs;
      // Só encurta o anterior se ele ainda ficar legível; senão descarta o novo.
      if (item.endMs - trimmed >= 1500) out.push({ ...item, startMs: trimmed });
      continue;
    }
    out.push(item);
  }
  return out;
}
