import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@vincere-studio/db";
import { checkAgentAuth, computeProjectAgentState } from "@/lib/agent-api";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = checkAgentAuth(req);
  if (denied) return denied;

  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      ideas: { orderBy: { createdAt: "desc" } },
      scripts: {
        orderBy: { version: "desc" },
        take: 1,
        include: {
          blocks: {
            orderBy: { order: "asc" },
            include: {
              voiceTracks: {
                orderBy: { createdAt: "desc" },
                take: 1,
                include: { captions: { take: 1 } },
              },
              scenes: { orderBy: { order: "asc" } },
            },
          },
        },
      },
      renderJobs: { orderBy: [{ revision: "desc" }, { startedAt: "desc" }], take: 5 },
      publications: { orderBy: { publishedAt: "desc" }, take: 3 },
      jobs: { orderBy: { createdAt: "desc" }, take: 15 },
    },
  });

  if (!project) {
    return NextResponse.json(
      { ok: false, error: { codigo: "NAO_ENCONTRADO", mensagem: `Projeto ${id} não encontrado.` } },
      { status: 404 },
    );
  }

  const editPlan = await prisma.editPlan.findFirst({
    where: { projectId: id },
    orderBy: { version: "desc" },
  });

  const state = await computeProjectAgentState(id);
  return NextResponse.json({
    ok: true,
    project,
    editPlan,
    state,
  });
}

const patchProjectSchema = z.object({
  title: z.string().trim().min(2).max(160).optional(),
  niche: z.string().trim().min(2).max(120).optional(),
  format: z.enum(["LONG_16_9", "SHORT_9_16"]).optional(),
  stage: z.enum(["IDEATION", "SCRIPT", "MEDIA", "RENDER", "PUBLISH"]).optional(),
  status: z.enum(["DRAFT", "IN_PROGRESS", "PUBLISHED", "ARCHIVED"]).optional(),
  tone: z.string().trim().max(240).optional(),
  targetDuration: z.number().int().min(10).max(7200).optional(),
  intensidade: z.enum(["calmo", "equilibrado", "dinamico", "muito-dinamico"]).optional(),
  captionPreset: z.string().trim().max(60).optional(),
  captionStyle: z.string().optional(),
  voiceProfileId: z.string().nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = checkAgentAuth(req);
  if (denied) return denied;

  const { id } = await params;
  const parsed = patchProjectSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: { codigo: "PAYLOAD_INVALIDO", mensagem: "Campos inválidos.", detalhes: parsed.error.flatten() } },
      { status: 400 },
    );
  }

  const exists = await prisma.project.findUnique({ where: { id }, select: { id: true } });
  if (!exists) {
    return NextResponse.json(
      { ok: false, error: { codigo: "NAO_ENCONTRADO", mensagem: `Projeto ${id} não encontrado.` } },
      { status: 404 },
    );
  }

  const project = await prisma.project.update({
    where: { id },
    data: parsed.data,
  });
  const state = await computeProjectAgentState(id);

  return NextResponse.json({ ok: true, project, state });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = checkAgentAuth(req);
  if (denied) return denied;

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { confirm?: boolean };
  const confirmQuery = new URL(req.url).searchParams.get("confirm") === "true";

  if (!body.confirm && !confirmQuery) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          codigo: "CONFIRMACAO_OBRIGATORIA",
          mensagem: "Para excluir um projeto via API, envie { \"confirm\": true } ou ?confirm=true.",
        },
      },
      { status: 400 },
    );
  }

  const exists = await prisma.project.findUnique({ where: { id }, select: { id: true, title: true } });
  if (!exists) {
    return NextResponse.json(
      { ok: false, error: { codigo: "NAO_ENCONTRADO", mensagem: `Projeto ${id} não encontrado.` } },
      { status: 404 },
    );
  }

  await prisma.project.delete({ where: { id } });
  return NextResponse.json({ ok: true, deletedId: id, title: exists.title });
}
