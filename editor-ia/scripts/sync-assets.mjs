/**
 * Copia os assets DVP de Edição/Assets/props para public/props.
 *
 * A origem é `Edição/Assets/props` (versionada); `public/props` é cópia derivada, fora do git,
 * porque o Remotion só enxerga o que está em public/. Rode após clonar ou depois de gerar
 * assets novos.
 */
import { cp, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, "..", "..", "Edição", "Assets", "props");
const dest = path.resolve(here, "..", "public", "props");

if (!existsSync(src)) {
  console.error(`Origem não encontrada: ${src}`);
  process.exit(1);
}
await mkdir(dest, { recursive: true });
await cp(src, dest, { recursive: true });
console.log(`assets sincronizados: ${src} -> ${dest}`);
