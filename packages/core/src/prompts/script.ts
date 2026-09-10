import { z } from "zod";
import { FORMATS, type VideoFormat } from "../formats";

export const SCRIPT_PROMPT_VERSION = "script.v1";

export const BLOCK_KINDS = ["HOOK", "CONTEXT", "ESCALATION", "REVEAL", "CLIMAX", "RESOLUTION", "CTA"] as const;
export type BlockKind = (typeof BLOCK_KINDS)[number];

/** Passo A — estrutura em atos. */
export const OutlineSchema = z.object({
  title: z.string().describe("Título final do vídeo, até 80 caracteres"),
  logline: z.string().describe("Uma frase que resume a promessa do vídeo"),
  acts: z.array(
    z.object({
      act: z.number().describe("Número do ato, começando em 1"),
      kind: z.enum(BLOCK_KINDS).describe("Função narrativa do ato"),
      title: z.string().describe("Título curto do ato, ex.: 'O Gancho Fatal'"),
      goal: z.string().describe("O que este ato precisa provocar no espectador"),
      keyFacts: z.array(z.string()).describe("2 a 4 fatos, datas ou lugares concretos que o ato vai usar"),
      durationSec: z.number().describe("Duração alvo do ato em segundos"),
      cliffhanger: z.string().describe("A pergunta ou tensão que fica aberta ao fim do ato"),
    }),
  ),
});
export type Outline = z.infer<typeof OutlineSchema>;

/** Passo B — texto de um ato. */
export const ActSchema = z.object({
  narration: z.string().describe("Texto da locução, em parágrafos, com marcações [Pausa dramática 1.5s] onde a narração deve respirar"),
  brollCue: z.string().describe("Descrição do visual dominante do ato para B-roll, em uma frase concreta"),
  soundCue: z.string().describe("Direção de som/trilha do ato em uma frase"),
  wpm: z.number().describe("Ritmo de leitura sugerido em palavras por minuto, entre 120 e 170"),
});
export type ActText = z.infer<typeof ActSchema>;

/** Reescrita de bloco. */
export const RewriteSchema = z.object({ narration: z.string(), note: z.string().describe("Uma frase explicando o que mudou") });

/** Sugestões de melhoria do roteiro inteiro. */
export const SuggestionsSchema = z.object({
  suggestions: z.array(
    z.object({
      act: z.number().describe("Número do ato afetado"),
      severity: z.enum(["high", "medium", "low"]),
      issue: z.string().describe("Problema detectado, ex.: 'Queda de retenção prevista aos 02:10'"),
      fix: z.string().describe("Correção proposta em uma frase"),
      instruction: z.string().describe("Instrução exata para reescrever o bloco aplicando a correção"),
    }),
  ),
});

export interface ScriptContext {
  format: VideoFormat;
  title: string;
  synopsis: string;
  hookLines: string[];
  niche: string;
  tone?: string | null;
  audience?: string | null;
  targetDuration?: number | null;
  hooks: string[];
}

export function scriptSystemPrompt() {
  return [
    "Você é o roteirista-chefe do Vincere Studio, especialista em documentários narrados para YouTube com altíssima retenção.",
    "Regras de ouro: abrir com uma pergunta ou imagem impossível de ignorar; nunca revelar tudo de uma vez; cada ato termina com um cliffhanger;",
    "frases curtas alternadas com uma longa; números, datas e lugares concretos; sem clichês de IA ('mergulhe', 'desvende', 'jornada');",
    "sem citações inventadas de pessoas reais: quando citar, use 'segundo relatórios' ou 'documentos da época'.",
    "Escreva em português do Brasil para ser lido em voz alta. Marque respiros com [Pausa dramática 1.5s] (1.0 a 2.5s).",
  ].join(" ");
}

