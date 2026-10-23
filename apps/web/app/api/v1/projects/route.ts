import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@vincere-studio/db";
import { checkAgentAuth, computeProjectAgentState } from "@/lib/agent-api";

export const dynamic = "force-dynamic";

const createProjectSchema = z.object({
  title: z.string().trim().min(2).max(160),
  niche: z.string().trim().min(2).max(120).default("dossie"),
  format: z.enum(["LONG_16_9", "SHORT_9_16"]).default("SHORT_9_16"),
  costMode: z.enum(["FREE", "HYBRID", "PREMIUM"]).default("FREE"),
  tone: z.string().trim().max(240).optional(),
  targetDuration: z.number().int().min(10).max(7200).optional(),
  audience: z.string().trim().max(240).optional(),
  visualStyle: z.string().trim().max(60).default("DARK_DOC"),
  intensidade: z.enum(["calmo", "equilibrado", "dinamico", "muito-dinamico"]).default("equilibrado"),
  captionPreset: z.string().trim().max(60).default("auto"),
  voiceProfileId: z.string().trim().optional(),
});

export async function GET(req: Request) {
  const denied = checkAgentAuth(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 40)));
  const stage = url.searchParams.get("stage") || undefined;

  const projects = await prisma.project.findMany({
    where: stage ? { stage } : undefined,
    orderBy: { updatedAt: "desc" },
    take: limit,
    include: {
      _count: {
        select: {
          ideas: true,
          scripts: true,
          renderJobs: true,
          publications: true,
          jobs: true,
        },
      },
    },
  });

  return NextResponse.json({
    ok: true,
    total: projects.length,
    projects: projects.map((p) => ({
      id: p.id,
      title: p.title,
      niche: p.niche,
      format: p.format,
      stage: p.stage,
      status: p.status,
      costMode: p.costMode,
      intensidade: p.intensidade,
      targetDuration: p.targetDuration,
      costUsd: p.costUsd,
      counts: p._count,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      urls: {
        state: `/api/v1/projects/${p.id}/state`,
        detail: `/api/v1/projects/${p.id}`,
        content: `/api/v1/projects/${p.id}/content`,
        actions: `/api/v1/projects/${p.id}/actions`,
      },
    })),
  });
}

export async function POST(req: Request) {
  const denied = checkAgentAuth(req);
  if (denied) return denied;

  const parsed = createProjectSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          codigo: "PAYLOAD_INVALIDO",
          mensagem: "Dados inválidos para criar projeto.",
          detalhes: parsed.error.flatten(),
        },
      },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const project = await prisma.project.create({
    data: {
      title: data.title,
      niche: data.niche,
      format: data.format,
      costMode: data.costMode,
      tone: data.tone,
      targetDuration: data.targetDuration ?? (data.format === "SHORT_9_16" ? 60 : 480),
      audience: data.audience,
      visualStyle: data.visualStyle,
      intensidade: data.intensidade,
      captionPreset: data.captionPreset,
      voiceProfileId: data.voiceProfileId,
      stage: "IDEATION",
      status: "IN_PROGRESS",
    },
  });

  const state = await computeProjectAgentState(project.id);
  return NextResponse.json(
    {
      ok: true,
      project,
      state,
    },
    { status: 201 },
  );
}
