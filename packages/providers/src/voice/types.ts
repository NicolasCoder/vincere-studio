export interface VoiceRequest {
  text: string;
  voiceId: string;
  /** Instrução de estilo em linguagem natural (Gemini) ou ignorada (Edge). */
  style?: string;
  rate?: number; // 1.0 = normal
  pitch?: number; // 0 = normal
  language?: string; // pt-BR
}

export interface VoiceResult {
  /** Arquivo WAV/MP3 gravado */
  file: string;
  durationMs: number;
  provider: string;
  voiceId: string;
  costUsd: number;
  units: number; // caracteres sintetizados
}

export interface VoiceProvider {
  readonly name: string;
  /** Vozes disponíveis para o seletor. */
  voices(): { id: string; label: string; gender?: string; description?: string }[];
  synthesize(req: VoiceRequest, outFile: string): Promise<VoiceResult>;
}
