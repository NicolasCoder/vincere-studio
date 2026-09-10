/**
 * Máquina de estados do pipeline. Cada projeto avança por estas etapas;
 * o stepper do topo do app é uma projeção direta deste array.
 */
export const STAGES = ["IDEATION", "SCRIPT", "MEDIA", "RENDER", "PUBLISH"] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_META: Record<Stage, { step: number; title: string; short: string; href: string }> = {
  IDEATION: { step: 1, title: "Tópico & Nicho", short: "Ideation", href: "ideation" },
  SCRIPT: { step: 2, title: "Roteiro & Narrativa", short: "Roteiro", href: "script" },
  MEDIA: { step: 3, title: "Voiceover & B-Roll", short: "Mídia", href: "media" },
  RENDER: { step: 4, title: "Render & Export", short: "Render", href: "render" },
  PUBLISH: { step: 5, title: "Publicado", short: "Publicado", href: "published" },
};

export type StepState = "done" | "active" | "locked";

/** Estado de cada passo do stepper dado o estágio atual do projeto. */
export function stepStates(current: Stage): Record<Stage, StepState> {
  const idx = STAGES.indexOf(current);
  return Object.fromEntries(
    STAGES.map((s, i) => [s, i < idx ? "done" : i === idx ? "active" : "locked"]),
  ) as Record<Stage, StepState>;
}

export function nextStage(current: Stage): Stage | null {
  const idx = STAGES.indexOf(current);
  return STAGES[idx + 1] ?? null;
}

/** Tipos de job que o worker sabe executar. Um por capacidade do pipeline. */
export const JOB_TYPES = [
  "DEMO",
  "GENERATE_IDEAS",
  "GENERATE_SCRIPT",
  "SYNTHESIZE_VOICE",
  "HUNT_BROLL",
  "ALIGN_CAPTIONS",
  "RENDER_VIDEO",
  "GENERATE_THUMBNAIL",
  "PUBLISH_YOUTUBE",
  "RUN_WORKFLOW",
  "REWRITE_BLOCK",
  "SCRIPT_SUGGESTIONS",
  "GENERATE_SCENE_PROMPTS",
  "IMPORT_INBOX",
  "PREVIEW_VOICE",
  "GENERATE_EDIT_PLAN",
] as const;
export type JobType = (typeof JOB_TYPES)[number];
