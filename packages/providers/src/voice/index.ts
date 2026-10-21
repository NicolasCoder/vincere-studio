import type { VoiceProvider } from "./types";
import { GeminiVoiceProvider } from "./gemini-tts";
import { EdgeVoiceProvider, EDGE_VOICES } from "./edge-tts";
import { ElevenLabsVoiceProvider } from "./elevenlabs";
import { VoiceStudioVoiceProvider } from "./voicestudio";
export * from "./types";
export { GeminiVoiceProvider, EdgeVoiceProvider, EDGE_VOICES, ElevenLabsVoiceProvider, VoiceStudioVoiceProvider };

export function getVoiceProvider(name: string): VoiceProvider {
  switch (name) {
    case "GEMINI_TTS":
      return new GeminiVoiceProvider();
    case "EDGE_TTS":
      return new EdgeVoiceProvider();
    case "VOICESTUDIO":
      return new VoiceStudioVoiceProvider();
    // Legado: só para perfis antigos que já usam ElevenLabs; não é mais oferecido na interface.
    case "ELEVENLABS":
      return new ElevenLabsVoiceProvider();
    default:
      throw new Error(`Provedor de voz desconhecido: ${name}`);
  }
}

export const VOICE_PROVIDERS = ["GEMINI_TTS", "EDGE_TTS", "VOICESTUDIO"] as const;
