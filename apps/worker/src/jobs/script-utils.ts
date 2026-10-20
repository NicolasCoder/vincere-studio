import { prisma } from "@vincere-studio/db";
import { blockTiming, estimateRetention } from "@vincere-studio/core";

/** Recalcula tempos, contagem de palavras, curva e métricas de um roteiro após qualquer edição. */
export async function recomputeScript(scriptId: string) {
  const blocks = await prisma.scriptBlock.findMany({ where: { scriptId }, orderBy: { order: "asc" } });
  let cursor = 0;
  let words = 0;
  const r = estimateRetention(blocks);
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const t = blockTiming(b);
    words += t.words;
    await prisma.scriptBlock.update({
      where: { id: b.id },
      data: { order: i + 1, act: i + 1, startMs: cursor, endMs: cursor + t.durationMs, retentionScore: r.perBlock[i] },
    });
    cursor += t.durationMs;
  }
  await prisma.script.update({
    where: { id: scriptId },
    data: { wordCount: words, estimatedDuration: Math.round(cursor / 1000), retentionCurve: JSON.stringify(r.curve), metrics: JSON.stringify(r) },
  });
  return { words, durationSec: Math.round(cursor / 1000), retention: r };
}