export function outlinePrompt(c: ScriptContext) {
  const f = FORMATS[c.format];
  const total = c.targetDuration ?? f.duration.default;
  return [
    `Crie a estrutura de um ${f.label} sobre: "${c.title}".`,
    `Sinopse: ${c.synopsis}`,
    `Ganchos já aprovados para os primeiros segundos (use-os no Ato 1, pode refinar): ${c.hookLines.map((h) => `"${h}"`).join(" / ")}`,
    `Nicho: ${c.niche}. ${c.tone ? `Tom: ${c.tone}.` : ""} ${c.audience ? `Público: ${c.audience}.` : ""}`,
    c.hooks.length ? `Dispositivos de retenção obrigatórios: ${c.hooks.join(", ")}.` : "",
    `Duração total: ${total} segundos. Divida em exatamente ${f.structure.acts} atos cuja soma de durationSec seja ${total}.`,
    `Use estas funções de ato, nesta ordem: ${f.structure.blockLabels.map((l, i) => `${i + 1}) ${l}`).join("; ")}.`,
    `O Ato 1 é o gancho e deve durar ${f.structure.hookSeconds} segundos.`,
    c.format === "SHORT_9_16" ? "Como é um vídeo curto, os atos são batidas de poucos segundos e o último termina com uma chamada para ação natural." : "",
    "Retorne apenas o JSON.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function actPrompt(c: ScriptContext, outline: Outline, actIndex: number, previousSummary: string) {
  const f = FORMATS[c.format];
  const a = outline.acts[actIndex];
  const wpm = 150;
  const words = Math.round((a.durationSec / 60) * wpm);
  return [
    `Vídeo: "${outline.title}" — ${outline.logline}`,
    `Escreva a locução completa do Ato ${a.act} de ${outline.acts.length}: "${a.title}" (função: ${a.kind}).`,
    `Objetivo do ato: ${a.goal}. Fatos a usar: ${a.keyFacts.join("; ")}. Termine com este cliffhanger: ${a.cliffhanger}`,
    previousSummary ? `Resumo do que já foi narrado: ${previousSummary}` : "Este é o primeiro ato: os primeiros 5 segundos decidem tudo.",
    a.kind === "HOOK" ? `Incorpore estes ganchos aprovados: ${c.hookLines.map((h) => `"${h}"`).join(" / ")}` : "",
    `Duração alvo: ${a.durationSec} segundos ≈ ${words} palavras (tolerância de 10%). Ritmo: ${f.cutPace.min}–${f.cutPace.max}s por cena.`,
    "Não repita informações dos atos anteriores. Retorne apenas o JSON.",
  ]
    .filter(Boolean)
    .join("\n");
}

export type RewriteMode = "rewrite" | "intense" | "shorten" | "question" | "custom";

export function rewritePrompt(narration: string, mode: RewriteMode, instruction?: string, ctx?: { title: string; actTitle: string }) {
  const modes: Record<RewriteMode, string> = {
    rewrite: "Reescreva mantendo os fatos e a duração, melhorando ritmo e clareza para leitura em voz alta.",
    intense: "Reescreva com mais tensão: frases mais curtas, mais perguntas, mais concretude, um cliffhanger mais forte. Mesma duração.",
    shorten: "Encurte em cerca de 30% sem perder os fatos nem o cliffhanger.",
    question: "Insira uma pergunta retórica no primeiro terço para segurar a atenção, mantendo o restante.",
    custom: instruction ?? "Aplique a instrução do editor.",
  };
  return [
    ctx ? `Vídeo: "${ctx.title}" · Ato: "${ctx.actTitle}"` : "",
    modes[mode],
    instruction && mode !== "custom" ? `Instrução adicional: ${instruction}` : "",
    "Mantenha as marcações [Pausa ...] onde fizer sentido. Retorne apenas o JSON.",
    "--- TEXTO ATUAL ---",
    narration,
  ]
    .filter(Boolean)
    .join("\n");
}

export function suggestionsPrompt(title: string, blocks: { act: number; title: string; narration: string; startMs: number; endMs: number }[]) {
  return [
    `Analise o roteiro do vídeo "${title}" como um editor sênior de retenção do YouTube.`,
    "Aponte de 2 a 4 problemas concretos (queda de ritmo, falta de pergunta, revelação cedo demais, transição fraca, frase longa demais para locução) com a correção e uma instrução de reescrita para cada.",
    "Retorne apenas o JSON.",
    ...blocks.map((b) => `--- Ato ${b.act}: ${b.title} (${Math.round(b.startMs / 1000)}s–${Math.round(b.endMs / 1000)}s) ---\n${b.narration}`),
  ].join("\n");
}
