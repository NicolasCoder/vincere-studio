"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@docupulse/db";

export async function generateImages(projectId: string, formData: FormData) {
  const prompt = String(formData.get("prompt") ?? "").trim();
  if (!prompt) redirect(`/projects/${projectId}/imagens?erro=vazio`);

  const engine = String(formData.get("engine") ?? "POLLINATIONS");
  const aspect = String(formData.get("aspect") ?? "16:9");
  const count = Number(formData.get("count") ?? 1);

  const job = await prisma.job.create({
    data: {
      type: "GENERATE_IMAGES",
      projectId,
      payload: JSON.stringify({ projectId, prompt, engine, aspect, count }),
    },
  });
  redirect(`/projects/${projectId}/imagens?job=${job.id}`);
}

export async function deleteImage(projectId: string, imageId: string) {
  // Só remove o registro: o arquivo fica em disco e a limpeza de storage é decisão separada,
  // para não apagar por engano algo que já foi usado num render.
  await prisma.generatedImage.delete({ where: { id: imageId } });
  revalidatePath(`/projects/${projectId}/imagens`);
}
