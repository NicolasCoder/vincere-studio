import { NextResponse } from "next/server";
import { z } from "zod";
import path from "node:path";
import fs from "node:fs/promises";
import { prisma } from "@vincere-studio/db";
import {
  analyzeLockup,
  buildCleanTimelineFromWords,
  compileColorGradeRecipe,
  reviewCleanTranscript,
  talkingHeadColorLookList,
  type TimedWord,
} from "@vincere-studio/core";
import { createRequest } from "@/lib/claude-inbox";

export const dynamic = "force-dynamic";

const REELS_TOOLS_DIR = process.env.REELS_TOOLS_DIR || "F:\\Python Projects\\reels_tools";
const OLLAMA_URL = process.env.SHARINGAN_LOCAL_BASE_URL || "http://127.0.0.1:11434/v1";
const VOICESTUDIO_URL = process.env.VOICESTUDIO_URL || "http://127.0.0.1:3900";

async function checkFile(p: string) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function checkHttp(url: string, timeoutMs = 1500) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
    return res.status < 500;
  } catch {
    return false;
  }
}

/**
 * GET /api/reels-tools
 * Retorna o status do Sistema de Processamento de Duas Vias (Nuvem vs Local GPU) e
 * os presets de Color Grading e Sharingan Style Library disponíveis.
 */
