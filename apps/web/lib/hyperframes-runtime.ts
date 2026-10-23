import fs from "node:fs/promises";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { storageRoot } from "@vincere-studio/providers";
import { deveIniciarPreviewLocal, portaAceitaConexao, timeoutConfigMs } from "./hyperframes-autostart";
import { pastaPessoal } from "./pastas";
import { lerAlvoHyperframes, resolverAlvo, type AlvoHyperframes } from "./hyperframes-config";

export interface HfConfigResponse {
  isHyperframes: boolean;
  pid: number;
  projectName: string;
  projectDir: string;
  version: string;
}

export interface WorkspaceProjectItem {
  name: string;
  path: string;
  title: string;
}

export const HF_STORAGE = () => path.join(storageRoot(), "hyperframes");

/** Verifica se um diretório possui pelo menos um subdiretório com index.html. */
export function hasHyperframesProjects(dir: string): boolean {
  if (!dir || !existsSync(dir)) return false;
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name.startsWith("_")) continue;
      if (existsSync(path.join(dir, entry.name, "index.html"))) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Retorna todos os diretórios candidatos onde projetos HyperFrames podem residir.
 * Isso evita que uma pasta `Videos-HF` recém-criada e vazia esconda os projetos reais em `storage/hyperframes/workspace`.
 */
export function resolveCandidateWorkspaceDirs(): string[] {
  const candidates = [
    process.env.HYPERFRAMES_PROJECTS_DIR?.trim(),
    path.join(HF_STORAGE(), "workspace"),
    path.join(pastaPessoal(), "Videos-HF"),
  ].filter((d): d is string => Boolean(d));

  const seen = new Set<string>();
  return candidates.filter((d) => {
    const norm = path.resolve(d).toLowerCase();
    if (seen.has(norm)) return false;
    seen.add(norm);
    return true;
  });
}

/**
 * Escolhe o diretório principal de trabalho priorizando aquele que já possui projetos com index.html.
 */
export function resolveWorkspaceDir(): string {
  const candidates = resolveCandidateWorkspaceDirs();
  for (const dir of candidates) {
    if (hasHyperframesProjects(dir)) {
      return dir;
    }
  }
  if (process.env.HYPERFRAMES_PROJECTS_DIR?.trim() && existsSync(process.env.HYPERFRAMES_PROJECTS_DIR.trim())) {
    return process.env.HYPERFRAMES_PROJECTS_DIR.trim();
  }
  const storageWs = path.join(HF_STORAGE(), "workspace");
  if (existsSync(storageWs)) return storageWs;
  const padrao = path.join(pastaPessoal(), "Videos-HF");
  if (existsSync(padrao)) return padrao;
  return storageWs;
}

/**
 * Lista projetos válidos (com index.html) mesclando todos os diretórios candidatos sem duplicar nomes.
 */
export function listWorkspaceProjects(primaryDir?: string): WorkspaceProjectItem[] {
  const dirs = primaryDir
    ? [primaryDir, ...resolveCandidateWorkspaceDirs().filter((d) => path.resolve(d) !== path.resolve(primaryDir))]
    : resolveCandidateWorkspaceDirs();

  const out: WorkspaceProjectItem[] = [];
  const seenNames = new Set<string>();

  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith(".") || entry.name.startsWith("_")) continue;
        if (seenNames.has(entry.name)) continue;
        const fullDir = path.join(dir, entry.name);
        if (existsSync(path.join(fullDir, "index.html"))) {
          seenNames.add(entry.name);
          out.push({
            name: entry.name,
            path: fullDir,
            title: entry.name,
          });
        }
      }
    } catch {
      // ignora diretório inacessível
    }
  }

  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function buildStarterCompositionHtml(title: string, width = 1080, height = 1920): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=${width}, height=${height}" />
  <title>${title}</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      background: #0a0b10;
      font-family: system-ui, -apple-system, sans-serif;
      color: #f2f3f7;
    }
    #main {
      position: relative;
      width: ${width}px;
      height: ${height}px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: radial-gradient(circle at 50% 35%, rgba(77, 107, 255, 0.22), #0a0b10 70%);
    }
    #hero-card {
      padding: 48px 56px;
      border-radius: 28px;
      background: rgba(20, 22, 31, 0.78);
      border: 1px solid rgba(255, 255, 255, 0.12);
      text-align: center;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6);
    }
    #hero-badge {
      display: inline-block;
      padding: 8px 18px;
      border-radius: 999px;
      background: rgba(77, 107, 255, 0.18);
      color: #8297ff;
      font-size: 20px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 20px;
    }
    #hero-title {
      font-size: 64px;
      font-weight: 800;
      letter-spacing: -0.03em;
      line-height: 1.08;
      margin-bottom: 16px;
    }
    #hero-sub {
      font-size: 26px;
      color: #a4a9b9;
      max-width: 720px;
    }
  </style>
