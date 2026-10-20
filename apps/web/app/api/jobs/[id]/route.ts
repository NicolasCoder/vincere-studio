import { NextResponse } from "next/server";
import { prisma } from "@vincere-studio/db";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await prisma.job.findUnique({ where: { id } });
  return job ? NextResponse.json(job) : NextResponse.json({ error: "not found" }, { status: 404 });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.job.updateMany({ where: { id, status: { in: ["QUEUED", "RUNNING"] } }, data: { status: "CANCELLED" } });
  return NextResponse.json({ ok: true });
}
