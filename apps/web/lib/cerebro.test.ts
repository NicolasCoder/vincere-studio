import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  findUnique: vi.fn(),
  detect: vi.fn(),
}));

vi.mock("@vincere-studio/db", () => ({
  prisma: { setting: { findUnique: m.findUnique, upsert: vi.fn(), deleteMany: vi.fn() } },
}));
vi.mock("@vincere-studio/providers", () => ({ OpenAICompatTextProvider: class {}, getTextProvider: vi.fn() }));
vi.mock("./local-agent-runner", () => ({ detectLocalAgents: m.detect }));

import { detectarOpcoes, lerCerebro, resolverCerebroAtivo, validarCerebro } from "./cerebro";

const agentes = (parcial: Record<string, unknown> = {}) => ({
  claudePath: "C:/bin/claude.exe",
  agyPath: null,
  codexPath: "C:/bin/codex.exe",
  preferred: "claude",
  hermes: { available: false, mode: null, detail: "Não configurado" },
  ...parcial,
});

beforeEach(() => {
  m.findUnique.mockReset();
  m.detect.mockReset();
  m.detect.mockReturnValue(agentes());
});

describe("validarCerebro", () => {
  it("aceita só combinações conhecidas de tipo e id", () => {
    expect(validarCerebro("agente", "claude")).toEqual({ tipo: "agente", id: "claude" });
    expect(validarCerebro("llm", "gemini")).toEqual({ tipo: "llm", id: "gemini" });
    expect(() => validarCerebro("agente", "gemini")).toThrow(/desconhecida/);
    expect(() => validarCerebro("llm", "claude")).toThrow(/desconhecida/);
    expect(() => validarCerebro("agente", "rm -rf")).toThrow(/desconhecida/);
  });

  it("preserva modelo e esforço válidos quando informados", () => {
    expect(validarCerebro("agente", "agy", { modelo: "claude-sonnet-5-5-high", esforco: "high" })).toEqual({
      tipo: "agente",
      id: "agy",
      modelo: "claude-sonnet-5-5-high",
      esforco: "high",
    });
    expect(() => validarCerebro("agente", "agy", { esforco: "ultra-invalido" })).toThrow(/força/);
    expect(() => validarCerebro("agente", "agy", { modelo: "rm -rf; echo $HOME" })).toThrow(/modelo/);
  });
});

describe("lerCerebro", () => {
  it("devolve o vínculo salvo, e null se não houver ou se estiver corrompido", async () => {
    m.findUnique.mockResolvedValueOnce({ value: JSON.stringify({ tipo: "agente", id: "codex" }) });
    expect(await lerCerebro()).toEqual({ tipo: "agente", id: "codex" });
    m.findUnique.mockResolvedValueOnce(null);
    expect(await lerCerebro()).toBeNull();
    m.findUnique.mockResolvedValueOnce({ value: "isso não é json" });
    expect(await lerCerebro()).toBeNull();
    m.findUnique.mockResolvedValueOnce({ value: JSON.stringify({ tipo: "agente", id: "inventado" }) });
    expect(await lerCerebro()).toBeNull();
  });
});

describe("detectarOpcoes", () => {
  it("marca como disponível só o que existe nesta máquina/instância", () => {
    const o = detectarOpcoes({ GEMINI_API_KEY: "x" });
    const por = Object.fromEntries(o.map((x) => [x.id, x.disponivel]));
    expect(por).toMatchObject({ claude: true, agy: false, codex: true, hermes: false, gemini: true, openai_compat: false, ollama: false });
    expect(o.find((x) => x.id === "agy")?.detalhe).toMatch(/AGY_BIN/);
  });

  it("LLM por endereço (OpenAI-compatível, Ollama) conta como disponível", () => {
    const por = Object.fromEntries(detectarOpcoes({ OPENAI_COMPAT_BASE_URL: "http://local/v1", OLLAMA_BASE_URL: "http://127.0.0.1:11434" }).map((x) => [x.id, x.disponivel]));
    expect(por).toMatchObject({ openai_compat: true, ollama: true, gemini: false });
  });

  it("nunca devolve o valor da chave nos detalhes", () => {
    const texto = JSON.stringify(detectarOpcoes({ GEMINI_API_KEY: "SEGREDO-123", OPENAI_COMPAT_API_KEY: "SEGREDO-456" }));
    expect(texto).not.toContain("SEGREDO");
  });
});

describe("resolverCerebroAtivo", () => {
  it("o vínculo da pessoa vence qualquer outra coisa", async () => {
    m.findUnique.mockResolvedValue({ value: JSON.stringify({ tipo: "agente", id: "claude" }) });
    expect(await resolverCerebroAtivo({ GEMINI_API_KEY: "x" })).toEqual({ tipo: "agente", id: "claude" });
  });

  it("sem vínculo, usa uma LLM já configurada (ex.: chave do Gemini)", async () => {
    m.findUnique.mockResolvedValue(null);
    expect(await resolverCerebroAtivo({ GEMINI_API_KEY: "x" })).toEqual({ tipo: "llm", id: "gemini" });
  });

  it("sem vínculo e sem nada configurado, não escolhe ninguém (o Vince pede para vincular)", async () => {
    m.findUnique.mockResolvedValue(null);
    expect(await resolverCerebroAtivo({})).toBeNull();
  });

  it("não usa serviço público por conta própria; só se a pessoa ligar VINCE_RESERVA_PUBLICA", async () => {
    m.findUnique.mockResolvedValue(null);
    expect(await resolverCerebroAtivo({})).toBeNull();
    expect(await resolverCerebroAtivo({ VINCE_RESERVA_PUBLICA: "1" })).toEqual({ tipo: "llm", id: "publico" });
  });
});
