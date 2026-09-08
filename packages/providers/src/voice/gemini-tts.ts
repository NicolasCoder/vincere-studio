import { ProviderError } from "../types";
import { pcmToWav, probeDurationMs } from "../media/ffmpeg";
import type { VoiceProvider, VoiceRequest, VoiceResult } from "./types";

const MODELS = (process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts,gemini-3.1-flash-tts-preview").split(",").map((m) => m.trim()).filter(Boolean);
const TIMEOUT_MS = Number(process.env.GEMINI_TTS_TIMEOUT_MS ?? 150_000);
const BASE = "https://generativelanguage.googleapis.com/v1beta";
/** US$ por 1M tokens de saída de áudio (≈ 1 token por caractere de entrada; estimativa). */
const PRICE_OUT_PER_M = 10;

/** Vozes pré-construídas do Gemini TTS (nomes fixos da API) com o caráter descrito pelo Google. */
const VOICES = [
  { id: "Charon", label: "Charon · Informativo, grave", gender: "m", description: "Narrador sombrio, ideal para dark documentary" },
  { id: "Orus", label: "Orus · Firme", gender: "m", description: "Autoridade, documentário clássico" },
  { id: "Fenrir", label: "Fenrir · Intenso", gender: "m", description: "Energia e urgência" },
  { id: "Enceladus", label: "Enceladus · Sussurrado", gender: "m", description: "Intimista, suspense" },
  { id: "Iapetus", label: "Iapetus · Claro", gender: "m", description: "Explicativo, limpo" },
  { id: "Umbriel", label: "Umbriel · Tranquilo", gender: "m", description: "Calmo, reflexivo" },
  { id: "Algieba", label: "Algieba · Suave", gender: "m", description: "Macio, agradável" },
  { id: "Algenib", label: "Algenib · Rouco", gender: "m", description: "Textura, gravidade" },
  { id: "Rasalgethi", label: "Rasalgethi · Informativo", gender: "m", description: "Didático" },
  { id: "Achernar", label: "Achernar · Macio", gender: "m", description: "Leve e suave" },
  { id: "Alnilam", label: "Alnilam · Firme", gender: "m", description: "Determinado" },
  { id: "Schedar", label: "Schedar · Equilibrado", gender: "m", description: "Neutro, estável" },
  { id: "Gacrux", label: "Gacrux · Maduro", gender: "m", description: "Voz madura, experiente" },
  { id: "Zubenelgenubi", label: "Zubenelgenubi · Casual", gender: "m", description: "Conversa, vlog" },
  { id: "Sadaltager", label: "Sadaltager · Conhecedor", gender: "m", description: "Especialista" },
  { id: "Sadachbia", label: "Sadachbia · Vivo", gender: "m", description: "Animado" },
  { id: "Puck", label: "Puck · Animado", gender: "m", description: "Vídeos infantis e divertidos" },
  { id: "Zephyr", label: "Zephyr · Brilhante", gender: "f", description: "Clara e luminosa" },
  { id: "Kore", label: "Kore · Firme e clara", gender: "f", description: "Narradora investigativa" },
  { id: "Leda", label: "Leda · Jovem", gender: "f", description: "Shorts e reels" },
  { id: "Aoede", label: "Aoede · Leve", gender: "f", description: "Conteúdo infantil e leve" },
  { id: "Callirrhoe", label: "Callirrhoe · Descontraída", gender: "f", description: "Tranquila, easy-going" },
  { id: "Autonoe", label: "Autonoe · Brilhante", gender: "f", description: "Energia positiva" },
  { id: "Despina", label: "Despina · Suave", gender: "f", description: "Macia, elegante" },
  { id: "Erinome", label: "Erinome · Clara", gender: "f", description: "Limpa, precisa" },
  { id: "Laomedeia", label: "Laomedeia · Animada", gender: "f", description: "Upbeat" },
  { id: "Pulcherrima", label: "Pulcherrima · Direta", gender: "f", description: "Assertiva" },
  { id: "Achird", label: "Achird · Amigável", gender: "f", description: "Calorosa" },
  { id: "Vindemiatrix", label: "Vindemiatrix · Gentil", gender: "f", description: "Suave, acolhedora" },
  { id: "Sulafat", label: "Sulafat · Calorosa", gender: "f", description: "Quente, próxima" },
];

export class GeminiVoiceProvider implements VoiceProvider {
  readonly name = "GEMINI_TTS";
  constructor(private readonly apiKey = process.env.GEMINI_API_KEY ?? "") {
    if (!this.apiKey) throw new ProviderError("GEMINI_API_KEY não configurada");
  }
  voices() {
    return VOICES;
  }
  async synthesize(req: VoiceRequest, outFile: string): Promise<VoiceResult> {
    const style = req.style ? `${req.style}\n\n` : "";
    const body = {
      contents: [{ parts: [{ text: `${style}${req.text}` }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: req.voiceId } } },
      },
    };
    type Resp = { candidates?: { content?: { parts?: { inlineData?: { mimeType?: string; data?: string } }[] } }[]; error?: { message?: string } };
    let part: { inlineData?: { mimeType?: string; data?: string } } | undefined;
    let lastErr: unknown;
    // Tenta cada modelo TTS; 429/5xx/timeout passam para o próximo.
    for (const model of MODELS) {
      try {
        const res = await fetch(`${BASE}/models/${model}:generateContent`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": this.apiKey },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        const json = (await res.json().catch(() => ({}))) as Resp;
        if (!res.ok) throw new ProviderError(`Gemini TTS ${model} ${res.status}: ${json.error?.message ?? res.statusText}`, res.status, json);
        part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
        if (!part?.inlineData?.data) throw new ProviderError(`Gemini TTS ${model} não retornou áudio`, 502, json);
        break;
      } catch (err) {
        lastErr = err;
        const status = err instanceof ProviderError ? err.status : 504;
        if (status && status !== 429 && status < 500) throw err;
        console.warn(`[gemini-tts] ${model} falhou (${String(err).slice(0, 80)}); tentando próximo modelo`);
      }
    }
    if (!part?.inlineData?.data) throw lastErr instanceof Error ? lastErr : new ProviderError(String(lastErr));
    const rate = Number(/rate=(\d+)/.exec(part.inlineData.mimeType ?? "")?.[1] ?? 24000);
    const pcm = Buffer.from(part.inlineData.data, "base64");
    await pcmToWav(pcm, outFile, rate);
    const durationMs = await probeDurationMs(outFile).catch(() => Math.round((pcm.length / 2 / rate) * 1000));
    const units = req.text.length;
    return { file: outFile, durationMs, provider: this.name, voiceId: req.voiceId, costUsd: (units * PRICE_OUT_PER_M) / 1_000_000, units };
  }
}
