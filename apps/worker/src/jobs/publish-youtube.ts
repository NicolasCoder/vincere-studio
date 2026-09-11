import { createReadStream, existsSync, statSync } from "node:fs";
import { prisma } from "@docupulse/db";
import { absPath, getAuthenticatedYoutubeClient } from "@docupulse/providers";
import type { JobContext } from "../queue";

/**
 * Decide qual arquivo vai pro ar: o master do Passo 4 ou a saída do APPLY_VISUAL_LAYER.
 *
 * Sempre diz no log qual escolheu e por quê — a diferença entre os dois é invisível no nome do
 * arquivo e só aparece assistindo, que é tarde demais quando o vídeo já está no canal.
 */
async function escolherArquivo(
  projectId: string,
  masterPath: string,
  masterEm: Date | null,
  ctx: JobContext,
): Promise<string> {
  const camada = await prisma.job.findFirst({
    where: { projectId, type: "APPLY_VISUAL_LAYER", status: "DONE" },
    orderBy: { finishedAt: "desc" },
  });
  if (!camada?.result) return masterPath;

  let saida: string | undefined;
  try {
    saida = (JSON.parse(camada.result) as { output?: string }).output;
  } catch {
    return masterPath;
  }
  if (!saida || !existsSync(absPath(saida))) return masterPath;

  if (masterEm && camada.finishedAt && camada.finishedAt < masterEm) {
    await ctx.log("Há camada visual, mas o master foi renderizado depois dela — subindo o master. Rode a camada de novo se quiser as inserções.");
    return masterPath;
  }

  await ctx.log("Subindo a versão com camada visual (não o master).");
  return saida;
}

/**
 * PUBLISH_YOUTUBE: sobe o último render concluído pro canal conectado (Settings →
 * Canal do YouTube), usando o título/descrição/tags já gerados em SEO & Metadados,
 * e define a thumbnail já gerada. Nasce no privacyStatus escolhido pelo usuário
 * (padrão: privado — nunca público sem revisão manual).
 * payload: { projectId, privacyStatus?: "private"|"unlisted"|"public", categoryId?: string }
 */
export async function publishYoutube(ctx: JobContext) {
  const projectId = String(ctx.payload.projectId ?? ctx.job.projectId ?? "");
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error("Projeto não encontrado");

  const pub = await prisma.publication.findFirst({ where: { projectId } });
  if (!pub) throw new Error('Sem metadados de SEO ainda — clique em "Gerar com IA" antes de publicar.');

  const render = await prisma.renderJob.findFirst({ where: { projectId, outputPath: { not: null } }, orderBy: { startedAt: "desc" } });
  if (!render?.outputPath) throw new Error("Nenhum render concluído ainda — renderize o vídeo no Passo 4 antes de publicar.");

  // O que sobe é a versão com camada visual, quando ela existe e é mais nova que o master.
  // O master é só o insumo dela; publicar o master depois de aplicar a camada jogaria fora
  // o trabalho todo da edição, e em silêncio — o arquivo abre normal, só está sem as inserções.
  // Se o projeto foi renderizado DE NOVO depois da camada, aí o master é que está em dia.
  const arquivo = await escolherArquivo(projectId, render.outputPath, render.finishedAt ?? render.startedAt, ctx);

  await ctx.log("Autenticando com a conta do YouTube conectada...");
  const { youtube, channelTitle } = await getAuthenticatedYoutubeClient();
  await ctx.log(`Canal: ${channelTitle}`);

  const tags = (() => {
    try {
      return JSON.parse(pub.tags || "[]") as string[];
    } catch {
      return [];
    }
  })();
  const privacyStatus = String(ctx.payload.privacyStatus ?? "private") as "private" | "unlisted" | "public";
  const categoryId = String(ctx.payload.categoryId ?? "27"); // 27 = Education (documentário)

  const videoPath = absPath(arquivo);
  const fileSize = statSync(videoPath).size;

  await ctx.log(`Enviando "${pub.title}" (${(fileSize / 1024 / 1024).toFixed(1)} MB, privacidade: ${privacyStatus})...`);
  await ctx.progress({ percent: 5, message: "Iniciando upload" });

  const insertRes = await youtube.videos.insert(
    {
      part: ["snippet", "status"],
      requestBody: {
        snippet: { title: pub.title.slice(0, 100), description: pub.description, tags: tags.slice(0, 30), categoryId },
        status: { privacyStatus, selfDeclaredMadeForKids: false },
      },
      media: { mimeType: "video/mp4", body: createReadStream(videoPath) },
    },
    {
      onUploadProgress: (evt: { bytesRead: number }) => {
        const percent = Math.min(90, Math.round((evt.bytesRead / fileSize) * 90));
        void ctx.progress({ percent, message: `Enviando... ${(evt.bytesRead / 1024 / 1024).toFixed(1)} / ${(fileSize / 1024 / 1024).toFixed(1)} MB` });
      },
    },
  );

  const videoId = insertRes.data.id;
  if (!videoId) throw new Error("YouTube não retornou um videoId — verifique a resposta da API.");
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  await ctx.log(`Upload concluído: ${url}`);
  await ctx.progress({ percent: 92, message: "Definindo thumbnail" });

  if (project.thumbnailPath) {
    try {
      await youtube.thumbnails.set({ videoId, media: { mimeType: "image/jpeg", body: createReadStream(absPath(project.thumbnailPath)) } });
      await ctx.log("Thumbnail personalizada aplicada.");
    } catch (err) {
      await ctx.log(`Não foi possível aplicar a thumbnail (o vídeo já está no ar mesmo assim): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  await prisma.publication.update({ where: { id: pub.id }, data: { platform: "YOUTUBE", videoId, url, publishedAt: new Date() } });
  await ctx.log(`Publicado com sucesso (${privacyStatus}): ${url}`);
  return { videoId, url, privacyStatus };
}
