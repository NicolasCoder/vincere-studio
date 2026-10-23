import type { JobType } from "@vincere-studio/core";
import type { JobContext } from "../queue";
import { demo } from "./demo";
import { runWorkflow } from "./run-workflow";
import { generateIdeas } from "./generate-ideas";
import { generateScript } from "./generate-script";
import { rewriteBlock, scriptSuggestions } from "./rewrite-block";
import { synthesizeVoice } from "./synthesize-voice";
import { alignCaptions } from "./align-captions";
import { generateScenePrompts, huntBroll, importInbox } from "./scenes";
import { previewVoice } from "./preview-voice";
import { renderVideo } from "./render-video";
import { generateThumbnail } from "./generate-thumbnail";
import { publishYoutube } from "./publish-youtube";
import { generateEditPlan } from "./edit-plan";
import { generateImages } from "./generate-images";
import { applyVisualLayer } from "./apply-visual-layer";
import { talkingHeadPipeline } from "./talking-head";
import { sharinganClone } from "./sharingan-clone";
import { checkSkillsUpdates } from "./skills-updates";
import { autoProduce } from "./auto-produce";

export type JobHandler = (ctx: JobContext) => Promise<unknown>;

/**
 * Todos os tipos de job têm handler real — não há mais stub de "chega na sprint N", e o
 * `Record<JobType, ...>` impede esquecer um.
 *
 * O que o tipo NÃO garante é o outro lado: um job pode ter handler aqui e nenhum botão que o
 * dispare. Foi o caso do APPLY_VISUAL_LAYER, inalcançável pela interface enquanto nove projetos
 * saíam sem camada visual e nada indicava a etapa faltando.
 */
export const handlers: Record<JobType, JobHandler> = {
  DEMO: demo,
  GENERATE_IDEAS: generateIdeas,
  GENERATE_SCRIPT: generateScript,
  SYNTHESIZE_VOICE: synthesizeVoice,
  HUNT_BROLL: huntBroll,
  ALIGN_CAPTIONS: alignCaptions,
  RENDER_VIDEO: renderVideo,
  GENERATE_THUMBNAIL: generateThumbnail,
  PUBLISH_YOUTUBE: publishYoutube,
  RUN_WORKFLOW: runWorkflow,
  REWRITE_BLOCK: rewriteBlock,
  SCRIPT_SUGGESTIONS: scriptSuggestions,
  GENERATE_SCENE_PROMPTS: generateScenePrompts,
  IMPORT_INBOX: importInbox,
  PREVIEW_VOICE: previewVoice,
  GENERATE_EDIT_PLAN: generateEditPlan,
  GENERATE_IMAGES: generateImages,
  APPLY_VISUAL_LAYER: applyVisualLayer,
  TALKING_HEAD_PIPELINE: talkingHeadPipeline,
  SHARINGAN_CLONE: sharinganClone,
  CHECK_SKILLS_UPDATES: checkSkillsUpdates,
  AUTO_PRODUCE: autoProduce,
};
