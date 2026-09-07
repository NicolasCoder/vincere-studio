import { NextResponse } from "next/server";
import { prisma } from "@docupulse/db";

/**
 * Webhook de entrada (ex.: n8n cria um projeto a partir de uma planilha de tópicos).
 * POST { niche, format?, costMode? } → cria projeto em IDEATION.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { niche?: string; format?: string; costMode?: string };
  if (!body.niche) return NextResponse.json({ error: "niche obrigatório" }, { status: 400 });
  const p = await prisma.project.create({
    data: { title: body.niche, niche: body.niche, format: body.format ?? "LONG_16_9", costMode: body.costMode ?? "FREE", status: "IN_PROGRESS" },
  });
  return NextResponse.json({ id: p.id, url: `/projects/${p.id}/ideation` }, { status: 201 });
}
