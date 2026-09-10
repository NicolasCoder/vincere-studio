"use server";
import { redirect } from "next/navigation";
import { prisma } from "@docupulse/db";

export async function generateEditPlan(projectId: string) {
  const job = await prisma.job.create({
    data: { type: "GENERATE_EDIT_PLAN", projectId, payload: JSON.stringify({ projectId }) },
  });
  redirect(`/projects/${projectId}/edit-plan?job=${job.id}`);
}
