import { prisma } from "@vincere-studio/db";
import { RewriteSchema, SuggestionsSchema, rewritePrompt, scriptSystemPrompt, suggestionsPrompt, type RewriteMode } from "@vincere-studio/core";
import { getTextProviderFor, recordUsage } from "@vincere-studio/providers";
import type { JobContext } from "../queue";
import { recomputeScript } from "./script-utils";

/** REWRITE_BLOCK: payload { blockId, mode, instruction? } */
export async function rewriteBlock(ctx: JobContext) {
  const blockId = String(ctx.payload.blockId ?? "");
  const mode = (ctx.payload.mode as RewriteMode) ?? "rewrite";
  const instruction = ctx.payload.instruction ? String(ctx.payload.instruction) : undefined;
  const block = await prisma.scriptBlock.findUnique({ where: { id: blockId }, include: { script: { include: { project: true } } } });
  if (!block) throw new Error("Bloco não encontrado");

  await ctx.progress({ percent: 20, message: `Reescrevendo Ato ${block.act} (${mode})` });
  const provider = getTextProviderFor("roteiro");
  const res = await provider.generateJson(rewritePrompt(block.narration, mode, instruction, { title: block.script.project.title, actTitle: block.title }), RewriteSchema, {
    system: scriptSystemPrompt(),
    temperature: 0.9,
  });
  await recordUsage(block.script.projectId, res.usage);
  await prisma.scriptBlock.update({ where: { id: blockId }, data: { narration: res.data.narration.trim(), note: res.data.note } });
  await recomputeScript(block.scriptId);
  await ctx.log(`Ato ${block.act}: ${res.data.note}`);
  return { note: res.data.note };
}

/** SCRIPT_SUGGESTIONS: payload { scriptId } */
export async function scriptSuggestions(ctx: JobContext) {
  const scriptId = String(ctx.payload.scriptId ?? "");
  const script = await prisma.script.findUnique({ where: { id: scriptId }, include: { project: true, blocks: { orderBy: { order: "asc" } } } });
  if (!script) throw new Error("Roteiro não encontrado");
  await ctx.progress({ percent: 20, message: "Analisando retenção do roteiro" });
  const provider = getTextProviderFor("roteiro");
  const res = await provider.generateJson(
    suggestionsPrompt(script.project.title, script.blocks.map((b) => ({ act: b.act, title: b.title, narration: b.narration, startMs: b.startMs ?? 0, endMs: b.endMs ?? 0 }))),
    SuggestionsSchema,
    { system: scriptSystemPrompt(), temperature: 0.6 },
  );
  await recordUsage(script.projectId, res.usage);
  const withIds = res.data.suggestions.map((s) => ({ ...s, blockId: script.blocks.find((b) => b.act === s.act)?.id ?? null, id: `${s.act}-${Math.random().toString(36).slice(2, 7)}` }));
  await prisma.script.update({ where: { id: scriptId }, data: { suggestions: JSON.stringify(withIds) } });
  await ctx.log(`${withIds.length} sugestão(ões)`);
  return { count: withIds.length };
}
