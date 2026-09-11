import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile, copyFile } from "node:fs/promises";
import { prisma } from "@docupulse/db";
import { FORMATS, planSegments, passthroughRanges, type EditPlanData, type VideoFormat } from "@docupulse/core";
import { profileFor } from "@docupulse/render";
import { FFMPEG, FFPROBE, absPath, probeDurationMs, projectDir, relPath, run, storageRoot } from "@docupulse/providers";
import type { JobContext } from "../queue";

/** Raiz do projeto Remotion. storage/ e editor-ia/ são irmãos na raiz do repo. */
const editorDir = () => process.env.EDITOR_IA_DIR || path.resolve(storageRoot(), "..", "editor-ia");

/**
 * Entry real da CLI do Remotion, chamada pelo próprio node.
 *
 * Nada de `npx` nem do bin em node_modules/.bin: no Windows aqueles são .cmd, e o spawn sem
 * shell falha com EINVAL nas versões recentes do Node. Apontar para o .js é estável nos dois SOs.
 */
const remotionCli = () => path.join(editorDir(), "node_modules", "@remotion", "cli", "remotion-cli.js");

/**
 * APPLY_VISUAL_LAYER: aplica a camada visual DVP sobre o master já renderizado.
 *
 * Não renderiza o vídeo inteiro pelo Remotion. Num vídeo de 11 min com 25 inserções só ~19% dos
 * frames têm camada; o Remotion custa ~11x o tempo real nesta máquina, contra ~1,4x do ffmpeg.
 * Então: os trechos com inserção passam pelo Remotion, o resto é só reencodado, e tudo é
 * costurado no fim. Medido: ~27 min contra ~2h05 do caminho ingênuo.
 *
 * payload: { projectId }
 */
