import { z } from "zod";

/** Modo de custo por projeto: define a cadeia de provedores usada. */
export const CostModeSchema = z.enum(["FREE", "HYBRID", "PREMIUM"]);
export type CostMode = z.infer<typeof CostModeSchema>;

export const COST_MODES: Record<CostMode, { label: string; description: string }> = {
  FREE: {
    label: "Gratuito",
    description: "Gemini free tier + Edge TTS + Pexels/Pixabay + FLUX (Cloudflare) + import manual do Flow",
  },
  HYBRID: {
    label: "Híbrido",
    description: "Gratuito, mas gera imagens-chave e thumbnail com Nano Banana pela API",
  },
  PREMIUM: {
    label: "Premium",
    description: "Nano Banana Pro para todas as cenas, ElevenLabs para voz, Veo opcional",
  },
};

/** Payload comum de progresso emitido pelos jobs. */
export const JobProgressSchema = z.object({
  percent: z.number().min(0).max(100),
  message: z.string().optional(),
  etaSeconds: z.number().optional(),
});
export type JobProgress = z.infer<typeof JobProgressSchema>;

/** Unidades de consumo medidas pelo app (base dos "créditos"). */
export const UsageUnitSchema = z.enum(["TOKENS_IN", "TOKENS_OUT", "IMAGES", "AUDIO_SECONDS", "VIDEO_SECONDS", "REQUESTS"]);
export type UsageUnit = z.infer<typeof UsageUnitSchema>;
