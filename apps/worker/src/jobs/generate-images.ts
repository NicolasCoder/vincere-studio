import path from "node:path";
import { writeFile } from "node:fs/promises";
import { prisma } from "@docupulse/db";
import { ProviderError, gerarImagemComRedundancia, motorImagem, projectDir, relPath } from "@docupulse/providers";
import type { JobContext } from "../queue";

const MAX_COUNT = 8;

const dorme = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ehLimite = (msg: string) => /\b429\b|rate.?limit|too many requests/i.test(msg);

/**
 * O Pollinations é grátis e limita por taxa: um lote de 9 evidências disparado de uma vez teve 7
 * recusadas com 429. Repete com espera crescente em vez de desistir — o limite é temporário.
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

  const motor = motorImagem(String(ctx.payload.engine ?? "POLLINATIONS"));
  const engine = motor.id;
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

    // Espaça as chamadas do Pollinations dentro do lote: disparar em rajada é o que dispara o 429.
    if (i > 0 && engine === "POLLINATIONS") await dorme(2500);

    const input = { prompt, aspectRatio: aspect, negativePrompt };
    try {
      // A retentativa com espera crescente vale para qualquer motor: o 429 do grátis e o do pago
      // querem a mesma coisa — esperar. O orçamento é conferido dentro de gerarImagem, antes da
      // chamada paga, então repetir não gasta nada a mais do que uma tentativa custaria.
      const result = await comRetentativa(
        () => gerarImagemComRedundancia(engine, input, { projectId, onAviso: (m) => ctx.log(m) }),
        ctx,
        `Imagem ${i + 1}`,
      );
      const costUsd = result.custoUsd;
      spent += costUsd;
      // Grava o motor que REALMENTE gerou, não o pedido: com a cascata os dois divergem, e a
      // galeria dizendo "Pollinations" numa imagem feita pela Cloudflare esconderia justamente o
      // que interessa saber depois — qual motor está sustentando a produção.
      const usado = motorImagem(result.motor);
      const model = usado.id === "GEMINI" ? (process.env.GEMINI_IMAGE_MODEL ?? null) : usado.medidor;
      if (usado.id !== engine) await ctx.log(`Imagem ${i + 1}: gerada por ${usado.label} (pedido: ${motor.label})`);

      const ext = result.mimeType.includes("png") ? ".png" : ".jpg";
      const file = path.join(dir, `img-${Date.now()}-${i + 1}${ext}`);
      await writeFile(file, result.buffer);
      await prisma.generatedImage.create({
        data: { projectId, prompt, engine: usado.id, model, aspect, filePath: relPath(file), costUsd },
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
