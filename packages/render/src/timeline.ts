/** Estruturas de timeline que o render consome (independentes do Prisma). */
export interface TimelineScene {
  id: string;
  file: string | null; // caminho absoluto ou null (cartão de título)
  mediaType: "image" | "video";
  durationMs: number;
  motion: "slow-zoom-in" | "slow-pan" | "gentle-float" | "static";
  title: string; // texto do cartão quando não há mídia
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
