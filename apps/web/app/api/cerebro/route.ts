import { NextResponse } from "next/server";
import { z } from "zod";
import { extractJson, recordUsage, carregarChavesNoAmbiente } from "@vincere-studio/providers";
import { interpretarRespostaDoVince } from "@/lib/cerebro-comandos";
import { descobrirCatalogoDoCerebro, inspecionarLimitesDoCerebro } from "@/lib/cerebro-catalogo";
import { detectarOpcoes, lerCerebro, limparCerebro, perguntarAoCerebro, resolverCerebroAtivo, salvarCerebro, validarCerebro } from "@/lib/cerebro";
import { PEDIDO_DE_APRESENTACAO, lerManual, montarSistemaDoVince } from "@/lib/vince-sistema";

export const dynamic = "force-dynamic";

// GET /api/cerebro → IA vinculada ao Vince, a que está respondendo agora, catálogo de modelos/força e limites/uso.
export async function GET(req: Request) {
  await carregarChavesNoAmbiente().catch(() => {});
  const url = new URL(req.url);
  const forcarAtualizacao = url.searchParams.get("atualizar") === "1";
  const [cerebro, ativo] = await Promise.all([lerCerebro(), resolverCerebroAtivo()]);
  const [catalogo, limites] = await Promise.all([
    descobrirCatalogoDoCerebro(ativo, { forcarAtualizacao }),
    inspecionarLimitesDoCerebro(ativo),
  ]);
  return NextResponse.json({
    ok: true,
    cerebro,
    ativo,
    opcoes: detectarOpcoes(),
    temManual: lerManual().length > 0,
    catalogo,
    limites,
  });
}

const bodySchema = z.discriminatedUnion("acao", [
  z.object({
    acao: z.literal("vincular"),
    tipo: z.string().max(20),
    id: z.string().max(40),
    modelo: z.string().max(100).optional(),
    esforco: z.string().max(20).optional(),
  }),
  z.object({
    acao: z.literal("configurar"),
    modelo: z.string().max(100).nullable().optional(),
    esforco: z.string().max(20).nullable().optional(),
  }),
  z.object({ acao: z.literal("desvincular") }),
  z.object({ acao: z.literal("apresentar") }),
]);

// POST /api/cerebro
//   vincular    → guarda qual IA é o cérebro do Vince (só nesta instância);
//   configurar  → troca o modelo (Gemini, Claude, GPT…) e/ou a força (low, medium, high, xhigh, max) da IA ativa;
//   desvincular → remove o vínculo;
//   apresentar  → a IA lê o manual da ferramenta e se apresenta (a primeira coisa que acontece depois de vincular).
export async function POST(req: Request) {
  await carregarChavesNoAmbiente().catch(() => {});
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Pedido inválido." }, { status: 400 });
  const corpo = parsed.data;

  if (corpo.acao === "desvincular") {
    await limparCerebro();
    return NextResponse.json({ ok: true });
  }

  if (corpo.acao === "vincular") {
    try {
      const base = validarCerebro(corpo.tipo, corpo.id, { modelo: corpo.modelo, esforco: corpo.esforco });
      const opcao = detectarOpcoes().find((o) => o.tipo === base.tipo && o.id === base.id);
      if (!opcao?.disponivel) {
        return NextResponse.json({ ok: false, error: `${opcao?.nome ?? "Essa IA"} não está disponível: ${opcao?.detalhe ?? "não encontrada"}.` }, { status: 409 });
      }
      const catalogo = await descobrirCatalogoDoCerebro(base);
      const final = validarCerebro(base.tipo, base.id, {
        modelo: base.modelo ?? catalogo.modeloPadrao ?? undefined,
        esforco: base.esforco ?? catalogo.esforcoPadrao ?? undefined,
      });
      await salvarCerebro(final);
      const limites = await inspecionarLimitesDoCerebro(final);
      return NextResponse.json({ ok: true, cerebro: final, ativo: final, catalogo, limites });
    } catch (err) {
      return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Não foi possível vincular." }, { status: 400 });
    }
  }

  if (corpo.acao === "configurar") {
    const atual = await resolverCerebroAtivo();
    if (!atual) {
      return NextResponse.json({ ok: false, precisaVincular: true, error: "Vincule uma IA ao Vince primeiro." }, { status: 409 });
    }
    try {
      const atualizado = validarCerebro(atual.tipo, atual.id, {
        modelo: corpo.modelo === undefined ? atual.modelo : (corpo.modelo ?? undefined),
        esforco: corpo.esforco === undefined ? atual.esforco : (corpo.esforco ?? undefined),
      });
      await salvarCerebro(atualizado);
      const [catalogo, limites] = await Promise.all([
        descobrirCatalogoDoCerebro(atualizado),
        inspecionarLimitesDoCerebro(atualizado),
      ]);
      return NextResponse.json({ ok: true, cerebro: atualizado, ativo: atualizado, catalogo, limites });
    } catch (err) {
      return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Configuração inválida." }, { status: 400 });
    }
  }

  const ativo = await resolverCerebroAtivo();
  if (!ativo) return NextResponse.json({ ok: false, precisaVincular: true, error: "Vincule uma IA ao Vince primeiro." }, { status: 409 });
  try {
    const { texto, motor, usage, conversaId, usoDetalhado } = await perguntarAoCerebro(ativo, {
      system: montarSistemaDoVince(),
      prompt: PEDIDO_DE_APRESENTACAO,
    });
    if (usage) await recordUsage(null, usage).catch(() => {});
    const r = interpretarRespostaDoVince(texto, extractJson);
    return NextResponse.json({ ok: true, resposta: r.resposta, motor, conversaId: conversaId ?? null, uso: usoDetalhado ?? usage ?? null });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "A IA não respondeu." }, { status: 502 });
  }
}
