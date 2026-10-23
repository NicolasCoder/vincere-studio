import { NextResponse } from "next/server";
import { z } from "zod";
import { extractJson, recordUsage } from "@vincere-studio/providers";
import { interpretarRespostaDoVince } from "@/lib/cerebro-comandos";
import { perguntarAoCerebro, resolverCerebroAtivo } from "@/lib/cerebro";
import { TELAS, montarSistemaDoVince } from "@/lib/vince-sistema";
import { contextoDaMemoria, lembrar } from "@/lib/vince-memoria";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  mensagens: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .min(1)
    .max(30),
  pagina: z.string().max(200).optional(),
});

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Mensagem inválida." }, { status: 400 });
  const { mensagens, pagina } = parsed.data;

  // Quem responde é a IA que a pessoa vinculou ao Vince (ou uma LLM já configurada). Sem nenhuma, o Vince
  // pede o vínculo em vez de mandar a conversa para um serviço qualquer.
  const ativo = await resolverCerebroAtivo();
  if (!ativo) {
    return NextResponse.json({ ok: false, precisaVincular: true, error: "Vincule a sua IA ao Vince para conversar." }, { status: 409 });
  }

  const conversa = mensagens
    .slice(-12)
    .map((m) => `${m.role === "user" ? "Pessoa" : "Vince"}: ${m.content}`)
    .join("\n");
  const prompt = `Tela atual: ${pagina ?? "desconhecida"} (${TELAS[pagina ?? ""] ?? "—"})\n\nConversa:\n${conversa}\n\nResponda como Vince em JSON {resposta, irPara, acaoClaude, lembrar}.`;
  const system = montarSistemaDoVince(await contextoDaMemoria());

  try {
    const { texto, motor, usage } = await perguntarAoCerebro(ativo, { system, prompt });
    if (usage) await recordUsage(null, usage).catch(() => {});
    const data = interpretarRespostaDoVince(texto, extractJson);
    const irPara = data.irPara && TELAS[data.irPara] ? data.irPara : null;
    const lembrou = data.lembrar ? await lembrar(data.lembrar) : null;
    return NextResponse.json({
      ok: true,
      resposta: data.resposta,
      irPara,
      acaoClaude: data.acaoClaude || null,
      acaoStudio: data.acaoStudio || null,
      skillSugerida: data.skillSugerida || null,
      lembrou: lembrou?.texto ?? null,
      motor,
      cerebro: ativo,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: `O assistente não conseguiu responder agora (${err instanceof Error ? err.message : String(err)}).` },
      { status: 502 },
    );
  }
}
