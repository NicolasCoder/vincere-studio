import path from "node:path";
import { readdir, rm, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { projectDir } from "@vincere-studio/providers";

/**
 * Libera espaço em disco depois que um projeto vai pro ar de verdade.
 *
 * Só roda para privacyStatus public/unlisted — nunca para "private", porque um upload privado
 * costuma ser revisão antes de publicar de verdade, e apagar o material ali derrubaria a
 * possibilidade de re-renderizar ou reaplicar a camada visual antes da publicação real.
 *
 * Apaga `scenes/` inteiro (B-roll baixado/gerado — já está queimado no vídeo final, não tem valor
 * depois de publicado) e qualquer arquivo em `renders/`/`visual/` que NÃO seja o exato arquivo que
 * subiu pro YouTube, mantendo esse um caso alguém precise reenviar legenda/thumbnail depois.
 */
export async function cleanupAfterPublish(
  projectId: string,
  publishedAbsPath: string,
  log: (line: string) => Promise<void>,
) {
  let freedBytes = 0;

  const scenesDir = await projectDir(projectId, "scenes");
  if (existsSync(scenesDir)) {
    const files = await readdir(scenesDir).catch(() => []);
    let size = 0;
    for (const f of files) {
      const full = path.join(scenesDir, f);
      size += (await stat(full).catch(() => ({ size: 0 }))).size;
    }
    await rm(scenesDir, { recursive: true, force: true }).catch(() => {});
    freedBytes += size;
  }

  for (const sub of ["renders", "visual"]) {
    const dir = await projectDir(projectId, sub);
    if (!existsSync(dir)) continue;
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (path.resolve(full) === path.resolve(publishedAbsPath)) continue; // mantém o que foi publicado
      const size = entry.isFile() ? (await stat(full).catch(() => ({ size: 0 }))).size : 0;
      await rm(full, { recursive: true, force: true }).catch(() => {});
      freedBytes += size;
    }
  }

  if (freedBytes > 0) {
    await log(`Limpeza pós-publicação: ${(freedBytes / 1024 / 1024).toFixed(1)} MB liberados (scenes/ e renders antigos, mantendo só o que foi publicado).`);
  }
}
