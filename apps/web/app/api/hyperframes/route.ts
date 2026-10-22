import fs from "node:fs/promises";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { NextResponse } from "next/server";
import { z } from "zod";
import { storageRoot } from "@vincere-studio/providers";
import { createRequest } from "@/lib/claude-inbox";
import { detectLocalAgents, dispatchLocalAgent } from "@/lib/local-agent-runner";

export const dynamic = "force-dynamic";

const HYPERFRAMES_PORT = Number(new URL(process.env.HYPERFRAMES_URL || "http://127.0.0.1:3010").port || 3010);
const HF_CANDIDATE_URLS = Array.from(
  new Set([
    `http://127.0.0.1:${HYPERFRAMES_PORT}`,
    `http://localhost:${HYPERFRAMES_PORT}`,
    process.env.HYPERFRAMES_URL || `http://127.0.0.1:${HYPERFRAMES_PORT}`,
  ]),
);
const HF_STORAGE = () => path.join(storageRoot(), "hyperframes");

function resolveWorkspaceDir(): string {
  if (process.env.HYPERFRAMES_PROJECTS_DIR && existsSync(process.env.HYPERFRAMES_PROJECTS_DIR)) {
    return process.env.HYPERFRAMES_PROJECTS_DIR;
  }
  if (existsSync("C:\\Users\\Igor\\Videos-HF")) {
    return "C:\\Users\\Igor\\Videos-HF";
  }
  return path.join(HF_STORAGE(), "workspace");
}

function resolveNode22AndHyperframes(): {
  nodeBin: string;
  hfMjs: string | null;
  npxBin: string;
  envPath: string;
} {
  const nvm22Dir = "C:\\Users\\Nicolas\\AppData\\Local\\nvm\\v22.11.0";
  const node22Exe = path.join(nvm22Dir, "node.exe");
  const npx22Cmd = path.join(nvm22Dir, "npx.cmd");

  const hfCandidates = [
    "F:\\npm-cache\\_npx\\702923228c2ce1e6\\node_modules\\hyperframes\\bin\\hyperframes.mjs",
    "F:\\npm-cache\\_npx\\329cd6bfc4591090\\node_modules\\hyperframes\\bin\\hyperframes.mjs",
  ];
  const hfMjs = hfCandidates.find((p) => existsSync(p)) ?? null;
  const nodeBin = existsSync(node22Exe) ? node22Exe : process.execPath;
  const npxBin = existsSync(npx22Cmd) ? npx22Cmd : "npx";
  const envPath = existsSync(nvm22Dir)
    ? `${nvm22Dir};${process.env.PATH || ""}`
    : process.env.PATH || "";

  return { nodeBin, hfMjs, npxBin, envPath };
}

// No Windows "npx" é npx.cmd, e o Node recusa executar .cmd sem shell (ENOENT/EINVAL). O npx-cli.js que
// acompanha o npm roda direto com o node, sem shell, então nenhum nome de pasta vira comando.
function npxInvocation(npxBin: string, nodeBin: string): { cmd: string; prefix: string[] } {
  if (process.platform !== "win32") return { cmd: npxBin, prefix: [] };
  const cli = path.join(path.dirname(nodeBin), "node_modules", "npm", "bin", "npx-cli.js");
  return existsSync(cli) ? { cmd: nodeBin, prefix: [cli] } : { cmd: npxBin, prefix: [] };
}

interface HfConfigResponse {
  isHyperframes: boolean;
  pid: number;
  projectName: string;
  projectDir: string;
  version: string;
}

async function getRunningHfConfig(): Promise<HfConfigResponse | null> {
  for (const baseUrl of HF_CANDIDATE_URLS) {
    try {
      const res = await fetch(`${baseUrl}/__hyperframes_config`, {
        signal: AbortSignal.timeout(1200),
        cache: "no-store",
      });
      if (!res.ok) continue;
      const data = (await res.json()) as HfConfigResponse;
      if (data?.isHyperframes) return data;
    } catch {}
  }
  return null;
}

