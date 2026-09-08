import path from "node:path";
import { mkdir } from "node:fs/promises";
import { getVoiceProvider, relPath, storageRoot } from "@docupulse/providers";
import type { JobContext } from "../queue";

export const PREVIEW_TEXT =
  "Em 1983, um sinal vindo dos confins do sistema solar foi registrado… e depois apagado de todos os relatórios oficiais. Por quarenta anos, ninguém falou sobre ele. Até agora.";

/**
 * PREVIEW_VOICE: grava uma frase de teste (ou um texto customizado) com a voz pedida em
 * storage/previews. payload: { provider, voiceId, style?, rate?, text?, cacheKey? }
 * `text` substitui a frase padrão (ex.: roteiro real de um node de Voz do Workflow Studio);
 * `cacheKey` evita que previews de textos diferentes se sobrescrevam no mesmo arquivo.
 */
export async function previewVoice(ctx: JobContext) {
  const provider = String(ctx.payload.provider ?? "GEMINI_TTS");
  const voiceId = String(ctx.payload.voiceId ?? "Charon");
  const style = ctx.payload.style ? String(ctx.payload.style) : undefined;
  const rate = Number(ctx.payload.rate ?? 1) || 1;
  const text = ctx.payload.text ? String(ctx.payload.text) : PREVIEW_TEXT;
  const cacheKey = ctx.payload.cacheKey ? `__${String(ctx.payload.cacheKey).replace(/[^\w.-]/g, "_")}` : "";
  const dir = path.join(storageRoot(), "previews");
  await mkdir(dir, { recursive: true });
  const out = path.join(dir, `${provider}__${voiceId.replace(/[^\w.-]/g, "_")}${cacheKey}.wav`);
  await ctx.progress({ percent: 20, message: `${provider} / ${voiceId}` });
  const p = getVoiceProvider(provider);
  const r = await p.synthesize({ text, voiceId, style, rate, language: "pt-BR" }, out);
  await ctx.log(`Prévia ${provider}/${voiceId}: ${(r.durationMs / 1000).toFixed(1)}s → ${relPath(r.file)}`);
  return { file: relPath(r.file), durationMs: r.durationMs };
}
