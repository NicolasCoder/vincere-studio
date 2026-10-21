import { NextResponse } from "next/server";
import { z } from "zod";
import { COMPONENTES, componentePorId, tokenAdminValido } from "@/lib/atualizacoes";

export const dynamic = "force-dynamic";

// GET  /api/atualizar            → lista componentes com versão instalada e a última publicada
// POST /api/atualizar {id,token} → atualiza o componente (exige ADMIN_TOKEN do servidor)
let cache: { em: number; itens: unknown[] } | null = null;

export async function GET() {
  // As versões vêm de comandos externos (npm view…); 10 min de cache evita rodá-los a cada visita.
  if (cache && Date.now() - cache.em < 10 * 60_000) {
    return NextResponse.json({ ok: true, itens: cache.itens, adminConfigurado: (process.env.ADMIN_TOKEN ?? "").length >= 12 });
  }
  const itens = await Promise.all(
    COMPONENTES.map(async (c) => {
      const [atual, ultima] = await Promise.all([c.atual(), c.ultima()]);
      return { id: c.id, nome: c.nome, atual, ultima, disponivel: !!atual && !!ultima && atual !== ultima, automatico: !!c.atualizar, manual: c.manual ?? null };
    }),
  );
  cache = { em: Date.now(), itens };
  return NextResponse.json({ ok: true, itens, adminConfigurado: (process.env.ADMIN_TOKEN ?? "").length >= 12 });
}

const corpo = z.object({ id: z.string().max(40), token: z.string().max(200) });

export async function POST(req: Request) {
  const p = corpo.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ ok: false, error: "Pedido inválido." }, { status: 400 });
  if (!tokenAdminValido(p.data.token)) {
    return NextResponse.json({ ok: false, error: "Token de admin inválido (ou ADMIN_TOKEN não definido no servidor)." }, { status: 403 });
  }
  const c = componentePorId(p.data.id);
  if (!c?.atualizar) return NextResponse.json({ ok: false, error: c?.manual ?? "Componente desconhecido." }, { status: 400 });
  try {
    const log = await c.atualizar();
    cache = null;
    return NextResponse.json({ ok: true, log, atual: await c.atual() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message.slice(0, 300) : "Falha ao atualizar." }, { status: 500 });
  }
}
