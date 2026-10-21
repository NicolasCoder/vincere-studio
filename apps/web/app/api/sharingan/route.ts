import { NextResponse } from "next/server";
import { z } from "zod";
import path from "node:path";
import fs from "node:fs/promises";
import { existsSync, readdirSync } from "node:fs";
import { prisma } from "@vincere-studio/db";
import { storageRoot } from "@vincere-studio/providers";
import { createRequest } from "@/lib/claude-inbox";
import { callPcGpuBridge, getPcGpuStatus } from "@/lib/pc-gpu-engine";

export const dynamic = "force-dynamic";

const REELS_TOOLS_DIR = process.env.REELS_TOOLS_DIR || "F:\\Python Projects\\reels_tools";
const OLLAMA_URL = process.env.SHARINGAN_LOCAL_BASE_URL || "http://127.0.0.1:11434/v1";

function toMediaUrl(absPath: string): string {
  return `/api/sharingan/media?path=${encodeURIComponent(absPath.replace(/\\/g, "/"))}`;
}

export interface StyleClonePreset {
  id: string;
  title: string;
  description: string;
  fps: number;
  aspect: string;
  shotsCount: number;
  aslS: number;
  bpm: number;
  dominantCamera: string;
  look: string;
  hasLocalVlm: boolean;
  hasForensicStep1: boolean;
  hasInteractiveStage: boolean;
  hasComparisonVideo: boolean;
  refVideoPath?: string;
}

const BUILTIN_STYLE_PRESETS: StyleClonePreset[] = [
  {
    id: "referenciamotion",
    title: "Referência Motion — Apple / macOS / Discord UI (Multi-Pass Local VLM)",
    description:
      "Coreografia cirúrgica de UI cards, cursores, dock macOS e transições elásticas GSAP extraídas em 3 passes (Keyframes + Step=5 + Adaptive High-Motion Burst + Step=1 Forense 1:1) na RTX 3060.",
    fps: 30,
    aspect: "9:16",
    shotsCount: 7,
    aslS: 1.56,
    bpm: 117.5,
    dominantCamera: "truck-right + push-in contínuo (never_stops=true)",
    look: "high-contrast dark + warm vibrant",
    hasLocalVlm: true,
    hasForensicStep1: true,
    hasInteractiveStage: true,
    hasComparisonVideo: true,
    refVideoPath: path.join(REELS_TOOLS_DIR, "projects", "style_lib", "referenciamotion", "ref.mp4"),
  },
  {
    id: "reels_imobiliario",
    title: "Reels Imobiliário 3-Atos (439 Frames Qwen2.5-VL-7B + 104 BPM)",
    description:
      "Análise de 439 frames via Qwen2.5-VL-7B + grid rítmico de 104 BPM + staging virtual Veo 3.1, plantas 3D e tipografia de luxo.",
    fps: 30,
    aspect: "9:16",
    shotsCount: 16,
    aslS: 2.1,
    bpm: 104,
    dominantCamera: "truck-right + push-in (1.8 %W/s)",
    look: "kodak_portra_400",
    hasLocalVlm: true,
    hasForensicStep1: false,
    hasInteractiveStage: true,
    hasComparisonVideo: true,
    refVideoPath: path.join(REELS_TOOLS_DIR, "projects", "style_lib", "reels_imobiliario", "ref.mp4"),
  },
  {
    id: "estilo222",
    title: "Estilo 222 (110-Edit Kinetic Talking Head)",
    description:
      "Talking Head de alta retenção com 110 micro-edições, punch-ins sincronizados, Lockups tipográficos e B-roll cobrindo emendas.",
    fps: 30,
    aspect: "9:16",
    shotsCount: 18,
    aslS: 1.9,
    bpm: 112,
    dominantCamera: "punch_in + jump_in (mascaramento ≥ 8%)",
    look: "apple_sungazing",
    hasLocalVlm: true,
    hasForensicStep1: false,
    hasInteractiveStage: true,
    hasComparisonVideo: true,
    refVideoPath: path.join(REELS_TOOLS_DIR, "projects", "style_lib", "estilo222", "ref.mp4"),
  },
  {
    id: "g4_valley",
    title: "G4 Valley VSL (Editorial Business Authority)",
    description:
      "Estrutura VSL executiva com cards de métricas animados, lower thirds de autoridade, contraste Kodak 2383 e cortes secos na batida.",
    fps: 30,
    aspect: "9:16",
    shotsCount: 14,
    aslS: 2.4,
    bpm: 105,
    dominantCamera: "push_slow + hold",
    look: "kodak_2383",
    hasLocalVlm: true,
    hasForensicStep1: false,
    hasInteractiveStage: false,
    hasComparisonVideo: false,
    refVideoPath: path.join(REELS_TOOLS_DIR, "projects", "style_lib", "g4_valley", "ref.mp4"),
  },
];

