import { NextResponse } from "next/server";
import { prisma } from "@vincere-studio/db";
import { checkAgentAuth } from "@/lib/agent-api";

export const dynamic = "force-dynamic";

const TERMINAL_STATUSES = new Set(["DONE", "FAILED", "CANCELLED"]);

/**
 * Long-polling inteligente para agentes: aguarda o job concluir até `timeoutMs` (padrão 20s, máx 55s)
 * e devolve o estado final com result parseado.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = checkAgentAuth(req);
  if (denied) return denied;

  const { id } = await params;
  const url = new URL(req.url);
  const timeoutMs = Math.min(55000, Math.max(0, Number(url.searchParams.get("timeoutMs") ?? 20000)));
  const pollIntervalMs = 500;
  const started = Date.now();

  while (true) {
    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) {
      return NextResponse.json(
        { ok: false, error: { codigo: "JOB_NAO_ENCONTRADO", mensagem: `Job ${id} não existe.` } },
        { status: 404 },
      );
    }

    if (TERMINAL_STATUSES.has(job.status) || Date.now() - started >= timeoutMs) {
      let parsedResult: unknown = null;
      if (job.result) {
        try {
          parsedResult = JSON.parse(job.result);
        } catch {
          parsedResult = job.result;
        }
      }
      return NextResponse.json({
        ok: job.status !== "FAILED",
        finished: TERMINAL_STATUSES.has(job.status),
        job: {
          id: job.id,
          type: job.type,
          projectId: job.projectId,
          status: job.status,
          progress: job.progress,
          message: job.message,
          error: job.error,
          result: parsedResult,
          logsTail: job.logs ? job.logs.split("\n").slice(-25).join("\n") : "",
          startedAt: job.startedAt,
          finishedAt: job.finishedAt,
        },
      });
    }

    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }
}
