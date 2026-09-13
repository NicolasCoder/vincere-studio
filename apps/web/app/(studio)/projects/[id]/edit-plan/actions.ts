"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@docupulse/db";
import { EDIT_LAYOUTS, INTENSIDADES, type EditLayout, type EditPlanData, type Intensidade } from "@docupulse/core";

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
 * Edita uma inserção do plano na mão — texto, horário ou layout — sem regenerar o plano inteiro.
 *
 * Atualiza a MESMA versão do plano (não cria `v+1`): isto é correção pontual de quem revisou,
 * não uma nova rodada da IA. `resolved` vira `true` — a pessoa acabou de confirmar o tempo com a
 * própria mão, então o aviso de "tempo não confirmado" não faz mais sentido aqui.
 */
export async function editarInsercao(projectId: string, insertionId: string, formData: FormData) {
  const plan = await prisma.editPlan.findFirst({ where: { projectId }, orderBy: { version: "desc" } });
  if (!plan) redirect(`/projects/${projectId}/edit-plan`);

  const data = JSON.parse(plan.data) as EditPlanData;
  const idx = data.insertions.findIndex((i) => i.id === insertionId);
  if (idx === -1) redirect(`/projects/${projectId}/edit-plan`);

  if (formData.get("remover") === "1") {
    data.insertions.splice(idx, 1);
  } else {
    const ins = data.insertions[idx];
    const startS = Number(formData.get("startS"));
    const endS = Number(formData.get("endS"));
    const layoutRaw = String(formData.get("layout") ?? ins.layout);
    const layout: EditLayout = (EDIT_LAYOUTS as readonly string[]).includes(layoutRaw) ? (layoutRaw as EditLayout) : ins.layout;
    const secondary = String(formData.get("secondary") ?? "").trim();
    data.insertions[idx] = {
      ...ins,
      primary: String(formData.get("primary") ?? ins.primary).trim() || ins.primary,
      secondary: secondary || undefined,
      layout,
      startMs: Number.isFinite(startS) && startS >= 0 ? Math.round(startS * 1000) : ins.startMs,
      endMs: Number.isFinite(endS) && endS > 0 ? Math.round(endS * 1000) : ins.endMs,
      resolved: true,
    };
    // Reordena por tempo: mudar o horário de uma inserção pode tirá-la do lugar na lista.
    data.insertions.sort((a, b) => a.startMs - b.startMs);
  }

  await prisma.editPlan.update({ where: { id: plan.id }, data: { data: JSON.stringify(data) } });
  revalidatePath(`/projects/${projectId}/edit-plan`);
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
