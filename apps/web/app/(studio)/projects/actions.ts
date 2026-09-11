"use server";
import path from "node:path";
import { rm } from "node:fs/promises";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@docupulse/db";
import { storageRoot } from "@docupulse/providers";
import { CostModeSchema, FORMATS, STAGES, STAGE_META, nextStage, type Stage, type VideoFormat } from "@docupulse/core";

const NewProject = z.object({
  format: z.enum(["LONG_16_9", "SHORT_9_16"]),
  costMode: CostModeSchema.default("FREE"),
  niche: z.string().min(3).max(120),
  tone: z.string().optional(),
  audience: z.string().optional(),
  targetDuration: z.coerce.number().optional(),
  hooks: z.array(z.string()).default([]),
});

export async function createProject(formData: FormData) {
  const data = NewProject.parse({
    format: formData.get("format"),
    costMode: formData.get("costMode") ?? "FREE",
    niche: formData.get("niche"),
    tone: formData.get("tone") ?? undefined,
    audience: formData.get("audience") ?? undefined,
    targetDuration: formData.get("targetDuration") ?? undefined,
    hooks: formData.getAll("hooks").map(String),
  });
  const format = FORMATS[data.format as VideoFormat];
  const p = await prisma.project.create({
    data: {
      title: data.niche,
      format: data.format,
      costMode: data.costMode,
      niche: data.niche,
      tone: data.tone,
      audience: data.audience,
      targetDuration: data.targetDuration ?? format.duration.default,
      hooks: JSON.stringify(data.hooks),
      status: "IN_PROGRESS",
    },
  });
  redirect(`/projects/${p.id}/ideation`);
}

/**
 * Avança o projeto para a próxima etapa do pipeline, com a validação mínima de cada passo.
 * Se algo faltar, volta para a mesma tela com ?blocked=<motivo>.
 */
export async function advanceStage(projectId: string) {
  const p = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: {
      ideas: { where: { selected: true }, take: 1 },
      scripts: { orderBy: { version: "desc" }, take: 1, include: { blocks: { include: { voiceTracks: true, scenes: true } } } },
      renderJobs: { orderBy: { startedAt: "desc" }, take: 1 },
    },
  });
  const current = p.stage as Stage;
  const next = nextStage(current);
  if (!next) return;

  const script = p.scripts[0];
  const blocks = script?.blocks ?? [];
  const written = blocks.filter((b) => b.narration.trim().length > 40 && !b.narration.startsWith("("));
  const checks: Record<Stage, string | null> = {
    IDEATION: p.ideas.length ? null : "Selecione uma ideia antes de iniciar o roteiro.",
    SCRIPT: !script || blocks.length === 0 ? "Gere ou escreva o roteiro antes de avançar." : written.length < blocks.length ? `Ainda há ${blocks.length - written.length} ato(s) sem texto no roteiro.` : null,
    MEDIA: blocks.some((b) => b.voiceTracks.length) ? null : "Sintetize a locução (Passo 3) antes de renderizar.",
    RENDER: p.renderJobs[0]?.progress === 100 ? null : "O render precisa terminar (100%) antes de publicar.",
    PUBLISH: null,
  };
  const blocked = checks[current];
  const currentHref = STAGE_META[current].href;
  if (blocked) redirect(`/projects/${projectId}/${currentHref}?blocked=${encodeURIComponent(blocked)}`);

  await prisma.project.update({
    where: { id: projectId },
    data: { stage: next, status: next === "PUBLISH" ? "PUBLISHED" : "IN_PROGRESS" },
  });
  redirect(`/projects/${projectId}/${STAGE_META[next].href}`);
}

/**
 * Move o projeto de coluna no quadro, arrastando.
 *
 * Sem as validações do `advanceStage` de propósito: isto é organização do quadro, não o botão
 * "avançar" do pipeline. Serve para corrigir um projeto que ficou na coluna errada, ou para
 * separar o que está parado do que está andando — e para isso precisa aceitar ir para trás.
 * A etapa é só um rótulo: nada do pipeline é apagado ou refeito ao mudar de coluna.
 */
export async function moveProjectStage(projectId: string, stage: string) {
  if (!(STAGES as readonly string[]).includes(stage)) throw new Error(`Etapa inválida: ${stage}`);
  await prisma.project.update({
    where: { id: projectId },
    data: {
      stage,
      // `status` acompanha para o resto da interface não contradizer a coluna. Só PUBLISH tem
      // leitura própria; as demais colunas são todas "em andamento".
      status: stage === "PUBLISH" ? "PUBLISHED" : "IN_PROGRESS",
    },
  });
  revalidatePath("/projects");
}

/**
 * Apaga o projeto: banco e disco.
 *
 * O cascade do Prisma cuida das linhas, mas NÃO dos arquivos — e é neles que mora o peso. Um
 * projeto renderizado guarda centenas de MB entre cenas, renders, prévias e miniaturas; apagar só
 * o registro deixaria o disco ocupado por algo que nem aparece mais na interface, que é a pior
 * combinação possível.
 *
 * Recusa enquanto houver job em andamento: apagar o projeto embaixo de um render deixaria o
 * worker escrevendo em pasta que não existe mais.
 */
export async function deleteProject(projectId: string) {
  const ativos = await prisma.job.count({ where: { projectId, status: { in: ["QUEUED", "RUNNING"] } } });
  if (ativos > 0) redirect(`/projects?erro=${encodeURIComponent(`Há ${ativos} job(s) em andamento neste projeto — espere terminar ou cancele antes de apagar.`)}`);

  const projeto = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!projeto) redirect("/projects");

  await prisma.project.delete({ where: { id: projectId } });
  // Depois do banco, nunca antes: se a remoção do disco falhar, o projeto já saiu da interface e
  // a pasta órfã é um problema de espaço, não de estado inconsistente.
  await rm(path.join(storageRoot(), "projects", projectId), { recursive: true, force: true }).catch(() => {});

  revalidatePath("/projects");
  redirect("/projects?apagado=1");
}

export async function selectIdea(projectId: string, ideaId: string) {
  await prisma.$transaction([
    prisma.idea.updateMany({ where: { projectId }, data: { selected: false } }),
    prisma.idea.update({ where: { id: ideaId }, data: { selected: true } }),
  ]);
  const idea = await prisma.idea.findUniqueOrThrow({ where: { id: ideaId } });
  await prisma.project.update({ where: { id: projectId }, data: { title: idea.title, stage: "SCRIPT" } });
  redirect(`/projects/${projectId}/script`);
}

/** Enfileira um job para o worker. Usado pelos botões "Gerar ..." (Sprint 1+) e pelo teste em Settings. */
export async function enqueueJob(type: string, projectId?: string, payload: Record<string, unknown> = {}) {
  const job = await prisma.job.create({ data: { type, projectId, payload: JSON.stringify(payload) } });
  return job.id;
}

/** Passo 1: enfileira a geração de ideias e volta para a tela acompanhando o job. */
export async function generateIdeas(projectId: string, opts: { append?: boolean; focus?: "all" | "viral" | "hooks"; count?: number } = {}) {
  const job = await prisma.job.create({
    data: { type: "GENERATE_IDEAS", projectId, payload: JSON.stringify({ projectId, count: opts.count ?? 3, append: opts.append ?? false, focus: opts.focus ?? "all" }) },
  });
  redirect(`/projects/${projectId}/ideation?job=${job.id}`);
}
