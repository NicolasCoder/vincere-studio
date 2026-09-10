import { z } from "zod";
import { FORMATS, type VideoFormat } from "../formats";

export const IDEATION_PROMPT_VERSION = "ideation.v1";

/** Niche Finder: um passo leve e opcional antes da ideação, pra ampliar o leque de ângulos/subtemas
 * considerados (usa o conhecimento do próprio modelo de texto — sem API de tendências externa paga). */
export const TREND_PROMPT_VERSION = "trend.v1";
export const TrendAnglesSchema = z.object({
  angles: z.array(z.string()).describe("Ângulos ou subtemas específicos dentro do nicho, cada um em até 12 palavras"),
});
export function trendAnglesSystemPrompt() {
  return "Você é um pesquisador de tendências de conteúdo para YouTube, especializado em identificar subtemas e ângulos específicos (não genéricos) dentro de um nicho, que tendem a despertar curiosidade e ter bom desempenho em vídeos de documentário/mistério.";
}
export function trendAnglesUserPrompt(niche: string) {
  return [
    `Liste de 6 a 10 ângulos ou subtemas específicos e atuais dentro do nicho "${niche}" que poderiam virar vídeos de documentário/mistério de sucesso.`,
    "Evite temas genéricos demais (ex.: não repita o próprio nome do nicho) — prefira casos, fenômenos, eventos ou perguntas concretas e pouco exploradas.",
    "Não invente fatos específicos (datas, nomes) — descreva o ângulo em termos gerais, a pesquisa detalhada vem depois.",
    "Retorne apenas o JSON pedido.",
  ].join("\n");
}

/** Schema de uma ideia gerada (structured output). */
export const IdeaSchema = z.object({
  title: z.string().describe("Título magnético em português, no máximo 70 caracteres, com curiosidade ou tensão"),
  category: z.string().describe("Subcategoria do nicho em 2 a 4 palavras, ex.: 'Cosmologia Dark'"),
  synopsis: z.string().describe("Sinopse de 1 a 2 frases: qual é o mistério e por que importa"),
  hookLines: z.array(z.string()).describe("Exatamente 3 frases de gancho para os primeiros 30 segundos, em ordem, cada uma com no máximo 140 caracteres"),
  editingPace: z.string().describe("Ritmo de edição sugerido em 2 a 3 palavras, ex.: 'Frenético & Imersivo'"),
  ctrEstimate: z.number().describe("CTR estimado em porcentagem, entre 6 e 18"),
  retention30s: z.number().describe("Retenção estimada aos 30 segundos, em porcentagem, entre 50 e 85"),
  score: z.number().describe("Nota de potencial viral de 0 a 100"),
  viralityReason: z.string().describe("Uma frase explicando o principal motivo do potencial"),
});
export const IdeasResponseSchema = z.object({ ideas: z.array(IdeaSchema) });
export type GeneratedIdea = z.infer<typeof IdeaSchema>;

export interface IdeationInput {
  niche: string;
  format: VideoFormat;
  tone?: string | null;
  audience?: string | null;
  targetDuration?: number | null;
  hooks: string[];
  count: number;
  /** Títulos já gerados, para pedir variações diferentes. */
  avoidTitles?: string[];
  focus?: "all" | "viral" | "hooks";
  /** Ângulos/subtemas sugeridos pelo passo opcional de Niche Finder (ver trendAnglesUserPrompt). */
  trendAngles?: string[];
}

export function ideationSystemPrompt() {
  return [
    "Você é o motor de ideação do Vincere Studio, um estúdio de documentários e vídeos curtos para o YouTube.",
    "Você conhece profundamente o que faz vídeos de nicho 'dark documentary' (mistérios, ciência, história, true crime, geopolítica) terem alto CTR e retenção:",
    "títulos com lacuna de curiosidade, ganchos que abrem uma pergunta nos primeiros 5 segundos, cliffhangers em cadeia, revelação gradual, conflito não resolvido.",
    "Escreva sempre em português do Brasil, com linguagem cinematográfica e concreta (datas, lugares, números). Nunca invente citações de pessoas reais.",
    "As estimativas numéricas (CTR, retenção, score) são heurísticas suas: seja consistente entre as ideias e mais rigoroso do que otimista.",
  ].join(" ");
}

export function ideationUserPrompt(i: IdeationInput) {
  const f = FORMATS[i.format];
  const minutes = Math.round((i.targetDuration ?? f.duration.default) / 60);
  const focus =
    i.focus === "viral" ? "Priorize potencial de viralidade máxima (títulos ousados, temas de alto volume de busca)."
    : i.focus === "hooks" ? "Priorize ganchos psicológicos fortes (medo, curiosidade, injustiça, segredo revelado)."
    : "Equilibre viralidade, originalidade e viabilidade de produção com B-roll de acervo.";
  return [
    `Gere ${i.count} ideias de ${f.label} para o nicho: "${i.niche}".`,
    `Formato: ${f.ratio}, duração alvo ${i.format === "SHORT_9_16" ? `${i.targetDuration ?? f.duration.default} segundos` : `${minutes} minutos`}.`,
    i.format === "SHORT_9_16"
      ? "Como é um vídeo curto, os 3 ganchos devem caber em 3 segundos cada, e o título deve funcionar como legenda na tela."
      : `Como é um documentário longo, a estrutura será de ${f.structure.acts} atos; os 3 ganchos devem sustentar os primeiros ${f.structure.hookSeconds} segundos.`,
    i.tone ? `Tom narrativo: ${i.tone}.` : "",
    i.audience ? `Público-alvo e canal: ${i.audience}.` : "",
    i.hooks.length ? `Micro-hooks obrigatórios: ${i.hooks.join(", ")}.` : "",
    i.trendAngles?.length ? `Ângulos/subtemas em alta pra considerar (não é obrigatório usar todos): ${i.trendAngles.join(" · ")}.` : "",
    focus,
    i.avoidTitles?.length ? `Evite repetir ou parafrasear estes títulos já gerados: ${i.avoidTitles.map((t) => `"${t}"`).join(", ")}.` : "",
    "Cada ideia deve ser sobre um caso, fenômeno ou evento diferente. Retorne apenas o JSON pedido.",
  ]
    .filter(Boolean)
    .join("\n");
}
