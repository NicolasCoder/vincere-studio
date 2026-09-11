import path from "node:path";
import { prisma } from "@docupulse/db";
import { partirManchete, quadroDe, renderizarThumbnail } from "@docupulse/render";
import { absPath, projectDir, relPath } from "@docupulse/providers";
import type { JobContext } from "../queue";

/**
 * GENERATE_THUMBNAIL: monta uma thumbnail 1280x720 gratuita via ffmpeg — sem gerador de imagem.
 *
 * Pega a melhor cena com mídia já baixada e a trata em vez de realçá-la: contraste firme,
 * saturação PARA BAIXO e brilho negativo, mais vinheta. A tentação é saturar para "chamar
 * atenção", mas na grade do YouTube todo mundo satura; foto escura com tipografia clara é o que
 * destaca, e é o que os canais do formato fazem. Em cima, manchete em duas alturas.
 *
 * A composição em si vive em @docupulse/render — a tela de publicação usa a mesma para a prévia
 * ao vivo, e duas cópias divergiriam no primeiro ajuste.
 *
 * payload: { projectId, sceneId?, title?, escuridao?, halo? }
 */
export async function generateThumbnail(ctx: JobContext) {
  const projectId = String(ctx.payload.projectId ?? ctx.job.projectId ?? "");
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error("Projeto não encontrado");

  const idea = await prisma.idea.findFirst({ where: { projectId, selected: true } });
  const title = String(ctx.payload.title ?? idea?.title ?? project.title);

  const sceneId = ctx.payload.sceneId ? String(ctx.payload.sceneId) : undefined;
  let scene = sceneId ? await prisma.scene.findUnique({ where: { id: sceneId } }) : null;
  if (!scene) {
    const candidates = await prisma.scene.findMany({
      where: { block: { script: { projectId } }, filePath: { not: null } },
      include: { block: true },
      orderBy: { order: "asc" },
    });
    scene =
      candidates.find((s) => s.mediaType === "image" && ["HOOK", "CLIMAX", "REVEAL"].includes(s.block.kind)) ??
      candidates.find((s) => s.mediaType === "image") ??
      candidates[0] ??
      null;
  }
  if (!scene?.filePath) throw new Error("Nenhuma cena com mídia disponível ainda — gere o b-roll no Passo 3 antes de gerar a thumbnail.");

  const outDir = await projectDir(projectId, "thumbnails");
  const origem = await quadroDe(absPath(scene.filePath), outDir);
  if (origem !== absPath(scene.filePath)) await ctx.log("Cena base é vídeo — extraindo um quadro para a thumbnail");

  const { titulo, sub } = partirManchete(title);
  const out = path.join(outDir, `thumb-${Date.now()}.jpg`);
  await renderizarThumbnail(origem, out, {
    titulo,
    sub,
    escuridao: ctx.payload.escuridao != null ? Number(ctx.payload.escuridao) : undefined,
    halo: ctx.payload.halo != null ? Number(ctx.payload.halo) : undefined,
  });

  await prisma.project.update({ where: { id: projectId }, data: { thumbnailPath: relPath(out), thumbnailUpdatedAt: new Date() } });
  await ctx.log(`Thumbnail gerada (cena ${scene.id.slice(-6)}): ${path.basename(out)}`);
  return { thumbnailPath: relPath(out) };
}
