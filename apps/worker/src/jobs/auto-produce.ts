import { prisma } from "@vincere-studio/db";
import type { JobContext } from "../queue";
import { generateScript } from "./generate-script";
import { synthesizeVoice } from "./synthesize-voice";
import { alignCaptions } from "./align-captions";
import { generateScenePrompts, huntBroll } from "./scenes";
import { generateImages } from "./generate-images";
import { generateEditPlan } from "./edit-plan";
import { renderVideo } from "./render-video";

/**
 * AUTO_PRODUCE: orquestrador autônomo de ponta a ponta.
 *
 * Encadeia as etapas do pipeline sem intervenção manual intermediária:
 * 1. Roteiro (se ainda não existir)
 * 2. Síntese de voz de todos os blocos
 * 3. Alinhamento de legendas palavra por palavra
 * 4. Planejamento de cenas por densidade de retenção
 * 5. Preenchimento de mídia (B-roll gratuito + geração de imagens por IA para pendentes)
 * 6. Plano de edição (lower-thirds, dados, intertítulos)
 * 7. Render de prova/vídeo
 *
 * REGRA INVIOLÁVEL: Para no render! Nunca publica automaticamente no YouTube.
 * A publicação exige aprovação humana explícita no servidor (Gate de Segurança Ativo).
 */
export async function autoProduce(ctx: JobContext) {
  const projectId = String(ctx.payload.projectId ?? ctx.job.projectId ?? "");
  if (!projectId) throw new Error("projectId é obrigatório para AUTO_PRODUCE.");

  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: {
      scripts: { orderBy: { version: "desc" }, take: 1, include: { blocks: true } },
    },
  });

  await ctx.log(`Iniciando AUTO_PRODUCE para o projeto "${project.title}" (${project.format})`);

  // Etapa 1: Roteiro
  let script = project.scripts[0];
  if (!script || script.blocks.length === 0) {
    await ctx.progress({ percent: 5, message: "Etapa 1/6: Gerando roteiro estruturado..." });
    await ctx.log("Roteiro ausente: gerando blocos narrativos...");
    await generateScript(ctx);
    const updated = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: { scripts: { orderBy: { version: "desc" }, take: 1, include: { blocks: true } } },
    });
    script = updated.scripts[0];
  } else {
    await ctx.log(`Roteiro existente encontrado (${script.blocks.length} blocos). Avançando.`);
  }

  if (await ctx.isCancelled()) return { cancelled: true };

  // Etapa 2: Locução / Voz
  await ctx.progress({ percent: 20, message: "Etapa 2/6: Sintetizando locução de todos os atos..." });
  await ctx.log("Sintetizando locução de voz...");
  await synthesizeVoice(ctx);

  if (await ctx.isCancelled()) return { cancelled: true };

  // Etapa 3: Alinhamento de Legendas
  await ctx.progress({ percent: 35, message: "Etapa 3/6: Alinhando legendas no Whisper..." });
  await ctx.log("Alinhando palavras e pausas...");
  await alignCaptions(ctx);

  if (await ctx.isCancelled()) return { cancelled: true };

  // Etapa 4: Planejamento e Preenchimento de Cenas
  await ctx.progress({ percent: 50, message: "Etapa 4/6: Planejando cenas e coletando mídias..." });
  const scenesCount = await prisma.scene.count({
    where: { block: { scriptId: script.id } },
  });
  if (scenesCount === 0) {
    await ctx.log("Planejando cenas por ato...");
    await generateScenePrompts(ctx);
  }

  // Tenta acervo de B-roll gratuito primeiro
  try {
    await ctx.log("Buscando B-roll relevante no acervo...");
    await huntBroll(ctx);
  } catch (err) {
    await ctx.log(`Aviso no B-roll (${String(err).slice(0, 100)}); preenchendo pendentes com gerador de imagens...`);
  }

  // Preenche as cenas que sobraram sem mídia usando gerador de imagem IA
  await ctx.log("Gerando imagens por IA para cenas restantes...");
  await generateImages(ctx);

  if (await ctx.isCancelled()) return { cancelled: true };

  // Etapa 5: Plano de Edição (Camada Visual DVP)
  await ctx.progress({ percent: 70, message: "Etapa 5/6: Gerando plano de inserções visuais..." });
  try {
    await ctx.log("Calculando inserções visuais e ganchos de retenção...");
    await generateEditPlan(ctx);
  } catch (err) {
    await ctx.log(`Aviso no plano de edição: ${String(err).slice(0, 100)}`);
  }

  if (await ctx.isCancelled()) return { cancelled: true };

  // Etapa 6: Renderização do Vídeo
  await ctx.progress({ percent: 85, message: "Etapa 6/6: Renderizando master de vídeo..." });
  await ctx.log("Iniciando renderização com auditoria de qualidade...");
  const renderResult = await renderVideo(ctx);

  // Notificação via Webhook (se configurado)
  const webhookUrl = process.env.WEBHOOK_URL;
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "AUTO_PRODUCE_COMPLETED",
          projectId,
          title: project.title,
          format: project.format,
          renderResult,
          message: "Vídeo renderizado com sucesso! Pronto para revisão e aprovação humana.",
          reviewUrl: `http://localhost:3210/projects/${projectId}/render`,
        }),
        signal: AbortSignal.timeout(5000),
      });
      await ctx.log("Webhook de conclusão disparado com sucesso.");
    } catch (err) {
      await ctx.log(`Aviso: falha ao disparar webhook: ${String(err).slice(0, 80)}`);
    }
  }

  await ctx.progress({ percent: 100, message: "Produção concluída! Aguardando aprovação humana." });
  await ctx.log("GATE DE SEGURANÇA: Vídeo pronto na tela de Render. É necessária aprovação manual para liberar a publicação.");

  return {
    success: true,
    projectId,
    status: "READY_FOR_REVIEW",
    renderResult,
  };
}
