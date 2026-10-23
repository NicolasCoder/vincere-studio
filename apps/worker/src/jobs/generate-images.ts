import path from "node:path";
import { writeFile } from "node:fs/promises";
import { prisma } from "@vincere-studio/db";
import { sceneFileStem } from "@vincere-studio/core";
import { ProviderError, gerarImagemComRedundancia, motorImagem, probeMediaInfo, projectDir, relPath } from "@vincere-studio/providers";
import type { JobContext } from "../queue";

const MAX_COUNT = 8;

const dorme = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ehLimite = (msg: string) => /\b429\b|rate.?limit|too many requests/i.test(msg);

/**
 * O Pollinations é grátis e limita por taxa: um lote de evidências disparado de uma vez pode ser
 * recusado com 429. Repete com espera crescente em vez de desistir — o limite é temporário.
 */
async function comRetentativa<T>(
  fn: () => Promise<T>,
  ctx: JobContext,
  rotulo: string,
  tentativas = 4,
): Promise<T> {
  let espera = 4000;
  for (let t = 1; ; t++) {
    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (t >= tentativas || !ehLimite(msg)) throw err;
      await ctx.log(`${rotulo}: limite de taxa, nova tentativa em ${espera / 1000}s (${t}/${tentativas - 1})`);
      await dorme(espera);
      espera *= 2;
    }
  }
}

/**
 * GENERATE_IMAGES: geração livre por prompt em lote para galeria, OU
 * preenchimento automático das cenas pendentes do roteiro com IA.
 *
 * payload: {
 *   projectId,
 *   prompt?: string,
 *   prompts?: string[],
 *   forPendingScenes?: boolean,
 *   engine?: "POLLINATIONS"|"CLOUDFLARE"|"HUGGINGFACE"|"TOGETHER"|"GEMINI"|"OPENAI"|"KIE",
 *   aspect?: string,
 *   count?: number,
 *   negativePrompt?: string
 * }
 */
