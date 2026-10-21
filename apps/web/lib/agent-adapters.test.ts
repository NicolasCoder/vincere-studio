import { describe, expect, it } from "vitest";
import {
  buildHermesInvocation,
  describeHermes,
  isDirectlySpawnable,
  readHermesConfig,
  remoteProjectDir,
  shellQuote,
  type HermesConfig,
} from "./agent-adapters";

const ssh: HermesConfig = {
  mode: "ssh",
  target: "hermes@servidor.exemplo",
  port: 22022,
  keyPath: "C:/chaves/hermes",
  remoteBin: "/home/hermes/.local/bin/hermes",
  remoteProjectsDir: "/opt/hf-projetos",
  worktree: false,
};

describe("shellQuote", () => {
  it("mantém texto simples entre aspas simples", () => {
    expect(shellQuote("hermes")).toBe("'hermes'");
  });

  it("escapa apóstrofo (o que quebrava o hermes.bat)", () => {
    expect(shellQuote("tira o título d'água")).toBe(`'tira o título d'\\''água'`);
  });

  it("neutraliza tentativa de injeção de comando", () => {
    const quoted = shellQuote("x'; rm -rf / #");
    // Dentro de aspas simples nada é interpretado; o apóstrofo do atacante é fechado, escapado e reaberto.
    expect(quoted).toBe(`'x'\\''; rm -rf / #'`);
  });
});

describe("readHermesConfig", () => {
  it("fica desligado sem configuração (comportamento padrão não muda)", () => {
    expect(readHermesConfig({})).toBeNull();
    expect(readHermesConfig({ HERMES_SSH_HOST: "  ", HERMES_BIN: "" })).toBeNull();
  });

  it("lê o modo SSH com padrões", () => {
    const cfg = readHermesConfig({ HERMES_SSH_HOST: "hermes@servidor.exemplo" });
    expect(cfg).toMatchObject({ mode: "ssh", target: "hermes@servidor.exemplo", port: 22, remoteBin: "hermes", worktree: false });
  });

  it("SSH tem prioridade sobre o binário local", () => {
    const cfg = readHermesConfig({ HERMES_SSH_HOST: "servidor", HERMES_BIN: "/usr/bin/hermes" });
    expect(cfg?.mode).toBe("ssh");
  });

  it("recusa host que viraria opção do ssh", () => {
    expect(readHermesConfig({ HERMES_SSH_HOST: "-oProxyCommand=calc" })).toBeNull();
    expect(readHermesConfig({ HERMES_SSH_HOST: "a b@c" })).toBeNull();
  });

  it("recusa porta inválida", () => {
    expect(readHermesConfig({ HERMES_SSH_HOST: "servidor", HERMES_SSH_PORT: "99999" })).toBeNull();
    expect(readHermesConfig({ HERMES_SSH_HOST: "servidor", HERMES_SSH_PORT: "abc" })).toBeNull();
  });

  it("lê o binário local e o --worktree", () => {
    const cfg = readHermesConfig({ HERMES_BIN: "/usr/local/bin/hermes", HERMES_WORKTREE: "1" });
    expect(cfg).toMatchObject({ mode: "local", target: "/usr/local/bin/hermes", worktree: true });
  });
});

describe("remoteProjectDir", () => {
  it("traduz a pasta do PC para a do servidor", () => {
    expect(remoteProjectDir(ssh, "C:\\Users\\Igor\\Videos-HF\\nike-historia")).toBe("/opt/hf-projetos/nike-historia");
  });

  it("usa o nome do projeto quando não há pasta", () => {
    expect(remoteProjectDir(ssh, undefined, "inicio")).toBe("/opt/hf-projetos/inicio");
  });

  it("aceita nome com acento e espaço", () => {
    expect(remoteProjectDir(ssh, undefined, "Nike história")).toBe("/opt/hf-projetos/Nike história");
  });

  it("recusa travessia de pasta", () => {
    expect(remoteProjectDir(ssh, undefined, "..")).toBeUndefined();
    expect(remoteProjectDir(ssh, undefined, "../etc")).toBeUndefined();
    expect(remoteProjectDir(ssh, undefined, "a/b")).toBeUndefined();
  });

  it("não inventa caminho sem HERMES_REMOTE_PROJECTS_DIR", () => {
    expect(remoteProjectDir({ ...ssh, remoteProjectsDir: undefined }, undefined, "inicio")).toBeUndefined();
  });
});

