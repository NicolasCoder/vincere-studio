import { NextResponse } from "next/server";
import { z } from "zod";
import { extractJson, recordUsage } from "@vincere-studio/providers";
import { interpretarRespostaDoVince } from "@/lib/cerebro-comandos";
import { detectarOpcoes, lerCerebro, limparCerebro, perguntarAoCerebro, resolverCerebroAtivo, salvarCerebro, validarCerebro } from "@/lib/cerebro";
import { PEDIDO_DE_APRESENTACAO, lerManual, montarSistemaDoVince } from "@/lib/vince-sistema";

export const dynamic = "force-dynamic";

// GET /api/cerebro → IA vinculada ao Vince, a que está respondendo agora e as opções detectadas nesta máquina.
export async function GET() {
  const [cerebro, ativo] = await Promise.all([lerCerebro(), resolverCerebroAtivo()]);
  return NextResponse.json({ ok: true, cerebro, ativo, opcoes: detectarOpcoes(), temManual: lerManual().length > 0 });
}

const bodySchema = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("vincular"), tipo: z.string().max(20), id: z.string().max(40) }),
  z.object({ acao: z.literal("desvincular") }),
  z.object({ acao: z.literal("apresentar") }),
]);

// POST /api/cerebro
//   vincular    → guarda qual IA é o cérebro do Vince (só nesta instância);
//   desvincular → remove o vínculo;
//   apresentar  → a IA lê o manual da ferramenta e se apresenta (a primeira coisa que acontece depois de vincular).
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Pedido inválido." }, { status: 400 });
  const corpo = parsed.data;

  if (corpo.acao === "desvincular") {
    await limparCerebro();
    return NextResponse.json({ ok: true });
  }

  if (corpo.acao === "vincular") {
    try {
      const c = validarCerebro(corpo.tipo, corpo.id);
      const opcao = detectarOpcoes().find((o) => o.tipo === c.tipo && o.id === c.id);
      if (!opcao?.disponivel) {
        return NextResponse.json({ ok: false, error: `${opcao?.nome ?? "Essa IA"} não está disponível: ${opcao?.detalhe ?? "não encontrada"}.` }, { status: 409 });
      }
      await salvarCerebro(c);
      return NextResponse.json({ ok: true, cerebro: c });
    } catch (err) {
      return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Não foi possível vincular." }, { status: 400 });
    }
  }

  const ativo = await resolverCerebroAtivo();
  if (!ativo) return NextResponse.json({ ok: false, precisaVincular: true, error: "Vincule uma IA ao Vince primeiro." }, { status: 409 });
  try {
    const { texto, motor, usage } = await perguntarAoCerebro(ativo, { system: montarSistemaDoVince(), prompt: PEDIDO_DE_APRESENTACAO });
    if (usage) await recordUsage(null, usage).catch(() => {});
    const r = interpretarRespostaDoVince(texto, extractJson);
    return NextResponse.json({ ok: true, resposta: r.resposta, motor });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "A IA não respondeu." }, { status: 502 });
  }
}
