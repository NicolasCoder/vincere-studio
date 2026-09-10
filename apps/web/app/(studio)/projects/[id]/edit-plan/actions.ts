"use server";
import { redirect } from "next/navigation";
import { prisma } from "@docupulse/db";

export async function generateEditPlan(projectId: string) {
  const job = await prisma.job.create({
    data: { type: "GENERATE_EDIT_PLAN", projectId, payload: JSON.stringify({ projectId }) },
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

  const data = JSON.parse(plan.data) as { insertions: { id: string; evidencePrompt?: string }[] };
  const pendentes = data.insertions.filter((i) => i.evidencePrompt);
  if (!pendentes.length) redirect(`/projects/${projectId}/edit-plan?evid=nenhuma`);

  // Um job por evidência: assim uma falha isolada não derruba o lote inteiro, e o progresso
  // aparece imagem a imagem em vez de tudo no fim.
  const jobs = await Promise.all(
    pendentes.map((i) =>
      prisma.job.create({
        data: {
          type: "GENERATE_IMAGES",
          projectId,
          payload: JSON.stringify({ projectId, prompt: i.evidencePrompt, engine, aspect: "16:9", count: 1 }),
        },
      }),
    ),
  );
  redirect(`/projects/${projectId}/edit-plan?job=${jobs[0].id}&evid=${jobs.length}`);
}
