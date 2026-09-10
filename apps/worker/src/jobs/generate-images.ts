import path from "node:path";
import { writeFile } from "node:fs/promises";
import { prisma } from "@docupulse/db";
import {
  ProviderError,
  checkBudget,
  estimateImageCostUsd,
  generateImageGemini,
  generateImagePollinations,
  projectDir,
  recordImageUsage,
  relPath,
} from "@docupulse/providers";
import type { JobContext } from "../queue";

const MAX_COUNT = 8;

/**
 * GENERATE_IMAGES: geração livre por prompt, em lote, para o banco de imagem do projeto.
 *
 * Diferente do nó Prompt do Workflow Studio, que gera 1 imagem dentro de um grafo, aqui é
 * "descreva e gere N" — o formato de galeria. O orçamento é checado por imagem, antes de cada
 * chamada paga, então estourar o teto no meio do lote interrompe sem gastar o resto.
 *
 * payload: { projectId, prompt, engine?: "GEMINI"|"POLLINATIONS", aspect?, count?, negativePrompt? }
 */
export async function generateImages(ctx: JobContext) {
  const projectId = String(ctx.payload.projectId ?? ctx.job.projectId ?? "");
  const prompt = String(ctx.payload.prompt ?? "").trim();
  if (!prompt) throw new Error("Descreva o que você quer gerar.");

  const engine = ctx.payload.engine === "GEMINI" ? "GEMINI" : "POLLINATIONS";
  const aspect = String(ctx.payload.aspect ?? "16:9");
  const negativePrompt = ctx.payload.negativePrompt ? String(ctx.payload.negativePrompt) : undefined;
  const count = Math.max(1, Math.min(MAX_COUNT, Number(ctx.payload.count ?? 1)));

  await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const dir = await projectDir(projectId, "gallery");

  await ctx.log(`Gerando ${count} imagem(ns) · motor ${engine} · ${aspect}`);
  let made = 0;
  let spent = 0;

  for (let i = 0; i < count; i++) {
    if (await ctx.isCancelled()) return { cancelled: true, made };
    await ctx.progress({ percent: (i / count) * 95, message: `Imagem ${i + 1} de ${count}` });

    const input = { prompt, aspectRatio: aspect, negativePrompt };
    try {
      let result: Awaited<ReturnType<typeof generateImageGemini>>;
      let costUsd = 0;
      let model: string | null = null;

      if (engine === "POLLINATIONS") {
        result = await generateImagePollinations(input);
        model = "pollinations";
      } else {
        costUsd = estimateImageCostUsd();
        // Estoura o teto? Lança antes de chamar a API paga — não gasta nada.
        await checkBudget(costUsd);
        result = await generateImageGemini(input);
        await recordImageUsage(projectId, "GEMINI_IMAGE", costUsd);
        spent += costUsd;
        model = process.env.GEMINI_IMAGE_MODEL ?? null;
      }

      const ext = result.mimeType.includes("png") ? ".png" : ".jpg";
      const file = path.join(dir, `img-${Date.now()}-${i + 1}${ext}`);
      await writeFile(file, result.buffer);
      await prisma.generatedImage.create({
        data: { projectId, prompt, engine, model, aspect, filePath: relPath(file), costUsd },
      });
      made++;
    } catch (err) {
      const msg = err instanceof ProviderError ? err.message : String(err);
      await ctx.log(`Imagem ${i + 1}: falhou — ${msg.slice(0, 160)}`);
      // Orçamento estourado interrompe o lote: insistir nas seguintes só repetiria o mesmo erro.
      if (/orçamento|budget/i.test(msg)) {
        await ctx.log("Lote interrompido pelo teto de orçamento.");
        break;
      }
    }
  }

  await ctx.progress({ percent: 100, message: "Concluído" });
  await ctx.log(`${made}/${count} imagem(ns) geradas${spent > 0 ? ` · US$ ${spent.toFixed(4)}` : " · sem custo"}`);
  return { made, total: count, engine, costUsd: spent };
}
