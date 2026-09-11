import { prisma } from "@docupulse/db";
import {
  ActSchema,
  OutlineSchema,
  RewriteSchema,
  countWords,
  rewritePrompt,
  SCRIPT_PROMPT_VERSION,
  actPrompt,
  outlinePrompt,
  scriptSystemPrompt,
  type ScriptContext,
  type VideoFormat,
} from "@docupulse/core";
import { getTextProvider, recordUsage } from "@docupulse/providers";
import type { JobContext } from "../queue";
import { recomputeScript } from "./script-utils";

/**
 * GENERATE_SCRIPT: outline (1 chamada) → texto de cada ato (1 chamada por ato, com resumo acumulado).
 * Cria uma nova versão de Script para o projeto. payload: { projectId }
 */
export async function generateScript(ctx: JobContext) {
  const projectId = String(ctx.payload.projectId ?? ctx.job.projectId ?? "");
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { ideas: { where: { selected: true }, take: 1 }, scripts: { orderBy: { version: "desc" }, take: 1 } },
  });
  if (!project) throw new Error(`Projeto ${projectId} não encontrado`);
  const idea = project.ideas[0];
  if (!idea) throw new Error("Selecione uma ideia no Passo 1 antes de gerar o roteiro.");

  const c: ScriptContext = {
    format: project.format as VideoFormat,
    title: idea.title,
    synopsis: idea.synopsis,
    hookLines: JSON.parse(idea.hookLines || "[]"),
    niche: project.niche,
    tone: project.tone,
    audience: project.audience,
    targetDuration: project.targetDuration,
    hooks: JSON.parse(project.hooks || "[]"),
  };
  const provider = getTextProvider();
  const system = scriptSystemPrompt();
  let cost = 0;

  await ctx.progress({ percent: 5, message: "Estruturando os atos (outline)" });
  const outlineRes = await provider.generateJson(outlinePrompt(c), OutlineSchema, { system, temperature: 0.8 });
  await recordUsage(projectId, outlineRes.usage);
  cost += outlineRes.usage.costUsd;
  const outline = outlineRes.data;
  await ctx.log(`Outline: "${outline.title}" · ${outline.acts.length} atos · ${outlineRes.usage.model}`);

  // Remove versões vazias deixadas por execuções interrompidas
  await prisma.script.deleteMany({ where: { projectId, blocks: { none: {} } } });

  /**
   * Retoma um roteiro pela metade em vez de recomeçar.
   *
   * Antes, qualquer erro num ato apagava o roteiro inteiro no catch — um 503 do Gemini no ato 3
   * jogou fora os atos 1 e 2 já escritos, e a retentativa recomeçava do outline, com boa chance
   * de morrer no mesmo ponto. Num roteiro de 6 atos isso é quase uma hora de trabalho perdida por
   * uma indisponibilidade de segundos.
   *
   * Só retoma o que veio da MESMA versão de prompt: com o prompt diferente, os atos antigos foram
   * escritos sob outras regras e misturá-los faria um roteiro sem unidade.
   */
  const parcial = await prisma.script.findFirst({
    where: { projectId, promptVersion: SCRIPT_PROMPT_VERSION, ideaId: idea.id },
    orderBy: { version: "desc" },
    include: { blocks: { orderBy: { act: "asc" } } },
  });
  const retomar = parcial && parcial.blocks.length > 0 && parcial.blocks.length < outline.acts.length ? parcial : null;

  const version = retomar ? retomar.version : (project.scripts[0]?.version ?? 0) + 1;
  const script = retomar
    ? retomar
    : await prisma.script.create({
        data: { projectId, ideaId: idea.id, version, logline: outline.logline, promptVersion: SCRIPT_PROMPT_VERSION, model: `${outlineRes.usage.provider}/${outlineRes.usage.model}` },
      });

  const jaEscritos = new Set(retomar ? retomar.blocks.map((b) => b.act) : []);
  if (retomar) {
    await ctx.log(`Retomando o roteiro v${version}: ${jaEscritos.size} de ${outline.acts.length} atos já escritos.`);
  }

  // O resumo acumulado alimenta o prompt do próximo ato — ao retomar, ele precisa ser
  // reconstruído dos atos que já existem, senão o ato novo é escrito sem saber o que veio antes.
  let summary = retomar
    ? retomar.blocks.map((b) => `Ato ${b.act} (${b.title}): ${b.narration.slice(0, 180)}`).join(" ")
    : "";

  try {
  for (let i = 0; i < outline.acts.length; i++) {
    if (await ctx.isCancelled()) return { cancelled: true };
    const a = outline.acts[i];
    if (jaEscritos.has(a.act)) continue;
    await ctx.progress({ percent: 10 + ((i + 0.5) / outline.acts.length) * 80, message: `Escrevendo Ato ${a.act}: ${a.title}` });
    const res = await provider.generateJson(actPrompt(c, outline, i, summary), ActSchema, { system, temperature: 0.9 });
    await recordUsage(projectId, res.usage);
    cost += res.usage.costUsd;

    // Garantia de duração: se o ato veio curto (<75% da meta), pede uma expansão.
    const targetWords = Math.round((a.durationSec / 60) * 150);
    let narration = res.data.narration.trim();
    if (countWords(narration) < targetWords * 0.75) {
      await ctx.log(`Ato ${a.act} curto (${countWords(narration)}/${targetWords} palavras) · expandindo`);
      const exp = await provider.generateJson(
        rewritePrompt(narration, "custom", `Expanda este ato para aproximadamente ${targetWords} palavras (hoje tem ${countWords(narration)}), mantendo todos os fatos e o cliffhanger final, acrescentando detalhes concretos (datas, lugares, números), contexto sensorial e tensão crescente. Não repita frases.`, { title: outline.title, actTitle: a.title }),
        RewriteSchema,
        { system, temperature: 0.9 },
      );
      await recordUsage(projectId, exp.usage);
      cost += exp.usage.costUsd;
      if (countWords(exp.data.narration) > countWords(narration)) narration = exp.data.narration.trim();
    }
    await prisma.scriptBlock.create({
      data: {
        scriptId: script.id,
        act: a.act,
        order: i + 1,
        kind: a.kind,
        title: a.title,
        narration,
        wpm: Math.max(110, Math.min(180, Math.round(res.data.wpm || 150))),
        brollCue: res.data.brollCue,
        soundCue: res.data.soundCue,
      },
    });
    summary += `${summary ? " " : ""}Ato ${a.act} (${a.title}): ${a.goal}; termina com: ${a.cliffhanger}`;
    await ctx.log(`Ato ${a.act} escrito · ${res.usage.tokensOut} tokens`);
  }

  } catch (err) {
    // NÃO apaga o que já foi escrito. O roteiro parcial é o que permite retomar de onde parou na
    // próxima tentativa; apagá-lo por assepsia custa todos os atos anteriores. Roteiro sem NENHUM
    // ato é limpo no começo da próxima execução, então não sobra lixo.
    const escritos = await prisma.scriptBlock.count({ where: { scriptId: script.id } });
    await ctx.log(`Falhou com ${escritos} ato(s) já escritos — eles ficam salvos e a próxima tentativa retoma daqui.`);
    throw err;
  }

  await ctx.progress({ percent: 92, message: "Calculando tempos e retenção" });
  const r = await recomputeScript(script.id);
  await prisma.project.update({ where: { id: projectId }, data: { title: outline.title, stage: "SCRIPT" } });
  await ctx.log(`Roteiro v${version}: ${r.words} palavras · ${r.durationSec}s · retenção prevista ${r.retention.predicted}/100 · US$ ${cost.toFixed(4)} equiv.`);
  return { scriptId: script.id, version, ...r };
}
