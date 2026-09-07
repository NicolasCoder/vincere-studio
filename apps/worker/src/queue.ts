import { prisma, type Job } from "@docupulse/db";
import type { JobProgress } from "@docupulse/core";

/**
 * Fila v1: polling da tabela Job no SQLite. Interface mínima para que, no SaaS,
 * a mesma assinatura seja servida por BullMQ/Redis sem tocar nos jobs.
 */
export interface JobContext {
  job: Job;
  payload: Record<string, unknown>;
  log: (line: string) => Promise<void>;
  progress: (p: JobProgress) => Promise<void>;
  isCancelled: () => Promise<boolean>;
}

export async function claimNext(): Promise<Job | null> {
  const next = await prisma.job.findFirst({ where: { status: "QUEUED" }, orderBy: { createdAt: "asc" } });
  if (!next) return null;
  // Claim atômico: só ganha quem ainda vê QUEUED.
  const claimed = await prisma.job.updateMany({
    where: { id: next.id, status: "QUEUED" },
    data: { status: "RUNNING", startedAt: new Date(), attempts: { increment: 1 } },
  });
  return claimed.count === 1 ? prisma.job.findUnique({ where: { id: next.id } }) : null;
}

export function makeContext(job: Job): JobContext {
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(job.payload);
  } catch {}
  return {
    job,
    payload,
    log: async (line) => {
      const stamp = new Date().toISOString().slice(11, 19);
      const entry = `[${stamp}] ${line}\n`;
      await prisma.$executeRaw`UPDATE "Job" SET logs = logs || ${entry}, message = ${line} WHERE id = ${job.id}`;
      console.log(`[${job.type}:${job.id.slice(-6)}] ${line}`);
    },
    progress: async (p) => {
      await prisma.job.update({ where: { id: job.id }, data: { progress: Math.round(p.percent), message: p.message } });
    },
    isCancelled: async () => (await prisma.job.findUnique({ where: { id: job.id }, select: { status: true } }))?.status === "CANCELLED",
  };
}

export async function finish(job: Job, result: unknown) {
  await prisma.job.update({
    where: { id: job.id },
    data: { status: "DONE", progress: 100, finishedAt: new Date(), result: JSON.stringify(result ?? null) },
  });
}

export async function fail(job: Job, err: unknown) {
  const error = err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err);
  await prisma.job.update({ where: { id: job.id }, data: { status: "FAILED", finishedAt: new Date(), error } });
}
