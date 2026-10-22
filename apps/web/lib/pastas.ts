import path from "node:path";

type Ambiente = Record<string, string | undefined>;

// Variáveis de ambiente em vez de `os.homedir()`/`os.tmpdir()` dentro de path.join: a análise de arquivos do
// `next build` (nft) tenta calcular esses valores em tempo de build e falha com "path must be of type string".

/** Pasta pessoal do usuário (USERPROFILE no Windows, HOME no Mac/Linux). */
export function pastaPessoal(env: Ambiente = process.env): string {
  return env.USERPROFILE || env.HOME || "";
}

/** Pasta temporária do sistema. */
export function pastaTemporaria(env: Ambiente = process.env): string {
  return env.TEMP || env.TMP || env.TMPDIR || (process.platform === "win32" ? "C:\\Windows\\Temp" : "/tmp");
}

/** Pasta dos projetos do HyperFrames: HYPERFRAMES_PROJECTS_DIR ou, se não houver, "Videos-HF" na pasta pessoal. */
export function pastaDeProjetosHyperframes(env: Ambiente = process.env): string {
  return env.HYPERFRAMES_PROJECTS_DIR?.trim() || path.join(pastaPessoal(env), "Videos-HF");
}
