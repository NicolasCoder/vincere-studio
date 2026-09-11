import path from "node:path";
import { writeFile } from "node:fs/promises";
import { prisma } from "@docupulse/db";
import { FFMPEG, run } from "@docupulse/providers";
import { absPath, projectDir, relPath } from "@docupulse/providers";
import type { JobContext } from "../queue";

/**
 * Fonte de display: condensada e pesada. É ela que dá o peso do formato — uma sans normal em
 * negrito ocupa largura demais por letra e o título nunca chega ao tamanho que o estilo pede.
 * Impact vem instalada em todo Windows; fora dele cai numa bold comum e o resultado fica mais
 * largo, porém legível.
 */
const displayFont = () =>
  process.env.THUMB_FONT ||
  (process.platform === "win32" ? "C:/Windows/Fonts/impact.ttf" : "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf");
const ffPath = (p: string) => p.replace(/\\/g, "/").replace(/:/g, "\\:");

/**
 * Separa a manchete em título grande e subtítulo fino, como no padrão do formato.
 *
 * Com dois-pontos (ou travessão/barra) o corte é o do próprio título — é onde o autor já separou
 * gancho de explicação. Sem separador, as primeiras palavras que couberem viram o título e o resto
 * desce: "O DESASTRE NUCLEAR" / "QUE A URSS ESCONDEU POR 31 ANOS".
 */
function partirManchete(texto: string): { titulo: string; sub: string } {
  const t = texto.replace(/\s+/g, " ").trim();
  const partes = t.split(/\s*[:—–|]\s*/);
  if (partes.length > 1 && partes[0].length >= 6) {
    return { titulo: partes[0], sub: partes.slice(1).join(" ") };
  }
  const palavras = t.split(" ");
  let titulo = "";
  let i = 0;
  while (i < palavras.length && `${titulo} ${palavras[i]}`.trim().length <= 18) {
    titulo = `${titulo} ${palavras[i]}`.trim();
    i++;
  }
  if (!titulo) {
    titulo = palavras[0] ?? t;
    i = 1;
  }
  return { titulo, sub: palavras.slice(i).join(" ") };
}

/**
 * Espaça o subtítulo letra a letra. O drawtext não tem entrelinhamento, e a Impact é estreita
 * demais para o espaço simples aparecer — daí o espaço triplo entre palavras.
 */
const espacar = (s: string) =>
  s
    .toUpperCase()
    .split("")
    .map((c) => (c === " " ? "   " : c))
    .join(" ");

/**
 * GENERATE_THUMBNAIL: monta uma thumbnail 1280x720 gratuita via ffmpeg — sem gerador de imagem.
 *
 * Pega a melhor cena com mídia já baixada e a trata em vez de realçá-la: contraste firme,
 * saturação PARA BAIXO e brilho negativo, mais vinheta. A tentação é saturar para "chamar
 * atenção", mas na grade do YouTube todo mundo satura; foto escura com tipografia clara é o que
 * destaca, e é o que os canais do formato fazem.
 *
 * Em cima, manchete em duas alturas — título condensado enorme e subtítulo fino espaçado — com
 * halo no lugar de contorno preto.
 *
 * payload: { projectId, sceneId?, title? }
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
  const fontFile = ffPath(displayFont());

  const { titulo, sub } = partirManchete(title);
  const arqTitulo = path.join(outDir, `thumb-${stamp}-t.txt`);
  await writeFile(arqTitulo, titulo.toUpperCase(), "utf8");
  const tamTitulo = Math.max(70, Math.min(160, Math.floor(2350 / Math.max(1, titulo.length))));

  const t1 = `drawtext=fontfile='${fontFile}':textfile='${ffPath(arqTitulo)}':fontcolor=white:fontsize=${tamTitulo}:x=(w-text_w)/2:y=h*0.58`;
  let t2 = "";
  if (sub) {
    const arqSub = path.join(outDir, `thumb-${stamp}-s.txt`);
    await writeFile(arqSub, espacar(sub), "utf8");
    t2 = `,drawtext=fontfile='${fontFile}':textfile='${ffPath(arqSub)}':fontcolor=white@0.92:fontsize=30:x=(w-text_w)/2:y=h*0.82`;
  }
  const textos = `${t1}${t2}`;

  /**
   * O texto ganha halo em vez de contorno preto: o mesmo texto é desenhado numa camada preta,
   * borrado e somado em `screen`, e a versão nítida entra por cima. Contorno grosso lê como
   * legenda de televisão; o halo separa o texto do fundo sem desenhar uma moldura em volta dele.
   *
   * O `format=gbrp` antes do blend não é decoração. Em YUV o modo screen também opera nos planos
   * de croma, que são centrados em 128 — o resultado sai com um magenta que não existe na foto.
   */
  const filter =
    `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,` +
    `eq=contrast=1.26:saturation=0.72:brightness=-0.07,` +
    `vignette=PI/3.5,format=gbrp[bg];` +
    `color=c=black:s=${W}x${H},format=gbrp,${textos},gblur=sigma=24[glow];` +
    `[bg][glow]blend=all_mode=screen:all_opacity=0.8,format=yuv420p[lit];` +
    `[lit]${textos}[out]`;

  await run(FFMPEG, [
    "-y", "-hide_banner", "-loglevel", "error",
    "-loop", "1", "-i", stillSource,
    "-filter_complex", filter, "-map", "[out]",
    "-frames:v", "1", "-q:v", "2", out,
  ]);

  await prisma.project.update({ where: { id: projectId }, data: { thumbnailPath: relPath(out), thumbnailUpdatedAt: new Date() } });
  await ctx.log(`Thumbnail gerada a partir de ${scene.mediaType === "video" ? "frame de vídeo" : "imagem"} (cena ${scene.id.slice(-6)}): ${path.basename(out)}`);
  return { thumbnailPath: relPath(out) };
}
