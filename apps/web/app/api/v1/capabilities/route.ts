import { NextResponse } from "next/server";
import { prisma } from "@vincere-studio/db";
import { statusDasChaves } from "@vincere-studio/providers";
import { checkAgentAuth } from "@/lib/agent-api";
import { detectLocalAgents } from "@/lib/local-agent-runner";
import { lerCerebro } from "@/lib/cerebro";
import { lerAlvoHyperframes } from "@/lib/hyperframes-config";
import { getPcGpuStatus } from "@/lib/pc-gpu-engine";
import { RUNBOOKS } from "@/lib/runbooks";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = checkAgentAuth(req);
  if (denied) return denied;

  const [heartbeatSetting, projectsCount, workflowsCount, chaves, cerebro, alvoHf, gpuStatus] = await Promise.all([
    prisma.setting.findUnique({ where: { key: "worker_heartbeat" } }).catch(() => null),
    prisma.project.count(),
    prisma.workflow.count(),
    statusDasChaves(),
    lerCerebro(),
    lerAlvoHyperframes(),
    getPcGpuStatus().catch(() => ({ online: false, gpuName: null })),
  ]);

  const heartbeatTs = heartbeatSetting ? Date.parse(heartbeatSetting.value) : NaN;
  const heartbeatAgeMs = Number.isFinite(heartbeatTs) ? Math.max(0, Date.now() - heartbeatTs) : null;
  const workerOnline = heartbeatAgeMs !== null && heartbeatAgeMs < 60000;
  const localAgents = detectLocalAgents();

  return NextResponse.json({
    ok: true,
    product: "Vincere Studio",
    mode: "agent-first",
    visualEngine: "HyperFrames",
    instance: {
      projectsCount,
      workflowsCount,
      worker: {
        online: workerOnline,
        heartbeatAgeMs,
      },
      hyperframes: {
        modo: alvoHf.modo,
        url: alvoHf.url,
      },
      pcGpuBridge: gpuStatus,
      vinceBrain: cerebro,
      localCliAgents: localAgents,
      configuredKeys: chaves.map((c) => ({
        name: c.name,
        label: c.label,
        configured: Boolean(c.origem),
        source: c.origem,
      })),
    },
    mcpServer: {
      command: "node",
      args: ["scripts/vincere-mcp-server.mjs"],
      npmScript: "pnpm mcp:server",
    },
    endpoints: {
      capabilities: "GET /api/v1/capabilities",
      runbooks: "GET /api/v1/runbooks",
      evaluateRunbook: "POST /api/v1/runbooks (body: { projectId, runbookId })",
      listProjects: "GET /api/v1/projects",
      createProject: "POST /api/v1/projects",
      projectDetail: "GET / PATCH / DELETE /api/v1/projects/:id",
      projectState: "GET /api/v1/projects/:id/state",
      submitContent: "POST /api/v1/projects/:id/content (kinds: ideas | script | scenes | edit_plan | seo)",
      runAction:
        "POST /api/v1/projects/:id/actions (actions: auto_produce | gerar_ideias | escolher_ideia | gerar_roteiro | reescrever_bloco | sugerir_melhorias | sintetizar_voz | alinhar_legendas | planejar_cenas | buscar_broll | gerar_imagens | importar_inbox | gerar_plano_edicao | exportar_hyperframes | renderizar_video | gerar_thumbnail | aprovar_render | rejeitar_render | publicar_youtube)",
      waitJob: "GET /api/v1/jobs/:jobId/wait?timeoutMs=25000",
      workflows: "GET / POST /api/v1/workflows, GET / PUT / POST /api/v1/workflows/:id",
      terminalAgentDispatch: "GET / POST / PATCH /api/claude",
    },
    runbooks: RUNBOOKS.map((r) => ({
      id: r.id,
      nome: r.nome,
      nicho: r.nicho,
      formato: r.formato,
      motorVisual: r.motorVisual,
      passosCount: r.passos.length,
    })),
  });
}
