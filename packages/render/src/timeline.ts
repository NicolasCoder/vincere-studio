/** Estruturas de timeline que o render consome (independentes do Prisma). */
export interface TimelineScene {
  id: string;
  file: string | null; // caminho absoluto ou null (cartão de título)
  mediaType: "image" | "video";
  durationMs: number;
  motion: MotionKind;
  title: string; // texto do cartão quando não há mídia
  /** Segundo inicial ao usar um vídeo mais longo que a cena (evita começar sempre do zero) */
  startOffsetSec?: number;
  /** Duração do arquivo de vídeo, quando conhecida */
  mediaDurationMs?: number | null;
  /** true quando a mídia foi herdada de uma cena vizinha */
  borrowed?: boolean;
}

export const MOTION_PRESETS = [
  { id: "static", label: "Estático", description: "Sem movimento de câmera" },
  { id: "slow-zoom-in", label: "Zoom suave", description: "Aproximação cinematográfica" },
  { id: "slow-zoom-out", label: "Zoom de abertura", description: "Revela gradualmente o quadro" },
  { id: "pan-right", label: "Pan para direita", description: "Varredura horizontal suave" },
  { id: "pan-left", label: "Pan para esquerda", description: "Varredura horizontal inversa" },
  { id: "pan-up", label: "Pan para cima", description: "Revela o quadro de baixo para cima" },
  { id: "pan-down", label: "Pan para baixo", description: "Revela o quadro de cima para baixo" },
  { id: "dolly-in", label: "Dolly in", description: "Aproximação mais intensa para impacto" },
  { id: "gentle-float", label: "Flutuação suave", description: "Movimento orgânico discreto" },
  { id: "parallax-soft", label: "Parallax suave", description: "Profundidade simulada com movimento diagonal" },
  { id: "handheld-soft", label: "Handheld leve", description: "Oscilação documental controlada" },
  { id: "punch-zoom", label: "Punch zoom", description: "Entrada rápida para momentos de impacto" },
] as const;
export type MotionKind = (typeof MOTION_PRESETS)[number]["id"];

/** Compatibilidade com cenas antigas que usavam o nome genérico slow-pan. */
export function normalizeMotion(value: unknown, fallback: MotionKind = "slow-zoom-in"): MotionKind {
  if (value === "slow-pan") return "pan-right";
  return MOTION_PRESETS.some((preset) => preset.id === value) ? (value as MotionKind) : fallback;
}

const MOTIONS: MotionKind[] = ["slow-zoom-in", "slow-zoom-out", "pan-right", "pan-left", "gentle-float", "parallax-soft"];

/**
 * Cenas sem mídia herdam a mídia da cena mais próxima do mesmo ato (com outro movimento e outro
 * trecho do vídeo), para não cair em cartão de título. Cartão só se o ato inteiro não tem nada.
 */
export function borrowNeighborMedia(scenes: TimelineScene[]): TimelineScene[] {
  const withMedia = scenes.map((s, i) => (s.file ? i : -1)).filter((i) => i >= 0);
  if (!withMedia.length) return scenes;
  return scenes.map((s, i) => {
    if (s.file) return s;
    const j = withMedia.reduce((best, k) => (Math.abs(k - i) < Math.abs(best - i) ? k : best), withMedia[0]);
    const src = scenes[j];
    const motion = MOTIONS[(MOTIONS.indexOf(src.motion) + 1 + Math.abs(i - j)) % MOTIONS.length];
    return { ...s, file: src.file, mediaType: src.mediaType, mediaDurationMs: src.mediaDurationMs, motion, borrowed: true, startOffsetSec: undefined };
  });
}

/** Sorteia o ponto de entrada de cada vídeo de acervo mais longo que a cena (determinístico por id). */
export function randomizeVideoOffsets(scenes: TimelineScene[]): TimelineScene[] {
  return scenes.map((s) => {
    if (s.mediaType !== "video" || !s.mediaDurationMs || s.mediaDurationMs <= s.durationMs + 500) return s;
    const slack = (s.mediaDurationMs - s.durationMs) / 1000;
    let h = 0;
    for (const ch of s.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const r = (h % 1000) / 1000;
    return { ...s, startOffsetSec: Math.round(r * slack * 10) / 10 };
  });
}
export interface TimelineAct {
  act: number;
  title: string;
  voiceFile: string; // absoluto
  voiceDurationMs: number;
  scenes: TimelineScene[];
  words: { text: string; startMs: number; endMs: number }[]; // relativos ao ato
}
export interface Timeline {
  acts: TimelineAct[];
  gapMs: number; // silêncio entre atos
  musicFile?: string | null;
}

/**
 * Silêncio entre atos no master. Quem calcula timecode absoluto (legendas, plano de edição)
 * precisa usar exatamente este valor — divergir aqui desalinha tudo a partir do ato 2.
 */
export const ACT_GAP_MS = 350;

/** Reescala as durações das cenas para somarem exatamente a duração da voz do ato. */
export function fitScenesToVoice(scenes: TimelineScene[], voiceMs: number, minSceneMs = 1500): TimelineScene[] {
  if (!scenes.length) return [{ id: "card", file: null, mediaType: "image", durationMs: voiceMs, motion: "static", title: "" }];
  const sum = scenes.reduce((s, x) => s + Math.max(1, x.durationMs), 0) || 1;
  let acc = 0;
  return scenes.map((s, i) => {
    const d = i === scenes.length - 1 ? voiceMs - acc : Math.max(minSceneMs, Math.round((Math.max(1, s.durationMs) / sum) * voiceMs));
    acc += d;
    return { ...s, durationMs: Math.max(minSceneMs, d) };
  });
}

export const totalMs = (t: Timeline) => t.acts.reduce((s, a) => s + a.voiceDurationMs, 0) + Math.max(0, t.acts.length - 1) * t.gapMs;
