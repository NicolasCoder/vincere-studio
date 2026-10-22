import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderError } from "@vincere-studio/providers";
import type { JobContext } from "../queue";

// IGO-7: bug real que já aconteceu em produção — quando o Gemini trunca o JSON do
// Niche Finder (resposta cortada, JSON.parse falha dentro de generateJson), a geração
// de ideias inteira não pode travar. O código já tem o try/catch certo em
// generate-ideas.ts; este teste é a rede de segurança pra não perder isso num refactor.
//
// Mocka @vincere-studio/providers e @vincere-studio/db (não precisa de banco real aqui — o ponto
// é isolar o comportamento de "um provedor externo falhou no meio do job").

const { mockGenerateJson, mockRecordUsage, mockIdea, mockProject } = vi.hoisted(() => ({
  mockGenerateJson: vi.fn(),
  mockRecordUsage: vi.fn().mockResolvedValue(undefined),
  mockIdea: { deleteMany: vi.fn(), createMany: vi.fn(), findMany: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  mockProject: { findUnique: vi.fn() },
}));

vi.mock("@vincere-studio/providers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@vincere-studio/providers")>();
  return {
    ...actual,
    getTextProvider: () => ({ name: "GEMINI", generateJson: mockGenerateJson, generateText: vi.fn() }),
    getTextProviderFor: () => ({ name: "GEMINI", generateJson: mockGenerateJson, generateText: vi.fn() }),
    recordUsage: mockRecordUsage,
  };
});

vi.mock("@vincere-studio/db", () => ({
  prisma: {
    project: mockProject,
    idea: mockIdea,
    $transaction: async (fn: (tx: unknown) => Promise<void>) => fn({ idea: mockIdea }),
  },
}));

const { generateIdeas } = await import("./generate-ideas");

function makeCtx(payload: Record<string, unknown>): JobContext {
  return {
    job: { id: "job1", projectId: "proj1" } as JobContext["job"],
    payload,
    log: vi.fn().mockResolvedValue(undefined),
    progress: vi.fn().mockResolvedValue(undefined),
    isCancelled: vi.fn().mockResolvedValue(false),
  };
}

const FAKE_PROJECT = {
  id: "proj1",
  niche: "mistérios espaciais",
  format: "LONG_16_9",
  tone: null,
  audience: null,
  targetDuration: 600,
  hooks: "[]",
  ideas: [],
};

const FAKE_IDEA = {
  title: "O sinal que ninguém explicou",
  category: "Cosmologia Dark",
  synopsis: "Um sinal de rádio nunca explicado reacende o debate.",
  hookLines: ["Gancho 1", "Gancho 2", "Gancho 3"],
  editingPace: "Frenético & Imersivo",
  ctrEstimate: 10,
  retention30s: 70,
  score: 80,
  viralityReason: "Mistério não resolvido gera curiosidade.",
};

describe("generateIdeas — Niche Finder não trava o job quando o JSON vem truncado", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProject.findUnique.mockResolvedValue(FAKE_PROJECT);
    mockIdea.findMany.mockResolvedValue([{ id: "idea1", score: 80 }]);
  });

  it("segue e conclui o job mesmo com o Niche Finder retornando JSON truncado/inválido", async () => {
    mockGenerateJson.mockRejectedValueOnce(new ProviderError("Gemini retornou JSON inválido", 502, '{"angles": ["a", "b"'));
    mockGenerateJson.mockResolvedValueOnce({
      data: { ideas: [FAKE_IDEA] },
      usage: { provider: "GEMINI", model: "gemini-3.6-flash", tokensIn: 100, tokensOut: 200, costUsd: 0.01 },
    });

    const ctx = makeCtx({ projectId: "proj1", count: 1 });

    await expect(generateIdeas(ctx)).resolves.toMatchObject({ count: 1 });

    expect(mockGenerateJson).toHaveBeenCalledTimes(2);
    expect(ctx.log).toHaveBeenCalledWith(expect.stringContaining("Niche Finder indisponível"));
    expect(mockIdea.createMany).toHaveBeenCalledWith({ data: expect.arrayContaining([expect.objectContaining({ title: FAKE_IDEA.title })]) });
  });

  it("mesmo com Niche Finder truncado, a ideia final não vem truncada/incompleta", async () => {
    mockGenerateJson.mockRejectedValueOnce(new ProviderError("Gemini retornou JSON inválido", 502, "{"));
    mockGenerateJson.mockResolvedValueOnce({
      data: { ideas: [FAKE_IDEA] },
      usage: { provider: "GEMINI", model: "gemini-3.6-flash", tokensIn: 100, tokensOut: 200, costUsd: 0.01 },
    });

    await generateIdeas(makeCtx({ projectId: "proj1", count: 1 }));

    const [{ data }] = mockIdea.createMany.mock.calls[0];
    expect(data[0].hookLines).toBe(JSON.stringify(FAKE_IDEA.hookLines.slice(0, 3)));
    expect(data[0].title).toBe(FAKE_IDEA.title);
    expect(data[0].synopsis).toBe(FAKE_IDEA.synopsis);
  });
});
