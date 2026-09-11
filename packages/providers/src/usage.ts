import { prisma } from "@docupulse/db";
import { ehCobravel } from "./budget";
import type { UsageInfo } from "./types";

/**
 * O medidor guarda preço de tabela para tudo, cobrável ou não — é o que permite responder "quanto
 * isso custaria num plano pago". `billable` separa o que realmente sai do bolso, e só esse conta
 * contra o teto de orçamento. Sem essa separação, rodar no plano gratuito ia fechando a torneira da
 * geração paga sozinho.
 */
export async function recordUsage(projectId: string | null, usage: UsageInfo) {
  const billable = ehCobravel(usage.provider);
  await prisma.usage.createMany({
    data: [
      { projectId, provider: usage.provider, unit: "TOKENS_IN", quantity: usage.tokensIn, costUsd: (usage.costUsd * usage.tokensIn) / Math.max(1, usage.tokensIn + usage.tokensOut), billable },
      { projectId, provider: usage.provider, unit: "TOKENS_OUT", quantity: usage.tokensOut, costUsd: (usage.costUsd * usage.tokensOut) / Math.max(1, usage.tokensIn + usage.tokensOut), billable },
    ],
  });
  // O custo do projeto segue somando o estimado: ali a pergunta é "quanto este vídeo custaria".
  if (projectId) await prisma.project.update({ where: { id: projectId }, data: { costUsd: { increment: usage.costUsd } } });
}

/** Registra o consumo de 1 imagem gerada por IA no medidor. */
export async function recordImageUsage(projectId: string | null, provider: string, costUsd: number, quantity = 1) {
  await prisma.usage.create({ data: { projectId, provider, unit: "IMAGES", quantity, costUsd, billable: ehCobravel(provider) } });
  if (projectId) await prisma.project.update({ where: { id: projectId }, data: { costUsd: { increment: costUsd } } });
}
