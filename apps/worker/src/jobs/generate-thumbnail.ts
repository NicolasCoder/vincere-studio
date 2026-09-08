import path from "node:path";
import { writeFile } from "node:fs/promises";
import { prisma } from "@docupulse/db";
import { getVisualStyle } from "@docupulse/core";
import { FFMPEG, run } from "@docupulse/providers";
import { absPath, projectDir, relPath } from "@docupulse/providers";
import type { JobContext } from "../queue";

/** Cor de destaque por estilo visual — só um acento na composição, nada de gerar imagem. */
const ACCENTS: Record<string, string> = {
  DARK_DOC: "0xFF8A3D",
  HISTORIC_REAL: "0xE8C27A",
  SPACE_SCI: "0x37E6FF",
  KIDS_3D: "0xFF6FA8",
  WATERCOLOR: "0xE0A97A",
  TRUE_CRIME: "0xFF3B3B",
};

function wrapTitle(text: string, max: number) {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max && cur) {
      lines.push(cur);
      cur = w;
    } else cur = (cur + " " + w).trim();
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3).join("\n");
}
const winFont = () => (process.platform === "win32" ? "C:/Windows/Fonts/segoeuib.ttf" : "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf");
const ffPath = (p: string) => p.replace(/\\/g, "/").replace(/:/g, "\\:");

/**
 * GENERATE_THUMBNAIL: monta uma thumbnail 1280x720 gratuita via ffmpeg — sem gerador de imagem
 * (isso fica pra quando entrarmos com Nano Banana Pro/GPT Image). Pega a melhor cena com mídia já
 * baixada, faz um cover-crop, uma grade mais "punchy" (contraste/saturação) pra chamar atenção,
 * uma barra escura de legibilidade embaixo e o título em caixa alta com a cor do estilo visual.
 * payload: { projectId, sceneId?, title? }
 */
export async function generateThumbnail(ctx: JobContext) {
  const projectId = String(ctx.payload.projectId ?? ctx.job.projectId ?? "");
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error("Projeto não encontrado");
  const style = getVisualStyle(project.visualStyle);
  const accent = ACCENTS[style.id] ?? "0xFF8A3D";

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

  const W = 1280;
  const H = 720;
  const outDir = await projectDir(projectId, "thumbnails");
  const stamp = Date.now();
  const source = absPath(scene.filePath);

  // Cena base é vídeo: extrai um frame do meio antes de compor.
  let stillSource = source;
  if (scene.mediaType === "video") {
    stillSource = path.join(outDir, `frame-${stamp}.jpg`);
    await run(FFMPEG, ["-y", "-hide_banner", "-loglevel", "error", "-i", source, "-vf", "select=eq(n\\,30)", "-vframes", "1", "-update", "1", stillSource]);
    await ctx.log("Cena base é vídeo — extraindo um frame do meio para a thumbnail");
  }

  const out = path.join(outDir, `thumb-${stamp}.jpg`);
  const txt = path.join(outDir, `thumb-${stamp}.txt`);
  await writeFile(txt, wrapTitle(title.toUpperCase(), 22), "utf8");
  const fontFile = winFont();

  const filter =
    `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,` +
    `eq=contrast=1.12:saturation=1.25:brightness=0.01,` +
    `drawbox=x=0:y=ih*0.58:w=iw:h=ih*0.42:color=black@0.55:t=fill,` +
    `drawbox=x=iw*0.045:y=ih*0.79:w=iw*0.11:h=ih*0.045:color=${accent}@0.95:t=fill,` +
    `drawtext=fontfile='${ffPath(fontFile)}':textfile='${ffPath(txt)}':fontcolor=white:fontsize=56:line_spacing=8:borderw=6:bordercolor=black@0.9:x=(w-text_w)/2:y=h*0.79`;

  await run(FFMPEG, ["-y", "-hide_banner", "-loglevel", "error", "-loop", "1", "-i", stillSource, "-frames:v", "1", "-vf", filter, out]);

  await prisma.project.update({ where: { id: projectId }, data: { thumbnailPath: relPath(out), thumbnailUpdatedAt: new Date() } });
  await ctx.log(`Thumbnail gerada a partir de ${scene.mediaType === "video" ? "frame de vídeo" : "imagem"} (cena ${scene.id.slice(-6)}): ${path.basename(out)}`);
  return { thumbnailPath: relPath(out) };
}
