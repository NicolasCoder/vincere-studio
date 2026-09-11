"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@docupulse/db";
import { INTENSIDADES, type Intensidade } from "@docupulse/core";

/**
 * Muda a intensidade do projeto — o multiplicador sobre os eixos do perfil (inserções e
 * transições). Não regenera o plano sozinho: o plano só reflete isto na próxima vez que for
 * gerado, porque regenerar automaticamente descartaria uma revisão manual já feita.
 */
export async function setIntensidade(projectId: string, formData: FormData) {
  const raw = String(formData.get("intensidade") ?? "equilibrado");
  const intensidade: Intensidade = (INTENSIDADES as readonly string[]).includes(raw) ? (raw as Intensidade) : "equilibrado";
  await prisma.project.update({ where: { id: projectId }, data: { intensidade } });
  revalidatePath(`/projects/${projectId}/edit-plan`);
}

export async function generateEditPlan(projectId: string) {
  const job = await prisma.job.create({
    data: { type: "GENERATE_EDIT_PLAN", projectId, payload: JSON.stringify({ projectId }) },
  });
  redirect(`/projects/${projectId}/edit-plan?job=${job.id}`);
}

/**
 * Aplica a camada visual sobre o master — é este job que DESENHA as inserções no vídeo.
 *
 * Ficou sem botão desde que foi escrito: o plano tinha como ser gerado pela tela, mas aplicá-lo
 * só acontecia enfileirando o job na mão. Na prática isso significava que os vídeos saíam sem
 * nenhuma das inserções, e não havia como perceber pela interface que faltava um passo.
 */
export async function applyVisualLayer(projectId: string) {
  const plan = await prisma.editPlan.findFirst({ where: { projectId }, orderBy: { version: "desc" } });
  if (!plan) redirect(`/projects/${projectId}/edit-plan?erro=sem-plano`);

  const render = await prisma.renderJob.findFirst({ where: { projectId, outputPath: { not: null } } });
  if (!render) redirect(`/projects/${projectId}/edit-plan?erro=sem-render`);

  const job = await prisma.job.create({
    data: { type: "APPLY_VISUAL_LAYER", projectId, payload: JSON.stringify({ projectId }) },
  });
  redirect(`/projects/${projectId}/edit-plan?job=${job.id}`);
}

/**
 * Gera as imagens de evidência que o plano propôs mas ainda não existem.
 *
 * Fica separado da geração do plano de propósito: propor evidência é barato, gerar imagem gasta
 * (crédito no motor pago, tempo no grátis). Quem decide é quem revisa.
 */
export async function generateEvidences(projectId: string, formData: FormData) {
  const engine = String(formData.get("engine") ?? "POLLINATIONS");
  const plan = await prisma.editPlan.findFirst({ where: { projectId }, orderBy: { version: "desc" } });
  if (!plan) redirect(`/projects/${projectId}/edit-plan`);

  const data = JSON.parse(plan.data) as {
    insertions: { id: string; evidencePrompt?: string; mesa?: { prompt: string }[] }[];
  };
  // A mesa de arquivo tem 2 ou 3 prompts por inserção, não um. Sem juntá-los aqui, o botão
  // geraria só as evidências únicas e a mesa apareceria vazia no render — sem erro nenhum,
  // que é a pior forma de falhar.
  const prompts = [
    ...data.insertions.flatMap((i) => (i.evidencePrompt ? [i.evidencePrompt] : [])),
    ...data.insertions.flatMap((i) => (i.mesa ?? []).map((m) => m.prompt)),
  ];
  const pendentes = [...new Set(prompts.map((p) => p.trim()).filter(Boolean))];
  if (!pendentes.length) redirect(`/projects/${projectId}/edit-plan?evid=nenhuma`);

  // Um job por evidência: assim uma falha isolada não derruba o lote inteiro, e o progresso
  // aparece imagem a imagem em vez de tudo no fim.
  const jobs = await Promise.all(
    pendentes.map((prompt) =>
      prisma.job.create({
        data: {
          type: "GENERATE_IMAGES",
          projectId,
          payload: JSON.stringify({ projectId, prompt, engine, aspect: "16:9", count: 1 }),
        },
      }),
    ),
  );
  redirect(`/projects/${projectId}/edit-plan?job=${jobs[0].id}&evid=${jobs.length}`);
}
