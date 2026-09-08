"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@docupulse/db";

const back = (projectId: string, job?: string) => redirect(`/projects/${projectId}/media${job ? `?job=${job}` : ""}`);
async function enqueue(projectId: string, type: string, payload: Record<string, unknown> = {}) {
  const job = await prisma.job.create({ data: { type, projectId, payload: JSON.stringify({ projectId, ...payload }) } });
  back(projectId, job.id);
}

export async function synthesizeVoice(projectId: string, blockIds: string[] = [], force = false) {
  await enqueue(projectId, "SYNTHESIZE_VOICE", { ...(blockIds.length ? { blockIds } : {}), force });
}
export async function alignCaptions(projectId: string) {
  await enqueue(projectId, "ALIGN_CAPTIONS");
}
export async function generateScenePrompts(projectId: string, density: "dense" | "sparse" = "dense") {
  await enqueue(projectId, "GENERATE_SCENE_PROMPTS", { density });
}
export async function importInbox(projectId: string) {
  await enqueue(projectId, "IMPORT_INBOX");
}
export async function huntBroll(projectId: string, onlyPreferVideo = false) {
  await enqueue(projectId, "HUNT_BROLL", { onlyPreferVideo });
}
export async function setVoiceProfile(projectId: string, formData: FormData) {
  const voiceProfileId = String(formData.get("voiceProfileId") ?? "") || null;
  await prisma.project.update({ where: { id: projectId }, data: { voiceProfileId } });
  revalidatePath(`/projects/${projectId}/media`);
}
export async function setVisualStyle(projectId: string, formData: FormData) {
  await prisma.project.update({ where: { id: projectId }, data: { visualStyle: String(formData.get("visualStyle") ?? "DARK_DOC") } });
  revalidatePath(`/projects/${projectId}/media`);
}
export async function clearScene(projectId: string, sceneId: string) {
  await prisma.scene.update({ where: { id: sceneId }, data: { filePath: null, status: "PENDING", source: "GENERATED", provider: "FLOW_MANUAL", thumbPath: null } });
  revalidatePath(`/projects/${projectId}/media`);
}
