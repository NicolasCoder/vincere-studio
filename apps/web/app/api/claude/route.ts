import { NextResponse } from "next/server";
import { z } from "zod";
import { createRequest, listRequests, updateRequest, deleteRequest, clearRequests, type ClaudeRequestStatus } from "@/lib/claude-inbox";
import { detectLocalAgents, dispatchLocalAgent } from "@/lib/local-agent-runner";
import { lerCerebro } from "@/lib/cerebro";

export const dynamic = "force-dynamic";

const STATUSES = ["pendente", "fazendo", "feito", "erro"] as const;

// GET  /api/claude[?status=pendente]  → lista pedidos + agentes locais detectados (agy / claude)
export async function GET(req: Request) {
  const status = new URL(req.url).searchParams.get("status");
  const items = await listRequests(
    STATUSES.includes(status as ClaudeRequestStatus) ? (status as ClaudeRequestStatus) : undefined,
  );
  const agents = detectLocalAgents();
  return NextResponse.json({ ok: true, items, agents });
}

const selectionSchema = z
  .object({
    label: z.string().optional(),
    tagName: z.string().optional(),
    selector: z.string().optional(),
    hfId: z.string().optional(),
    currentTime: z.number().optional(),
    textContent: z.string().nullable().optional(),
    sourceFile: z.string().optional(),
    inlineStyles: z.record(z.string()).optional(),
    // Faixa de áudio selecionada na timeline (segundos), quando o Studio souber capturá-la.
    faixaAudio: z
      .object({ trilha: z.string().max(200).optional(), inicio: z.number().min(0).optional(), fim: z.number().min(0).optional() })
      .optional(),
  })
  .nullable()
  .optional();

const createSchema = z.object({
  pedido: z.string().trim().min(3).max(4000),
  pagina: z.string().max(200).optional(),
  projetoHf: z.string().max(200).optional(),
  projectDir: z.string().max(500).optional(),
  projetoId: z.string().max(60).optional(),
  anexo: z.string().max(20000).optional(),
  engine: z.enum(["auto", "agy", "claude", "codex", "hermes", "inbox"]).optional(),
  selection: selectionSchema,
});

// Sem motor escolhido, executa com o agente que a pessoa vinculou ao Vince (se houver); senão, o primeiro detectado.
async function resolverConfigPedido(escolhido?: "auto" | "agy" | "claude" | "codex" | "hermes" | "inbox") {
  const c = await lerCerebro();
  const engine: "auto" | "agy" | "claude" | "codex" | "hermes" | "inbox" =
    escolhido && escolhido !== "auto" ? escolhido : c?.tipo === "agente" ? (c.id as "agy" | "claude" | "codex" | "hermes") : "auto";
  const mesmoAgente = c?.tipo === "agente" && (engine === "auto" || c.id === engine);
  return {
    engine,
    modelo: mesmoAgente ? c?.modelo : undefined,
    esforco: mesmoAgente ? c?.esforco : undefined,
  };
}

// POST /api/claude  → cria pedido e dispara o agente local (Antigravity agy / Claude Code)
export async function POST(req: Request) {
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Escreva o pedido (mínimo 3 caracteres)." }, { status: 400 });
  }
  const { engine, projectDir, selection, ...rest } = parsed.data;
  const item = await createRequest(rest);
  const cfg = await resolverConfigPedido(engine);

  const dispatch = await dispatchLocalAgent({
    requestId: item.id,
    pedido: rest.pedido,
    engine: cfg.engine,
    modelo: cfg.modelo,
    esforco: cfg.esforco,
    projectHf: rest.projetoHf,
    projectDir,
    pagina: rest.pagina,
    anexo: rest.anexo,
    selection,
  });

  return NextResponse.json({
    ok: true,
    item,
    dispatched: dispatch.dispatched,
    engineUsed: dispatch.engineUsed,
  });
}

const patchSchema = z.object({
  id: z.string().min(1),
  status: z.enum(STATUSES).optional(),
  resposta: z.string().max(20000).optional(),
});

// PATCH /api/claude  → atualiza status/resposta do pedido
export async function PATCH(req: Request) {
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Dados inválidos" }, { status: 400 });
  const { id, ...patch } = parsed.data;
  const item = await updateRequest(id, patch);
  if (!item) return NextResponse.json({ ok: false, error: "Pedido não encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true, item });
}

// DELETE /api/claude?id=... ou ?filtro=all|feito|pendente  → limpa pedidos da fila
export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (id) {
    const ok = await deleteRequest(id);
    return NextResponse.json({ ok, apagado: id });
  }
  const filtro = (url.searchParams.get("filtro") ?? "all") as ClaudeRequestStatus | "all";
  const total = await clearRequests(filtro);
  return NextResponse.json({ ok: true, totalApagados: total });
}