export async function generateImages(ctx: JobContext) {
  const projectId = String(ctx.payload.projectId ?? ctx.job.projectId ?? "");
  const singlePrompt = String(ctx.payload.prompt ?? "").trim();
  const rawPrompts = Array.isArray(ctx.payload.prompts)
    ? ctx.payload.prompts.map((p) => String(p).trim()).filter(Boolean)
    : [];
  const forPendingScenes = Boolean(ctx.payload.forPendingScenes ?? (!singlePrompt && rawPrompts.length === 0));

  const motor = motorImagem(String(ctx.payload.engine ?? "POLLINATIONS"));
  const engine = motor.id;
  const aspect = String(ctx.payload.aspect ?? "16:9");
  const negativePrompt = ctx.payload.negativePrompt ? String(ctx.payload.negativePrompt) : undefined;

  await prisma.project.findUniqueOrThrow({ where: { id: projectId } });

  // Ramo 1: Preenchimento automático de imagens para cenas pendentes do roteiro
  if (forPendingScenes) {
    const script = await prisma.script.findFirst({
      where: { projectId },
      orderBy: { version: "desc" },
      include: {
        blocks: {
          orderBy: { order: "asc" },
          include: { scenes: { orderBy: { order: "asc" } } },
        },
      },
    });

    if (!script) throw new Error("Roteiro não encontrado para preencher cenas.");
    const pendingScenes = script.blocks.flatMap((b) =>
      b.scenes.filter((s) => !s.filePath).map((s) => ({ s, act: b.act })),
    );

    if (!pendingScenes.length) {
      await ctx.log("Nenhuma cena pendente de mídia.");
      return { made: 0, total: 0, engine, costUsd: 0 };
    }

    const scenesDir = await projectDir(projectId, "scenes");
    await ctx.log(`Preenchendo ${pendingScenes.length} cena(s) pendente(s) via IA · motor ${engine} · ${aspect}`);

    let made = 0;
    let spent = 0;

    for (let i = 0; i < pendingScenes.length; i++) {
      if (await ctx.isCancelled()) return { cancelled: true, made };
      const { s, act } = pendingScenes[i];
      await ctx.progress({
        percent: (i / pendingScenes.length) * 95,
        message: `Gerando imagem para cena a${String(act).padStart(2, "0")}-s${String(s.order).padStart(2, "0")}`,
      });

      if (i > 0 && engine === "POLLINATIONS") await dorme(2500);

      const promptToUse = s.prompt || s.description || "cinematic scene, documentary style";
      const input = { prompt: promptToUse, aspectRatio: aspect, negativePrompt };

      try {
        const result = await comRetentativa(
          () => gerarImagemComRedundancia(engine, input, { projectId, onAviso: (m) => ctx.log(m) }),
          ctx,
          `Cena ${act}-${s.order}`,
        );
        spent += result.custoUsd;
        const ext = result.mimeType.includes("png") ? ".png" : ".jpg";
        const filename = `${sceneFileStem(act, s.order)}${ext}`;
        const filePath = path.join(scenesDir, filename);

        await writeFile(filePath, result.buffer);
        const info = await probeMediaInfo(filePath).catch(() => ({ width: null, height: null }));

        await prisma.scene.update({
          where: { id: s.id },
          data: {
            filePath: relPath(filePath),
            mediaType: "image",
            source: "GENERATED",
            provider: result.motor,
            status: "READY",
            width: info.width,
            height: info.height,
            license: `Gerado por IA (${result.motor})`,
          },
        });

        made++;
      } catch (err) {
        const msg = err instanceof ProviderError ? err.message : String(err);
        await ctx.log(`Cena ${act}-${s.order}: falhou — ${msg.slice(0, 160)}`);
        if (/orçamento|budget/i.test(msg)) {
          await ctx.log("Preenchimento interrompido pelo teto de orçamento.");
          break;
        }
      }
    }

    await ctx.progress({ percent: 100, message: "Concluído" });
    await ctx.log(`${made}/${pendingScenes.length} cena(s) preenchida(s) com sucesso${spent > 0 ? ` · US$ ${spent.toFixed(4)}` : ""}`);
    return { made, total: pendingScenes.length, engine, costUsd: spent };
  }

  // Ramo 2: Geração de galeria a partir de prompt(s)
  const promptsList = rawPrompts.length > 0 ? rawPrompts : [singlePrompt];
  const countPerPrompt = Math.max(1, Math.min(MAX_COUNT, Number(ctx.payload.count ?? 1)));
  const totalRequests = promptsList.length * countPerPrompt;

  const dir = await projectDir(projectId, "gallery");
  await ctx.log(`Gerando ${totalRequests} imagem(ns) para galeria · motor ${engine} · ${aspect}`);
  let made = 0;
  let spent = 0;
  let idx = 0;

  for (const currentPrompt of promptsList) {
    for (let c = 0; c < countPerPrompt; c++) {
      if (await ctx.isCancelled()) return { cancelled: true, made };
      await ctx.progress({ percent: (idx / totalRequests) * 95, message: `Imagem ${idx + 1} de ${totalRequests}` });

      if (idx > 0 && engine === "POLLINATIONS") await dorme(2500);

      const input = { prompt: currentPrompt, aspectRatio: aspect, negativePrompt };
      try {
        const result = await comRetentativa(
          () => gerarImagemComRedundancia(engine, input, { projectId, onAviso: (m) => ctx.log(m) }),
          ctx,
          `Imagem ${idx + 1}`,
        );
        spent += result.custoUsd;
        const usado = motorImagem(result.motor);
        const model = usado.id === "GEMINI" ? (process.env.GEMINI_IMAGE_MODEL ?? null) : usado.medidor;

        const ext = result.mimeType.includes("png") ? ".png" : ".jpg";
        const file = path.join(dir, `img-${Date.now()}-${idx + 1}${ext}`);
        await writeFile(file, result.buffer);
        await prisma.generatedImage.create({
          data: { projectId, prompt: currentPrompt, engine: usado.id, model, aspect, filePath: relPath(file), costUsd: result.custoUsd },
        });
        made++;
      } catch (err) {
        const msg = err instanceof ProviderError ? err.message : String(err);
        await ctx.log(`Imagem ${idx + 1}: falhou — ${msg.slice(0, 160)}`);
        if (/orçamento|budget/i.test(msg)) {
          await ctx.log("Lote interrompido pelo teto de orçamento.");
          break;
        }
      }
      idx++;
    }
  }

  await ctx.progress({ percent: 100, message: "Concluído" });
  await ctx.log(`${made}/${totalRequests} imagem(ns) geradas${spent > 0 ? ` · US$ ${spent.toFixed(4)}` : " · sem custo"}`);
  return { made, total: totalRequests, engine, costUsd: spent };
}
