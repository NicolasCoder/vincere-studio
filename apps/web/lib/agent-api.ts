import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@vincere-studio/db";
import { storageRoot } from "@vincere-studio/providers";
import { requisicaoLocal } from "./acesso-local";
import { pastaDeProjetosHyperframes } from "./pastas";
import { createRequest } from "./claude-inbox";

export interface AgentNextAction {
  acao: string;
  titulo: string;
  disponivel: boolean;
  motivoBloqueio?: string;
  metodo: "POST";
  endpoint: string;
  payloadExemplo: Record<string, unknown>;
}

export interface ProjectAgentState {
  projectId: string;
  title: string;
  format: string;
  niche: string;
  stage: string;
  status: string;
  etapasConcluidas: {
    ideation: boolean;
    script: boolean;
    voice: boolean;
    captions: boolean;
    scenes: boolean;
    broll: boolean;
    editPlan: boolean;
    render: boolean;
    renderApproved: boolean;
    hyperframesExported: boolean;
    published: boolean;
  };
  metricas: {
    totalIdeias: number;
    ideiaSelecionadaId: string | null;
    ideiaSelecionadaTitulo: string | null;
    scriptId: string | null;
    scriptVersion: number | null;
    totalAtos: number;
    totalPalavrasRoteiro: number;
    duracaoEstimadaSeg: number;
    atosComVoz: number;
    duracaoVozTotalMs: number;
    atosComLegendaAlinhada: number;
    totalCenas: number;
    cenasComMidiaPronta: number;
    cenasComArquivoExistente: number;
    insercoesPlanoEdicao: number;
    totalRenders: number;
    ultimoRenderPath: string | null;
    ultimoRenderRevisao: string | null;
    hyperframesSlug: string;
    hyperframesDir: string;
    jobsAtivos: Array<{ id: string; type: string; status: string; progress: number; message: string | null }>;
  };
  pendencias: string[];
  proximasAcoes: AgentNextAction[];
}

