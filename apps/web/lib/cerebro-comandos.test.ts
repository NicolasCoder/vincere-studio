import { describe, expect, it } from "vitest";
import { LIMITE_PROMPT_ARGUMENTO, interpretarRespostaDoVince, montarComandoChat } from "./cerebro-comandos";
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
});

describe("interpretarRespostaDoVince", () => {
  it("lê JSON completo, inclusive com texto em volta", () => {
    const r = interpretarRespostaDoVince('Claro!\n{"resposta":"Comece pelo Início.","irPara":"/dashboard","acaoClaude":null,"lembrar":"gosta de 9:16"}', extrair);
    expect(r).toEqual({ resposta: "Comece pelo Início.", irPara: "/dashboard", acaoClaude: null, lembrar: "gosta de 9:16" });
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
