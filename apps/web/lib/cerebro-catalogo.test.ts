import { describe, expect, it } from "vitest";
import { classificarFamiliaModelo, criarModeloDisponivel, descobrirCatalogoDoCerebro } from "./cerebro-catalogo";

describe("classificarFamiliaModelo e criarModeloDisponivel", () => {
  it("classifica corretamente Gemini, Claude, GPT e modelos locais", () => {
    expect(classificarFamiliaModelo("gemini-4-argon-high", "Gemini 4 Argon (High)")).toBe("Gemini");
    expect(classificarFamiliaModelo("claude-sonnet-5-5-medium", "Claude Sonnet 5.5 (Medium)")).toBe("Claude");
    expect(classificarFamiliaModelo("gpt-oss-120b-medium", "GPT-OSS 120B (Medium)")).toBe("GPT");
    expect(classificarFamiliaModelo("o4-mini", "OpenAI o4-mini")).toBe("GPT");
    expect(classificarFamiliaModelo("qwen2.5:7b", "Qwen 2.5")).toBe("Local");
  });

  it("extrai grupoBase e forcaEmbutida de modelos com sufixo low/medium/high", () => {
    const m = criarModeloDisponivel("claude-opus-5-5-high", "Claude Opus 5.5 (High)");
    expect(m).toEqual({
      id: "claude-opus-5-5-high",
      nome: "Claude Opus 5.5 (High)",
      familia: "Claude",
      grupoBase: "Claude Opus 5.5",
      forcaEmbutida: "high",
    });
  });

  it("adapta o catálogo dinamicamente conforme o motor conectado pelo usuário (Claude Code, Codex, Gemini)", async () => {
    const catClaude = await descobrirCatalogoDoCerebro({ tipo: "agente", id: "claude" });
    expect(catClaude.motorId).toBe("claude");
    expect(catClaude.suportaConversaContinua).toBe(true);
    expect(catClaude.suportaEsforco).toBe(true);
    expect(catClaude.familias).toEqual(["Claude"]);
    expect(catClaude.modelos.some((m) => m.id === "sonnet")).toBe(true);

    const catCodex = await descobrirCatalogoDoCerebro({ tipo: "agente", id: "codex" });
    expect(catCodex.motorId).toBe("codex");
    expect(catCodex.suportaEsforco).toBe(true);
    expect(catCodex.familias).toEqual(["GPT"]);
    expect(catCodex.modelos.some((m) => m.id === "o4-mini")).toBe(true);

    const catGemini = await descobrirCatalogoDoCerebro({ tipo: "llm", id: "gemini" }, { env: { GEMINI_TEXT_MODEL: "gemini-3.8-flash" } });
    expect(catGemini.motorId).toBe("gemini");
    expect(catGemini.modeloPadrao).toBe("gemini-3.8-flash");
    expect(catGemini.familias).toEqual(["Gemini"]);
  });
});
