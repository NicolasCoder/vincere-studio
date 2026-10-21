"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@vincere-studio/db";
import { atualizarCanal, identificarCanal, listarCanaisMonitorados, temChaveYoutube } from "@/lib/canais-stats";

/** Busca os números atuais de todos os canais monitorados (seu + concorrentes) e guarda o histórico. */
export async function atualizarCanais() {
  if (!temChaveYoutube()) redirect("/metrics?erro=chave");
  for (const c of await listarCanaisMonitorados()) await atualizarCanal(c.ref, c.url);
  revalidatePath("/metrics");
  redirect("/metrics?ok=1");
}

/** Adiciona um canal (concorrente ou inspiração) ao monitoramento e já traz os números dele. */
export async function adicionarCanal(formData: FormData) {
  const url = String(formData.get("url") ?? "").trim();
  const nicho = String(formData.get("nicho") ?? "").trim() || "Geral";
  if (!identificarCanal(url)) redirect("/metrics?erro=url");
  const ja = await prisma.referenceChannel.findFirst({ where: { url } });
  const ref = ja ?? (await prisma.referenceChannel.create({ data: { url, niche: nicho } }));
  if (temChaveYoutube()) await atualizarCanal(`ref:${ref.id}`, url);
  revalidatePath("/metrics");
  redirect(temChaveYoutube() ? "/metrics?ok=1" : "/metrics?erro=chave");
}

export async function removerCanal(refId: string) {
  await prisma.referenceChannel.delete({ where: { id: refId } }).catch(() => null);
  await prisma.setting.delete({ where: { key: `canal:ref:${refId}` } }).catch(() => null);
  revalidatePath("/metrics");
  redirect("/metrics");
}
