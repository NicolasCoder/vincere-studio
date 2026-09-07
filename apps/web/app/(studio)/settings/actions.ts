"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@docupulse/db";

export async function enqueueDemoJob() {
  await prisma.job.create({ data: { type: "DEMO", payload: JSON.stringify({ steps: 10, delayMs: 400 }) } });
  revalidatePath("/settings");
}
