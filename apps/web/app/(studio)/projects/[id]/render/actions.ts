"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@vincere-studio/db";
import { CAPTION_PRESET_IDS } from "@vincere-studio/core";
import { MOTION_PRESETS, normalizeMotion } from "@vincere-studio/render";
import { captionStyleFromForm } from "./caption-style";

const REVIEW_STATUSES = ["PENDING", "APPROVED", "CHANGES_REQUESTED", "REJECTED"] as const;

export async function renderVideo(projectId: string, formData: FormData) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { captionPreset: true, captionStyle: true } });
  const profile = String(formData.get("profile") ?? "");
  const submittedPreset = formData.get("captionPreset");
  const presetRaw = submittedPreset == null ? (project?.captionPreset ?? "auto") : String(submittedPreset);
  const captionPreset = (CAPTION_PRESET_IDS as readonly string[]).includes(presetRaw) ? presetRaw : "auto";
  const captionStyle = submittedPreset == null ? (project?.captionStyle ?? "{}") : JSON.stringify(captionStyleFromForm(formData));
  const captions = formData.get("captions") !== null;
  const music = formData.get("music") !== null;
  if (submittedPreset != null) {
    await prisma.project.update({ where: { id: projectId }, data: { captionPreset, captionStyle } });
  }
  if (formData.get("saveCaption") !== null) {
    revalidatePath(`/projects/${projectId}/render`);
    redirect(`/projects/${projectId}/render?saved=caption`);
  }
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
        captionPreset,
        captionStyle,
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

/** Registra a decisão sobre uma versão sem apagar o MP4 rejeitado — o histórico continua comparável. */
export async function reviewRender(projectId: string, renderJobId: string, formData: FormData) {
  const statusRaw = String(formData.get("status") ?? "PENDING");
  const reviewStatus = REVIEW_STATUSES.includes(statusRaw as (typeof REVIEW_STATUSES)[number]) ? statusRaw : "PENDING";
  const reviewNote = String(formData.get("reviewNote") ?? "").trim() || null;
  const render = await prisma.renderJob.findFirst({ where: { id: renderJobId, projectId, outputPath: { not: null } }, select: { id: true } });
  if (!render) return;
  await prisma.renderJob.update({
    where: { id: render.id },
    data: { reviewStatus, reviewNote, reviewedAt: reviewStatus === "PENDING" ? null : new Date() },
  });
  revalidatePath(`/projects/${projectId}/render`);
  revalidatePath(`/projects/${projectId}/published`);
}

/** Ajusta uma cena para a próxima versão e marca o render atual como necessitando alterações. */
export async function updateSceneReview(projectId: string, sceneId: string, formData: FormData) {
  const scene = await prisma.scene.findFirst({ where: { id: sceneId, block: { script: { projectId } } }, select: { id: true, motion: true } });
  if (!scene) return;
  const statusRaw = String(formData.get("reviewStatus") ?? "PENDING");
  const reviewStatus = REVIEW_STATUSES.includes(statusRaw as (typeof REVIEW_STATUSES)[number]) ? statusRaw : "PENDING";
  const rawMotion = String(formData.get("motion") ?? "static");
  let previousMotion = normalizeMotion(undefined, "static");
  try { previousMotion = normalizeMotion(JSON.parse(scene.motion || "{}").kind, "static"); } catch {}
  const motion = MOTION_PRESETS.some((preset) => preset.id === rawMotion) ? normalizeMotion(rawMotion) : previousMotion;
  const motionChanged = motion !== previousMotion;
  const reviewNote = String(formData.get("reviewNote") ?? "").trim() || null;
  await prisma.scene.update({
    where: { id: scene.id },
    data: { motion: JSON.stringify({ kind: motion }), reviewStatus, reviewNote },
  });
  if (motionChanged || reviewStatus === "CHANGES_REQUESTED" || reviewStatus === "REJECTED") {
    const latest = await prisma.renderJob.findFirst({ where: { projectId, outputPath: { not: null } }, orderBy: { startedAt: "desc" }, select: { id: true } });
    if (latest) await prisma.renderJob.update({ where: { id: latest.id }, data: { reviewStatus: "CHANGES_REQUESTED", reviewedAt: new Date() } });
  }
  revalidatePath(`/projects/${projectId}/render`);
}
