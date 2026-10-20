"use server";
import { redirect } from "next/navigation";
import { prisma } from "@vincere-studio/db";

export async function previewVoice(provider: string, voiceId: string, style: string, back: string) {
  const job = await prisma.job.create({ data: { type: "PREVIEW_VOICE", payload: JSON.stringify({ provider, voiceId, style }) } });
  redirect(`${back}?job=${job.id}#vozes`);
}
