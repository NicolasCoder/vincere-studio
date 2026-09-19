import { describe, expect, it } from "vitest";
import { prisma } from "./index";

// IGO-7: regressão de um bug real — PRAGMAs do SQLite que RETORNAM linha (journal_mode,
// busy_timeout) precisam ir por $queryRawUnsafe. Usar $executeRawUnsafe nesses casos
// já quebrou em produção (o driver rejeita SELECT-like statements em execute*).
// Referência do padrão correto: apps/worker/src/index.ts:93-94 e este arquivo (index.ts:18).
// Roda contra SQLite real (não mock), do jeito que packages/db/src/index.ts já faz no boot.
describe("PRAGMA via $queryRawUnsafe", () => {
  it("PRAGMA busy_timeout (que retorna linha) não lança com $queryRawUnsafe", async () => {
    await expect(prisma.$queryRawUnsafe("PRAGMA busy_timeout=5000;")).resolves.toBeDefined();
  });

  it("PRAGMA journal_mode (que retorna linha) não lança com $queryRawUnsafe", async () => {
    await expect(prisma.$queryRawUnsafe("PRAGMA journal_mode=WAL;")).resolves.toBeDefined();
  });
});