function mesmoToken(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/**
 * Verifica autorização para chamadas da API de agente (/api/v1/*).
 * - Na própria máquina (ou túnel SSH do dono): liberado. "Local" = Host de loopback e sem a marca do lan-proxy
 *   (x-vincere-origem); só o Host não basta, ver lib/acesso-local.ts.
 * - Pela rede: aceita Authorization: Bearer <VINCERE_AGENT_TOKEN | ADMIN_TOKEN | LAN_PIN>
 *   ou cabeçalho x-vincere-token.
 */
export function checkAgentAuth(req: Request): NextResponse | null {
  if (requisicaoLocal(req.headers)) return null;

  const authHeader = req.headers.get("authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const headerToken = req.headers.get("x-vincere-token")?.trim() ?? "";
  const provided = bearer || headerToken;

  const validTokens = [
    process.env.VINCERE_AGENT_TOKEN,
    process.env.ADMIN_TOKEN,
    process.env.LAN_PIN,
  ].filter((t): t is string => Boolean(t && t.trim().length > 0));

  if (provided && validTokens.some((t) => mesmoToken(t, provided))) {
    return null;
  }

  return NextResponse.json(
    {
      ok: false,
      error: {
        codigo: "NAO_AUTORIZADO",
        mensagem: "Acesso externo à API de agentes exige token.",
        comoResolver: "Envie o cabeçalho Authorization: Bearer <VINCERE_AGENT_TOKEN> ou acesse via localhost.",
      },
    },
    { status: 401 },
  );
}

export function slugifyProjectTitle(title: string): string {
  return (
    title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 42) || "projeto-hf"
  );
}

function resolveSceneDiskPath(filePath: string | null | undefined): string | null {
  if (!filePath) return null;
  if (path.isAbsolute(filePath)) return filePath;
  return path.join(storageRoot(), filePath);
}

export async function computeProjectAgentState(projectId: string): Promise<ProjectAgentState | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      ideas: { orderBy: { createdAt: "desc" } },
      scripts: {
        orderBy: { version: "desc" },
        take: 1,
        include: {
          blocks: {
            orderBy: { order: "asc" },
            include: {
              voiceTracks: {
                orderBy: { createdAt: "desc" },
                take: 1,
                include: { captions: { take: 1 } },
              },
              scenes: { orderBy: { order: "asc" } },
            },
          },
        },
      },
      renderJobs: { orderBy: [{ revision: "desc" }, { startedAt: "desc" }], take: 5 },
      publications: { orderBy: { publishedAt: "desc" }, take: 3 },
      jobs: {
        where: { status: { in: ["QUEUED", "RUNNING"] } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!project) return null;

  const editPlan = await prisma.editPlan.findFirst({
    where: { projectId },
    orderBy: { version: "desc" },
  });

  const selectedIdea = project.ideas.find((i) => i.selected) ?? project.ideas[0] ?? null;
  const latestScript = project.scripts[0] ?? null;
  const blocks = latestScript?.blocks ?? [];

  let atosComVoz = 0;
  let duracaoVozTotalMs = 0;
  let atosComLegendaAlinhada = 0;
  let totalCenas = 0;
  let cenasComMidiaPronta = 0;
  let cenasComArquivoExistente = 0;

  for (const b of blocks) {
    const track = b.voiceTracks[0];
    if (track && track.durationMs > 0) {
      atosComVoz += 1;
      duracaoVozTotalMs += track.durationMs;
      const cap = track.captions[0];
      if (cap) {
        try {
          const words = JSON.parse(cap.words);
          if (Array.isArray(words) && words.length > 0) {
            atosComLegendaAlinhada += 1;
          }
        } catch {}
      }
    }
    for (const sc of b.scenes) {
      totalCenas += 1;
      if (sc.status === "READY" && sc.filePath) {
        cenasComMidiaPronta += 1;
        const disk = resolveSceneDiskPath(sc.filePath);
        if (disk && existsSync(disk)) {
          cenasComArquivoExistente += 1;
        }
      }
    }
  }

  const latestRender = project.renderJobs.find((r) => Boolean(r.outputPath)) ?? project.renderJobs[0] ?? null;
  const latestPub = project.publications[0] ?? null;
  const hfSlug = slugifyProjectTitle(project.title);
  const hfDir = path.join(pastaDeProjetosHyperframes(), hfSlug);
  const hfExported = existsSync(path.join(hfDir, "index.html"));

  const etapasConcluidas = {
    ideation: Boolean(selectedIdea),
    script: blocks.length > 0,
    voice: blocks.length > 0 && atosComVoz === blocks.length,
    captions: blocks.length > 0 && atosComLegendaAlinhada === blocks.length,
    scenes: totalCenas > 0,
    broll: totalCenas > 0 && cenasComMidiaPronta === totalCenas && cenasComArquivoExistente === totalCenas,
    editPlan: Boolean(editPlan && editPlan.insertions > 0),
    render: Boolean(latestRender?.outputPath),
    renderApproved: latestRender?.reviewStatus === "APPROVED",
    hyperframesExported: hfExported,
    published: Boolean(latestPub?.videoId || project.status === "PUBLISHED"),
  };

  const pendencias: string[] = [];
  if (!etapasConcluidas.ideation) pendencias.push("Nenhuma ideia criada ou selecionada.");
  if (!etapasConcluidas.script) pendencias.push("Falta roteiro em atos/blocos.");
  if (etapasConcluidas.script && !etapasConcluidas.voice) {
    pendencias.push(`Narração incompleta (${atosComVoz}/${blocks.length} atos com áudio).`);
  }
  if (etapasConcluidas.voice && !etapasConcluidas.captions) {
    pendencias.push(`Legendas por palavra pendentes (${atosComLegendaAlinhada}/${blocks.length} atos alinhados).`);
  }
  if (etapasConcluidas.script && !etapasConcluidas.scenes) {
    pendencias.push("Cenas visuais ainda não foram planejadas.");
  }
  if (etapasConcluidas.scenes && !etapasConcluidas.broll) {
    pendencias.push(
      `Mídia das cenas incompleta (${cenasComArquivoExistente}/${totalCenas} cenas com arquivo válido no disco).`,
    );
  }
  if (etapasConcluidas.broll && etapasConcluidas.captions && !etapasConcluidas.render && !etapasConcluidas.hyperframesExported) {
    pendencias.push("Pronto para renderizar vídeo bruto ou exportar composição para o HyperFrames Studio.");
  }
  if (etapasConcluidas.render && !etapasConcluidas.renderApproved) {
    pendencias.push(`Último render está com status de revisão "${latestRender?.reviewStatus ?? "PENDING"}" (aprovação necessária antes de publicar).`);
  }

  const baseActionUrl = `/api/v1/projects/${projectId}/actions`;
  const baseContentUrl = `/api/v1/projects/${projectId}/content`;

  const proximasAcoes: AgentNextAction[] = [
    {
      acao: "injetar_ideias_ou_roteiro",
      titulo: "Enviar ideias ou roteiro escrito pelo próprio agente",
      disponivel: true,
      metodo: "POST",
      endpoint: baseContentUrl,
      payloadExemplo: {
        kind: "script",
        logline: "Resumo central do vídeo",
        blocks: [
          {
            act: 1,
            kind: "HOOK",
            title: "Gancho Inicial",
            narration: "Nos primeiros três segundos, uma descoberta mudou tudo o que sabíamos.",
            brollCue: "Close cinematográfico em arquivo confidencial sobre mesa escura",
            soundCue: "Sub-bass profundo + batida seca de relógio",
          },
        ],
      },
    },
    {
      acao: "gerar_ideias",
      titulo: "Gerar ideias com LLM interno",
      disponivel: true,
      metodo: "POST",
      endpoint: baseActionUrl,
      payloadExemplo: { action: "gerar_ideias", count: 3 },
    },
    {
      acao: "gerar_roteiro",
      titulo: "Gerar roteiro em blocos com LLM interno",
      disponivel: etapasConcluidas.ideation,
      motivoBloqueio: etapasConcluidas.ideation ? undefined : "Selecione ou injete uma ideia antes de gerar o roteiro.",
      metodo: "POST",
      endpoint: baseActionUrl,
      payloadExemplo: { action: "gerar_roteiro" },
    },
    {
      acao: "sintetizar_voz",
      titulo: "Sintetizar narração para os atos do roteiro",
      disponivel: etapasConcluidas.script,
      motivoBloqueio: etapasConcluidas.script ? undefined : "O projeto precisa ter blocos de roteiro antes de narrar.",
      metodo: "POST",
      endpoint: baseActionUrl,
      payloadExemplo: { action: "sintetizar_voz", force: false },
    },
    {
      acao: "alinhar_legendas",
      titulo: "Alinhar timestamps palavra a palavra (Whisper GPU / filtro de áudio)",
      disponivel: atosComVoz > 0,
      motivoBloqueio: atosComVoz > 0 ? undefined : "Sintetize a voz de pelo menos 1 ato antes de alinhar legendas.",
      metodo: "POST",
      endpoint: baseActionUrl,
      payloadExemplo: { action: "alinhar_legendas" },
    },
    {
      acao: "planejar_cenas",
      titulo: "Planejar cenas visuais a partir do roteiro",
      disponivel: etapasConcluidas.script,
      motivoBloqueio: etapasConcluidas.script ? undefined : "Crie o roteiro antes de planejar as cenas.",
      metodo: "POST",
      endpoint: baseActionUrl,
      payloadExemplo: { action: "planejar_cenas", density: "dense" },
    },
    {
      acao: "buscar_broll",
      titulo: "Buscar e baixar B-roll gratuito (Pexels / Pixabay / Openverse)",
      disponivel: etapasConcluidas.scenes,
      motivoBloqueio: etapasConcluidas.scenes ? undefined : "Planeje ou injete as cenas antes de buscar B-roll.",
      metodo: "POST",
      endpoint: baseActionUrl,
      payloadExemplo: { action: "buscar_broll", onlyPreferVideo: false },
    },
    {
      acao: "exportar_hyperframes",
      titulo: "Gerar composição HTML5/GSAP no HyperFrames Studio",
      disponivel: etapasConcluidas.script,
      motivoBloqueio: etapasConcluidas.script ? undefined : "Crie o roteiro antes de exportar para o HyperFrames.",
      metodo: "POST",
      endpoint: baseActionUrl,
      payloadExemplo: { action: "exportar_hyperframes", dispatchAgent: false },
    },
    {
      acao: "renderizar_video",
      titulo: "Renderizar vídeo master MP4 (FFmpeg / NVENC)",
      disponivel: etapasConcluidas.voice && etapasConcluidas.scenes,
      motivoBloqueio:
        etapasConcluidas.voice && etapasConcluidas.scenes
          ? undefined
          : "Requer narração sintetizada e cenas criadas antes de renderizar.",
      metodo: "POST",
      endpoint: baseActionUrl,
      payloadExemplo: { action: "renderizar_video", captions: true, music: true, preview: false },
    },
    {
      acao: "aprovar_render",
      titulo: "Aprovar versão mais recente do render para liberar publicação",
      disponivel: etapasConcluidas.render,
      motivoBloqueio: etapasConcluidas.render ? undefined : "Renderize uma versão antes de aprovar.",
      metodo: "POST",
      endpoint: baseActionUrl,
      payloadExemplo: { action: "aprovar_render", note: "Aprovado após verificação técnica." },
    },
    {
      acao: "publicar_youtube",
      titulo: "Publicar ou agendar no YouTube (exige render aprovado)",
      disponivel: etapasConcluidas.renderApproved,
      motivoBloqueio: etapasConcluidas.renderApproved
        ? undefined
        : "Trava de segurança: o último render precisa estar APPROVED antes de publicar no YouTube.",
      metodo: "POST",
      endpoint: baseActionUrl,
      payloadExemplo: { action: "publicar_youtube", privacyStatus: "private" },
    },
  ];

  return {
    projectId: project.id,
    title: project.title,
    format: project.format,
    niche: project.niche,
    stage: project.stage,
    status: project.status,
    etapasConcluidas,
    metricas: {
      totalIdeias: project.ideas.length,
      ideiaSelecionadaId: selectedIdea?.id ?? null,
      ideiaSelecionadaTitulo: selectedIdea?.title ?? null,
      scriptId: latestScript?.id ?? null,
      scriptVersion: latestScript?.version ?? null,
      totalAtos: blocks.length,
      totalPalavrasRoteiro: latestScript?.wordCount ?? 0,
      duracaoEstimadaSeg: latestScript?.estimatedDuration ?? 0,
      atosComVoz,
      duracaoVozTotalMs,
      atosComLegendaAlinhada,
      totalCenas,
      cenasComMidiaPronta,
      cenasComArquivoExistente,
      insercoesPlanoEdicao: editPlan?.insertions ?? 0,
      totalRenders: project.renderJobs.length,
      ultimoRenderPath: latestRender?.outputPath ?? null,
      ultimoRenderRevisao: latestRender?.reviewStatus ?? null,
      hyperframesSlug: hfSlug,
      hyperframesDir: hfDir,
      jobsAtivos: project.jobs.map((j) => ({
        id: j.id,
        type: j.type,
        status: j.status,
        progress: j.progress,
        message: j.message,
      })),
    },
    pendencias,
    proximasAcoes,
  };
}

/**
 * Enfileira um job para o projeto de maneira idempotente: se já houver um job do mesmo tipo
 * QUEUED ou RUNNING para este projeto (e force !== true), retorna o job ativo existente.
 */
export async function enqueueProjectJob(
  projectId: string,
  type: string,
  payload: Record<string, unknown> = {},
  opts: { force?: boolean } = {},
) {
  if (!opts.force) {
    const existing = await prisma.job.findFirst({
      where: {
        projectId,
        type,
        status: { in: ["QUEUED", "RUNNING"] },
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      return { job: existing, reused: true };
    }
  }

  const job = await prisma.job.create({
    data: {
      type,
      projectId,
      payload: JSON.stringify({ projectId, ...payload }),
    },
  });
  return { job, reused: false };
}

/**
 * Gera uma composição real HTML5 + GSAP compatível com o HyperFrames Studio na pasta Videos-HF
 * a partir dos dados atuais do projeto (roteiro, cenas, tempos de voz e legendas alinhadas).
 */
export async function exportProjectToHyperFrames(
  projectId: string,
  opts: { dispatchAgent?: boolean; instructions?: string } = {},
) {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: {
      scripts: {
        orderBy: { version: "desc" },
        take: 1,
        include: {
          blocks: {
            orderBy: { order: "asc" },
            include: {
              voiceTracks: {
                orderBy: { createdAt: "desc" },
                take: 1,
                include: { captions: { take: 1 } },
              },
              scenes: { orderBy: { order: "asc" } },
            },
          },
        },
      },
    },
  });

  const slug = slugifyProjectTitle(project.title);
  const hfRoot = pastaDeProjetosHyperframes();
  const projectDir = path.join(hfRoot, slug);
  await fs.mkdir(projectDir, { recursive: true });

  const isVertical = project.format === "SHORT_9_16";
  const width = isVertical ? 1080 : 1920;
  const height = isVertical ? 1920 : 1080;

  const blocks = project.scripts[0]?.blocks ?? [];
  let cursorSec = 0;

  interface BeatCard {
    index: number;
    act: number;
    kind: string;
    title: string;
    narration: string;
    brollCue: string;
    startSec: number;
    durationSec: number;
    endSec: number;
    mediaUrl: string | null;
  }

  const beats: BeatCard[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]!;
    const track = b.voiceTracks[0];
    const wordCount = b.narration.trim().split(/\s+/).filter(Boolean).length;
    const durSec = track?.durationMs
      ? Math.max(2, Number((track.durationMs / 1000).toFixed(2)))
      : Math.max(3, Math.round((wordCount / (b.wpm || 150)) * 60));

    const firstScene = b.scenes[0];
    const mediaUrl = firstScene?.filePath
      ? `/api/media/${firstScene.filePath.replace(/^[/\\]+/, "").replace(/\\/g, "/")}`
      : null;

    beats.push({
      index: i + 1,
      act: b.act,
      kind: b.kind,
      title: b.title,
      narration: b.narration.replace(/\[[^\]]+\]/g, "").trim(),
      brollCue: b.brollCue ?? firstScene?.prompt ?? "",
      startSec: Number(cursorSec.toFixed(2)),
      durationSec: durSec,
      endSec: Number((cursorSec + durSec).toFixed(2)),
      mediaUrl,
    });
    cursorSec += durSec;
  }

  const totalDurationSec = Math.max(5, Number(cursorSec.toFixed(2)));

  const manifest = {
    id: slug,
    vincereProjectId: project.id,
    title: project.title,
    niche: project.niche,
    format: project.format,
    width,
    height,
    fps: 30,
    durationSec: totalDurationSec,
    beats,
    exportedAt: new Date().toISOString(),
  };

  await fs.writeFile(path.join(projectDir, "vincere-manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

  const beatsHtml = beats
    .map(
      (b) => `
      <section
        class="hf-beat"
        data-hf-id="beat-${b.index}"
        data-start="${b.startSec}"
        data-duration="${b.durationSec}"
      >
        <div class="hf-badge" data-hf-id="beat-${b.index}-badge">ATO ${b.act} · ${escapeHtml(b.kind)}</div>
        <h2 class="hf-title" data-hf-id="beat-${b.index}-title">${escapeHtml(b.title)}</h2>
        <p class="hf-narration" data-hf-id="beat-${b.index}-narration">${escapeHtml(b.narration)}</p>
        ${
          b.brollCue
            ? `<div class="hf-cue" data-hf-id="beat-${b.index}-cue">CENA: ${escapeHtml(b.brollCue)}</div>`
            : ""
        }
      </section>`,
    )
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=${width}, height=${height}, initial-scale=1.0" />
  <title>${escapeHtml(project.title)} — HyperFrames</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      background: #07090e;
      color: #f5f7ff;
      font-family: "Inter", -apple-system, BlinkMacSystemFont, sans-serif;
    }
    #stage {
      position: relative;
      width: ${width}px;
      height: ${height}px;
      background: radial-gradient(circle at 50% 25%, #131c31 0%, #07090e 72%);
      overflow: hidden;
    }
    .hf-grid {
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px);
      background-size: 72px 72px;
      pointer-events: none;
    }
    .hf-beat {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: ${isVertical ? "96px 72px" : "96px 140px"};
      opacity: 0;
    }
    .hf-badge {
      display: inline-flex;
      align-self: flex-start;
      padding: 8px 18px;
      border-radius: 999px;
      border: 1px solid rgba(56, 189, 248, 0.45);
      background: rgba(56, 189, 248, 0.12);
      color: #38bdf8;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      margin-bottom: 28px;
    }
    .hf-title {
      font-size: ${isVertical ? "68px" : "76px"};
      line-height: 1.08;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #ffffff;
      margin-bottom: 32px;
    }
    .hf-narration {
      font-size: ${isVertical ? "40px" : "38px"};
      line-height: 1.42;
      color: #cbd5e1;
      max-width: 92%;
    }
    .hf-cue {
      margin-top: 40px;
      padding: 16px 22px;
      border-left: 4px solid #38bdf8;
      background: rgba(15, 23, 42, 0.72);
      color: #94a3b8;
      font-size: 22px;
      font-family: monospace;
    }
  </style>
