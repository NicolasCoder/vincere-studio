"use server";
import { redirect } from "next/navigation";
import { prisma } from "@docupulse/db";

export async function renderVideo(projectId: string, formData: FormData) {
  const profile = String(formData.get("profile") ?? "");
  const captions = formData.get("captions") !== null;
  const music = formData.get("music") !== null;
  // `preview` vem do botão de prova, que usa o mesmo formulário para herdar trilha e legenda —
  // uma prova com opções diferentes das do render final não provaria o render final. O perfil
  // também não é forçado: em projeto vertical, 720p sairia 1280×720 e a prova mentiria sobre o
  // enquadramento, que é justamente uma das coisas que ela existe para mostrar.
  const preview = formData.get("preview") !== null;
  const job = await prisma.job.create({
    data: {
      type: "RENDER_VIDEO",
      projectId,
      payload: JSON.stringify({
        projectId,
        profile: profile || undefined,
        captions,
        music,
        ...(preview ? { preview: true } : {}),
      }),
    },
  });
  redirect(`/projects/${projectId}/render?job=${job.id}`);
}

export async function generateThumbnail(projectId: string) {
  const job = await prisma.job.create({ data: { type: "GENERATE_THUMBNAIL", projectId, payload: JSON.stringify({ projectId }) } });
  redirect(`/projects/${projectId}/render?job=${job.id}`);
}
