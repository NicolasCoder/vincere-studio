"use server";
import { redirect } from "next/navigation";
import { prisma } from "@docupulse/db";

export async function renderVideo(projectId: string, formData: FormData) {
  const profile = String(formData.get("profile") ?? "");
  const captions = formData.get("captions") !== null;
  const music = formData.get("music") !== null;
  const job = await prisma.job.create({ data: { type: "RENDER_VIDEO", projectId, payload: JSON.stringify({ projectId, profile: profile || undefined, captions, music }) } });
  redirect(`/projects/${projectId}/render?job=${job.id}`);
}

export async function generateThumbnail(projectId: string) {
  const job = await prisma.job.create({ data: { type: "GENERATE_THUMBNAIL", projectId, payload: JSON.stringify({ projectId }) } });
  redirect(`/projects/${projectId}/render?job=${job.id}`);
}
