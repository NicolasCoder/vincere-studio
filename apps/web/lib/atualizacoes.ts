import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { timingSafeEqual } from "node:crypto";

const run = promisify(execFile);
const NPM = process.platform === "win32" ? "npm.cmd" : "npm";
const sh = process.platform === "win32";

/**
 * Componentes que o botão "Atualizar versão" sabe atualizar. Só comandos fixos daqui rodam;
 * nada vindo do navegador entra em linha de comando (o cliente só manda o id e o token).
 * Novo componente = nova entrada.
 */
export interface Componente {
  id: string;
  nome: string;
  /** Lê a versão instalada. */
  atual: () => Promise<string | null>;
  /** Lê a última versão publicada. */
  ultima: () => Promise<string | null>;
  /** Atualiza; sem isso o botão só orienta como fazer. */
  atualizar?: () => Promise<string>;
  manual?: string;
}

async function saida(cmd: string, args: string[], timeout = 30_000): Promise<string | null> {
  try {
    const { stdout } = await run(cmd, args, { timeout, shell: sh, windowsHide: true });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}
const semV = (v: string | null) => v?.match(/\d+\.\d+\.\d+[\w.-]*/)?.[0] ?? null;

export const COMPONENTES: Componente[] = [
  {
    id: "hyperframes",
    nome: "HyperFrames",
    atual: async () => semV(await saida("hyperframes", ["--version"])),
    ultima: async () => semV(await saida(NPM, ["view", "hyperframes", "version"])),
    atualizar: async () => {
      const { stdout, stderr } = await run(NPM, ["install", "-g", "hyperframes@latest"], { timeout: 5 * 60_000, shell: sh, windowsHide: true });
      return `${stdout}\n${stderr}`.trim().split("\n").slice(-6).join("\n");
    },
  },
  {
    id: "voicestudio",
    nome: "VoiceStudio",
    atual: async () => null,
    ultima: async () => null,
    manual: "O VoiceStudio roda em um container. Atualize pelo Console Admin (scripts/admin) ou com `docker compose pull && docker compose up -d` na pasta dele.",
  },
  {
    id: "flow",
    nome: "Flow Studio (daemon)",
    atual: async () => null,
    ultima: async () => null,
    manual: "O daemon do Flow roda no seu PC. Atualize com `git pull` na pasta dele e reinicie pelo Iniciar Vincere.bat.",
  },
  {
    id: "vincere",
    nome: "Vincere Studio",
    atual: async () => null,
    ultima: async () => null,
    manual: "Atualize o código com `git pull` e, na VPS, rode `bash scripts/deploy-vps.sh` (faz backup e volta atrás sozinho se o build falhar).",
  },
];

export const componentePorId = (id: string) => COMPONENTES.find((c) => c.id === id);

/** Compara o token enviado com ADMIN_TOKEN em tempo constante. Sem ADMIN_TOKEN no servidor, nada é permitido. */
export function tokenAdminValido(enviado: string): boolean {
  const esperado = process.env.ADMIN_TOKEN ?? "";
  if (esperado.length < 12) return false;
  const a = Buffer.from(enviado);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}
