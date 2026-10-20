"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@vincere-studio/db";
import { disconnectYoutube } from "@vincere-studio/providers";

export async function enqueueDemoJob() {
  await prisma.job.create({ data: { type: "DEMO", payload: JSON.stringify({ steps: 10, delayMs: 400 }) } });
  revalidatePath("/settings");
}

export async function disconnectYoutubeAction() {
  await disconnectYoutube();
  revalidatePath("/settings");
}
