import { NextResponse } from "next/server";
import { prisma } from "@docupulse/db";

/** Status do fluxo + último job de execução (usado pelo polling do canvas). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const wf = await prisma.workflow.findUnique({ where: { id }, select: { id: true, status: true, updatedAt: true, graph: true } });
  if (!wf) return NextResponse.json({ error: "not found" }, { status: 404 });
  const jobs = await prisma.job.findMany({ where: { type: "RUN_WORKFLOW" }, orderBy: { createdAt: "desc" }, take: 20 });
  const job = jobs.find((j) => j.payload.includes(`"workflowId":"${id}"`)) ?? null;
  return NextResponse.json({
    ...wf,
    job: job && { id: job.id, status: job.status, progress: job.progress, message: job.message, error: job.error, logs: job.logs },
  });
}