</head>
<body>
  <div id="main" data-composition-id="main" data-width="${width}" data-height="${height}" data-fps="30" data-duration="6">
    <div id="hero-card" data-start="0" data-duration="6" data-track-index="1">
      <div id="hero-badge">Vincere Studio · HyperFrames</div>
      <h1 id="hero-title">${title}</h1>
      <p id="hero-sub">Clique em qualquer elemento e peça ao Agente (Antigravity / Claude) para animar.</p>
    </div>
  </div>
  <script>
    window.__timelines = window.__timelines || {};
    const tl = gsap.timeline({ paused: true });
    tl.fromTo("#hero-card",
      { scale: 0.92, y: 40, opacity: 0 },
      { scale: 1, y: 0, opacity: 1, duration: 0.85, ease: "expo.out" },
      0
    );
    tl.fromTo("#hero-title",
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.65, ease: "power3.out" },
      0.18
    );
    window.__timelines["main"] = tl;
  </script>
</body>
</html>`;
}

/**
 * Garante que exista ao menos um projeto inicial válido no workspace para o HyperFrames nunca travar sem projetos.
 */
export async function ensureStarterProject(workspaceDir: string, defaultName = "referenciamotion-pro"): Promise<WorkspaceProjectItem[]> {
  let projects = listWorkspaceProjects(workspaceDir);
  if (projects.length > 0 && (hasHyperframesProjects(workspaceDir) || projects.some((p) => p.name === defaultName))) {
    return projects;
  }

  const starterDir = path.join(workspaceDir, defaultName);
  await fs.mkdir(path.join(starterDir, "assets"), { recursive: true }).catch(() => {});
  await fs.mkdir(path.join(starterDir, "renders"), { recursive: true }).catch(() => {});
  const indexHtml = path.join(starterDir, "index.html");
  if (!existsSync(indexHtml)) {
    await fs.writeFile(indexHtml, buildStarterCompositionHtml(defaultName, 1080, 1920), "utf8").catch(() => {});
  }
  projects = listWorkspaceProjects(workspaceDir);
  return projects;
}

function findHyperframesMjsInNpxCache(cacheRoot: string): string | null {
  if (!cacheRoot || !existsSync(cacheRoot)) return null;
  try {
    const entries = readdirSync(cacheRoot, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const candidate = path.join(cacheRoot, e.name, "node_modules", "hyperframes", "bin", "hyperframes.mjs");
      if (existsSync(candidate)) return candidate;
    }
  } catch {}
  return null;
}

export function resolveNode22AndHyperframes(): {
  nodeBin: string;
  hfMjs: string | null;
  npxBin: string;
  envPath: string;
} {
  const home = pastaPessoal();
  const nvm22Dir = path.join(home, "AppData", "Local", "nvm", "v22.11.0");
  const node22Exe = path.join(nvm22Dir, "node.exe");
  const npx22Cmd = path.join(nvm22Dir, "npx.cmd");

  const staticCandidates = [
    process.env.APPDATA ? path.join(process.env.APPDATA, "npm", "node_modules", "hyperframes", "bin", "hyperframes.mjs") : "",
    home ? path.join(home, "AppData", "Roaming", "npm", "node_modules", "hyperframes", "bin", "hyperframes.mjs") : "",
    path.resolve(process.cwd(), "..", "..", "node_modules", "hyperframes", "bin", "hyperframes.mjs"),
    path.join(nvm22Dir, "node_modules", "hyperframes", "bin", "hyperframes.mjs"),
    "F:\\npm-cache\\_npx\\702923228c2ce1e6\\node_modules\\hyperframes\\bin\\hyperframes.mjs",
    "F:\\npm-cache\\_npx\\329cd6bfc4591090\\node_modules\\hyperframes\\bin\\hyperframes.mjs",
  ].filter(Boolean);

  let hfMjs = staticCandidates.find((p) => existsSync(p)) ?? null;
  if (!hfMjs) {
    hfMjs =
      findHyperframesMjsInNpxCache("F:\\npm-cache\\_npx") ??
      (process.env.LOCALAPPDATA ? findHyperframesMjsInNpxCache(path.join(process.env.LOCALAPPDATA, "npm-cache", "_npx")) : null);
  }

  const nodeBin = existsSync(node22Exe) ? node22Exe : process.execPath;
  const npxBin = existsSync(npx22Cmd) ? npx22Cmd : "npx";
  const envPath = existsSync(nvm22Dir)
    ? `${nvm22Dir}${path.delimiter}${process.env.PATH || ""}`
    : process.env.PATH || "";

  return { nodeBin, hfMjs, npxBin, envPath };
}

function npxInvocation(npxBin: string, nodeBin: string): { cmd: string; prefix: string[] } {
  if (process.platform !== "win32") return { cmd: npxBin, prefix: [] };
  const cli = path.join(path.dirname(nodeBin), "node_modules", "npm", "bin", "npx-cli.js");
  return existsSync(cli) ? { cmd: nodeBin, prefix: [cli] } : { cmd: npxBin, prefix: [] };
}

export async function getRunningHfConfig(alvo?: AlvoHyperframes): Promise<HfConfigResponse | null> {
  const resolvedAlvo = alvo ?? (await lerAlvoHyperframes());
  for (const baseUrl of resolvedAlvo.urls) {
    try {
      const res = await fetch(`${baseUrl}/__hyperframes_config`, {
        signal: AbortSignal.timeout(timeoutConfigMs()),
        cache: "no-store",
      });
      if (!res.ok) continue;
      const data = (await res.json()) as HfConfigResponse;
      if (data?.isHyperframes) return data;
    } catch {}
  }
  return null;
}

export async function getRunningSelection(projectId: string, alvo?: AlvoHyperframes) {
  const resolvedAlvo = alvo ?? (await lerAlvoHyperframes());
  for (const baseUrl of resolvedAlvo.urls) {
    try {
      const res = await fetch(`${baseUrl}/api/projects/${encodeURIComponent(projectId)}/selection`, {
        signal: AbortSignal.timeout(Math.max(1000, timeoutConfigMs() / 2)),
        cache: "no-store",
      });
      if (!res.ok) continue;
      const data = await res.json();
      return data?.selection ?? null;
    } catch {}
  }
  return null;
}

let bootPromise: Promise<HfConfigResponse | null> | null = null;
let lastBootError: string | null = null;

export function getLastHyperframesBootError(): string | null {
  return lastBootError;
}

export async function ensureHyperframesRunning(
  targetProjectDir: string,
  options?: { forceRestart?: boolean; alvo?: AlvoHyperframes },
): Promise<HfConfigResponse | null> {
  const alvo = options?.alvo ?? (await lerAlvoHyperframes());
  const targetName = path.basename(targetProjectDir);
  const current = await getRunningHfConfig(alvo);
  if (!options?.forceRestart && current && current.projectName === targetName) {
    lastBootError = null;
    return current;
  }

  if (bootPromise) {
    return bootPromise;
  }

  bootPromise = (async () => {
    try {
      lastBootError = null;

      // Se a pasta alvo não tiver index.html, garante um starter válido antes de subir
      const indexHtml = path.join(targetProjectDir, "index.html");
      if (!existsSync(indexHtml)) {
        await fs.mkdir(path.join(targetProjectDir, "assets"), { recursive: true }).catch(() => {});
        await fs.mkdir(path.join(targetProjectDir, "renders"), { recursive: true }).catch(() => {});
        await fs.writeFile(indexHtml, buildStarterCompositionHtml(targetName, 1080, 1920), "utf8").catch(() => {});
      }

      if (current?.pid) {
        try {
          process.kill(current.pid);
        } catch {}
        await new Promise((r) => setTimeout(r, 350));
      }

      const { nodeBin, hfMjs, npxBin, envPath } = resolveNode22AndHyperframes();
      const npx = npxInvocation(npxBin, nodeBin);
      const cmd = hfMjs ? nodeBin : npx.cmd;

      // Se a porta 3010 continuar ocupada (por outro projeto ou processo órfão), executa --kill-all
      // e aguarda a liberação da porta para impedir que o HyperFrames pule silenciosamente para a porta 3011.
      if (!alvo.modoVps && (await portaAceitaConexao(alvo.port))) {
        const killArgs = hfMjs
          ? [hfMjs, "preview", "--kill-all"]
          : [...npx.prefix, "hyperframes", "preview", "--kill-all"];
        await new Promise<void>((resolve) => {
          const killer = spawn(cmd, killArgs, {
            env: { ...process.env, PATH: envPath },
            stdio: "ignore",
            windowsHide: true,
          });
          killer.on("error", () => resolve());
          killer.on("close", () => resolve());
          setTimeout(resolve, 3500);
        });
        for (let w = 0; w < 12; w++) {
          if (!(await portaAceitaConexao(alvo.port))) break;
          await new Promise((r) => setTimeout(r, 250));
        }
      }

      const args = hfMjs
        ? [hfMjs, "preview", targetProjectDir, "--background", "--force-new", "--port", String(alvo.port), "--no-open"]
        : [...npx.prefix, "hyperframes", "preview", targetProjectDir, "--background", "--force-new", "--port", String(alvo.port), "--no-open"];

      let stderrBuf = "";
      const child = spawn(cmd, args, {
        cwd: targetProjectDir,
        env: { ...process.env, PATH: envPath },
        detached: true,
        stdio: ["ignore", "ignore", "pipe"],
        windowsHide: true,
      });

      child.stderr?.on("data", (chunk: Buffer) => {
        if (stderrBuf.length < 2000) stderrBuf += chunk.toString("utf8");
      });

      child.on("error", (err) => {
        lastBootError = `Falha ao iniciar processo HyperFrames: ${err.message}`;
        console.error("[hyperframes] não foi possível iniciar o preview:", err.message);
      });
      child.unref();

      // Aguarda até 10.5s (35 * 300ms) pelo servidor responder em /__hyperframes_config
      for (let i = 0; i < 35; i++) {
        await new Promise((r) => setTimeout(r, 300));
        const cfg = await getRunningHfConfig(alvo);
        if (cfg && cfg.projectName === targetName) {
          lastBootError = null;
          return cfg;
        }
      }

      const finalCfg = await getRunningHfConfig(alvo);
      if (!finalCfg) {
        lastBootError =
          stderrBuf.trim().slice(0, 400) ||
          `O servidor HyperFrames não respondeu na porta ${alvo.port} após iniciar o projeto "${targetName}".`;
      }
      return finalCfg;
    } finally {
      bootPromise = null;
    }
  })();

  return bootPromise;
}

export { deveIniciarPreviewLocal, portaAceitaConexao, resolverAlvo };
