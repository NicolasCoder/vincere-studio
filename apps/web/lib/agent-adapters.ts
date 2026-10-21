import path from "node:path";

// Adaptadores dos agentes que o Vince/Studio pode comandar. Este módulo só monta o comando
// (sem spawn nem acesso a disco), para ser testável; quem executa é o local-agent-runner.

export type AgentEngineId = "auto" | "agy" | "claude" | "hermes" | "inbox";

export interface AgentInvocation {
  command: string;
  args: string[];
  cwd: string;
  /** Prompt enviado pela entrada padrão (evita limite de tamanho e problemas de aspas na linha de comando). */
  stdin?: string;
  /** Texto curto para mostrar ao usuário ("Hermes (SSH)"). */
  label: string;
}

/** Aspas simples POSIX: o conteúdo vira um único argumento literal no shell remoto. */
export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export interface HermesConfig {
  mode: "ssh" | "local";
  /** local: caminho do executável. ssh: usuário@servidor. */
  target: string;
  port: number;
  keyPath?: string;
  remoteBin: string;
  /** Pasta (no servidor) onde ficam os projetos HyperFrames; permite traduzir o projeto ativo em --in. */
  remoteProjectsDir?: string;
  /** --worktree isola as mudanças num worktree do Git; só vale para projetos que são repositório Git. */
  worktree: boolean;
}

// Impede que o "host" vire opção do ssh (ex.: -oProxyCommand=...).
const SSH_TARGET = /^[A-Za-z0-9][A-Za-z0-9._-]*@[A-Za-z0-9][A-Za-z0-9.-]*$|^[A-Za-z0-9][A-Za-z0-9.-]*$/;
const PROJECT_NAME = /^[\p{L}\p{N}_][\p{L}\p{N}_ .-]{0,119}$/u;

/**
 * Hermes só é detectado quando alguém o configura de propósito (HERMES_SSH_HOST ou HERMES_BIN):
 * o papel padrão dele no projeto é ponte de código e memória, não editor de composições.
 */
export function readHermesConfig(env: Record<string, string | undefined> = process.env): HermesConfig | null {
  const worktree = env.HERMES_WORKTREE === "1";
  const sshHost = env.HERMES_SSH_HOST?.trim();
  if (sshHost) {
    if (!SSH_TARGET.test(sshHost)) return null;
    const port = Number(env.HERMES_SSH_PORT || 22);
    if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
    return {
      mode: "ssh",
      target: sshHost,
      port,
      keyPath: env.HERMES_SSH_KEY?.trim() || undefined,
      remoteBin: env.HERMES_REMOTE_BIN?.trim() || "hermes",
      remoteProjectsDir: env.HERMES_REMOTE_PROJECTS_DIR?.trim() || undefined,
      worktree,
    };
  }
  const bin = env.HERMES_BIN?.trim();
  if (bin) return { mode: "local", target: bin, port: 22, remoteBin: "hermes", worktree };
  return null;
}

/** .cmd/.bat não podem ser executados sem shell (Node recusa por segurança); só vale .exe ou script direto. */
export function isDirectlySpawnable(bin: string, platform: NodeJS.Platform = process.platform): boolean {
  if (platform !== "win32") return true;
  return !/\.(cmd|bat)$/i.test(bin);
}

/** Traduz o projeto ativo para o caminho dele no servidor; undefined se não der para fazer com segurança. */
export function remoteProjectDir(cfg: HermesConfig, projectDir?: string, projectHf?: string): string | undefined {
  if (!cfg.remoteProjectsDir) return undefined;
  const raw = projectDir ? path.win32.basename(projectDir.replace(/\\/g, "/")) : projectHf;
  const name = raw?.trim();
  if (!name || name === "." || name === ".." || !PROJECT_NAME.test(name)) return undefined;
  return path.posix.join(cfg.remoteProjectsDir.replace(/\/+$/, ""), name);
}

export interface HermesInvokeOptions {
  prompt: string;
  cwd: string;
  projectDir?: string;
  projectHf?: string;
}

export function buildHermesInvocation(cfg: HermesConfig, opts: HermesInvokeOptions): AgentInvocation {
  if (cfg.mode === "local") {
    const args = ["-z", opts.prompt, "--in", opts.cwd];
    if (cfg.worktree) args.push("--worktree");
    return { command: cfg.target, args, cwd: opts.cwd, label: "Hermes" };
  }

  const dir = remoteProjectDir(cfg, opts.projectDir, opts.projectHf);
  // O prompt viaja pela entrada padrão do ssh e é lido no servidor por "$(cat)": nenhum caractere dele
  // passa pelo shell como código (o hermes.bat antigo proibia apóstrofo por causa disso).
  let remote = `${shellQuote(cfg.remoteBin)} -z "$(cat)"`;
  if (dir) remote += ` --in ${shellQuote(dir)}`;
  if (cfg.worktree) remote += " --worktree";

  const args = ["-T", "-p", String(cfg.port), "-o", "BatchMode=yes", "-o", "IdentitiesOnly=yes"];
  if (cfg.keyPath) args.push("-i", cfg.keyPath);
  args.push(cfg.target, remote);
  return { command: "ssh", args, cwd: opts.cwd, stdin: opts.prompt, label: "Hermes (SSH)" };
}

export interface DetectedHermes {
  available: boolean;
  mode: "ssh" | "local" | null;
  detail: string;
}

export function describeHermes(cfg: HermesConfig | null, platform: NodeJS.Platform = process.platform): DetectedHermes {
  if (!cfg) {
    return { available: false, mode: null, detail: "Não configurado (defina HERMES_SSH_HOST ou HERMES_BIN no .env)." };
  }
  if (cfg.mode === "local" && !isDirectlySpawnable(cfg.target, platform)) {
    return { available: false, mode: "local", detail: "HERMES_BIN aponta para .cmd/.bat; use o .exe ou configure HERMES_SSH_HOST." };
  }
  return { available: true, mode: cfg.mode, detail: cfg.mode === "ssh" ? `SSH ${cfg.target}:${cfg.port}` : cfg.target };
}
