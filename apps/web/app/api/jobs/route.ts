import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@vincere-studio/db";
import { JOB_TYPES } from "@vincere-studio/core";

/** API simples da fila. Também é o ponto de entrada para automações externas (n8n etc.). */
const Body = z.object({ type: z.enum(JOB_TYPES), projectId: z.string().optional(), payload: z.record(z.unknown()).default({}) });

export async function GET() {
  const jobs = await prisma.job.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  return NextResponse.json(jobs);
}

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const job = await prisma.job.create({ data: { ...parsed.data, payload: JSON.stringify(parsed.data.payload) } });
  return NextResponse.json(job, { status: 201 });
}
