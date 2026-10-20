import { NextResponse } from "next/server";
import { z } from "zod";
import { createRequest, listRequests, updateRequest, type ClaudeRequestStatus } from "@/lib/claude-inbox";

export const dynamic = "force-dynamic";

const STATUSES = ["pendente", "fazendo", "feito", "erro"] as const;

// GET  /api/claude[?status=pendente]  → lista (o Claude no PC lê por aqui)
export async function GET(req: Request) {
  const status = new URL(req.url).searchParams.get("status");
  const items = await listRequests(STATUSES.includes(status as ClaudeRequestStatus) ? (status as ClaudeRequestStatus) : undefined);
  return NextResponse.json({ ok: true, items });
}

const createSchema = z.object({
  pedido: z.string().trim().min(3).max(4000),
  pagina: z.string().max(200).optional(),
  projetoHf: z.string().max(200).optional(),
  projetoId: z.string().max(60).optional(),
  anexo: z.string().max(20000).optional(),
});

// POST /api/claude  → novo pedido (botão "Chamar o Claude")
export async function POST(req: Request) {
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Escreva o pedido (mínimo 3 caracteres)." }, { status: 400 });
  }
  return NextResponse.json({ ok: true, item: await createRequest(parsed.data) });
}

const patchSchema = z.object({
  id: z.string().min(1),
  status: z.enum(STATUSES).optional(),
  resposta: z.string().max(20000).optional(),
});

// PATCH /api/claude  → o Claude marca andamento e devolve a resposta
export async function PATCH(req: Request) {
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Dados inválidos" }, { status: 400 });
  const { id, ...patch } = parsed.data;
  const item = await updateRequest(id, patch);
  if (!item) return NextResponse.json({ ok: false, error: "Pedido não encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true, item });
}