async function getRunningSelection(projectId: string) {
  for (const baseUrl of HF_CANDIDATE_URLS) {
    try {
      const res = await fetch(`${baseUrl}/api/projects/${encodeURIComponent(projectId)}/selection`, {
        signal: AbortSignal.timeout(1000),
        cache: "no-store",
      });
      if (!res.ok) continue;
      const data = await res.json();
      return data?.selection ?? null;
    } catch {}
  }
  return null;
}

function listWorkspaceProjects(workspaceDir: string): Array<{ name: string; path: string; title: string }> {
  if (!existsSync(workspaceDir)) return [];
  try {
    const entries = readdirSync(workspaceDir, { withFileTypes: true });
    const out: Array<{ name: string; path: string; title: string }> = [];
    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name.startsWith("_")) continue;
      const fullDir = path.join(workspaceDir, entry.name);
      if (existsSync(path.join(fullDir, "index.html"))) {
        out.push({
          name: entry.name,
          path: fullDir,
          title: entry.name,
        });
      }
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

let bootPromise: Promise<HfConfigResponse | null> | null = null;

async function ensureHyperframesRunning(targetProjectDir: string): Promise<HfConfigResponse | null> {
  const targetName = path.basename(targetProjectDir);
  const current = await getRunningHfConfig();
  if (current && current.projectName === targetName) {
    return current;
  }

  if (bootPromise) {
    return bootPromise;
  }

  bootPromise = (async () => {
    try {
      // Se já havia outro projeto ocupando a porta 3010, encerra o processo anterior
      if (current?.pid) {
        try {
          process.kill(current.pid);
        } catch {}
        await new Promise((r) => setTimeout(r, 450));
      }

      const { nodeBin, hfMjs, npxBin, envPath } = resolveNode22AndHyperframes();
      const npx = npxInvocation(npxBin, nodeBin);
      const cmd = hfMjs ? nodeBin : npx.cmd;
      const args = hfMjs
        ? [hfMjs, "preview", targetProjectDir, "--background", "--force-new", "--port", String(HYPERFRAMES_PORT), "--no-open"]
        : [...npx.prefix, "hyperframes", "preview", targetProjectDir, "--background", "--force-new", "--port", String(HYPERFRAMES_PORT), "--no-open"];

      const child = spawn(cmd, args, {
        cwd: targetProjectDir,
        env: { ...process.env, PATH: envPath },
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      });
      // Sem este ouvinte, um ENOENT vira uncaughtException e derruba o servidor inteiro.
      child.on("error", (err) => console.error("[hyperframes] não foi possível iniciar o preview:", err.message));
      child.unref();

      // Aguarda até 6s pelo servidor responder em /__hyperframes_config
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 300));
        const cfg = await getRunningHfConfig();
        if (cfg && cfg.projectName === targetName) {
          return cfg;
        }
      }
      return await getRunningHfConfig();
    } finally {
      bootPromise = null;
    }
  })();

  return bootPromise;
}

const NOME_RE = /^[\p{L}\p{N}_-]{1,80}$/u;
const ARQ_RE = /^previa-[\w-]+\.mp4$/;

async function listarPrevias(projeto: string) {
  const dir = path.join(HF_STORAGE(), projeto, "previas");
  const nomes = (await fs.readdir(dir).catch(() => [] as string[])).filter((n) => ARQ_RE.test(n));
  const previas = await Promise.all(
    nomes.map(async (arquivo) => {
      const st = await fs.stat(path.join(dir, arquivo));
      const decisao = await fs
        .readFile(path.join(dir, `${arquivo}.decisao.json`), "utf8")
        .then((t) => JSON.parse(t) as { decisao: string; nota?: string; em: string })
        .catch(() => null);
      return {
        arquivo,
        url: `/api/media/hyperframes/${encodeURIComponent(projeto)}/previas/${arquivo}`,
        criadaEm: st.mtime.toISOString(),
        tamanhoMB: Math.round((st.size / 1024 / 1024) * 10) / 10,
        decisao,
      };
    }),
  );
  return previas.sort((a, b) => b.criadaEm.localeCompare(a.criadaEm));
}

