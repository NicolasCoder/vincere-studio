import { NextResponse } from "next/server";
import { z } from "zod";
import { esquecer, lembrar, listarMemoria, registrarFeedback } from "@/lib/vince-memoria";

export const dynamic = "force-dynamic";

// GET  /api/vince                                    → memória e feedback
// POST { action: "lembrar", texto }                   → anotação manual
// POST { action: "esquecer", id }                     → apaga uma lembrança
// POST { action: "feedback", pergunta, resposta, nota, comentario? }
export async function GET() {
  return NextResponse.json({ ok: true, ...(await listarMemoria()) });
}

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("lembrar"), texto: z.string().trim().min(4).max(300) }),
  z.object({ action: z.literal("esquecer"), id: z.string().min(1).max(20) }),
  z.object({
    action: z.literal("feedback"),
    pergunta: z.string().max(4000),
    resposta: z.string().max(8000),
    nota: z.union([z.literal(1), z.literal(-1)]),
    comentario: z.string().max(300).optional(),
  }),
]);

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Dados inválidos" }, { status: 400 });
  const d = parsed.data;
  if (d.action === "lembrar") return NextResponse.json({ ok: true, item: await lembrar(d.texto, "manual") });
  if (d.action === "esquecer") {
    await esquecer(d.id);
    return NextResponse.json({ ok: true });
  }
  await registrarFeedback({ pergunta: d.pergunta, resposta: d.resposta, nota: d.nota, comentario: d.comentario });
  return NextResponse.json({ ok: true });
}
