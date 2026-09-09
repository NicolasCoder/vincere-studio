"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@docupulse/db";

export async function addSkill(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const category = String(formData.get("category") ?? "OUTRO").trim();
  const niche = String(formData.get("niche") ?? "").trim() || null;
  const content = String(formData.get("content") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  if (!title || !content) return;
  await prisma.scriptSkill.create({ data: { title, category, niche, content, notes } });
  revalidatePath("/skills");
}

export async function deleteSkill(id: string) {
  await prisma.scriptSkill.delete({ where: { id } });
  revalidatePath("/skills");
}
