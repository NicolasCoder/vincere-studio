import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@vincere-studio/db";
import { WorkflowGraph, canConnect } from "@vincere-studio/core";
import { checkAgentAuth } from "@/lib/agent-api";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = checkAgentAuth(req);
  if (denied) return denied;

  const { id } = await params;
  const wf = await prisma.workflow.findUnique({ where: { id } });
  if (!wf) {
    return NextResponse.json(
      { ok: false, error: { codigo: "NAO_ENCONTRADO", mensagem: `Workflow ${id} não encontrado.` } },
      { status: 404 },
    );
  }

  let parsedGraph: unknown = { nodes: [], edges: [] };
  try {
    parsedGraph = JSON.parse(wf.graph);
  } catch {}

  const jobs = await prisma.job.findMany({
    where: { type: "RUN_WORKFLOW" },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const lastJob = jobs.find((j) => j.payload.includes(`"workflowId":"${id}"`)) ?? null;

  return NextResponse.json({
    ok: true,
    workflow: {
      ...wf,
      graph: parsedGraph,
    },
    lastJob,
  });
}

const updateWorkflowSchema = z.object({
  name: z.string().trim().min(2).max(140).optional(),
  graph: WorkflowGraph,
});

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = checkAgentAuth(req);
  if (denied) return denied;

  const { id } = await params;
  const wf = await prisma.workflow.findUnique({ where: { id } });
  if (!wf) {
    return NextResponse.json(
      { ok: false, error: { codigo: "NAO_ENCONTRADO", mensagem: `Workflow ${id} não encontrado.` } },
      { status: 404 },
    );
  }

  const parsed = updateWorkflowSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: { codigo: "GRAFO_INVALIDO", mensagem: "Grafo de workflow inválido.", detalhes: parsed.error.flatten() } },
      { status: 400 },
    );
  }

  const { name, graph } = parsed.data;
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));

  for (const edge of graph.edges) {
    const src = nodeById.get(edge.source);
    const dst = nodeById.get(edge.target);
    if (!src || !dst) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            codigo: "ARESTA_ORFA",
            mensagem: `A aresta ${edge.id} referencia nós inexistentes (${edge.source} -> ${edge.target}).`,
          },
        },
        { status: 422 },
      );
    }
    if (!canConnect(src.type, dst.type)) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            codigo: "CONEXAO_NAO_PERMITIDA",
            mensagem: `Conexão inválida entre ${src.type} (${src.id}) e ${dst.type} (${dst.id}).`,
          },
        },
        { status: 422 },
      );
    }
  }

  const updated = await prisma.workflow.update({
    where: { id },
    data: {
      ...(name ? { name } : {}),
      status: "READY",
      graph: JSON.stringify(graph),
    },
  });

  return NextResponse.json({
    ok: true,
    workflow: {
      ...updated,
      graph,
    },
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = checkAgentAuth(req);
  if (denied) return denied;

  const { id } = await params;
  const wf = await prisma.workflow.findUnique({ where: { id } });
  if (!wf) {
    return NextResponse.json(
      { ok: false, error: { codigo: "NAO_ENCONTRADO", mensagem: `Workflow ${id} não encontrado.` } },
      { status: 404 },
    );
  }

  await prisma.workflow.update({ where: { id }, data: { status: "RUNNING" } });
  const job = await prisma.job.create({
    data: {
      type: "RUN_WORKFLOW",
      payload: JSON.stringify({ workflowId: id }),
    },
  });

  return NextResponse.json({
    ok: true,
    workflowId: id,
    jobId: job.id,
    waitUrl: `/api/v1/jobs/${job.id}/wait`,
  });
}
