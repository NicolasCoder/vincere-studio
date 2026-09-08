import type { VoiceProvider } from "./types";
import { GeminiVoiceProvider } from "./gemini-tts";
import { EdgeVoiceProvider } from "./edge-tts";
import { ElevenLabsVoiceProvider } from "./elevenlabs";
export * from "./types";
export { GeminiVoiceProvider, EdgeVoiceProvider, ElevenLabsVoiceProvider };

export function getVoiceProvider(name: string): VoiceProvider {
  switch (name) {
    case "GEMINI_TTS":
      return new GeminiVoiceProvider();
    case "EDGE_TTS":
      return new EdgeVoiceProvider();
    case "ELEVENLABS":
      return new ElevenLabsVoiceProvider();
    default:
      throw new Error(`Provedor de voz desconhecido: ${name}`);
  }
}

export const VOICE_PROVIDERS = ["GEMINI_TTS", "EDGE_TTS", "ELEVENLABS"] as const;
