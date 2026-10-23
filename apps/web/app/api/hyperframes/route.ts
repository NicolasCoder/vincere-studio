import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createRequest } from "@/lib/claude-inbox";
import { detectLocalAgents, dispatchLocalAgent } from "@/lib/local-agent-runner";
import { deveIniciarPreviewLocal, portaAceitaConexao } from "@/lib/hyperframes-autostart";
import { lerAlvoHyperframes, resolverAlvo, type AlvoHyperframes } from "@/lib/hyperframes-config";
import {
  HF_STORAGE,
  buildStarterCompositionHtml,
  ensureHyperframesRunning,
  ensureStarterProject,
  getLastHyperframesBootError,
  getRunningHfConfig,
  getRunningSelection,
  listWorkspaceProjects,
  resolveWorkspaceDir,
} from "@/lib/hyperframes-runtime";

export const dynamic = "force-dynamic";

let alvo: AlvoHyperframes = resolverAlvo({}, process.env);
async function atualizarAlvo() {
  alvo = await lerAlvoHyperframes();
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

// GET /api/hyperframes
export async function GET(req: Request) {
  await atualizarAlvo();
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
  const requestedProject = params.get("project") || "";
  const autoStart = params.get("autoStart") !== "false";
  const forceRestart = params.get("forceRestart") === "true";

  let localProjects = listWorkspaceProjects(workspaceDir);
  if (localProjects.length === 0 && autoStart) {
    localProjects = await ensureStarterProject(workspaceDir);
  }

  let cfg = await getRunningHfConfig(alvo);

  // Auto-inicia o HyperFrames localmente ao abrir a tela /studio
  // No modo "vps" o preview roda no servidor (túnel na porta 3010); não há o que iniciar neste PC.
  const modoVps = alvo.modoVps;
  const portaAberta = cfg ? true : await portaAceitaConexao(alvo.port);
  const deveSubir =
    (!modoVps && forceRestart && localProjects.length > 0) ||
    deveIniciarPreviewLocal({ rodando: Boolean(cfg), portaAberta, autoStart, modoVps, temProjetos: localProjects.length > 0 }) ||
    // Se autoStart=true foi pedido explicitamente na tela /studio e /__hyperframes_config não respondeu mesmo com porta aberta (processo travado):
    (!cfg && autoStart && !modoVps && localProjects.length > 0);

  if (deveSubir) {
    const target =
      localProjects.find((p) => p.name === requestedProject) ??
      localProjects.find((p) => p.name === "referenciamotion-pro") ??
      localProjects[0];
    if (target) {
      cfg = await ensureHyperframesRunning(target.path, { forceRestart, alvo });
    }
  }

  const activeProject = cfg?.projectName || requestedProject || localProjects[0]?.name || "referenciamotion-pro";
  const activeProjectDir =
    cfg?.projectDir ||
    localProjects.find((p) => p.name === activeProject)?.path ||
    path.join(workspaceDir, activeProject);

  const selection = cfg ? await getRunningSelection(cfg.projectName, alvo) : null;
  const agents = detectLocalAgents();

  return NextResponse.json({
    ok: true,
    running: Boolean(cfg),
    port: alvo.port,
    modoHyperframes: alvo.modo,
    // Endereço que o navegador deve abrir quando o preview roda em outro computador; null = este computador.
    hfBaseUrl: alvo.modo === "remoto" ? alvo.url : null,
    activeProject,
    activeProjectDir,
    projects: localProjects,
    baseDir: workspaceDir,
    selection,
    agents,
    bootError: !cfg ? getLastHyperframesBootError() : null,
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
  engine: z.enum(["auto", "agy", "claude", "codex", "hermes", "inbox"]).optional(),
});

const decisaoSchema = z.object({
  action: z.literal("decidir"),
  projeto: z.string().regex(NOME_RE),
  arquivo: z.string().regex(ARQ_RE),
  decisao: z.enum(["aprovado", "ajustes"]),
  nota: z.string().max(4000).optional(),
});

export async function POST(req: Request) {
  await atualizarAlvo();
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "Payload inválido" }, { status: 400 });
  }

  // 1. Trocar de projeto ativo no HyperFrames Studio (reinicia na porta 3010 apontando para o projeto escolhido)
  if (body.action === "switch") {
    const parsed = switchSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ ok: false, error: "Projeto inválido" }, { status: 400 });
    const workspaceDir = resolveWorkspaceDir();
    const allProjects = listWorkspaceProjects(workspaceDir);
    const found = allProjects.find((p) => p.name === parsed.data.project);
    const targetDir = found?.path ?? path.join(workspaceDir, parsed.data.project);
    if (!existsSync(path.join(targetDir, "index.html"))) {
      return NextResponse.json({ ok: false, error: "Projeto não encontrado no workspace local" }, { status: 404 });
    }
    const cfg = await ensureHyperframesRunning(targetDir, { alvo });
    return NextResponse.json({
      ok: true,
      running: Boolean(cfg),
      activeProject: cfg?.projectName ?? parsed.data.project,
      activeProjectDir: targetDir,
    });
  }

  // 1.1 Apagar projeto do workspace local (Videos-HF / storage/hyperframes/workspace)
  if (body.action === "delete") {
    const parsed = z.object({ action: z.literal("delete"), project: z.string().regex(NOME_RE) }).safeParse(body);
    if (!parsed.success) return NextResponse.json({ ok: false, error: "Projeto inválido" }, { status: 400 });
    const workspaceDir = resolveWorkspaceDir();
    const allProjects = listWorkspaceProjects(workspaceDir);
    const found = allProjects.find((p) => p.name === parsed.data.project);
    const targetDir = found?.path ?? path.join(workspaceDir, parsed.data.project);
    if (existsSync(targetDir)) {
      await fs.rm(targetDir, { recursive: true, force: true }).catch(() => {});
    }
    const remaining = listWorkspaceProjects(workspaceDir);
    return NextResponse.json({ ok: true, projects: remaining });
  }

  // 2. Criar novo projeto localmente no disco + abrir no Studio + acionar Agente se tiver prompt
  if (body.action === "create") {
    const parsed = createProjectSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ ok: false, error: "Dados inválidos para criar projeto" }, { status: 400 });
    const { name, width, height, prompt, engine } = parsed.data;
    const workspaceDir = resolveWorkspaceDir();
    const newDir = path.join(workspaceDir, name);

    await fs.mkdir(path.join(newDir, "assets"), { recursive: true });
    await fs.mkdir(path.join(newDir, "renders"), { recursive: true });

    const indexHtml = path.join(newDir, "index.html");
    if (!existsSync(indexHtml)) {
      await fs.writeFile(indexHtml, buildStarterCompositionHtml(name, width, height), "utf8");
    }

    const cfg = await ensureHyperframesRunning(newDir, { alvo });

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
  const alvoPrevia = path.join(HF_STORAGE(), projeto, "previas", arquivo);
  if (!(await fs.stat(alvoPrevia).catch(() => null))) {
    return NextResponse.json({ ok: false, error: "Prévia não encontrada" }, { status: 404 });
  }

  const registro = { decisao, nota: nota?.trim() || undefined, em: new Date().toISOString() };
  await fs.writeFile(`${alvoPrevia}.decisao.json`, JSON.stringify(registro, null, 2), "utf8");

  const workspaceDir = resolveWorkspaceDir();
  const found = listWorkspaceProjects(workspaceDir).find((p) => p.name === projeto);
  const projectDir = found?.path ?? path.join(workspaceDir, projeto);
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
