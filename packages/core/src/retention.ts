/**
 * Heurística de retenção v0. Não é previsão neural: é um modelo simples e
 * explicável que pontua cada bloco por dispositivos conhecidos de retenção.
 * Será calibrado com as métricas reais do YouTube Analytics (Sprint 6).
 */
export interface BlockLike {
  act: number;
  kind: string;
  narration: string;
  wpm?: number | null;
}

export interface BlockTiming {
  words: number;
  durationMs: number;
}

export const countWords = (t: string) => t.replace(/\[[^\]]*\]/g, " ").trim().split(/\s+/).filter(Boolean).length;

/** Soma das pausas marcadas, em ms. */
export const pauseMs = (t: string) =>
  [...t.matchAll(/\[pausa[^\]]*?(\d+(?:[.,]\d+)?)\s*s\]/gi)].reduce((s, m) => s + Math.round(parseFloat(m[1].replace(",", ".")) * 1000), 0);

export function blockTiming(b: BlockLike): BlockTiming {
  const words = countWords(b.narration);
  const wpm = b.wpm && b.wpm > 60 ? b.wpm : 150;
  return { words, durationMs: Math.round((words / wpm) * 60_000) + pauseMs(b.narration) };
}

export interface RetentionResult {
  /** 12 pontos de 0 a 100 ao longo do vídeo */
  curve: number[];
  /** Pontuação 0–100 por bloco */
  perBlock: number[];
  pacing: number;
  climaxCount: number;
  questions: number;
  avgSentence: number;
  predicted: number;
}

export function estimateRetention(blocks: BlockLike[]): RetentionResult {
  if (!blocks.length) return { curve: [], perBlock: [], pacing: 0, climaxCount: 0, questions: 0, avgSentence: 0, predicted: 0 };
  let totalQuestions = 0;
  let totalSentences = 0;
  let totalWords = 0;
  const perBlock = blocks.map((b, i) => {
    const text = b.narration.replace(/\[[^\]]*\]/g, " ");
    const sentences = text.split(/[.!?…]+\s/).filter((s) => s.trim().length > 0);
    const words = countWords(text);
    const questions = (text.match(/\?/g) ?? []).length;
    const pauses = (b.narration.match(/\[pausa/gi) ?? []).length;
    const numbers = (text.match(/\d{2,4}/g) ?? []).length;
    const avgSentence = sentences.length ? words / sentences.length : words;
    totalQuestions += questions;
    totalSentences += sentences.length;
    totalWords += words;

    let score = 70;
    score += Math.min(10, questions * 3); // perguntas seguram atenção
    score += Math.min(6, pauses * 2); // respiros dramáticos
    score += Math.min(8, numbers * 1.5); // concretude
    if (avgSentence > 26) score -= Math.min(15, (avgSentence - 26) * 1.2); // frases longas cansam na locução
    if (avgSentence < 8) score -= 4; // metralhadora sem fôlego
    if (b.kind === "HOOK") score += 12;
    if (b.kind === "CLIMAX" || b.kind === "REVEAL") score += 8;
    if (b.kind === "CONTEXT") score -= 3; // contexto é onde a audiência cai
    score -= i * 1.5; // decaimento natural ao longo do vídeo
    if (words < 30 && b.kind !== "CTA") score -= 10; // bloco vazio/curto demais
    return Math.max(35, Math.min(99, Math.round(score)));
  });

  // Curva de 12 pontos interpolando os blocos pela duração
  const timings = blocks.map(blockTiming);
  const total = timings.reduce((s, t) => s + t.durationMs, 0) || 1;
  const curve: number[] = [];
  for (let p = 0; p < 12; p++) {
    const t = (p / 11) * total;
    let acc = 0;
    let idx = 0;
    for (let i = 0; i < timings.length; i++) {
      if (t <= acc + timings[i].durationMs) {
        idx = i;
        break;
      }
      acc += timings[i].durationMs;
      idx = i;
    }
    curve.push(perBlock[idx]);
  }
  const climaxCount = blocks.filter((b) => b.kind === "HOOK" || b.kind === "CLIMAX" || b.kind === "REVEAL").length;
  const avgSentence = totalSentences ? totalWords / totalSentences : 0;
  const pacing = Math.round(Math.max(40, Math.min(99, 100 - Math.abs(avgSentence - 16) * 3 - Math.max(0, 3 - climaxCount) * 8)));
  const predicted = Math.round(perBlock.reduce((s, v) => s + v, 0) / perBlock.length);
  return { curve, perBlock, pacing, climaxCount, questions: totalQuestions, avgSentence: Math.round(avgSentence * 10) / 10, predicted };
}