export async function applyVisualLayer(ctx: JobContext) {
  const projectId = String(ctx.payload.projectId ?? ctx.job.projectId ?? "");
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const format = FORMATS[project.format as VideoFormat];
  const profile = profileFor(project.format, null);

  const plan = await prisma.editPlan.findFirst({ where: { projectId }, orderBy: { version: "desc" } });
  if (!plan) throw new Error("Sem plano de edição. Gere o plano antes de aplicar a camada visual.");
  const data = JSON.parse(plan.data) as EditPlanData;
  if (!data.insertions.length) throw new Error("O plano não tem nenhuma inserção.");

  const render = await prisma.renderJob.findFirst({
    where: { projectId, outputPath: { not: null } },
    orderBy: { finishedAt: "desc" },
  });
  if (!render?.outputPath) throw new Error("Sem render concluído para aplicar a camada.");
  const master = absPath(render.outputPath);

  const segments = planSegments(data.insertions, data.totalMs);
  const gaps = passthroughRanges(segments, data.totalMs);
  const segSec = segments.reduce((t, s) => t + (s.endMs - s.startMs), 0) / 1000;
  await ctx.log(
    `Plano v${plan.version}: ${data.insertions.length} inserções em ${segments.length} segmento(s) · ` +
      `${Math.round(segSec)}s pelo Remotion (${Math.round((segSec / (data.totalMs / 1000)) * 100)}% do vídeo), o resto só reencodado`,
  );

  // Evidências já geradas: o job de imagens usou o evidencePrompt como prompt, então casa por texto.
  const imagens = await prisma.generatedImage.findMany({ where: { projectId }, orderBy: { createdAt: "desc" } });
  const evidencePorPrompt = new Map(imagens.map((i) => [i.prompt.trim(), i.filePath]));

  const work = path.join(await projectDir(projectId, "visual"), `job-${ctx.job.id}`);
  // public/ do Remotion é a única raiz que o staticFile enxerga.
  const pub = path.join(editorDir(), "public", "tmp", ctx.job.id);
  await mkdir(work, { recursive: true });
  await mkdir(pub, { recursive: true });

  const partes: { ordem: number; file: string }[] = [];
  const encArgs = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-r", String(profile.fps), "-c:a", "aac", "-b:a", profile.audioBitrate];

  try {
    // 1) Trechos sem inserção: só recorte e reencode, sem passar pelo Remotion.
    for (let i = 0; i < gaps.length; i++) {
      if (await ctx.isCancelled()) return { cancelled: true };
      const g = gaps[i];
      await ctx.progress({ percent: (i / (gaps.length + segments.length)) * 90, message: `Trecho ${i + 1}/${gaps.length} sem camada` });
      const out = path.join(work, `gap-${String(i).padStart(3, "0")}.mp4`);
      await run(FFMPEG, [
        "-y", "-hide_banner", "-loglevel", "error",
        "-ss", (g.startMs / 1000).toFixed(3),
        "-i", master,
        "-t", ((g.endMs - g.startMs) / 1000).toFixed(3),
        ...encArgs, out,
      ]);
      partes.push({ ordem: g.startMs, file: out });
    }

    // 2) Trechos com inserção: recorta, joga no public do Remotion e renderiza a camada.
    for (let i = 0; i < segments.length; i++) {
      if (await ctx.isCancelled()) return { cancelled: true };
      const s = segments[i];
      const durMs = s.endMs - s.startMs;
      await ctx.progress({
        percent: ((gaps.length + i) / (gaps.length + segments.length)) * 90,
        message: `Segmento ${i + 1}/${segments.length} com camada visual`,
      });

      const slice = path.join(pub, `seg-${i}.mp4`);
      await run(FFMPEG, [
        "-y", "-hide_banner", "-loglevel", "error",
        "-ss", (s.startMs / 1000).toFixed(3),
        "-i", master,
        "-t", (durMs / 1000).toFixed(3),
        ...encArgs, slice,
      ]);

      // Evidências deste segmento entram no public/ para o staticFile alcançar.
      const insertions = [];
      for (const ins of s.insertions) {
        let evidencePath: string | null = null;
        const rel = ins.evidencePrompt ? evidencePorPrompt.get(ins.evidencePrompt.trim()) : undefined;
        if (rel && existsSync(absPath(rel))) {
          const dest = path.join(pub, `evid-${ins.id}${path.extname(rel)}`);
          await copyFile(absPath(rel), dest);
          evidencePath = `tmp/${ctx.job.id}/${path.basename(dest)}`;
        }
        insertions.push({
          id: ins.id,
          layout: ins.layout,
          lowerThirdStyle: ins.lowerThirdStyle ?? null,
          primary: ins.primary,
          secondary: ins.secondary ?? null,
          startMs: ins.startMs,
          endMs: ins.endMs,
          onLight: ins.backdrop === "light",
          evidencePath,
        });
      }

      const props = {
        master: `tmp/${ctx.job.id}/seg-${i}.mp4`,
        insertions,
        burnedCaptions: format.captions.required,
        durationInFrames: Math.round((durMs / 1000) * profile.fps),
        // Resolução do perfil, não a da composição. Sem isto o Remotion devolve 1920×1080 fixo e
        // um projeto vertical sai deitado — o concat então mistura resoluções e a duração final
        // vira qualquer coisa.
        width: profile.width,
        height: profile.height,
      };
      const propsFile = path.join(work, `props-${i}.json`);
      await writeFile(propsFile, JSON.stringify(props), "utf8");

      const bruto = path.join(work, `seg-${String(i).padStart(3, "0")}-bruto.mp4`);
      await run(process.execPath, [
        remotionCli(), "render", "Segmento", bruto,
        `--props=${propsFile}`,
        "--codec", "h264",
        // Uma qualidade acima do alvo: este arquivo ainda passa pela normalização abaixo, e
        // codificar duas vezes no mesmo CRF acumularia perda à toa.
        "--crf", "15",
        "--log", "error",
      ], { cwd: editorDir() });

      // Normaliza para os mesmos parâmetros dos trechos sem camada. Sem isto o concat por cópia
      // sai quebrado: o Remotion entrega time_base 1/90000 e pix_fmt yuvj420p (faixa de cor
      // cheia), contra 1/15360 e yuv420p do ffmpeg. A diferença de base de tempo embaralha os
      // timestamps — na primeira execução o vídeo saiu com 64 min em vez de 11 — e a de faixa de
      // cor daria salto de brilho nas emendas.
      const out = path.join(work, `seg-${String(i).padStart(3, "0")}.mp4`);
      await run(FFMPEG, ["-y", "-hide_banner", "-loglevel", "error", "-i", bruto, ...encArgs, out]);
      partes.push({ ordem: s.startMs, file: out });
    }

    // 3) Costura na ordem do tempo. Todas as partes saíram com os mesmos parâmetros, então
    //    o concat pode copiar sem reencodar de novo.
    await ctx.progress({ percent: 92, message: "Costurando o vídeo final" });
    partes.sort((a, b) => a.ordem - b.ordem);

    // Concat por cópia exige resolução idêntica em todas as partes. Quando não é, o arquivo sai
    // gerado e abre normalmente — só a duração denuncia, muito depois. Conferir aqui transforma
    // corrupção silenciosa em erro com nome: foi assim que a composição travada em 1920×1080
    // quebrou o primeiro Short que passou pela camada.
    const resolucoes = new Map<string, string[]>();
    for (const p of partes) {
      const bruto = await run(FFPROBE, ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", p.file]);
      // Extrai os dois primeiros números em vez de comparar o texto cru: o ffprobe às vezes
      // devolve um campo vazio a mais ("1080,1920,") e uma comparação de string reprovava partes
      // que tinham exatamente a mesma resolução.
      const nums = bruto.match(/\d+/g) ?? [];
      const r = nums.length >= 2 ? `${nums[0]}x${nums[1]}` : "desconhecida";
      if (!resolucoes.has(r)) resolucoes.set(r, []);
      resolucoes.get(r)!.push(path.basename(p.file));
    }
    if (resolucoes.size > 1) {
      const detalhe = [...resolucoes.entries()].map(([r, fs]) => `${r}: ${fs.length} parte(s) (${fs[0]}…)`).join(" · ");
      throw new Error(`Partes com resoluções diferentes, o concat sairia quebrado — ${detalhe}`);
    }
    const lista = path.join(work, "concat.txt");
    await writeFile(lista, partes.map((p) => `file '${p.file.replace(/\\/g, "/")}'`).join("\n"), "utf8");

    const outDir = await projectDir(projectId, "visual");
    const final = path.join(outDir, `dvp-${Date.now()}.mp4`);
    await run(FFMPEG, ["-y", "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lista, "-c", "copy", "-movflags", "+faststart", final]);

    // Confere a duração contra o master antes de dar por concluído. A costura por cópia falha em
    // silêncio quando as partes divergem em base de tempo: o arquivo é gerado, abre normalmente, e
    // só a duração denuncia. Melhor o job falhar aqui do que entregar um vídeo quebrado.
    const finalMs = await probeDurationMs(final);
    const desvioMs = Math.abs(finalMs - data.totalMs);
    if (desvioMs > 2000) {
      throw new Error(
        `Costura inconsistente: saída com ${(finalMs / 1000).toFixed(1)}s contra ${(data.totalMs / 1000).toFixed(1)}s do master ` +
          `(desvio de ${(desvioMs / 1000).toFixed(1)}s). Provável divergência de parâmetros entre as partes.`,
      );
    }
    await ctx.log(`Duração conferida: ${(finalMs / 1000).toFixed(1)}s (master ${(data.totalMs / 1000).toFixed(1)}s)`);

    await ctx.progress({ percent: 100, message: "Concluído" });
    await ctx.log(`Camada visual aplicada: ${relPath(final)}`);
    return { output: relPath(final), segments: segments.length, gaps: gaps.length };
  } finally {
    // O public/tmp fica dentro do projeto Remotion e sujaria o bundle das próximas execuções.
    await rm(pub, { recursive: true, force: true }).catch(() => {});
  }
}
