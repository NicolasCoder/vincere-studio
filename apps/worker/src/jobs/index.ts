import type { JobType } from "@docupulse/core";
import type { JobContext } from "../queue";
import { demo } from "./demo";
import { runWorkflow } from "./run-workflow";

export type JobHandler = (ctx: JobContext) => Promise<unknown>;

const notImplemented =
  (sprint: string): JobHandler =>
  async (ctx) => {
    await ctx.log(`Job ${ctx.job.type} ainda não implementado (${sprint}).`);
    throw new Error(`${ctx.job.type} chega na ${sprint}`);
  };

export const handlers: Record<JobType, JobHandler> = {
  DEMO: demo,
  GENERATE_IDEAS: notImplemented("Sprint 1"),
  GENERATE_SCRIPT: notImplemented("Sprint 2"),
  SYNTHESIZE_VOICE: notImplemented("Sprint 3"),
  HUNT_BROLL: notImplemented("Sprint 3"),
  ALIGN_CAPTIONS: notImplemented("Sprint 3"),
  RENDER_VIDEO: notImplemented("Sprint 4"),
  PUBLISH_YOUTUBE: notImplemented("Sprint 5"),
  RUN_WORKFLOW: runWorkflow,
};
