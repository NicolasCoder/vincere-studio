import { prisma } from "@docupulse/db";
import type { UsageInfo } from "./types";

/** Registra o consumo no medidor (base dos créditos) e soma ao custo do projeto. */
export async function recordUsage(projectId: string | null, usage: UsageInfo) {
  await prisma.usage.createMany({
    data: [
      { projectId, provider: usage.provider, unit: "TOKENS_IN", quantity: usage.tokensIn, costUsd: (usage.costUsd * usage.tokensIn) / Math.max(1, usage.tokensIn + usage.tokensOut) },
      { projectId, provider: usage.provider, unit: "TOKENS_OUT", quantity: usage.tokensOut, costUsd: (usage.costUsd * usage.tokensOut) / Math.max(1, usage.tokensIn + usage.tokensOut) },
    ],
  });
  if (projectId) await prisma.project.update({ where: { id: projectId }, data: { costUsd: { increment: usage.costUsd } } });
}