async function listarTemplates() {
  const dir = path.join(HF_STORAGE(), "templates");
  const nomes = (await fs.readdir(dir).catch(() => [] as string[])).filter((n) => n.endsWith(".json"));
  const itens = await Promise.all(
    nomes.map((n) =>
      fs
        .readFile(path.join(dir, n), "utf8")
        .then((t) => JSON.parse(t.replace(/^\uFEFF/, "")) as { nome: string; nicho?: string; origem?: string; criadoEm?: string; formato?: string })
        .catch(() => null),
    ),
  );
  return itens.filter((t): t is NonNullable<typeof t> => !!t?.nome);
}

function buildStarterCompositionHtml(title: string, width: number, height: number): string {
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

// GET /api/hyperframes
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const action = params.get("action");
  if (action === "previas") {
    const projeto = params.get("projeto") ?? "";
    if (!NOME_RE.test(projeto)) return NextResponse.json({ ok: false, error: "Projeto inválido" }, { status: 400 });
    return NextResponse.json({ ok: true, previas: await listarPrevias(projeto) });
  }
  if (action === "templates") {
    return NextResponse.json({ ok: true, templates: await listarTemplates() });
  }

  const workspaceDir = resolveWorkspaceDir();
  await fs.mkdir(workspaceDir, { recursive: true }).catch(() => {});
  const localProjects = listWorkspaceProjects(workspaceDir);
  const requestedProject = params.get("project") || "";
  const autoStart = params.get("autoStart") !== "false";

  let cfg = await getRunningHfConfig();

  // Auto-inicia o HyperFrames localmente ao abrir a tela /studio
  // No modo "vps" o preview roda no servidor (túnel na porta 3010); não há o que iniciar neste PC.
  const modoVps = process.env.HYPERFRAMES_MODO?.trim().toLowerCase() === "vps";
  if (!cfg && autoStart && !modoVps && localProjects.length > 0) {
    const target =
      localProjects.find((p) => p.name === requestedProject) ??
      localProjects.find((p) => p.name === "referenciamotion-pro") ??
      localProjects[0];
    if (target) {
      cfg = await ensureHyperframesRunning(target.path);
    }
  }

  const activeProject = cfg?.projectName || requestedProject || localProjects[0]?.name || "referenciamotion-pro";
  const activeProjectDir =
    cfg?.projectDir ||
    localProjects.find((p) => p.name === activeProject)?.path ||
    path.join(workspaceDir, activeProject);

  const selection = cfg ? await getRunningSelection(cfg.projectName) : null;
  const agents = detectLocalAgents();

  return NextResponse.json({
    ok: true,
    running: Boolean(cfg),
    port: HYPERFRAMES_PORT,
    activeProject,
    activeProjectDir,
    projects: localProjects,
    baseDir: workspaceDir,
    selection,
    agents,
  });
}

const switchSchema = z.object({
  action: z.literal("switch"),
  project: z.string().regex(NOME_RE),
});

const createProjectSchema = z.object({
  action: z.literal("create"),
  name: z.string().regex(NOME_RE),
  width: z.number().int().min(320).max(3840).default(1080),
  height: z.number().int().min(320).max(3840).default(1920),
  template: z.string().optional(),
  prompt: z.string().optional(),
  engine: z.enum(["auto", "agy", "claude", "hermes", "inbox"]).optional(),
});

