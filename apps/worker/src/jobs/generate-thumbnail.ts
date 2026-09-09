import path from "node:path";
import { writeFile } from "node:fs/promises";
import { prisma } from "@docupulse/db";
import { getVisualStyle } from "@docupulse/core";
import { FFMPEG, run } from "@docupulse/providers";
import { absPath, projectDir, relPath } from "@docupulse/providers";
import type { JobContext } from "../queue";

/** Cor de destaque por estilo visual — a linha de impacto (última linha) usa essa cor. */
const ACCENTS: Record<string, string> = {
  DARK_DOC: "0xFF8A3D",
  HISTORIC_REAL: "0xE8C27A",
  SPACE_SCI: "0x37E6FF",
  KIDS_3D: "0xFF6FA8",
  WATERCOLOR: "0xE0A97A",
  TRUE_CRIME: "0xFF3B3B",
};

/** Quebra o título em até 3 linhas curtas, no estilo "manchete" (poucas palavras por linha). */
function wrapLines(text: string, max: number): string[] {
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
  return lines.slice(0, 3);
}
const winFont = () => (process.platform === "win32" ? "C:/Windows/Fonts/segoeuib.ttf" : "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf");
const ffPath = (p: string) => p.replace(/\\/g, "/").replace(/:/g, "\\:");

/**
 * GENERATE_THUMBNAIL: monta uma thumbnail 1280x720 gratuita via ffmpeg — sem gerador de imagem
 * (isso fica pra quando entrarmos com Nano Banana Pro/GPT Image). Pega a melhor cena com mídia já
 * baixada, faz um cover-crop punchy (contraste/saturação bem acima do normal pra chamar atenção),
 * um degradê escuro no terço inferior pra legibilidade, e o título em "manchete": linhas em branco
 * com stroke grosso e a última linha bem maior na cor de destaque do estilo — no estilo dos canais
 * de documentário/mistério do YouTube (texto grande, 2 tons, contorno preto pesado).
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
  const fontFile = winFont();

  const lines = wrapLines(title.toUpperCase(), 18);
  const accentLine = lines[lines.length - 1] ?? title.toUpperCase();
  const whiteLines = lines.slice(0, -1);
  const longest = Math.max(accentLine.length, ...whiteLines.map((l) => l.length), 1);
  const accentSize = Math.max(52, Math.min(104, Math.floor(1750 / longest)));
  const whiteSize = Math.max(40, Math.round(accentSize * 0.66));

  const txtAccent = path.join(outDir, `thumb-${stamp}-accent.txt`);
  await writeFile(txtAccent, accentLine, "utf8");
  let whiteDraw = "";
  if (whiteLines.length) {
    const txtWhite = path.join(outDir, `thumb-${stamp}-white.txt`);
    await writeFile(txtWhite, whiteLines.join("\n"), "utf8");
    whiteDraw = `,drawtext=fontfile='${ffPath(fontFile)}':textfile='${ffPath(txtWhite)}':fontcolor=white:fontsize=${whiteSize}:line_spacing=6:borderw=7:bordercolor=black@0.95:x=(w-text_w)/2:y=h*0.60`;
  }
  const accentY = whiteLines.length ? "h-text_h-46" : "h*0.80";

  const filter =
    `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,` +
    `eq=contrast=1.2:saturation=1.4:brightness=0.01,` +
    `drawbox=x=0:y=ih*0.55:w=iw:h=ih*0.08:color=black@0.12:t=fill,` +
    `drawbox=x=0:y=ih*0.63:w=iw:h=ih*0.12:color=black@0.30:t=fill,` +
    `drawbox=x=0:y=ih*0.75:w=iw:h=ih*0.25:color=black@0.62:t=fill` +
    whiteDraw +
    `,drawtext=fontfile='${ffPath(fontFile)}':textfile='${ffPath(txtAccent)}':fontcolor=${accent}:fontsize=${accentSize}:borderw=9:bordercolor=black@1.0:x=(w-text_w)/2:y=${accentY}`;

  await run(FFMPEG, ["-y", "-hide_banner", "-loglevel", "error", "-loop", "1", "-i", stillSource, "-frames:v", "1", "-vf", filter, out]);

  await prisma.project.update({ where: { id: projectId }, data: { thumbnailPath: relPath(out), thumbnailUpdatedAt: new Date() } });
  await ctx.log(`Thumbnail gerada a partir de ${scene.mediaType === "video" ? "frame de vídeo" : "imagem"} (cena ${scene.id.slice(-6)}): ${path.basename(out)}`);
  return { thumbnailPath: relPath(out) };
}
