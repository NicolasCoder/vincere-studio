import type { JobType } from "@docupulse/core";
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

export type JobHandler = (ctx: JobContext) => Promise<unknown>;

const notImplemented =
  (sprint: string): JobHandler =>
  async (ctx) => {
    await ctx.log(`Job ${ctx.job.type} ainda não implementado (${sprint}).`);
    throw new Error(`${ctx.job.type} chega na ${sprint}`);
  };

export const handlers: Record<JobType, JobHandler> = {
  DEMO: demo,
  GENERATE_IDEAS: generateIdeas,
  GENERATE_SCRIPT: generateScript,
  SYNTHESIZE_VOICE: synthesizeVoice,
  HUNT_BROLL: huntBroll,
  ALIGN_CAPTIONS: alignCaptions,
  RENDER_VIDEO: notImplemented("Sprint 4"),
  PUBLISH_YOUTUBE: notImplemented("Sprint 5"),
  RUN_WORKFLOW: runWorkflow,
  REWRITE_BLOCK: rewriteBlock,
  SCRIPT_SUGGESTIONS: scriptSuggestions,
  GENERATE_SCENE_PROMPTS: generateScenePrompts,
  IMPORT_INBOX: importInbox,
  PREVIEW_VOICE: previewVoice,
};
