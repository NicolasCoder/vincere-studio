import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { checkBudget } from "../budget";
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
    /*
     * A trava de orçamento fica AQUI, e não no job que chama.
     *
     * Até agora `checkBudget` cobria só imagem: a voz calculava o custo, registrava em `Usage` e
     * somava no projeto — depois de já ter gasto. Ou seja, o teto de US$ 0 bloqueava imagem paga e
     * deixava voz paga passar, o que contraria a regra do projeto de produzir no gratuito.
     *
     * Travar no provedor e não no chamador é a mesma lição do registro de motores de imagem: com a
     * trava no job, cada novo caminho que sintetizar voz (preview, workflow, um AUTO_PRODUCE
     * futuro) precisa lembrar de chamar — e um dia não lembra. Aqui não tem como desviar.
     */
    await checkBudget((req.text.length / 1000) * PRICE_PER_1K_CHARS);

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
