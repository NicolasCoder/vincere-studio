import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { probeDurationMs } from "../media/ffmpeg";
import { ProviderError } from "../types";
import type { VoiceProvider, VoiceRequest, VoiceResult } from "./types";

/**
 * ElevenLabs — qualidade premium. Free tier: 10k créditos/mês (~10 min).
 * voiceId = ID da voz (em elevenlabs.io → Vozes → ... → "Copy voice ID").
 */
const MODEL = process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";
const PRICE_PER_1K_CHARS = 0.3; // estimativa do plano Starter; free tier = 0

export class ElevenLabsVoiceProvider implements VoiceProvider {
  readonly name = "ELEVENLABS";
  constructor(private readonly apiKey = process.env.ELEVENLABS_API_KEY ?? "") {
    if (!this.apiKey) throw new ProviderError("ELEVENLABS_API_KEY não configurada no .env");
  }
  voices() {
    return [
      { id: "cole-o-voice-id", label: "Cole o Voice ID da voz escolhida em elevenlabs.io", description: "Vozes → menu da voz → Copy voice ID" },
    ];
  }
  async synthesize(req: VoiceRequest, outFile: string): Promise<VoiceResult> {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(req.voiceId)}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": this.apiKey, "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify({
        text: req.text,
        model_id: MODEL,
        voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true, speed: req.rate ?? 1 },
      }),
      signal: AbortSignal.timeout(180_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new ProviderError(`ElevenLabs ${res.status}: ${body.slice(0, 200) || res.statusText}`, res.status, body);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    await mkdir(path.dirname(outFile), { recursive: true });
    const mp3 = outFile.replace(/\.wav$/i, ".mp3");
    await writeFile(mp3, buf);
    const durationMs = await probeDurationMs(mp3);
    const units = req.text.length;
    return { file: mp3, durationMs, provider: this.name, voiceId: req.voiceId, costUsd: (units / 1000) * PRICE_PER_1K_CHARS, units };
  }
}