const decisaoSchema = z.object({
  action: z.literal("decidir"),
  projeto: z.string().regex(NOME_RE),
  arquivo: z.string().regex(ARQ_RE),
  decisao: z.enum(["aprovado", "ajustes"]),
  nota: z.string().max(4000).optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "Payload inválido" }, { status: 400 });
  }

  // 1. Trocar de projeto ativo no HyperFrames Studio (reinicia na porta 3010 apontando para o projeto escolhido)
  if (body.action === "switch") {
    const parsed = switchSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ ok: false, error: "Projeto inválido" }, { status: 400 });
    const workspaceDir = resolveWorkspaceDir();
    const targetDir = path.join(workspaceDir, parsed.data.project);
    if (!existsSync(path.join(targetDir, "index.html"))) {
      return NextResponse.json({ ok: false, error: "Projeto não encontrado no workspace local" }, { status: 404 });
    }
    const cfg = await ensureHyperframesRunning(targetDir);
    return NextResponse.json({
      ok: true,
      running: Boolean(cfg),
      activeProject: cfg?.projectName ?? parsed.data.project,
      activeProjectDir: targetDir,
    });
  }

  // 2. Criar novo projeto localmente no disco + abrir no Studio + acionar Agente se tiver prompt
  if (body.action === "create") {
    const parsed = createProjectSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ ok: false, error: "Dados inválidos para criar projeto" }, { status: 400 });
    const { name, width, height, prompt, engine } = parsed.data;
    const workspaceDir = resolveWorkspaceDir();
    const newDir = path.join(workspaceDir, name);

    await fs.mkdir( path.join(newDir, "assets"), { recursive: true });
    await fs.mkdir( path.join(newDir, "renders"), { recursive: true });

    const indexHtml = path.join(newDir, "index.html");
    if (!existsSync(indexHtml)) {
      await fs.writeFile(indexHtml, buildStarterCompositionHtml(name, width, height), "utf8");
    }

    const cfg = await ensureHyperframesRunning(newDir);

    let agentRequestId: string | undefined;
    if (prompt && prompt.trim().length >= 3) {
      const reqItem = await createRequest({
        pedido: prompt.trim(),
        pagina: "/studio",
        projetoHf: name,
      });
      agentRequestId = reqItem.id;
      await dispatchLocalAgent({
        requestId: reqItem.id,
        pedido: prompt.trim(),
        engine: engine ?? "auto",
        projectHf: name,
        projectDir: newDir,
        pagina: "/studio",
      });
    }

    return NextResponse.json({
      ok: true,
      running: Boolean(cfg),
      project: name,
      projectDir: newDir,
      agentRequestId,
      projects: listWorkspaceProjects(workspaceDir),
    });
  }

  // 3. Decisão sobre prévia (aprovado / ajustes)
  const parsed = decisaoSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Dados inválidos" }, { status: 400 });
  const { projeto, arquivo, decisao, nota } = parsed.data;
  const alvo = path.join(HF_STORAGE(), projeto, "previas", arquivo);
  if (!(await fs.stat(alvo).catch(() => null))) {
    return NextResponse.json({ ok: false, error: "Prévia não encontrada" }, { status: 404 });
  }

  const registro = { decisao, nota: nota?.trim() || undefined, em: new Date().toISOString() };
  await fs.writeFile(`${alvo}.decisao.json`, JSON.stringify(registro, null, 2), "utf8");

  const workspaceDir = resolveWorkspaceDir();
  const projectDir = path.join(workspaceDir, projeto);
  const pedido =
    decisao === "aprovado"
      ? `Prévia ${arquivo} do projeto ${projeto} APROVADA. Faça o render final (npx hyperframes render) em ${projectDir}\\renders.`
      : `Ajustes pedidos na prévia ${arquivo} do projeto ${projeto}: ${registro.nota ?? "(sem nota)"}. Aplique na composição ${projectDir}\\index.html.`;
  const item = await createRequest({ pedido, pagina: "/studio", projetoHf: projeto });

  await dispatchLocalAgent({
    requestId: item.id,
    pedido,
    engine: "auto",
    projectHf: projeto,
    projectDir,
    pagina: "/studio",
  });

  return NextResponse.json({ ok: true, registro, pedidoId: item.id });
}