describe("buildHermesInvocation", () => {
  const prompt = "Mude o título d'água para azul\n$(rm -rf /)";

  it("SSH: o prompt vai por stdin e nunca na linha de comando", () => {
    const inv = buildHermesInvocation(ssh, { prompt, cwd: "C:/repo", projectHf: "nike-historia" });
    expect(inv.command).toBe("ssh");
    expect(inv.stdin).toBe(prompt);
    expect(inv.args.join(" ")).not.toContain("água");
    expect(inv.args.join(" ")).not.toContain("rm -rf");
  });

  it("SSH: monta o comando remoto com -z, --in e opções seguras", () => {
    const inv = buildHermesInvocation(ssh, { prompt, cwd: "C:/repo", projectHf: "nike-historia" });
    expect(inv.args.slice(0, 9)).toEqual(["-T", "-p", "22022", "-o", "BatchMode=yes", "-o", "IdentitiesOnly=yes", "-i", "C:/chaves/hermes"]);
    expect(inv.args[inv.args.length - 2]).toBe("hermes@servidor.exemplo");
    expect(inv.args[inv.args.length - 1]).toBe(
      `'/home/hermes/.local/bin/hermes' -z "$(cat)" --in '/opt/hf-projetos/nike-historia'`,
    );
  });

  it("SSH: sem projeto conhecido, não passa --in", () => {
    const inv = buildHermesInvocation(ssh, { prompt, cwd: "C:/repo" });
    expect(inv.args[inv.args.length - 1]).toBe(`'/home/hermes/.local/bin/hermes' -z "$(cat)"`);
  });

  it("SSH: --worktree só quando pedido", () => {
    const inv = buildHermesInvocation({ ...ssh, worktree: true }, { prompt, cwd: "C:/repo", projectHf: "inicio" });
    expect(inv.args[inv.args.length - 1]).toMatch(/ --worktree$/);
  });

  it("SSH: nome de projeto malicioso é descartado, não executado", () => {
    const inv = buildHermesInvocation(ssh, { prompt, cwd: "C:/repo", projectHf: "x'; touch /tmp/hack; '" });
    expect(inv.args[inv.args.length - 1]).not.toContain("hack");
  });

  it("local: passa o prompt como argumento, sem shell", () => {
    const cfg: HermesConfig = { mode: "local", target: "/usr/local/bin/hermes", port: 22, remoteBin: "hermes", worktree: false };
    const inv = buildHermesInvocation(cfg, { prompt: "oi", cwd: "/proj" });
    expect(inv).toMatchObject({ command: "/usr/local/bin/hermes", args: ["-z", "oi", "--in", "/proj"], cwd: "/proj" });
    expect(inv.stdin).toBeUndefined();
  });
});

describe("detecção", () => {
  it(".cmd/.bat não são executáveis diretos no Windows", () => {
    expect(isDirectlySpawnable("C:\\bin\\hermes.bat", "win32")).toBe(false);
    expect(isDirectlySpawnable("C:\\bin\\hermes.exe", "win32")).toBe(true);
    expect(isDirectlySpawnable("/usr/bin/hermes", "linux")).toBe(true);
  });

  it("explica por que está indisponível", () => {
    expect(describeHermes(null).available).toBe(false);
    const bat: HermesConfig = { mode: "local", target: "C:\\bin\\hermes.bat", port: 22, remoteBin: "hermes", worktree: false };
    const d = describeHermes(bat, "win32");
    expect(d.available).toBe(false);
    expect(d.detail).toMatch(/\.cmd\/\.bat/);
    expect(describeHermes(ssh).available).toBe(true);
  });
});
