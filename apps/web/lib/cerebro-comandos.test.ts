import { describe, expect, it } from "vitest";
import { LIMITE_PROMPT_ARGUMENTO, extrairEnvelopeCliJson, interpretarRespostaDoVince, montarComandoChat } from "./cerebro-comandos";
import type { HermesConfig } from "./agent-adapters";

// Mesma lógica de extração usada pelo provedor de texto, simplificada para o teste.
const extrair = (t: string): { ok: true; value: unknown } | { ok: false } => {
  const m = /\{[\s\S]*\}/.exec(t);
  if (!m) return { ok: false };
  try {
    return { ok: true, value: JSON.parse(m[0]) };
  } catch {
    return { ok: false };
  }
};

describe("montarComandoChat", () => {
  const base = { prompt: "Oi", cwd: "C:/tmp/vince", bin: "C:/bin/x.exe" };

  it("Claude: somente planejar, prompt por stdin, pasta vazia", () => {
    const c = montarComandoChat("claude", base);
    expect(c).toMatchObject({ command: "C:/bin/x.exe", args: ["-p", "--permission-mode", "plan"], stdin: "Oi", cwd: "C:/tmp/vince" });
    expect(c.args).not.toContain("--dangerously-skip-permissions");
  });

  it("Codex: sandbox somente leitura, sem sessão gravada, resposta final em arquivo", () => {
    const c = montarComandoChat("codex", { ...base, arquivoSaida: "C:/tmp/saida.txt" });
    expect(c.args).toEqual(["exec", "--sandbox", "read-only", "--skip-git-repo-check", "--ephemeral", "--ignore-rules", "-C", "C:/tmp/vince", "-o", "C:/tmp/saida.txt", "-"]);
    expect(c.stdin).toBe("Oi");
    expect(c.arquivoSaida).toBe("C:/tmp/saida.txt");
    expect(() => montarComandoChat("codex", base)).toThrow(/arquivo/);
  });

  it("agy: modo plan; recusa prompt grande demais para argumento", () => {
    const c = montarComandoChat("agy", base);
    expect(c.args).toEqual(["--mode", "plan", "-p", "Oi"]);
    expect(c.args).not.toContain("--dangerously-skip-permissions");
    expect(() => montarComandoChat("agy", { ...base, prompt: "x".repeat(LIMITE_PROMPT_ARGUMENTO + 1) })).toThrow(/longa demais/);
  });

  it("Hermes: usa o adaptador seguro (prompt por stdin no modo SSH)", () => {
    const hermes: HermesConfig = { mode: "ssh", target: "hermes@servidor", port: 22, remoteBin: "hermes", worktree: false };
    const c = montarComandoChat("hermes", { prompt: "Oi d'água", cwd: "C:/tmp", hermes });
    expect(c.command).toBe("ssh");
    expect(c.stdin).toBe("Oi d'água");
    expect(() => montarComandoChat("hermes", { prompt: "x", cwd: "C:/tmp", hermes: null })).toThrow(/Hermes/);
  });

  it("sem executável, avisa", () => {
    expect(() => montarComandoChat("claude", { prompt: "x", cwd: "C:/tmp" })).toThrow(/Executável/);
  });

  it("repassa modelo, esforço, conversaId e formatoJson conforme cada CLI", () => {
    const agyCmd = montarComandoChat("agy", {
      ...base,
      modelo: "claude-sonnet-5-5-high",
      esforco: "max",
      conversaId: "conv-123",
      formatoJson: true,
    });
    expect(agyCmd.args).toEqual([
      "--mode",
      "plan",
      "--output-format",
      "json",
      "--model",
      "claude-sonnet-5-5-high",
      "--effort",
      "max",
      "--conversation",
      "conv-123",
      "-p",
      "Oi",
    ]);

    const claudeCmd = montarComandoChat("claude", {
      ...base,
      modelo: "opus",
      esforco: "high",
      conversaId: "sess-456",
      formatoJson: true,
    });
    expect(claudeCmd.args).toEqual([
      "-p",
      "--permission-mode",
      "plan",
      "--output-format",
      "json",
      "--model",
      "opus",
      "--effort",
      "high",
      "--resume",
      "sess-456",
    ]);

    const codexCmd = montarComandoChat("codex", {
      ...base,
      arquivoSaida: "C:/tmp/out.txt",
      modelo: "o3",
      esforco: "high",
    });
    expect(codexCmd.args).toContain("-m");
    expect(codexCmd.args).toContain("o3");
    expect(codexCmd.args).toContain('model_reasoning_effort="high"');
  });
});

