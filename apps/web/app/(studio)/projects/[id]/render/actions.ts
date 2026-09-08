"use server";
import { redirect } from "next/navigation";
import { prisma } from "@docupulse/db";

export async function renderVideo(projectId: string, formData: FormData) {
  const profile = String(formData.get("profile") ?? "");
  const captions = formData.get("captions") !== null;
  const job = await prisma.job.create({ data: { type: "RENDER_VIDEO", projectId, payload: JSON.stringify({ projectId, profile: profile || undefined, captions }) } });
  redirect(`/projects/${projectId}/render?job=${job.id}`);
}
