import path from "node:path";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import type { JobContext } from "../queue";
import { storageRoot } from "@vincere-studio/providers";
import {
  analyzeLockup,
  buildCleanTimelineFromWords,
  compileColorGradeRecipe,
  reviewCleanTranscript,
  type TimedWord,
} from "@vincere-studio/core";

const REELS_TOOLS_DIR = process.env.REELS_TOOLS_DIR || "F:\\Python Projects\\reels_tools";

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function runPythonScript(scriptPath: string, args: string[], cwd: string, onLine?: (line: string) => void): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = spawn("python", [scriptPath, ...args], { cwd, env: { ...process.env, PYTHONIOENCODING: "utf-8" } });
    proc.stdout.on("data", (d) => onLine?.(String(d).trim()));
    proc.stderr.on("data", (d) => onLine?.(String(d).trim()));
    proc.on("error", reject);
    proc.on("close", (code) => resolve(code ?? 0));
  });
}

/**
 * Job `TALKING_HEAD_PIPELINE`:
 * Executa o pipeline do `reels_tools` em modo Híbrido (Duas Vias):
 * - Via Local (GPU/Python): Se `reels_tools` estiver presente e o modo for `LOCAL_GPU` ou `AUTO`,
 *   pode invocar os scripts determinísticos (`01_ingest.py`..`10_compile_hyperframes.py`) para um projeto real.
 * - Via Nuvem / Leve (Node.js): Executa instantaneamente a limpeza cirúrgica ("Regra do Vão Livre"),
 *   mascaramento de cortes por escala (>=6%), aninhamento tipográfico Lockup, revisão editorial e
 *   geração da receita de Color Grading 256-pontos SVG/LUT.
 */
export async function talkingHeadPipeline(ctx: JobContext) {
  const mode = String(ctx.payload.computeMode ?? "AUTO") as "LOCAL_GPU" | "CLOUD_FAST" | "AUTO";
  const projectName = String(ctx.payload.projectName ?? `th-${Date.now()}`);
  const lookId = String(ctx.payload.lookId ?? "apple_sungazing");
  const rawTranscript = String(ctx.payload.transcript ?? "");
  const lockupMain = String(ctx.payload.lockupMain ?? "limpeza");
  const lockupAbove = String(ctx.payload.lockupAbove ?? "pra fazer");
  const lockupBelow = String(ctx.payload.lockupBelow ?? "das lavouras");
  const videoPath = ctx.payload.videoPath ? String(ctx.payload.videoPath) : null;

  await ctx.log(`Iniciando pipeline Talking Head (${projectName}) · Modo: ${mode} · Look: ${lookId}`);
  await ctx.progress({ percent: 10, message: "Analisando ambiente de execução (Duas Vias)..." });

  const localAvailable = await fileExists(path.join(REELS_TOOLS_DIR, "04_build_clean_timeline.py"));
  const effectiveRoute = mode === "CLOUD_FAST" ? "CLOUD_FAST" : mode === "LOCAL_GPU" && localAvailable ? "LOCAL_GPU" : localAvailable && videoPath ? "LOCAL_GPU" : "CLOUD_FAST";

  await ctx.log(`Rota selecionada: ${effectiveRoute} (reels_tools local disponível: ${localAvailable ? "SIM" : "NÃO"})`);

  // 1. Construir ou extrair palavras temporizadas
  let words: TimedWord[] = [];
  if (Array.isArray(ctx.payload.words) && ctx.payload.words.length > 0) {
    words = ctx.payload.words as TimedWord[];
  } else {
    const tokens = (rawTranscript.trim() || "O segredo para escalar vídeos [respiração] é nunca deixar um corte seco sem mascarar a escala na batida.").split(/\s+/);
    let cursor = 0.2;
    words = tokens.map((word, idx) => {
      const isPause = word.startsWith("[");
      const dur = isPause ? 0.55 : Math.max(0.18, Math.min(0.55, word.length * 0.045));
      const tStart = Number(cursor.toFixed(3));
      const tEnd = Number((cursor + dur).toFixed(3));
      // Insere um vão de silêncio a cada 7 palavras para demonstrar a Regra do Vão Livre
      cursor = tEnd + (idx % 7 === 6 ? 0.48 : 0.04);
      return { gid: idx, word, tStart, tEnd };
    });
  }

  await ctx.progress({ percent: 35, message: "Aplicando Regra do Vão Livre e Mascaramento de Cortes..." });
  const cleanTimeline = buildCleanTimelineFromWords(words, {
    minSilenceGapS: Number(ctx.payload.minSilenceGapS ?? 0.35),
    fadeMs: 28,
  });

  await ctx.progress({ percent: 55, message: "Revisando transcrição (7 categorias editoriais)..." });
  const scriptReview = reviewCleanTranscript(words);

  await ctx.progress({ percent: 75, message: "Calculando geometria de Lockup e Color Grading 3D LUT..." });
  const lockup = analyzeLockup(lockupMain, lockupAbove, lockupBelow);
  const colorGrade = compileColorGradeRecipe(lookId);

  // Se houver vídeo local e rota LOCAL_GPU, podemos opcionalmente disparar o ingest/alinhamento Python
  let pythonLogs: string[] = [];
  if (effectiveRoute === "LOCAL_GPU" && videoPath && (await fileExists(videoPath))) {
    await ctx.log(`Executando 01_ingest.py no motor local para ${videoPath}...`);
    await runPythonScript(
      path.join(REELS_TOOLS_DIR, "01_ingest.py"),
      [videoPath, "--name", projectName],
      REELS_TOOLS_DIR,
      (l) => pythonLogs.push(l),
    ).catch((e) => pythonLogs.push(`Aviso Python: ${(e as Error).message}`));
  }

  const outDir = path.join(storageRoot(), "talking-head", projectName);
  await fs.mkdir(outDir, { recursive: true });
  const resultPayload = {
    projectName,
    effectiveRoute,
    localAvailable,
    cleanTimeline,
    scriptReview,
    lockup,
    colorGrade,
    pythonLogs: pythonLogs.slice(-20),
    createdAt: new Date().toISOString(),
  };

  await fs.writeFile(path.join(outDir, "pipeline-result.json"), JSON.stringify(resultPayload, null, 2), "utf8");
  await ctx.progress({ percent: 100, message: "Pipeline Talking Head concluído!" });
  await ctx.log(`Resultado salvo em storage/talking-head/${projectName}/pipeline-result.json`);

  return resultPayload;
}