describe("extrairEnvelopeCliJson", () => {
  it("extrai response, conversation_id e usage do envelope JSON do agy", () => {
    const bruto = JSON.stringify({
      conversation_id: "3423fa4e-f778-4109-b16d-953b6d977aca",
      status: "SUCCESS",
      response: '{"resposta":"Tudo certo!"}',
      usage: { input_tokens: 1000, output_tokens: 200, thinking_tokens: 50, cache_read_tokens: 400, total_tokens: 1250 },
    });
    const env = extrairEnvelopeCliJson(bruto);
    expect(env.texto).toBe('{"resposta":"Tudo certo!"}');
    expect(env.conversaId).toBe("3423fa4e-f778-4109-b16d-953b6d977aca");
    expect(env.uso).toEqual({
      tokensIn: 1000,
      tokensOut: 250,
      tokensPensamento: 50,
      tokensCache: 400,
      totalTokens: 1250,
    });
  });

  it("extrai result, session_id e usage do envelope JSON do Claude Code", () => {
    const bruto = JSON.stringify({
      type: "result",
      result: "Olá do Claude!",
      session_id: "sess-abc",
      total_cost_usd: 0.015,
      usage: { input_tokens: 500, output_tokens: 120, cache_read_input_tokens: 300 },
    });
    const env = extrairEnvelopeCliJson(bruto);
    expect(env.texto).toBe("Olá do Claude!");
    expect(env.conversaId).toBe("sess-abc");
    expect(env.uso).toEqual({
      tokensIn: 800,
      tokensOut: 120,
      tokensPensamento: 0,
      tokensCache: 300,
      totalTokens: 920,
      costUsd: 0.015,
    });
  });
});

describe("interpretarRespostaDoVince", () => {
  it("lê JSON completo, inclusive com texto em volta", () => {
    const r = interpretarRespostaDoVince('Claro!\n{"resposta":"Comece pelo Início.","irPara":"/dashboard","acaoClaude":null,"lembrar":"gosta de 9:16"}', extrair);
    expect(r).toEqual({
      resposta: "Comece pelo Início.",
      irPara: "/dashboard",
      acaoClaude: null,
      lembrar: "gosta de 9:16",
      acaoStudio: null,
      skillSugerida: null,
    });
  });

  it("lê acaoStudio e skillSugerida quando presentes", () => {
    const json = JSON.stringify({
      resposta: "Gerei as imagens para o projeto.",
      acaoStudio: { action: "gerar_imagens", label: "Gerar Imagens IA" },
      skillSugerida: { nome: "subtitles-studio", comando: "/subtitles-studio", motivo: "Legendas Lockup" },
    });
    const r = interpretarRespostaDoVince(json, extrair);
    expect(r.acaoStudio?.action).toBe("gerar_imagens");
    expect(r.skillSugerida?.comando).toBe("/subtitles-studio");
  });

  it("se a IA responder em texto corrido, o texto inteiro vira a resposta", () => {
    const r = interpretarRespostaDoVince("Use a tela de Projetos para criar o vídeo.", extrair);
    expect(r.resposta).toBe("Use a tela de Projetos para criar o vídeo.");
    expect(r.irPara).toBeNull();
  });

  it("JSON sem o campo resposta não é aceito (não perde o texto)", () => {
    const r = interpretarRespostaDoVince('{"outra":"coisa"}', extrair);
    expect(r.resposta).toBe('{"outra":"coisa"}');
  });

  it("resposta vazia tem uma mensagem explícita", () => {
    expect(interpretarRespostaDoVince("   ", extrair).resposta).toMatch(/não devolveu/);
  });
});
