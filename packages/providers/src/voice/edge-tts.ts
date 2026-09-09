import { mkdir } from "node:fs/promises";
import path from "node:path";
import { probeDurationMs } from "../media/ffmpeg";
import { ProviderError } from "../types";
import type { VoiceProvider, VoiceRequest, VoiceResult } from "./types";

/**
 * Edge TTS (Microsoft) — gratuito, sem chave, via pacote `msedge-tts`.
 * Reserva do Gemini TTS; vozes neurais pt-BR de boa qualidade.
 */
const VOICES = [
  { id: "pt-BR-AntonioNeural", label: "Antônio · Grave e natural", gender: "m", description: "Narração documental" },
  { id: "pt-BR-FranciscaNeural", label: "Francisca · Clara", gender: "f", description: "Narração neutra" },
  { id: "pt-BR-ThalitaNeural", label: "Thalita · Jovem", gender: "f", description: "Shorts" },
  { id: "pt-BR-MacerioMultilingualNeural", label: "Macério · Multilíngue", gender: "m", description: "Versátil" },
];

/** Lista canônica de voiceIds válidos do Edge TTS — usada por quem grava um voiceId (ex.: o nó
 * de Voz do Workflow Studio) pra validar antes de sintetizar, em vez de deixar o msedge-tts
 * quebrar com "Could not infer voiceLocale from voiceName" quando o valor salvo não é um ID real. */
export const EDGE_VOICES = VOICES;

export class EdgeVoiceProvider implements VoiceProvider {
  readonly name = "EDGE_TTS";
  voices() {
    return VOICES;
  }
  async synthesize(req: VoiceRequest, outFile: string): Promise<VoiceResult> {
    // import dinâmico: pacote opcional, só carregado quando usado
    const modName = "msedge-tts";
    const mod = (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ modName).catch(() => null)) as null | { MsEdgeTTS: new () => { setMetadata: (v: string, f: string) => Promise<void>; toFile: (dir: string, text: string, opts?: { rate?: string; pitch?: string }) => Promise<{ audioFilePath: string }> }; OUTPUT_FORMAT: Record<string, string> };
    if (!mod) throw new ProviderError("Pacote msedge-tts não instalado (pnpm add msedge-tts no worker)");
    const tts = new mod.MsEdgeTTS();
    await tts.setMetadata(req.voiceId, mod.OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    await mkdir(path.dirname(outFile), { recursive: true });
    const rate = req.rate && req.rate !== 1 ? `${Math.round((req.rate - 1) * 100)}%` : undefined;
    // Edge não gosta de reticências unicode e de opções vazias
    const text = req.text.replace(/…/g, "...").replace(/\s+\n/g, "\n");
    outFile = outFile.replace(/\.wav$/i, ".mp3"); // Edge entrega MP3
    const { audioFilePath } = rate ? await tts.toFile(path.dirname(outFile), text, { rate: rate.startsWith("-") ? rate : `+${rate}` }) : await tts.toFile(path.dirname(outFile), text);
    // msedge-tts grava com nome próprio; renomeia para o esperado
    const { rename } = await import("node:fs/promises");
    await rename(audioFilePath, outFile).catch(async () => {
      const { copyFile } = await import("node:fs/promises");
      await copyFile(audioFilePath, outFile);
    });
    const durationMs = await probeDurationMs(outFile);
    return { file: outFile, durationMs, provider: this.name, voiceId: req.voiceId, costUsd: 0, units: req.text.length };
  }
}
