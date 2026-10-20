"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@vincere-studio/db";
import { blockTiming, estimateRetention, type RewriteMode } from "@vincere-studio/core";

const back = (projectId: string, job?: string) => redirect(`/projects/${projectId}/script${job ? `?job=${job}` : ""}`);

export async function generateScript(projectId: string) {
  const job = await prisma.job.create({ data: { type: "GENERATE_SCRIPT", projectId, payload: JSON.stringify({ projectId }) } });
  back(projectId, job.id);
}

export async function rewriteBlock(projectId: string, blockId: string, mode: RewriteMode, instruction = "") {
  const job = await prisma.job.create({ data: { type: "REWRITE_BLOCK", projectId, payload: JSON.stringify({ blockId, mode, instruction: instruction || undefined }) } });
  back(projectId, job.id);
}

export async function requestSuggestions(projectId: string, scriptId: string) {
  const job = await prisma.job.create({ data: { type: "SCRIPT_SUGGESTIONS", projectId, payload: JSON.stringify({ scriptId }) } });
  back(projectId, job.id);
}

/** Recalcula tempos/retenção no servidor web (mesma heurística do worker, sem IA). */
async function recompute(scriptId: string) {
  const blocks = await prisma.scriptBlock.findMany({ where: { scriptId }, orderBy: { order: "asc" } });
  const r = estimateRetention(blocks);
  let cursor = 0;
  let words = 0;
  for (let i = 0; i < blocks.length; i++) {
    const t = blockTiming(blocks[i]);
    words += t.words;
    await prisma.scriptBlock.update({ where: { id: blocks[i].id }, data: { order: i + 1, act: i + 1, startMs: cursor, endMs: cursor + t.durationMs, retentionScore: r.perBlock[i] } });
    cursor += t.durationMs;
  }
  await prisma.script.update({ where: { id: scriptId }, data: { wordCount: words, estimatedDuration: Math.round(cursor / 1000), retentionCurve: JSON.stringify(r.curve), metrics: JSON.stringify(r) } });
}

export async function saveBlock(projectId: string, blockId: string, formData: FormData) {
  const narration = String(formData.get("narration") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const b = await prisma.scriptBlock.update({ where: { id: blockId }, data: { narration, ...(title ? { title } : {}) } });
  await recompute(b.scriptId);
  revalidatePath(`/projects/${projectId}/script`);
}

export async function moveBlock(projectId: string, blockId: string, dir: -1 | 1) {
  const b = await prisma.scriptBlock.findUniqueOrThrow({ where: { id: blockId } });
  const other = await prisma.scriptBlock.findFirst({ where: { scriptId: b.scriptId, order: b.order + dir } });
  if (other) {
    await prisma.$transaction([
      prisma.scriptBlock.update({ where: { id: b.id }, data: { order: other.order } }),
      prisma.scriptBlock.update({ where: { id: other.id }, data: { order: b.order } }),
    ]);
    await recompute(b.scriptId);
  }
  revalidatePath(`/projects/${projectId}/script`);
}

export async function deleteBlock(projectId: string, blockId: string) {
  const b = await prisma.scriptBlock.delete({ where: { id: blockId } });
  await recompute(b.scriptId);
  revalidatePath(`/projects/${projectId}/script`);
}

export async function splitBlock(projectId: string, blockId: string) {
  const b = await prisma.scriptBlock.findUniqueOrThrow({ where: { id: blockId } });
  const sentences = b.narration.split(/(?<=[.!?…])\s+/);
  if (sentences.length < 2) return;
  const half = Math.ceil(sentences.length / 2);
  const a = sentences.slice(0, half).join(" ");
  const c = sentences.slice(half).join(" ");
  await prisma.$transaction([
    prisma.scriptBlock.updateMany({ where: { scriptId: b.scriptId, order: { gt: b.order } }, data: { order: { increment: 1 } } }),
    prisma.scriptBlock.update({ where: { id: b.id }, data: { narration: a } }),
    prisma.scriptBlock.create({ data: { scriptId: b.scriptId, act: b.act + 1, order: b.order + 1, kind: b.kind, title: `${b.title} (cont.)`, narration: c, wpm: b.wpm, brollCue: b.brollCue, soundCue: b.soundCue } }),
  ]);
  await recompute(b.scriptId);
  revalidatePath(`/projects/${projectId}/script`);
}

export async function addBlock(projectId: string, scriptId: string) {
  const count = await prisma.scriptBlock.count({ where: { scriptId } });
  await prisma.scriptBlock.create({ data: { scriptId, act: count + 1, order: count + 1, kind: "ESCALATION", title: `Novo bloco ${count + 1}`, narration: "" } });
  await recompute(scriptId);
  revalidatePath(`/projects/${projectId}/script`);
}

/** Restaura uma versão antiga como nova versão (não apaga histórico). */
export async function restoreVersion(projectId: string, scriptId: string) {
  const old = await prisma.script.findUniqueOrThrow({ where: { id: scriptId }, include: { blocks: { orderBy: { order: "asc" } } } });
  const latest = await prisma.script.findFirst({ where: { projectId }, orderBy: { version: "desc" } });
  const s = await prisma.script.create({
    data: {
      projectId, ideaId: old.ideaId, version: (latest?.version ?? 0) + 1, logline: old.logline, promptVersion: old.promptVersion, model: old.model,
      blocks: { create: old.blocks.map((b) => ({ act: b.act, order: b.order, kind: b.kind, title: b.title, narration: b.narration, wpm: b.wpm, brollCue: b.brollCue, soundCue: b.soundCue })) },
    },
  });
  await recompute(s.id);
  redirect(`/projects/${projectId}/script`);
}
