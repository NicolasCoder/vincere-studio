import path from "node:path";
import { mkdir } from "node:fs/promises";

/** Raiz da mídia. STORAGE_DIR é relativa à raiz do monorepo (apps/* rodam 2 níveis abaixo). */
export function storageRoot() {
  const rel = process.env.STORAGE_DIR || "./storage";
  if (path.isAbsolute(rel)) return rel;
  const cwd = process.cwd();
  const root = /[\\/]apps[\\/](web|worker)$/.test(cwd) ? path.resolve(cwd, "../..") : cwd;
  return path.resolve(root, rel);
}
export async function projectDir(projectId: string, sub?: string) {
  const dir = path.join(storageRoot(), "projects", projectId, sub ?? "");
  await mkdir(dir, { recursive: true });
  return dir;
}
/** Caminho relativo à raiz de storage (o que gravamos no banco). */
export const relPath = (abs: string) => path.relative(storageRoot(), abs).split(path.sep).join("/");
export const absPath = (rel: string) => path.join(storageRoot(), rel);