</head>
<body>
  <main
    id="stage"
    data-composition-id="main"
    data-width="${width}"
    data-height="${height}"
    data-fps="30"
    data-duration="${totalDurationSec}"
  >
    <div class="hf-grid" data-hf-id="bg-grid"></div>
    ${beatsHtml}
  </main>
  <script>
    window.__timelines = window.__timelines || {};
    const tl = gsap.timeline({ paused: false });
    const beats = document.querySelectorAll(".hf-beat");
    beats.forEach((beat) => {
      const start = parseFloat(beat.getAttribute("data-start") || "0");
      const dur = parseFloat(beat.getAttribute("data-duration") || "4");
      const title = beat.querySelector(".hf-title");
      const narration = beat.querySelector(".hf-narration");
      tl.set(beat, { opacity: 1 }, start)
        .fromTo(title, { y: 40, opacity: 0, scale: 0.96 }, { y: 0, opacity: 1, scale: 1, duration: 0.45, ease: "power3.out" }, start)
        .fromTo(narration, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: "power2.out" }, start + 0.12)
        .to(beat, { opacity: 0, duration: 0.25, ease: "power1.in" }, Math.max(start + 0.5, start + dur - 0.25));
    });
    window.__timelines["main"] = tl;
  </script>
</body>
</html>`;

  const indexPath = path.join(projectDir, "index.html");
  await fs.writeFile(indexPath, html, "utf8");

  let claudeRequest = null;
  if (opts.dispatchAgent) {
    claudeRequest = await createRequest({
      pedido:
        `Refine a composição HyperFrames "${slug}" em ${projectDir} (${width}x${height}, ${totalDurationSec}s) ` +
        `gerada a partir do projeto "${project.title}" (/projects/${projectId}). ` +
        (opts.instructions ? `${opts.instructions} ` : "") +
        `Mantenha window.__timelines["main"] sincronizado e anime apenas transform e opacity.`,
      pagina: "/studio",
      projetoId: projectId,
      projetoHf: slug,
    });
  }

  return {
    slug,
    projectDir,
    indexPath,
    width,
    height,
    durationSec: totalDurationSec,
    beatsCount: beats.length,
    claudeRequest,
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
