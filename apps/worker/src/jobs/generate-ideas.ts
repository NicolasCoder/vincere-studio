import { prisma } from "@docupulse/db";
import {
  IDEATION_PROMPT_VERSION,
  IdeasResponseSchema,
  ideationSystemPrompt,
  ideationUserPrompt,
  TrendAnglesSchema,
  trendAnglesSystemPrompt,
  trendAnglesUserPrompt,
  type VideoFormat,
} from "@docupulse/core";
import { getTextProvider, recordUsage } from "@docupulse/providers";
import type { JobContext } from "../queue";

/**
 * GENERATE_IDEAS: gera N ideias para o projeto com o provedor de texto padrão.
 * payload: { projectId, count?: 3, append?: false, focus?: "all"|"viral"|"hooks" }
 */
export async function generateIdeas(ctx: JobContext) {
  const projectId = String(ctx.payload.projectId ?? ctx.job.projectId ?? "");
  const count = Number(ctx.payload.count ?? 3);
  const append = Boolean(ctx.payload.append ?? false);
  const focus = (ctx.payload.focus as "all" | "viral" | "hooks") ?? "all";

  const project = await prisma.project.findUnique({ where: { id: projectId }, include: { ideas: true } });
  if (!project) throw new Error(`Projeto ${projectId} não encontrado`);

  const provider = getTextProvider();

  // Niche Finder: passo leve e opcional pra ampliar o leque de ângulos antes da ideação.
  // Nunca deve travar a geração de ideias — se falhar por qualquer motivo, segue sem ele.
  let trendAngles: string[] = [];
  await ctx.progress({ percent: 5, message: "Buscando ângulos em alta no nicho (Niche Finder)" });
  try {
    const { data: trendData, usage: trendUsage } = await provider.generateJson(
      trendAnglesUserPrompt(project.niche),
      TrendAnglesSchema,
      { system: trendAnglesSystemPrompt(), temperature: 1.0 },
    );
    trendAngles = trendData.angles.slice(0, 10);
    await ctx.log(`Niche Finder: ${trendAngles.length} ângulo(s) sugerido(s) — ${trendAngles.join(" · ")}`);
    await recordUsage(projectId, trendUsage);
  } catch (err) {
    await ctx.log(`Niche Finder indisponível, seguindo sem ele: ${err instanceof Error ? err.message : String(err)}`);
  }

  await ctx.progress({ percent: 10, message: "Montando prompt de ideação" });
  const hooks = JSON.parse(project.hooks || "[]") as string[];
  const prompt = ideationUserPrompt({
    niche: project.niche,
    format: project.format as VideoFormat,
    tone: project.tone,
    audience: project.audience,
    targetDuration: project.targetDuration,
    hooks,
    count,
    focus,
    avoidTitles: project.ideas.map((i) => i.title),
    trendAngles,
  });
  await ctx.log(`Prompt ${IDEATION_PROMPT_VERSION} · ${count} ideias · foco ${focus} · formato ${project.format}`);

  await ctx.progress({ percent: 25, message: `Chamando ${provider.name}...` });
  const { data, usage } = await provider.generateJson(prompt, IdeasResponseSchema, { system: ideationSystemPrompt(), temperature: 1.0 });
  await ctx.log(`${provider.name}/${usage.model}: ${usage.tokensIn} in · ${usage.tokensOut} out · US$ ${usage.costUsd.toFixed(4)}`);
  await recordUsage(projectId, usage);

  await ctx.progress({ percent: 80, message: "Gravando ideias" });
  const ideas = data.ideas.slice(0, count).map((i) => ({
    projectId,
    title: i.title.slice(0, 120),
    category: i.category,
    synopsis: i.synopsis,
    hookLines: JSON.stringify(i.hookLines.slice(0, 3)),
    ctrEstimate: Math.round(i.ctrEstimate * 10) / 10,
    score: Math.round(i.score),
    retention30s: Math.round(i.retention30s),
    editingPace: i.editingPace,
    viralityReason: i.viralityReason,
    promptVersion: IDEATION_PROMPT_VERSION,
    model: `${usage.provider}/${usage.model}`,
  }));

  await prisma.$transaction(async (tx) => {
    if (!append) await tx.idea.deleteMany({ where: { projectId, selected: false } });
    await tx.idea.createMany({ data: ideas });
    // Recomendada = maior score entre todas as não selecionadas
    const all = await tx.idea.findMany({ where: { projectId }, orderBy: { score: "desc" } });
    await tx.idea.updateMany({ where: { projectId }, data: { recommended: false } });
    if (all[0]) await tx.idea.update({ where: { id: all[0].id }, data: { recommended: true } });
  });

  await ctx.log(`${ideas.length} ideia(s) gravadas: ${ideas.map((i) => `"${i.title}"`).join(" · ")}`);
  return { count: ideas.length, usage };
}
