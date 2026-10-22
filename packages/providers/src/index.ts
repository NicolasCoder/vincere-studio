export * from "./types";
export * from "./schema";
export * from "./usage";
export { GeminiTextProvider } from "./gemini/text";
export { OllamaTextProvider } from "./ollama/text";
export { OpenAICompatTextProvider } from "./openai-compat/text";

import type { TextProvider } from "./types";
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
