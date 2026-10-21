import { NextResponse } from "next/server";
import { z } from "zod";
import { createRequest, listRequests, updateRequest, type ClaudeRequestStatus } from "@/lib/claude-inbox";
import { detectLocalAgents, dispatchLocalAgent } from "@/lib/local-agent-runner";

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
  engine: z.enum(["auto", "agy", "claude", "inbox"]).optional(),
  selection: selectionSchema,
});

// POST /api/claude  → cria pedido e dispara o agente local (Antigravity agy / Claude Code)
export async function POST(req: Request) {
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Escreva o pedido (mínimo 3 caracteres)." }, { status: 400 });
  }
  const { engine, projectDir, selection, ...rest } = parsed.data;
  const item = await createRequest(rest);

  const dispatch = await dispatchLocalAgent({
    requestId: item.id,
    pedido: rest.pedido,
    engine: engine ?? "auto",
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
