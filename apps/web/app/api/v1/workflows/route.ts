import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@vincere-studio/db";
import { WORKFLOW_KINDS, WorkflowGraph, templateGraph } from "@vincere-studio/core";
import { checkAgentAuth } from "@/lib/agent-api";

export const dynamic = "force-dynamic";

const createWorkflowSchema = z.object({
  name: z.string().trim().min(2).max(140),
  kind: z.enum(WORKFLOW_KINDS).default("VERTICAL_COMMERCIAL"),
  graph: WorkflowGraph.optional(),
});

export async function GET(req: Request) {
  const denied = checkAgentAuth(req);
  if (denied) return denied;

  const workflows = await prisma.workflow.findMany({
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({
    ok: true,
    total: workflows.length,
    workflows: workflows.map((w) => {
      let parsedGraph: { nodes?: unknown[]; edges?: unknown[] } = { nodes: [], edges: [] };
      try {
        parsedGraph = JSON.parse(w.graph);
      } catch {}
      return {
        id: w.id,
        name: w.name,
        kind: w.kind,
        status: w.status,
        nodesCount: Array.isArray(parsedGraph.nodes) ? parsedGraph.nodes.length : 0,
        edgesCount: Array.isArray(parsedGraph.edges) ? parsedGraph.edges.length : 0,
        updatedAt: w.updatedAt,
        url: `/api/v1/workflows/${w.id}`,
      };
    }),
  });
}

export async function POST(req: Request) {
  const denied = checkAgentAuth(req);
  if (denied) return denied;

  const parsed = createWorkflowSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: { codigo: "PAYLOAD_INVALIDO", mensagem: "Dados inválidos para criar workflow.", detalhes: parsed.error.flatten() } },
      { status: 400 },
    );
  }

  const d = parsed.data;
  const graphObj = d.graph ?? templateGraph(d.kind);
  const wf = await prisma.workflow.create({
    data: {
      name: d.name,
      kind: d.kind,
      status: "READY",
      graph: JSON.stringify(graphObj),
    },
  });

  return NextResponse.json(
    {
      ok: true,
      workflow: {
        ...wf,
        graph: graphObj,
      },
    },
    { status: 201 },
  );
}
