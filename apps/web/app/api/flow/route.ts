import { NextResponse } from "next/server";
import { prisma } from "@vincere-studio/db";
import { storageRoot } from "@vincere-studio/providers";
import fs from "node:fs/promises";
import path from "node:path";

const FLOW_DAEMON_URL = process.env.FLOW_DAEMON_URL || "http://127.0.0.1:9334";

// IDs que chegam do navegador vão para path.join, URL do daemon e Prisma: só formatos esperados.
const ID_RE = /^[a-z0-9]{20,40}$/i; // cuid do Prisma
const JOB_RE = /^[A-Za-z0-9-]{8,64}$/; // uuid do daemon

// Cenas esperando um job do Flow terminar: jobId → destino. Vinculadas sozinhas quando o job conclui.
const LINKS_FILE = () => path.join(storageRoot(), "flow-links.json");
type FlowLink = { projectId: string; sceneId?: string; prompt?: string; createdAt: string };

async function readLinks(): Promise<Record<string, FlowLink>> {
  try {
    return JSON.parse(await fs.readFile(LINKS_FILE(), "utf8"));
  } catch {
    return {};
  }
}

async function writeLinks(links: Record<string, FlowLink>) {
  const tmp = `${LINKS_FILE()}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(links, null, 2), "utf8");
  await fs.rename(tmp, LINKS_FILE());
}

/** Baixa o resultado do job e grava na cena (ou no banco de imagens do projeto). */
async function assignJob(jobId: string, projectId: string, sceneId?: string, prompt?: string) {
  if (!JOB_RE.test(jobId) || !ID_RE.test(projectId) || (sceneId && !ID_RE.test(sceneId))) {
    throw new Error("IDs inválidos");
  }
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) throw new Error("Projeto não encontrado");
  if (sceneId) {
    const scene = await prisma.scene.findFirst({ where: { id: sceneId, block: { script: { projectId } } }, select: { id: true } });
    if (!scene) throw new Error("A cena não pertence a este projeto");
  }

  const fileRes = await fetch(`${FLOW_DAEMON_URL}/jobs/${jobId}/file`, { signal: AbortSignal.timeout(20000) });
  if (!fileRes.ok) throw new Error("Não foi possível baixar o arquivo gerado do Flow");

  const contentType = fileRes.headers.get("content-type") || "";
  const isVideo = contentType.includes("video") || contentType.includes("mp4");
  const ext = isVideo ? ".mp4" : contentType.includes("jpeg") ? ".jpg" : ".png";
  const fileName = `flow_${jobId}${ext}`;
  const sub = sceneId ? "scenes" : "generated";
  const targetDir = path.join(storageRoot(), "projects", projectId, sub);
  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(path.join(targetDir, fileName), Buffer.from(await fileRes.arrayBuffer()));
  const relativePath = `projects/${projectId}/${sub}/${fileName}`;

  if (sceneId) {
    await prisma.scene.update({
      where: { id: sceneId },
      data: {
        filePath: relativePath,
        source: "GENERATED",
        provider: isVideo ? "Google Flow (Veo 3.1)" : "Google Flow (Nano Banana Pro)",
        mediaType: isVideo ? "video" : "image",
      },
    });
  } else {
    await prisma.generatedImage.create({
      data: { projectId, prompt: prompt || "Gerado no Google Flow", engine: "FLOW", filePath: relativePath, costUsd: 0 },
    });
  }
  return { relativePath, isVideo };
}

/** Confere os jobs com destino pendente e vincula os que terminaram. Barato quando não há pendências. */
async function syncLinks() {
  const links = await readLinks();
  const ids = Object.keys(links);
  if (ids.length === 0) return { pendentes: 0, vinculados: 0 };
  let vinculados = 0;
  for (const jobId of ids) {
    const st = await fetch(`${FLOW_DAEMON_URL}/jobs/${jobId}`, { signal: AbortSignal.timeout(4000) })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    const status = st?.status ?? st?.job?.status;
    const link = links[jobId];
    if (status === "completed") {
      try {
        await assignJob(jobId, link.projectId, link.sceneId, link.prompt);
        vinculados++;
      } catch {}
      delete links[jobId];
    } else if (status === "failed" || status === "cancelled" || Date.now() - Date.parse(link.createdAt) > 6 * 3600_000) {
      delete links[jobId];
    }
  }
  await writeLinks(links);
  return { pendentes: Object.keys(links).length, vinculados };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") || "status";

  try {
    if (action === "projects") {
      const projects = await prisma.project.findMany({
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          title: true,
          format: true,
          visualStyle: true,
          scripts: {
            take: 1,
            orderBy: { version: "desc" },
            select: {
              blocks: {
                orderBy: { order: "asc" },
                select: {
                  id: true,
                  act: true,
                  title: true,
                  scenes: {
                    orderBy: { order: "asc" },
                    select: {
                      id: true,
                      order: true,
                      prompt: true,
                      description: true,
                      filePath: true,
                    },
                  },
                },
              },
            },
          },
        },
      });
      return NextResponse.json({ ok: true, projects });
    }

    if (action === "sync") {
      return NextResponse.json({ ok: true, ...(await syncLinks()) });
    }

    if (action === "file") {
      const jobId = searchParams.get("jobId");
      if (!jobId || !JOB_RE.test(jobId)) {
        return new NextResponse("Job ID inválido", { status: 400 });
      }
      const fileRes = await fetch(`${FLOW_DAEMON_URL}/jobs/${jobId}/file`, {
        signal: AbortSignal.timeout(15000),
      });
      if (!fileRes.ok) {
        return new NextResponse("Mídia não encontrada no Flow Daemon", { status: fileRes.status });
      }
      const contentType = fileRes.headers.get("content-type") || "image/png";
      const buffer = await fileRes.arrayBuffer();
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=86400",
        },
      });
    }

    if (action === "queue") {
      const res = await fetch(`${FLOW_DAEMON_URL}/queue`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json({ ok: true, ...data });
      }
    }

    // Default: health / status check
    const res = await fetch(`${FLOW_DAEMON_URL}/health`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) {
      return NextResponse.json({
        ok: false,
        running: false,
        message: `Flow Daemon respondeu com status ${res.status}`,
      });
    }

    const health = await res.json();
    return NextResponse.json({
      ok: true,
      running: true,
      ...health,
    });
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      running: false,
      error: "Flow Daemon não detectado na porta 9334. Inicie o daemon (python flow_queue_daemon.py, na pasta flow-studio-mcp). Se o Vincere roda em um servidor, o túnel do seu computador até ele também precisa estar ativo.",
      details: err.message,
    });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const action = body.action || "enqueue";

    if (action === "browser") {
      const cmd = body.command; // "show", "hide", "login"
      const res = await fetch(`${FLOW_DAEMON_URL}/browser/${cmd}`, {
        method: "POST",
        signal: AbortSignal.timeout(5000),
      });
      const data = await res.json().catch(() => ({}));
      return NextResponse.json({ ok: res.ok, ...data });
    }

    if (action === "assign_to_project") {
      const { jobId, projectId, sceneId, prompt } = body;
      if (!jobId || !projectId) {
        return NextResponse.json({ ok: false, error: "jobId e projectId são obrigatórios" }, { status: 400 });
      }

      const { relativePath } = await assignJob(String(jobId), String(projectId), sceneId ? String(sceneId) : undefined, prompt);

      return NextResponse.json({
        ok: true,
        filePath: relativePath,
        message: sceneId
          ? "Mídia vinculada à cena com sucesso!"
          : "Mídia salva no banco de imagens do projeto com sucesso!",
      });
    }

    if (action === "enqueue") {
      const jobData = {
        workspace: body.workspace || "Vincere Studio",
        tipo: body.tipo || "imagem", // "imagem" | "video"
        prompt: body.prompt || "",
        modelo: body.modelo || (body.tipo === "video" ? "lower_priority" : "pro"),
        proporcao: body.proporcao || "16:9",
        duracao: body.duracao || "8s",
        resolucao: body.resolucao || "720p",
        quantidade: body.quantidade || "x1",
        imagem_in: body.imagem_in || "",
        imagem_out: body.imagem_out || "",
        ingredientes: body.ingredientes || [],
        wait: false, // Return job_id immediately so UI doesn't hang!
        priority: body.priority || 10,
      };

      const res = await fetch(`${FLOW_DAEMON_URL}/enqueue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(jobData),
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText);
        return NextResponse.json({ ok: false, error: errText }, { status: res.status });
      }

      const data = await res.json();
      const jobId = data.job_id || data.id;
      const { targetProjectId, targetSceneId } = body;
      if (jobId && targetProjectId && ID_RE.test(String(targetProjectId)) && (!targetSceneId || ID_RE.test(String(targetSceneId)))) {
        const links = await readLinks();
        links[jobId] = {
          projectId: String(targetProjectId),
          sceneId: targetSceneId ? String(targetSceneId) : undefined,
          prompt: jobData.prompt,
          createdAt: new Date().toISOString(),
        };
        await writeLinks(links);
      }
      return NextResponse.json({ ok: true, ...data });
    }

    return NextResponse.json({ ok: false, error: "Ação desconhecida" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "Falha na comunicação com Flow Daemon", details: err.message },
      { status: 500 }
    );
  }
}