async function checkFile(p: string) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readJsonSafe<T = Record<string, unknown>>(p: string): Promise<T | null> {
  try {
    if (!existsSync(p)) return null;
    const raw = await fs.readFile(p, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function readTextSafe(p: string): Promise<string | null> {
  try {
    if (!existsSync(p)) return null;
    return await fs.readFile(p, "utf8");
  } catch {
    return null;
  }
}

function listImagesInDir(dirPath: string, limit = 80): { name: string; path: string; url: string }[] {
  if (!existsSync(dirPath)) return [];
  try {
    return readdirSync(dirPath)
      .filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f))
      .sort()
      .slice(0, limit)
      .map((name) => {
        const full = path.join(dirPath, name);
        return { name, path: full, url: toMediaUrl(full) };
      });
  } catch {
    return [];
  }
}

async function loadPresetInspection(presetId: string) {
  const baseDir = path.join(REELS_TOOLS_DIR, "projects", "style_lib", presetId);
  const sharinganDir = path.join(baseDir, "sharingan");
  const rendersDir = path.join(REELS_TOOLS_DIR, "renders");

  const [
    analysis,
    briefMd,
    localVlmSpecMd,
    act1ReportMd,
    tokenReportMerged,
    tokenReportStep5,
    tokenReportDraft,
    visionMerged,
    visionStep5,
    visionDraft,
    forensicVision,
  ] = await Promise.all([
    readJsonSafe(path.join(sharinganDir, "analysis.json")),
    readTextSafe(path.join(sharinganDir, "brief.md")),
    readTextSafe(path.join(sharinganDir, "local_qwen_adaptive_merged", "local_vlm_spec.md")).then(
      async (v) =>
        v ??
        (await readTextSafe(path.join(sharinganDir, "local_qwen_step5", "local_vlm_spec.md"))) ??
        (await readTextSafe(path.join(sharinganDir, "local_qwen_draft", "local_vlm_spec.md"))),
    ),
    readTextSafe(path.join(baseDir, "act1_frames", "act1_local_vlm_report.md")),
    readJsonSafe(path.join(sharinganDir, "local_qwen_adaptive_merged", "token_savings_report_merged.json")),
    readJsonSafe(path.join(sharinganDir, "local_qwen_step5", "token_savings_report.json")),
    readJsonSafe(path.join(sharinganDir, "local_qwen_draft", "token_savings_report.json")),
    readJsonSafe<{ observations?: unknown[]; model?: string; step_frames?: number; total_sampled_frames?: number }>(
      path.join(sharinganDir, "local_qwen_adaptive_merged", "local_vlm_vision_merged.json"),
    ),
    readJsonSafe<{ observations?: unknown[]; model?: string; step_frames?: number; total_sampled_frames?: number }>(
      path.join(sharinganDir, "local_qwen_step5", "local_vlm_vision.json"),
    ),
    readJsonSafe<{ observations?: unknown[]; model?: string; step_frames?: number; total_sampled_frames?: number }>(
      path.join(sharinganDir, "local_qwen_draft", "local_vlm_vision.json"),
    ),
    readJsonSafe<{ observations?: unknown[]; model?: string; mode?: string; total_frames?: number }>(
      path.join(sharinganDir, "local_qwen_step1_forensic", "forensic_step1_vision.json"),
    ),
  ]);

  // Contact sheets
  const sheets: { label: string; url: string; path: string }[] = [];
  const candidateSheets = [
    { label: "Overview Contact Sheet", p: path.join(sharinganDir, "sheets", "overview.png") },
    { label: "Shots Breakdown Sheet", p: path.join(sharinganDir, "sheets", "shots.png") },
    { label: "Act 1 Sheet (0.5s Grid)", p: path.join(baseDir, "act1_sheet_05s.jpg") },
    { label: "Comparativo Act 1 (Original vs Omni)", p: path.join(baseDir, "renders", "comparativo_act1_original_vs_omni.jpg") },
    { label: "Comparativo Storyboard", p: path.join(baseDir, "renders", "comparativo_storyboard.jpg") },
  ];
  for (const s of candidateSheets) {
    if (existsSync(s.p)) {
      sheets.push({ label: s.label, path: s.p, url: toMediaUrl(s.p) });
    }
  }

  // Gridded 720p frames (10%x10% red/cyan grid) & Forensic 1:1 strips
  const griddedFrames720p = listImagesInDir(path.join(sharinganDir, "vlm_frames_720p"), 70);
  const act1Frames = listImagesInDir(path.join(baseDir, "act1_frames"), 60);
  const forensicStrips1to1 = listImagesInDir(path.join(sharinganDir, "vlm_strips_1to1"), 60);
  const forensicFramesStep1 = listImagesInDir(path.join(sharinganDir, "vlm_frames_720x720_step1"), 60);

  // Interactive HTML5/GSAP Stages
  const htmlStages: { id: string; label: string; path: string; url: string }[] = [];
  const candidateStages = [
    {
      id: "pro_polished",
      label: "Clone Pro Polished (GSAP + Forensic 1:1 Refinado)",
      p: path.join(sharinganDir, "pro_polished_clone", "index.html"),
    },
    {
      id: "refined_clone",
      label: "Clone Híbrido Refinado (GSAP Stage)",
      p: path.join(sharinganDir, "refined_clone", "index.html"),
    },
    {
      id: "qwen_step5_draft",
      label: "Rascunho Puro Qwen2.5-VL (Step=5 Local GPU)",
      p: path.join(sharinganDir, "local_qwen_step5", "draft_index.html"),
    },
    {
      id: "qwen_pass1_draft",
      label: "Rascunho Puro Qwen2.5-VL (Pass 1 Keyframes)",
      p: path.join(sharinganDir, "local_qwen_draft", "draft_index.html"),
    },
    {
      id: "flow_clone",
      label: "Palco HTML5/GSAP Principal",
      p: path.join(baseDir, "flow_clone", "index.html"),
    },
    {
      id: "root_stage",
      label: "Palco HTML5/GSAP (Root Index)",
      p: path.join(baseDir, "index.html"),
    },
  ];
  for (const st of candidateStages) {
    if (existsSync(st.p)) {
      htmlStages.push({ id: st.id, label: st.label, path: st.p, url: toMediaUrl(st.p) });
    }
  }

  // Videos (Reference & 2-Way / 3-Way Comparisons)
  const videos: { id: string; label: string; path: string; url: string }[] = [];
  const candidateVideos = [
    {
      id: "ref_original",
      label: "Vídeo Referência Original (ref.mp4)",
      p: path.join(baseDir, "ref.mp4"),
    },
    {
      id: "comp_3way",
      label: "Comparativo 3-Vias (Original vs Híbrido vs Qwen2.5-VL Puro)",
      p: path.join(rendersDir, "comparativo_3_versoes_original_vs_hibrido_vs_local.mp4"),
      onlyFor: "referenciamotion",
    },
    {
      id: "comp_pro_polished",
      label: "Comparativo Lado a Lado (Original vs Clone Pro Polished)",
      p: path.join(rendersDir, "comparativo_referenciamotion_pro_polished.mp4"),
      onlyFor: "referenciamotion",
    },
    {
      id: "comp_step1_forensic",
      label: "Comparativo Forense Step=1 (328 Frames 1:1)",
      p: path.join(rendersDir, "comparativo_referenciamotion_step1_forensic.mp4"),
      onlyFor: "referenciamotion",
    },
    {
      id: "comp_adaptive_burst",
      label: "Comparativo Adaptive High-Motion Burst",
      p: path.join(rendersDir, "comparativo_referenciamotion_adaptive_burst.mp4"),
      onlyFor: "referenciamotion",
    },
    {
      id: "comp_imobiliario",
      label: "Comparativo Lado a Lado (Original vs Clone Imobiliário)",
      p: path.join(rendersDir, "comparativo_reels_imobiliario_original_vs_clone.mp4"),
      onlyFor: "reels_imobiliario",
    },
    {
      id: "preview_imobiliario",
      label: "Render Final Clone Imobiliário (1080×1920)",
      p: path.join(rendersDir, "preview_reels_imobiliario.mp4"),
      onlyFor: "reels_imobiliario",
    },
    {
      id: "preview_estilo222",
      label: "Render Final Clone Estilo 222 (110-Edit Kinetic)",
      p: path.join(rendersDir, "preview_estilo222.mp4"),
      onlyFor: "estilo222",
    },
    {
      id: "draft_qwen_raw",
      label: "Render Rascunho Puro Qwen2.5-VL (draft_qwen_raw.mp4)",
      p: path.join(sharinganDir, "local_qwen_draft", "draft_qwen_raw.mp4"),
    },
  ];

  for (const v of candidateVideos) {
    if (v.onlyFor && v.onlyFor !== presetId) continue;
    if (existsSync(v.p)) {
      videos.push({ id: v.id, label: v.label, path: v.p, url: toMediaUrl(v.p) });
    }
  }

  const activeVision = visionMerged ?? visionStep5 ?? visionDraft;
  const activeTokenReport = tokenReportMerged ?? tokenReportStep5 ?? tokenReportDraft;

  return {
    presetId,
    analysis,
    briefMd: briefMd ?? act1ReportMd,
    localVlmSpecMd: localVlmSpecMd ?? act1ReportMd,
    tokenSavingsReport: activeTokenReport,
    visionObservations: activeVision?.observations ?? [],
    visionMeta: activeVision
      ? {
          model: activeVision.model ?? "qwen2.5-vl:7b",
          stepFrames: activeVision.step_frames ?? 5,
          totalSampledFrames: activeVision.total_sampled_frames ?? 0,
        }
      : null,
    forensicObservations: forensicVision?.observations ?? [],
    forensicMeta: forensicVision
      ? {
          model: forensicVision.model ?? "qwen2.5-vl:7b",
          mode: forensicVision.mode ?? "step1_every_frame_1to1_720x720_strips",
          totalFrames: forensicVision.total_frames ?? 328,
        }
      : null,
    sheets,
    griddedFrames: griddedFrames720p.length > 0 ? griddedFrames720p : act1Frames,
    forensicStrips1to1,
    forensicFramesStep1,
    htmlStages,
    videos,
  };
}

async function checkOllama() {
  try {
    const res = await fetch(`${OLLAMA_URL.replace(/\/v1$/, "")}/api/tags`, {
      signal: AbortSignal.timeout(1500),
      cache: "no-store",
    });
    if (!res.ok) return { online: false, models: [] as string[] };
    const data = (await res.json()) as { models?: { name: string }[] };
    return {
      online: true,
      models: (data.models ?? []).map((m) => m.name),
    };
  } catch {
    return { online: false, models: [] as string[] };
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const presetId = searchParams.get("presetId") || "referenciamotion";

  const [sharinganScriptExists, localVlmScriptExists, ollama, gpuStatus, jobs, inspection] =
    await Promise.all([
      checkFile(path.join(REELS_TOOLS_DIR, "video-sharingan", "scripts", "sharingan.py")),
      checkFile(path.join(REELS_TOOLS_DIR, "video-sharingan", "scripts", "local_vlm.py")),
      checkOllama(),
      getPcGpuStatus().catch(() => null),
      prisma.job.findMany({
        where: { type: "SHARINGAN_CLONE" },
        orderBy: { createdAt: "desc" },
        take: 12,
      }),
      loadPresetInspection(presetId),
    ]);

  // Lê também clones salvos em storage/sharingan-clones
  const clonesDir = path.join(storageRoot(), "sharingan-clones");
  const savedDirs = await fs.readdir(clonesDir).catch(() => [] as string[]);
  const savedClones = [];
  for (const d of savedDirs.slice(0, 15)) {
    const sumPath = path.join(clonesDir, d, "summary.json");
    if (await checkFile(sumPath)) {
      try {
        savedClones.push(JSON.parse(await fs.readFile(sumPath, "utf8")));
      } catch {}
    }
  }

  return NextResponse.json({
    ok: true,
    localEngine: {
      sharinganScriptExists,
      localVlmScriptExists,
      ollamaOnline: ollama.online,
      ollamaModels: ollama.models,
      defaultModel: process.env.SHARINGAN_LOCAL_MODEL || "qwen2.5-vl:7b",
      gpu: gpuStatus?.gpu ?? {
        available: true,
        name: "NVIDIA GeForce RTX 3060",
        vramTotalMb: 12288,
        vramFreeMb: 8192,
      },
      engines: gpuStatus?.engines ?? {},
    },
    cloudEngine: {
      online: true,
      provider: process.env.TEXT_PROVIDER || "GEMINI",
      model: process.env.GEMINI_TEXT_MODEL || "gemini-3.6-flash",
    },
    presets: BUILTIN_STYLE_PRESETS,
    activeInspection: inspection,
    savedClones,
    jobs: jobs.map((j) => ({
      id: j.id,
      status: j.status,
      progress: j.progress,
      message: j.message,
      result: j.result ? JSON.parse(j.result) : null,
      createdAt: j.createdAt,
    })),
  });
}

const cloneSchema = z.object({
  action: z
    .enum(["clone", "analyze_local", "forensic_query", "compare_qc", "render_html"])
    .optional()
    .default("clone"),
  cloneName: z.string().trim().min(2).max(80).optional(),
  engineMode: z.enum(["LOCAL_GPU", "CLOUD", "AUTO"]).default("LOCAL_GPU"),
  vlmMode: z
    .enum(["pass1_keyframes", "pass2_step5", "pass3_adaptive_burst", "forensic_step1_1to1"])
    .optional()
    .default("pass3_adaptive_burst"),
  localVlmModel: z.string().optional().default("qwen2.5-vl:7b"),
  styleReferenceId: z.string().optional(),
  videoPath: z.string().max(500).optional(),
  candidatePath: z.string().max(500).optional(),
  htmlPath: z.string().max(500).optional(),
  imagePaths: z.array(z.string()).optional(),
  prompt: z.string().optional(),
  userTopic: z.string().trim().max(800).optional(),
  useLocalVlm: z.boolean().optional().default(true),
  durationS: z.number().optional(),
  fps: z.number().optional(),
  projectId: z.string().optional(),
});

export async function POST(req: Request) {
  const rawBody = await req.json().catch(() => null);
  const parsed = cloneSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Dados inválidos para operação do Video-Sharingan." },
      { status: 400 },
    );
  }

  const d = parsed.data;

  // Ação 1: Consulta Forense ao Vivo na GPU Local (Qwen2.5-VL-7B via Ollama)
  if (d.action === "forensic_query") {
    if (!d.imagePaths || d.imagePaths.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Selecione ao menos um frame ou tira 1:1 para consultar o Qwen2.5-VL." },
        { status: 400 },
      );
    }
    const res = await callPcGpuBridge("sharingan_forensic_query", {
      imagePaths: d.imagePaths,
      model: d.localVlmModel || "qwen2.5-vl:7b",
      prompt:
        d.prompt ||
        "Read the exact 10%x10% grid coordinates, typography hierarchy, hex colors, and motion deltas between these frames.",
    });
    return NextResponse.json(res, { status: res.ok ? 200 : 500 });
  }

  // Ação 2: Rodar os 12 Portões de Qualidade (QC Gates: sharingan.py compare) no PC
  if (d.action === "compare_qc") {
    const preset = BUILTIN_STYLE_PRESETS.find((p) => p.id === (d.styleReferenceId || "referenciamotion"));
    const referencePath = d.videoPath || preset?.refVideoPath;
    let candidatePath = d.candidatePath;
    if (!candidatePath) {
      if (d.styleReferenceId === "referenciamotion") {
        candidatePath = path.join(
          REELS_TOOLS_DIR,
          "projects",
          "style_lib",
          "referenciamotion",
          "sharingan",
          "pro_polished_clone",
          "pro_polished_clone.mp4",
        );
      } else if (d.styleReferenceId === "reels_imobiliario") {
        candidatePath = path.join(REELS_TOOLS_DIR, "renders", "preview_reels_imobiliario.mp4");
      } else if (d.styleReferenceId === "estilo222") {
        candidatePath = path.join(REELS_TOOLS_DIR, "renders", "preview_estilo222.mp4");
      }
    }

    if (!referencePath || !candidatePath) {
      return NextResponse.json(
        { ok: false, error: "Informe o vídeo de referência e o vídeo candidato para rodar os 12 QC Gates." },
        { status: 400 },
      );
    }

    const res = await callPcGpuBridge("sharingan_compare", {
      referencePath,
      candidatePath,
    });
    return NextResponse.json(res, { status: res.ok ? 200 : 500 });
  }

  // Ação 3: Renderizar Palco HTML5/GSAP -> MP4 + Side-by-Side via Playwright + FFmpeg no PC
  if (d.action === "render_html") {
    if (!d.htmlPath) {
      return NextResponse.json(
        { ok: false, error: "Informe o caminho do arquivo HTML/GSAP para renderizar." },
        { status: 400 },
      );
    }
    const preset = BUILTIN_STYLE_PRESETS.find((p) => p.id === (d.styleReferenceId || "referenciamotion"));
    const outMp4 = path.join(
      storageRoot(),
      "sharingan-clones",
      `render-${Date.now()}.mp4`,
    );
    const res = await callPcGpuBridge("sharingan_render_html", {
      htmlPath: d.htmlPath,
      outputPath: outMp4,
      referenceVideoPath: d.videoPath || preset?.refVideoPath,
      durationS: d.durationS ?? 10.9,
      fps: d.fps ?? 30,
    });
    return NextResponse.json(
      {
        ...res,
        videoUrl: typeof res.outputPath === "string" ? toMediaUrl(res.outputPath) : undefined,
        comparisonUrl: typeof res.comparisonPath === "string" ? toMediaUrl(res.comparisonPath) : undefined,
      },
      { status: res.ok ? 200 : 500 },
    );
  }

  // Ação padrão ("clone" ou "analyze_local"): dispara job SHARINGAN_CLONE
  if (!d.cloneName || !d.userTopic) {
    return NextResponse.json(
      { ok: false, error: "Preencha o nome do clone e o tema do novo vídeo." },
      { status: 400 },
    );
  }

  const job = await prisma.job.create({
    data: {
      type: "SHARINGAN_CLONE",
      projectId: d.projectId,
      payload: JSON.stringify(d),
    },
  });

  if (d.engineMode === "LOCAL_GPU") {
    await createRequest({
      pedido: `[Video-Sharingan Local GPU · ${d.vlmMode}] Clonar referência (${d.styleReferenceId || d.videoPath || "estilo custom"}) para o tema "${d.userTopic}" (clone: ${d.cloneName}, modelo: ${d.localVlmModel}).`,
      pagina: "/sharingan",
      projetoId: d.projectId,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, jobId: job.id });
}
