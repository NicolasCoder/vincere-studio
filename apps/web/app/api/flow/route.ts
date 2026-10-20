import { NextResponse } from "next/server";
import { prisma } from "@vincere-studio/db";
import { storageRoot } from "@vincere-studio/providers";
import fs from "node:fs/promises";
import path from "node:path";

const FLOW_DAEMON_URL = process.env.FLOW_DAEMON_URL || "http://127.0.0.1:9334";

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

    if (action === "file") {
      const jobId = searchParams.get("jobId");
      if (!jobId) {
        return new NextResponse("Job ID missing", { status: 400 });
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
      error: "Flow Daemon não detectado na porta 9334. Execute flow_queue_daemon.py para conectar.",
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

      const fileRes = await fetch(`${FLOW_DAEMON_URL}/jobs/${jobId}/file`, {
        signal: AbortSignal.timeout(20000),
      });
      if (!fileRes.ok) {
        return NextResponse.json({ ok: false, error: "Não foi possível baixar o arquivo gerado do Flow" }, { status: 404 });
      }

      const contentType = fileRes.headers.get("content-type") || "";
      const isVideo = contentType.includes("video") || contentType.includes("mp4");
      const ext = isVideo ? ".mp4" : ".png";
      const fileName = `flow_${jobId.slice(0, 8)}${ext}`;

      const targetDir = path.join(storageRoot(), "projects", projectId, sceneId ? "scenes" : "generated");
      await fs.mkdir(targetDir, { recursive: true });
      const targetPath = path.join(targetDir, fileName);

      const arrayBuf = await fileRes.arrayBuffer();
      await fs.writeFile(targetPath, Buffer.from(arrayBuf));

      const relativePath = `projects/${projectId}/${sceneId ? "scenes" : "generated"}/${fileName}`;

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
          data: {
            projectId,
            prompt: prompt || "Gerado no Google Flow",
            engine: "FLOW",
            filePath: relativePath,
            costUsd: 0,
          },
        });
      }

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
