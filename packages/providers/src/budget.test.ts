import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@vincere-studio/db";
import { checkBudget, setBudgetCapUsd } from "./budget";
import { ProviderError } from "./types";

// IGO-7: roda contra o SQLite real de teste (DATABASE_URL do .env.test), não mock —
// checkBudget é a última trava antes de gastar dinheiro de verdade, então o teste
// precisa exercitar a mesma leitura de banco que o código de produção usa.
describe("checkBudget", () => {
  beforeEach(async () => {
    await prisma.usage.deleteMany({});
    await prisma.setting.deleteMany({ where: { key: "image_video_budget_usd" } });
  });

  afterEach(async () => {
    await prisma.usage.deleteMany({});
    await prisma.setting.deleteMany({ where: { key: "image_video_budget_usd" } });
  });

  it("trava ANTES de qualquer chamada quando o teto do mês já foi excedido", async () => {
    await setBudgetCapUsd(5);
    await prisma.usage.create({
      data: { provider: "NANO_BANANA", unit: "IMAGES", quantity: 1, costUsd: 4.5, billable: true },
    });

    await expect(checkBudget(1)).rejects.toBeInstanceOf(ProviderError);
  });

  it("libera quando há saldo suficiente no teto do mês", async () => {
    await setBudgetCapUsd(10);
    await prisma.usage.create({
      data: { provider: "NANO_BANANA", unit: "IMAGES", quantity: 1, costUsd: 2, billable: true },
    });

    await expect(checkBudget(1)).resolves.toBeUndefined();
  });

  it("trava quando nenhum orçamento foi configurado ainda (teto US$ 0)", async () => {
    await expect(checkBudget(0.01)).rejects.toBeInstanceOf(ProviderError);
  });

  it("ignora gasto não-cobrável (billable=false) do plano gratuito ao somar o mês", async () => {
    await setBudgetCapUsd(5);
    // Custo estimado do free tier (Gemini) não sai do bolso — não pode contar pro teto.
    await prisma.usage.create({
      data: { provider: "GEMINI", unit: "TOKENS_OUT", quantity: 1000, costUsd: 4.9, billable: false },
    });

    await expect(checkBudget(1)).resolves.toBeUndefined();
  });
});
