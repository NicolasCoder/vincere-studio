export * from "./types";
export * from "./schema";
export * from "./usage";
export { GeminiTextProvider } from "./gemini/text";

import type { TextProvider } from "./types";
import { GeminiTextProvider } from "./gemini/text";

/** Fábrica: hoje só Gemini; Claude/OpenAI entram aqui sem mudar os jobs. */
export function getTextProvider(name = process.env.TEXT_PROVIDER ?? "GEMINI"): TextProvider {
  switch (name) {
    case "GEMINI":
      return new GeminiTextProvider();
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
export * from "./image/kie-image";
export * from "./image/engines";
export * from "./budget";
