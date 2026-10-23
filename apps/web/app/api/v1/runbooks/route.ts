import { NextResponse } from "next/server";
import { z } from "zod";
import { checkAgentAuth } from "@/lib/agent-api";
import { RUNBOOKS, evaluateRunbookForProject, getRunbookById } from "@/lib/runbooks";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = checkAgentAuth(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");
  const runbookId = url.searchParams.get("runbookId") ?? "curiosidades-short-9x16";

  if (projectId) {
    const evaluation = await evaluateRunbookForProject(runbookId, projectId);
    if (!evaluation) {
      return NextResponse.json(
        { ok: false, error: { codigo: "PROJETO_NAO_ENCONTRADO", mensagem: `Projeto ${projectId} não encontrado.` } },
        { status: 404 },
      );
    }
    return NextResponse.json({
      ok: true,
      evaluation,
      runbooks: RUNBOOKS,
    });
  }

  return NextResponse.json({
    ok: true,
    total: RUNBOOKS.length,
    runbooks: RUNBOOKS,
  });
}

const evaluateSchema = z.object({
  runbookId: z.string().min(1).default("curiosidades-short-9x16"),
  projectId: z.string().min(1),
});

export async function POST(req: Request) {
  const denied = checkAgentAuth(req);
  if (denied) return denied;

  const parsed = evaluateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: { codigo: "PAYLOAD_INVALIDO", mensagem: "Informe projectId e runbookId.", detalhes: parsed.error.flatten() } },
      { status: 400 },
    );
  }

  const rb = getRunbookById(parsed.data.runbookId);
  if (!rb) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          codigo: "RUNBOOK_NAO_ENCONTRADO",
          mensagem: `Runbook "${parsed.data.runbookId}" não existe.`,
          disponiveis: RUNBOOKS.map((r) => r.id),
        },
      },
      { status: 404 },
    );
  }

  const evaluation = await evaluateRunbookForProject(rb.id, parsed.data.projectId);
  if (!evaluation) {
    return NextResponse.json(
      { ok: false, error: { codigo: "PROJETO_NAO_ENCONTRADO", mensagem: `Projeto ${parsed.data.projectId} não encontrado.` } },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    evaluation,
  });
}
