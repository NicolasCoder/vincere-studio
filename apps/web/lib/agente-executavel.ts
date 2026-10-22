import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

// Localizar e preparar os executáveis dos agentes de IA (Claude Code, Antigravity, Codex...) em qualquer
// sistema. No Windows, `claude` costuma ser um atalho .cmd do npm, e o Node recusa executar .cmd sem
// shell; aqui o atalho é traduzido para o executável de verdade, sem passar por shell.

type Ambiente = Record<string, string | undefined>;

export interface ComandoPronto {
  command: string;
  /** Argumentos que precisam vir antes dos do chamador (ex.: o script .js quando o alvo é um script Node). */
  prefixo: string[];
}

/** Procura `nomes` nas pastas do PATH (com PATHEXT no Windows) e nos caminhos extras; devolve o primeiro que existe. */
export function acharExecutavel(
  nomes: string[],
  extras: Array<string | undefined> = [],
  env: Ambiente = process.env,
  plataforma: NodeJS.Platform = process.platform,
  existe: (p: string) => boolean = existsSync,
): string | null {
  for (const extra of extras) if (extra && existe(extra)) return extra;
  const sep = plataforma === "win32" ? ";" : ":";
  const pastas = (env.PATH ?? env.Path ?? "").split(sep).filter(Boolean);
  const exts = plataforma === "win32" ? ["", ...(env.PATHEXT ?? ".EXE;.CMD;.BAT").toLowerCase().split(";").filter(Boolean)] : [""];
  const join = (...partes: string[]) => (plataforma === "win32" ? path.win32.join(...partes) : path.posix.join(...partes));
  for (const pasta of pastas) {
    for (const nome of nomes) {
      for (const ext of exts) {
        const candidato = join(pasta, nome + ext);
        if (existe(candidato)) return candidato;
      }
    }
  }
  return null;
}

/**
 * Lê um atalho .cmd gerado pelo npm e devolve o alvo real: o `.exe` direto, ou o `node` + o script `.js`.
 * Retorna null se não reconhecer o formato (aí o chamador avisa em vez de falhar com um erro obscuro).
 */
export function resolverAtalhoNpm(
  conteudoCmd: string,
  caminhoCmd: string,
  node: string = process.execPath,
): ComandoPronto | null {
  // Última linha de execução do atalho: "%dp0%\node_modules\...\alvo.ext"  %*
  const linhas = conteudoCmd.split(/\r?\n/).filter((l) => /%dp0%|%~dp0/i.test(l) && /node_modules/i.test(l));
  const alvo = linhas.map((l) => /"%~?dp0%?\\?([^"]+)"/i.exec(l)?.[1]).filter(Boolean).pop();
  if (!alvo) return null;
  const real = path.win32.join(path.win32.dirname(caminhoCmd), alvo.replace(/^[\\/]+/, ""));
  const ext = path.win32.extname(real).toLowerCase();
  if (ext === ".exe" || ext === ".com") return { command: real, prefixo: [] };
  if ([".js", ".mjs", ".cjs"].includes(ext)) return { command: node, prefixo: [real] };
  return null;
}

/** Devolve o comando executável sem shell, ou null se for um .cmd/.bat que não dá para traduzir. */
export function prepararExecutavel(
  bin: string,
  plataforma: NodeJS.Platform = process.platform,
  ler: (p: string) => string = (p) => readFileSync(p, "utf8"),
): ComandoPronto | null {
  if (plataforma !== "win32" || !/\.(cmd|bat)$/i.test(bin)) return { command: bin, prefixo: [] };
  try {
    return resolverAtalhoNpm(ler(bin), bin);
  } catch {
    return null;
  }
}