export async function GET() {
  const [reelsToolsLocal, sharinganLocal, ollamaOnline, voiceStudioOnline, modeSetting, recentJobs] = await Promise.all([
    checkFile(path.join(REELS_TOOLS_DIR, "04_build_clean_timeline.py")),
    checkFile(path.join(REELS_TOOLS_DIR, "video-sharingan", "scripts", "sharingan.py")),
    checkHttp(`${OLLAMA_URL.replace(/\/v1$/, "")}/api/tags`),
    checkHttp(`${VOICESTUDIO_URL}/mcp/`),
    prisma.setting.findUnique({ where: { key: "hybrid_compute_mode" } }),
    prisma.job.findMany({
      where: { type: { in: ["TALKING_HEAD_PIPELINE", "SHARINGAN_CLONE", "SYNTHESIZE_VOICE"] } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  // Lista clones de referência existentes em reels_tools/projects/style_lib
  const styleLibDir = path.join(REELS_TOOLS_DIR, "projects", "style_lib");
  const stylePresets = await fs.readdir(styleLibDir).catch(() => [
    "estilo222",
    "g4_valley",
    "reels_imobiliario",
    "referenciamotion",
  ]);

  return NextResponse.json({
    ok: true,
    computeMode: (modeSetting?.value ?? "AUTO") as "AUTO" | "LOCAL_GPU" | "CLOUD_FAST",
    nodes: {
      cloudWeb: {
        online: true,
        label: "Via 1 · Nuvem / Interface Web",
        tasks: ["Lockup Nesting (07b)", "256-pt SVG Color LUT (06b)", "Regra do Vão Livre & Splice Masking", "Revisão Editorial (07c)", "Roteiro & Ideação"],
      },
      localGpu: {
        online: reelsToolsLocal || sharinganLocal || ollamaOnline,
        reelsToolsLocal,
        sharinganLocal,
        ollamaOnline,
        voiceStudioOnline,
        label: "Via 2 · Worker Local GPU / PC",
        tasks: ["Clonagem de Voz & Whisper (CrisperWhisper)", "Sharingan Optical Flow + Qwen2.5-VL-7B", "Alinhamento Facial MediaPipe (Y=640px)", "Relighting 3D Depth Anything V2 & Render GPU"],
      },
    },
    looks: talkingHeadColorLookList.map((l) => ({
      id: l.id,
      name: l.name,
      badge: l.badge,
      description: l.description,
      category: l.category,
    })),
    stylePresets,
    recentJobs: recentJobs.map((j) => ({
      id: j.id,
      type: j.type,
      status: j.status,
      progress: j.progress,
      message: j.message,
      result: j.result ? JSON.parse(j.result) : null,
      createdAt: j.createdAt,
    })),
  });
}

const lockupSchema = z.object({
  action: z.literal("lockup"),
  main: z.string().min(1).max(60),
  above: z.string().max(60).optional().default(""),
  below: z.string().max(60).optional().default(""),
});

const colorGradeSchema = z.object({
  action: z.literal("color-grade"),
  lookId: z.string().min(1),
  strength: z.number().min(0).max(1.2).optional().default(0.95),
});

const cleanTimelineSchema = z.object({
  action: z.literal("clean-timeline"),
  text: z.string().min(3).max(15000),
  minSilenceGapS: z.number().min(0.15).max(2.0).optional().default(0.35),
});

const setModeSchema = z.object({
  action: z.literal("set-compute-mode"),
  mode: z.enum(["AUTO", "LOCAL_GPU", "CLOUD_FAST"]),
});

const runPipelineSchema = z.object({
  action: z.literal("run-talking-head-job"),
  projectName: z.string().min(2).max(80),
  computeMode: z.enum(["AUTO", "LOCAL_GPU", "CLOUD_FAST"]).default("AUTO"),
  lookId: z.string().default("apple_sungazing"),
  transcript: z.string().max(20000).optional().default(""),
  lockupMain: z.string().max(60).optional().default("limpeza"),
  lockupAbove: z.string().max(60).optional().default("pra fazer"),
  lockupBelow: z.string().max(60).optional().default("das lavouras"),
  videoPath: z.string().max(400).optional(),
  projectId: z.string().optional(),
});

function synthesizeWordsFromText(text: string): TimedWord[] {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  let cursor = 0.15;
  return tokens.map((word, idx) => {
    const isPauseTag = /^\[pausa/i.test(word) || word === "[pausa]" || word === "...";
    const dur = isPauseTag ? 0.55 : Math.max(0.16, Math.min(0.52, word.length * 0.042));
    const tStart = Number(cursor.toFixed(3));
    const tEnd = Number((cursor + dur).toFixed(3));
    const sentenceEnd = /[.?!]$/.test(word);
    cursor = tEnd + (sentenceEnd ? 0.44 : idx % 8 === 7 ? 0.38 : 0.035);
    return { gid: idx, word, tStart, tEnd };
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.action) {
    return NextResponse.json({ ok: false, error: "Informe action" }, { status: 400 });
  }

  try {
    switch (body.action) {
      case "lockup": {
        const d = lockupSchema.parse(body);
        const analysis = analyzeLockup(d.main, d.above, d.below);
        return NextResponse.json({ ok: true, analysis });
      }
      case "color-grade": {
        const d = colorGradeSchema.parse(body);
        const recipe = compileColorGradeRecipe(d.lookId, d.strength);
        return NextResponse.json({ ok: true, recipe });
      }
      case "clean-timeline": {
        const d = cleanTimelineSchema.parse(body);
        const words = synthesizeWordsFromText(d.text);
        const timeline = buildCleanTimelineFromWords(words, { minSilenceGapS: d.minSilenceGapS });
        const review = reviewCleanTranscript(words);
        return NextResponse.json({ ok: true, timeline, review });
      }
      case "set-compute-mode": {
        const d = setModeSchema.parse(body);
        await prisma.setting.upsert({
          where: { key: "hybrid_compute_mode" },
          create: { key: "hybrid_compute_mode", value: d.mode },
          update: { value: d.mode },
        });
        return NextResponse.json({ ok: true, computeMode: d.mode });
      }
      case "run-talking-head-job": {
        const d = runPipelineSchema.parse(body);
        const job = await prisma.job.create({
          data: {
            type: "TALKING_HEAD_PIPELINE",
            projectId: d.projectId,
            payload: JSON.stringify(d),
          },
        });
        if (d.computeMode === "LOCAL_GPU") {
          await createRequest({
            pedido: `[Duas Vias · GPU Local] Processar pipeline Talking Head "${d.projectName}" com look ${d.lookId}${d.videoPath ? ` no vídeo ${d.videoPath}` : ""}.`,
            pagina: "/talking-head",
            projetoId: d.projectId,
          }).catch(() => {});
        }
        return NextResponse.json({ ok: true, jobId: job.id });
      }
      default:
        return NextResponse.json({ ok: false, error: `Ação desconhecida: ${body.action}` }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
}
