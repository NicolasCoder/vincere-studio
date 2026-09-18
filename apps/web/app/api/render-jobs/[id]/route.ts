import { NextResponse } from "next/server";
import { prisma } from "@docupulse/db";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await prisma.renderJob.findUnique({
    where: { id },
    select: { id: true, progress: true, outputPath: true, log: true, finishedAt: true, profile: true },
  });
  return job ? NextResponse.json(job) : NextResponse.json({ error: "not found" }, { status: 404 });
}
