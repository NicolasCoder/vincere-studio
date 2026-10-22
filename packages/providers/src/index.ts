export * from "./types";
export * from "./schema";
export { ProvedorComReserva, TAREFAS_TEXTO, nomeDaReserva, nomeDoProvedorDaTarefa, type TarefaTexto } from "./texto-por-tarefa";
export * from "./usage";
export { GeminiTextProvider } from "./gemini/text";
export { OllamaTextProvider } from "./ollama/text";
export { OpenAICompatTextProvider, extractJson } from "./openai-compat/text";

import type { TextProvider } from "./types";
import { ProvedorComReserva, nomeDaReserva, nomeDoProvedorDaTarefa, type TarefaTexto } from "./texto-por-tarefa";
import { GeminiTextProvider } from "./gemini/text";
import { OllamaTextProvider } from "./ollama/text";
import { OpenAICompatTextProvider } from "./openai-compat/text";

/** Fábrica: Gemini, Ollama (local) ou qualquer API compatível com OpenAI (NIM, OpenRouter, Hermes…). */
export function getTextProvider(name = process.env.TEXT_PROVIDER ?? "GEMINI"): TextProvider {
  switch (name.toUpperCase()) {
    case "GEMINI":
      return new GeminiTextProvider();
    case "OLLAMA":
      return new OllamaTextProvider();
    case "OPENAI_COMPAT":
      return new OpenAICompatTextProvider();
    default:
      throw new Error(`Provedor de texto desconhecido: ${name}`);
  }
}
/**
 * Provedor de texto de uma tarefa (ideias, roteiro, cenas...): TEXT_PROVIDER_<TAREFA> ou o TEXT_PROVIDER de sempre,
 * com TEXT_PROVIDER_FALLBACK como reserva se ele falhar. A reserva só é criada se for preciso.
 */
export function getTextProviderFor(tarefa: TarefaTexto, env: Record<string, string | undefined> = process.env): TextProvider {
  const nome = nomeDoProvedorDaTarefa(tarefa, env);
  const principal = getTextProvider(nome);
  const reserva = nomeDaReserva(env);
  if (!reserva || reserva.toUpperCase() === nome.toUpperCase()) return principal;
  return new ProvedorComReserva(principal, () => getTextProvider(reserva), reserva);
}
export * from "./voice";
export * from "./stock";
export * from "./media/ffmpeg";
export * from "./media/storage";
export * from "./youtube";
export * from "./image/gemini-image";
export * from "./image/pollinations-image";
export * from "./image/cloudflare-image";
export * from "./image/huggingface-image";
export * from "./image/together-image";
export * from "./image/openai-image";
export * from "./image/kie-image";
export * from "./image/engines";
export * from "./budget";
export * from "./api-keys";
