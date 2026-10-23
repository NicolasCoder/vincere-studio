import { NextResponse } from "next/server";
import { z } from "zod";
import { createRequest } from "@/lib/claude-inbox";
import { IDIOMAS, idiomaPorId } from "@/lib/idiomas";
import { NICHOS } from "@/lib/nichos";
import { RelatorioSchema, concluirRelatorio, criarRelatorio, falharRelatorio, lerRelatorio, listarRelatorios, gerarPesquisaTendenciasComIA } from "@/lib/tendencias";

export const dynamic = "force-dynamic";

// GET  /api/tendencias[?id=]                          → relatórios (ou um)
// POST { action: "pesquisar", idiomas, foco?, foraDaCaixa } → cria relatório e o pedido ao Claude
// POST { action: "salvar", id, relatorio }            → o Claude grava o resultado (skill vincere-tendencias)
// POST { action: "falhou", id, erro }
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (id) {
    const r = await lerRelatorio(id);
    return r ? NextResponse.json({ ok: true, relatorio: r }) : NextResponse.json({ ok: false, error: "Não encontrado" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, relatorios: await listarRelatorios() });
}

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("pesquisar"),
    idiomas: z.array(z.enum(IDIOMAS.map((i) => i.id) as [string, ...string[]])).min(1).max(IDIOMAS.length),
    foco: z.string().trim().max(300).optional(),
    foraDaCaixa: z.boolean().default(true),
  }),
  z.object({ action: z.literal("salvar"), id: z.string().regex(/^[a-f0-9]{8}$/), relatorio: RelatorioSchema }),
  z.object({ action: z.literal("falhou"), id: z.string().regex(/^[a-f0-9]{8}$/), erro: z.string().max(500) }),
]);

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Dados inválidos", detalhes: parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`) }, { status: 400 });
  }
  const d = parsed.data;

  if (d.action === "pesquisar") {
    const rel = await criarRelatorio({ idiomas: d.idiomas, foco: d.foco || undefined, foraDaCaixa: d.foraDaCaixa });
    const mercados = d.idiomas.map((id) => {
      const i = idiomaPorId(id);
      return `${i.nome} (código ${i.codigo}; países ${i.mercados.join(", ")})`;
    });
    const pedido = [
      `Pesquisa de tendências ${rel.id} — use a skill /vincere-tendencias.`,
      `Idiomas/mercados: ${mercados.join("; ")}.`,
      d.foco ? `Foco pedido: ${d.foco}.` : "Sem foco: varra os nichos do Vincere e também nichos novos.",
      d.foraDaCaixa ? "Priorize o fora da caixa: demanda subindo, pouca oferta boa nesse idioma, ângulo inesperado." : "Pode incluir temas mais tradicionais se a demanda for forte.",
      `Nichos do Vincere: ${NICHOS.map((n) => n.id).join(", ")}.`,
      `Grave o resultado com POST /api/tendencias {action:"salvar", id:"${rel.id}", relatorio}.`,
    ].join(" ");
    const item = await createRequest({ pedido, pagina: "/tendencias" });
    const pronto = await gerarPesquisaTendenciasComIA(rel.id, rel.pedido).catch(() => null);
    return NextResponse.json({ ok: true, relatorio: pronto || rel, pedidoId: item.id });
  }

  if (d.action === "salvar") {
    const r = await concluirRelatorio(d.id, d.relatorio);
    return r ? NextResponse.json({ ok: true, relatorio: r }) : NextResponse.json({ ok: false, error: "Relatório não encontrado" }, { status: 404 });
  }

  const r = await falharRelatorio(d.id, d.erro);
  return r ? NextResponse.json({ ok: true }) : NextResponse.json({ ok: false, error: "Relatório não encontrado" }, { status: 404 });
}
