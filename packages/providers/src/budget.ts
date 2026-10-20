import { prisma } from "@vincere-studio/db";
import { ProviderError } from "./types";

const BUDGET_KEY = "image_video_budget_usd";

/**
 * Controle de gasto pra geração paga de imagem/vídeo por IA (Gemini com faturamento, e qualquer
 * provedor pago futuro — Veo, Kling, Runway etc.). Teto mensal configurável em Settings, guardado
 * na tabela Setting (sem tabela nova). Começa em US$ 0 de propósito: nada gera de verdade até o
 * usuário decidir e configurar um valor.
 */
export async function getBudgetCapUsd(): Promise<number> {
  const row = await prisma.setting.findUnique({ where: { key: BUDGET_KEY } });
  const n = row ? Number(row.value) : 0;
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export async function setBudgetCapUsd(value: number): Promise<void> {
  const v = Number.isFinite(value) && value >= 0 ? value : 0;
  await prisma.setting.upsert({
    where: { key: BUDGET_KEY },
    update: { value: String(v) },
    create: { key: BUDGET_KEY, value: String(v) },
  });
}

/**
 * Provedores que cobram de verdade. O resto roda em plano gratuito e tem o custo registrado só
 * para visibilidade ("quanto isso custaria"), sem consumir o teto.
 *
 * A distinção não é cosmética: `Usage.costUsd` sempre guardou preço de tabela, e o teto somava
 * tudo. Com o Gemini no free tier, gerar roteiro e narração acumulava "gasto" que nunca saiu do
 * bolso — já eram US$ 1,14 de tokens de texto num teto de US$ 10, ou seja, 14% do orçamento
 * consumido por dinheiro imaginário. Mais alguns meses e a geração paga seria bloqueada com uma
 * mensagem tecnicamente correta e factualmente falsa.
 *
 * Se um dia o faturamento do Gemini for ativado, é aqui que ele entra.
 */
const PROVEDORES_COBRAVEIS = new Set(["ELEVENLABS", "OPENAI", "KIE", "NANO_BANANA", "RUNWAY", "KLING", "VEO"]);

export const ehCobravel = (provider: string) => PROVEDORES_COBRAVEIS.has(provider.toUpperCase());

/**
 * Soma que sai do bolso no mês corrente. Conta só o que é cobrável — linhas de plano gratuito
 * ficam de fora, por mais que tenham um `costUsd` estimado.
 */
export async function getSpentThisMonthUsd(): Promise<number> {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const rows = await prisma.usage.findMany({ where: { createdAt: { gte: start }, billable: true }, select: { costUsd: true } });
  return rows.reduce((s, r) => s + r.costUsd, 0);
}

/** O que teria sido gasto se nada fosse gratuito. Serve para a tela de custos, não para o teto. */
export async function getEstimatedThisMonthUsd(): Promise<number> {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const rows = await prisma.usage.findMany({ where: { createdAt: { gte: start } }, select: { costUsd: true } });
  return rows.reduce((s, r) => s + r.costUsd, 0);
}

export async function getBudgetStatus() {
  const [capUsd, spentUsd, estimatedUsd] = await Promise.all([
    getBudgetCapUsd(),
    getSpentThisMonthUsd(),
    getEstimatedThisMonthUsd(),
  ]);
  return { capUsd, spentUsd, remainingUsd: Math.max(0, capUsd - spentUsd), estimatedUsd };
}

/**
 * Chamar ANTES de qualquer geração paga de imagem/vídeo, com o custo estimado em USD. Lança
 * ProviderError (sem gastar nada, sem chamar a API paga) se estourar o teto mensal configurado.
 */
export async function checkBudget(estimatedCostUsd: number): Promise<void> {
  const { capUsd, spentUsd } = await getBudgetStatus();
  if (spentUsd + estimatedCostUsd > capUsd) {
    throw new ProviderError(
      capUsd <= 0
        ? `Geração paga bloqueada: nenhum orçamento configurado ainda (teto atual: US$ 0,00). Defina um teto mensal em Settings → "Orçamento de IA paga" pra liberar.`
        : `Geração paga bloqueada: custaria ~US$ ${estimatedCostUsd.toFixed(3)} e o orçamento mensal (US$ ${capUsd.toFixed(2)}) já tem US$ ${spentUsd.toFixed(2)} gastos — não sobra espaço. Aumente o teto em Settings se quiser continuar.`,
    );
  }
}
