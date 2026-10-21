import { NextResponse } from "next/server";
import { z } from "zod";
import { OpenAICompatTextProvider, getTextProvider, recordUsage, type TextProvider } from "@vincere-studio/providers";
import { NICHOS } from "@/lib/nichos";
import { SKILLS } from "@/lib/skills-catalog";
import { PROMPTS, PROMPT_CATEGORIAS } from "@/lib/prompt-library";
import { IDIOMAS } from "@/lib/idiomas";
import { contextoDaMemoria, lembrar } from "@/lib/vince-memoria";

export const dynamic = "force-dynamic";

// Mapa das telas: é o que o assistente pode indicar em "irPara".
const TELAS: Record<string, string> = {
  "/dashboard": "Início: escolher um nicho e começar um vídeo; status dos motores; projetos recentes",
  "/projects": "Projetos do banco (pipeline clássico: ideia → roteiro → mídia → render → publicação); cada projeto tem o painel Saúde do projeto com o próximo passo",
  "/studio": "HyperFrames Studio: timeline ao vivo do projeto em C:\\Users\\Igor\\Videos-HF; editar cenas pedindo ao Claude",
  "/copiloto": "Copiloto (esteira de criação): ideia → roteiro em beats → narração → cenas e B-roll → bruto, que segue para o HyperFrames; chama skills em cada etapa",
  "/flow-studio": "Gerar imagem (Nano Banana) e vídeo (Veo) no Google Flow e vincular à cena",
  "/prompts": "Biblioteca de prompts testados de imagem e vídeo, com imagem de referência",
  "/voice-studio": "Central de Vozes: narrar com voz clonada (qualidade rascunho/equilibrado/final, roda em segundo plano), rascunho rápido grátis (Edge TTS), clonar voz enviando um áudio de 5-30s e transcrever áudio",
  "/tipografia": "Combinações de fontes do Google por nicho, com prévia ao vivo e CSS pronto para o HyperFrames",
  "/tendencias": "Pesquisa de tendências com dados reais (vidIQ, buscas, Reddit/X, notícias) por idioma/mercado: temas e nichos fora do óbvio, com evidência e botão para virar vídeo",
  "/workflow": "Workflow nodal: avatar, produto, cenário, prompt, voz e render conectados",
  "/skills": "Skills e receitas por nicho, com exemplo de pedido",
  "/references": "Canais de referência",
  "/assets": "Mídias geradas e baixadas",
  "/channels": "Canais do YouTube conectados",
  "/metrics": "Métricas de retenção",
  "/health": "Saúde do sistema",
  "/settings": "Configurações (chaves, orçamento, vozes)",
};

const SYSTEM = `Você é o Vince, o assistente que mora dentro do Vincere Studio, um estúdio de vídeo com IA do Igor.
Responda SEMPRE em português do Brasil, curto (até 6 linhas), direto e didático, como um diretor de edição paciente.
Seu trabalho: guiar o Igor na ferramenta, explicar o que cada tela faz, sugerir o nicho e a skill certos para o momento,
e transformar pedidos de edição em um pedido claro para o Claude (que roda no PC dele e edita os projetos HyperFrames).

Regras:
- Pipeline canônico de vídeo: roteiro em beats → narração PRIMEIRO (a voz define o tempo) → B-roll/Flow → montagem HyperFrames → legendas → render.
- Recomende só skills e telas que existem na lista abaixo. Nunca invente recurso.
- Se o Igor pedir para criar, editar, gerar ou mudar algo, preencha "acaoClaude" com o pedido pronto e detalhado para o Claude executar,
  incluindo a skill a usar. Você não executa nada sozinho.
- Use "irPara" quando uma tela resolver a dúvida.
- Renders e mídias pesadas ficam no C: (Videos-HF), nunca no Google Drive.
- O Igor produz em VÁRIOS idiomas e mercados (${IDIOMAS.map((i) => i.nome).join(", ")}). Converse com ele em português, mas quando o assunto for o vídeo, considere o idioma/mercado dele e sugira o que funciona nesse público.
- Tendência/tema "em alta" só com dado real: mande para /tendencias ou crie acaoClaude de pesquisa. Nunca invente que algo está em alta.
- MEMÓRIA: quando o Igor contar uma preferência, decisão, fato sobre ele, o canal, o público ou o estilo ("meu público é do México", "não gosto de legenda amarela"), preencha "lembrar" com uma frase curta e objetiva para guardar. Não use "lembrar" para pedidos pontuais.

TELAS:
${Object.entries(TELAS).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

NICHOS (Início → O que vamos criar hoje?):
${NICHOS.map((n) => `- ${n.nome} (${n.formato}, ${n.skill}): ${n.resumo} Passos: ${n.passos.join(" → ")}`).join("\n")}

SKILLS DO CLAUDE:
${SKILLS.map((s) => `- ${s.comando} [${s.motor}]: ${s.quando}`).join("\n")}

BIBLIOTECA DE PROMPTS (/prompts): ${PROMPT_CATEGORIAS.map((c) => `${c.nome}: ${PROMPTS.filter((p) => p.categoria === c.id).map((p) => p.titulo).join(", ")}`).join(" | ")}`;

const RespostaSchema = z.object({
  lembrar: z.string().nullable().optional(),
  resposta: z.string(),
  irPara: z.string().nullable().optional(),
  acaoClaude: z.string().nullable().optional(),
});

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

  const conversa = mensagens
    .slice(-12)
    .map((m) => `${m.role === "user" ? "Igor" : "Vince"}: ${m.content}`)
    .join("\n");
  const prompt = `Tela atual: ${pagina ?? "desconhecida"} (${TELAS[pagina ?? ""] ?? "—"})\n\nConversa:\n${conversa}\n\nResponda como Vince em JSON {resposta, irPara, acaoClaude, lembrar}.`;

  // Ordem: LLM configurada → reserva grátis e sem chave (Pollinations). O Vince nunca fica mudo
  // por falta de chave ou cota esgotada.
  const candidatos: Array<() => TextProvider> = [
    () => getTextProvider(process.env.ASSISTENTE_PROVIDER || process.env.TEXT_PROVIDER || "GEMINI"),
    () => new OpenAICompatTextProvider("https://text.pollinations.ai", "", "openai", "https://text.pollinations.ai/openai"),
  ];
  const memoria = await contextoDaMemoria();
  let ultimoErro: unknown = null;
  for (const criar of candidatos) {
    try {
      const { data, usage } = await criar().generateJson(prompt, RespostaSchema, {
        system: [SYSTEM, memoria].filter(Boolean).join("\n\n"),
        temperature: 0.4,
        maxOutputTokens: 800,
      });
      await recordUsage(null, usage).catch(() => {});
      const irPara = data.irPara && TELAS[data.irPara] ? data.irPara : null;
      const lembrou = data.lembrar ? await lembrar(data.lembrar) : null;
      return NextResponse.json({ ok: true, resposta: data.resposta, irPara, acaoClaude: data.acaoClaude || null, lembrou: lembrou?.texto ?? null });
    } catch (err) {
      ultimoErro = err;
    }
  }
  return NextResponse.json(
    {
      ok: false,
      error: `O assistente não conseguiu responder agora (${ultimoErro instanceof Error ? ultimoErro.message : String(ultimoErro)}).`,
    },
    { status: 502 },
  );
}
