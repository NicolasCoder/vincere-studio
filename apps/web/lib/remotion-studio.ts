import path from "node:path";
import { spawn } from "node:child_process";

export const STUDIO_URL = "http://localhost:3001";

/** editor-ia é irmão de apps/web na raiz do monorepo — mesmo cálculo de storageRoot() em @docupulse/providers. */
export function editorIaDir() {
  const cwd = process.cwd();
  const root = /[\\/]apps[\\/]web$/.test(cwd) ? path.resolve(cwd, "../..") : cwd;
  return path.resolve(root, "editor-ia");
}

async function estaNoAr() {
  try {
    const res = await fetch(STUDIO_URL, { signal: AbortSignal.timeout(800) });
    return res.ok || res.status < 500; // Remotion Studio responde HTML mesmo em rotas internas
  } catch {
    return false;
  }
}

/**
 * Garante que o Remotion Studio está no ar, subindo o processo se preciso.
 *
 * `--port=3001` fixo: é a mesma porta que o abrir-remotion.bat usa, pra sempre bater com
 * STUDIO_URL aqui — sem isso, cada um poderia subir numa porta livre diferente e um dos dois
 * ficaria órfão. Compartilhado entre a rota genérica (abrir o Studio como está) e a que leva um
 * projeto específico, porque as duas precisam do mesmo "está no ar? senão, suba".
 */
export async function ensureRemotionStudio(): Promise<"already-running" | "started" | "starting"> {
  if (await estaNoAr()) return "already-running";

  const child = spawn("npx", ["remotion", "studio", "--port=3001", "--no-open"], {
    cwd: editorIaDir(),
    detached: true,
    stdio: "ignore",
    shell: true,
  });
  child.unref();

  // Espera curta pra dar tempo do bundler subir antes do botão abrir a aba — sem isso a aba nova
  // carrega "conexão recusada" no primeiro segundo e o usuário acha que quebrou.
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await estaNoAr()) return "started";
  }
  return "starting";
}
