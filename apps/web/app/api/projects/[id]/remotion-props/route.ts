import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile, copyFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "@vincere-studio/db";
import { FORMATS, type EditPlanData, type VideoFormat } from "@vincere-studio/core";
import { absPath, probeDurationMs, run, FFPROBE } from "@vincere-studio/providers";
import { STUDIO_URL, editorIaDir, ensureRemotionStudio } from "@/lib/remotion-studio";

/**
 * POST /api/projects/[id]/remotion-props: leva o vídeo e o plano de edição REAIS deste projeto
 * pro Remotion Studio, na composição "Revisao".
 *
 * Antes, "Abrir Remotion Studio" abria o Studio como ele estava — última composição que alguém
 * tinha aberto, sem nenhuma ligação com o projeto que o usuário estava olhando na ferramenta.
 * Reportado pelo usuário: apertou o botão num projeto e abriu o vídeo de outro.
 *
 * Mesma lógica de resolução de evidência/mesa que apply-visual-layer.ts usa pra montar os props
 * do Remotion — duplicada aqui (não extraída) porque lá o alvo é um SEGMENTO recortado do master
 * pra render em lote, e aqui é o MASTER inteiro sem cortar, pra revisão ao vivo no Studio.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return NextResponse.json({ error: "Projeto não encontrado" }, { status: 404 });

  const plan = await prisma.editPlan.findFirst({ where: { projectId }, orderBy: { version: "desc" } });
  if (!plan) return NextResponse.json({ error: "Gere o plano de edição antes de abrir no Remotion." }, { status: 400 });
  const data = JSON.parse(plan.data) as EditPlanData;

  const render = await prisma.renderJob.findFirst({ where: { projectId, outputPath: { not: null } }, orderBy: { finishedAt: "desc" } });
  if (!render?.outputPath) return NextResponse.json({ error: "Renderize o vídeo (Passo 4) antes de abrir no Remotion." }, { status: 400 });

  const format = FORMATS[project.format as VideoFormat];
  const masterAbs = absPath(render.outputPath);

  const sonda = await run(FFPROBE, ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", masterAbs]).catch(() => "");
  const [mw, mh] = sonda.trim().split(",").map(Number);
  const width = Number.isFinite(mw) && mw > 0 ? mw : format.width;
  const height = Number.isFinite(mh) && mh > 0 ? mh : format.height;
  const durationMs = await probeDurationMs(masterAbs);

  const imagens = await prisma.generatedImage.findMany({ where: { projectId }, orderBy: { createdAt: "desc" } });
  const evidencePorPrompt = new Map(imagens.map((i) => [i.prompt.trim(), i.filePath]));

  // Pasta fixa "current", sempre sobrescrita: só existe UM projeto "aberto no Remotion" por vez.
  const pub = path.join(editorIaDir(), "public", "tmp", "current");
  await rm(pub, { recursive: true, force: true }).catch(() => {});
  await mkdir(pub, { recursive: true });
  await copyFile(masterAbs, path.join(pub, "master.mp4"));

  const insertions = await Promise.all(
    data.insertions.map(async (ins) => {
      let evidencePath: string | null = null;
      const rel = ins.evidencePrompt ? evidencePorPrompt.get(ins.evidencePrompt.trim()) : undefined;
      if (rel && existsSync(absPath(rel))) {
        const dest = path.join(pub, `evid-${ins.id}${path.extname(rel)}`);
        await copyFile(absPath(rel), dest);
        evidencePath = `tmp/current/${path.basename(dest)}`;
      }
      const fotos = ins.mesa
        ? (
            await Promise.all(
              ins.mesa.map(async (m, k) => {
                const relF = evidencePorPrompt.get(m.prompt.trim());
                if (!relF || !existsSync(absPath(relF))) return null;
                const dest = path.join(pub, `mesa-${ins.id}-${k}${path.extname(relF)}`);
                await copyFile(absPath(relF), dest);
                return { src: `tmp/current/${path.basename(dest)}`, legenda: m.legenda };
              }),
            )
          ).filter((x): x is { src: string; legenda: string } => x !== null)
        : null;

      return {
        id: ins.id,
        layout: ins.layout,
        lowerThirdStyle: ins.lowerThirdStyle ?? null,
        primary: ins.primary,
        secondary: ins.secondary ?? null,
        startMs: ins.startMs,
        endMs: ins.endMs,
        onLight: ins.backdrop === "light",
        evidencePath,
        eventos: ins.eventos ?? null,
        fotos,
      };
    }),
  );

  await writeFile(
    path.join(pub, "props.json"),
    JSON.stringify({
      master: "tmp/current/master.mp4",
      insertions,
      burnedCaptions: format.captions.required,
      durationInFrames: Math.max(1, Math.round((durationMs / 1000) * 30)),
      width,
      height,
      projectId,
      projectTitle: project.title,
    }),
  );

  await ensureRemotionStudio();
  return NextResponse.json({ url: `${STUDIO_URL}/Revisao` });
}
