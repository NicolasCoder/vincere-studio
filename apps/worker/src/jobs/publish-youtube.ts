import { createReadStream, existsSync, statSync } from "node:fs";
import { Readable } from "node:stream";
import { prisma } from "@vincere-studio/db";
import { absPath, getAuthenticatedYoutubeClient } from "@vincere-studio/providers";
import { ACT_GAP_MS, buildSrt, type FaixaLegenda } from "@vincere-studio/render";
import { cleanupAfterPublish } from "./cleanup-after-publish";
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
 * Sobe a legenda como faixa de CC, a partir das palavras já alinhadas no Passo 3.
 *
 * No vídeo longo o master não queima legenda de propósito — o rodapé livre é onde a camada visual
 * põe os lower thirds. Sem esta faixa, o vídeo longo fica SEM legenda nenhuma: nem queimada, nem
 * enviada. Além da acessibilidade, é o texto que o YouTube indexa na busca e oferece traduzido.
 *
 * Falhar aqui não derruba a publicação: o vídeo já está no ar, e legenda se reenvia depois.
 */
async function enviarLegenda(
  projectId: string,
  youtube: Awaited<ReturnType<typeof getAuthenticatedYoutubeClient>>["youtube"],
  videoId: string,
  ctx: JobContext,
) {
  try {
    const script = await prisma.script.findFirst({
      where: { projectId },
      orderBy: { version: "desc" },
      include: { blocks: { orderBy: { order: "asc" }, include: { voiceTracks: { include: { captions: true } } } } },
    });
    if (!script) return;

    let offsetMs = 0;
    const faixas: FaixaLegenda[] = [];
    for (const b of script.blocks) {
      const track = b.voiceTracks[0];
      if (!track) continue;
      const words = JSON.parse(track.captions[0]?.words ?? "[]") as { text: string; startMs: number; endMs: number }[];
      if (words.length) faixas.push({ offsetMs, words });
      // O deslocamento acumula mesmo sem palavras: um ato sem legenda ainda ocupa tempo, e ignorá-lo
      // adiantaria tudo que vem depois.
      offsetMs += track.durationMs + ACT_GAP_MS;
    }
    if (!faixas.length) {
      await ctx.log("Sem palavras alinhadas — vídeo publicado sem faixa de legenda.");
      return;
    }

    const srt = buildSrt(faixas);
    await youtube.captions.insert({
      part: ["snippet"],
      requestBody: { snippet: { videoId, language: "pt-BR", name: "Português", isDraft: false } },
      media: { mimeType: "application/octet-stream", body: Readable.from([srt]) },
    });
    await ctx.log(`Legenda enviada: ${srt.split("\n\n").length} linhas em pt-BR.`);
  } catch (err) {
    await ctx.log(`Não consegui enviar a legenda (o vídeo já está no ar): ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * PUBLISH_YOUTUBE: sobe o último render concluído pro canal conectado (Settings →
 * Canal do YouTube), usando o título/descrição/tags já gerados em SEO & Metadados,
 * e define a thumbnail já gerada. Nasce no privacyStatus escolhido pelo usuário
 * (padrão: privado — nunca público sem revisão manual).
 * payload: { projectId, privacyStatus?: "private"|"unlisted"|"public", categoryId?: string, publishAt?: ISO-8601 }
 */
export async function publishYoutube(ctx: JobContext) {
  const projectId = String(ctx.payload.projectId ?? ctx.job.projectId ?? "");
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error("Projeto não encontrado");

  const pub = await prisma.publication.findFirst({ where: { projectId } });
  if (!pub) throw new Error('Sem metadados de SEO ainda — clique em "Gerar com IA" antes de publicar.');

  const requestedPrivacy = String(ctx.payload.privacyStatus ?? "private") as "private" | "unlisted" | "public";
  const publishAt = ctx.payload.publishAt ? new Date(String(ctx.payload.publishAt)) : null;
  if (publishAt && (Number.isNaN(publishAt.getTime()) || publishAt.getTime() <= Date.now())) {
    throw new Error("A data programada precisa estar no futuro.");
  }
  // A API do YouTube exige vídeo privado quando `publishAt` é definido; o próprio YouTube o
  // torna público no horário, sem depender de o worker continuar online.
  const privacyStatus: "private" | "unlisted" | "public" = publishAt ? "private" : requestedPrivacy;

  await ctx.log("Autenticando com a conta do YouTube conectada...");
  const { youtube, channelTitle } = await getAuthenticatedYoutubeClient();
  await ctx.log(`Canal: ${channelTitle}`);

  // Se o master já foi enviado como privado, agendar/publicar deve alterar ESSE vídeo. Fazer
  // outro upload criaria duplicatas no canal e desperdiçaria cota.
  if (pub.videoId) {
    await ctx.progress({ percent: 40, message: publishAt ? "Programando vídeo privado" : "Atualizando visibilidade" });
    await youtube.videos.update({
      part: ["status"],
      requestBody: {
        id: pub.videoId,
        status: {
          privacyStatus,
          ...(publishAt ? { publishAt: publishAt.toISOString() } : {}),
          selfDeclaredMadeForKids: false,
        },
      },
    });
    const url = pub.url || `https://www.youtube.com/watch?v=${pub.videoId}`;
    await prisma.publication.update({
      where: { id: pub.id },
      data: {
        url,
        privacyStatus,
        scheduledAt: publishAt,
        publishedAt: publishAt || privacyStatus === "private" ? null : new Date(),
      },
    });
    await ctx.log(publishAt
      ? `Vídeo privado programado para ${publishAt.toLocaleString("pt-BR")}: ${url}`
      : `Visibilidade atualizada para ${privacyStatus}: ${url}`);
    return { videoId: pub.videoId, url, privacyStatus, scheduledAt: publishAt?.toISOString() ?? null, reusedExisting: true };
  }

  const render = await prisma.renderJob.findFirst({ where: { projectId, outputPath: { not: null } }, orderBy: { startedAt: "desc" } });
  if (!render?.outputPath) throw new Error("Nenhum render concluído ainda — renderize o vídeo no Passo 4 antes de publicar.");
  if (render.reviewStatus !== "APPROVED") throw new Error("A versão mais recente precisa ser aprovada no Passo 4 antes da publicação.");

  // O que sobe é a versão com camada visual, quando ela existe e é mais nova que o master.
  // O master é só o insumo dela; publicar o master depois de aplicar a camada jogaria fora
  // o trabalho todo da edição, e em silêncio — o arquivo abre normal, só está sem as inserções.
  // Se o projeto foi renderizado DE NOVO depois da camada, aí o master é que está em dia.
  const arquivo = await escolherArquivo(projectId, render.outputPath, render.finishedAt ?? render.startedAt, ctx);

  const tags = (() => {
    try {
      return JSON.parse(pub.tags || "[]") as string[];
    } catch {
      return [];
    }
  })();
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
        status: { privacyStatus, ...(publishAt ? { publishAt: publishAt.toISOString() } : {}), selfDeclaredMadeForKids: false },
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

  await enviarLegenda(projectId, youtube, videoId, ctx);

  if (project.thumbnailPath) {
    try {
      await youtube.thumbnails.set({ videoId, media: { mimeType: "image/jpeg", body: createReadStream(absPath(project.thumbnailPath)) } });
      await ctx.log("Thumbnail personalizada aplicada.");
    } catch (err) {
      await ctx.log(`Não foi possível aplicar a thumbnail (o vídeo já está no ar mesmo assim): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  await prisma.publication.update({
    where: { id: pub.id },
    data: {
      platform: "YOUTUBE",
      videoId,
      url,
      privacyStatus,
      scheduledAt: publishAt,
      publishedAt: publishAt || privacyStatus === "private" ? null : new Date(),
    },
  });
  if (publishAt) await ctx.log(`Postagem programada no YouTube para ${publishAt.toLocaleString("pt-BR")}: ${url}`);
  else await ctx.log(`Publicado com sucesso (${privacyStatus}): ${url}`);

  // Só libera espaço quando é publicação de verdade (public/unlisted) — "private" costuma ser
  // revisão antes de publicar, e apagar o material ali impediria rerenderizar ou reaplicar a
  // camada visual antes da publicação real.
  if (!publishAt && privacyStatus !== "private") {
    await cleanupAfterPublish(projectId, videoPath, (line) => ctx.log(line));
  }

  return { videoId, url, privacyStatus, scheduledAt: publishAt?.toISOString() ?? null };
}
