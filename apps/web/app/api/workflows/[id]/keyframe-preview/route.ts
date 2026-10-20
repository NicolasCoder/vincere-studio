import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "@vincere-studio/db";
import { WorkflowGraph, type WorkflowNodeData } from "@vincere-studio/core";
import { generateImageGemini, generateImagePollinations, estimateImageCostUsd, checkBudget, recordImageUsage, ProviderError, storageRoot, relPath, absPath } from "@vincere-studio/providers";

/**
 * Prévia de keyframe sob demanda pro nó de Prompt: gera 1 imagem de verdade via Gemini
 * (Nano Banana) sem precisar rodar o fluxo inteiro — espelha o padrão do preview de Voz
 * (Edge TTS), mas roda direto aqui porque generateImageGemini é só um fetch, sem dependência
 * nativa (ao contrário do msedge-tts, que só resolve certo no worker). Usa Avatar/Produto/
 * Cenário já conectados ao nó como contexto (referência de imagem + descrição do cenário),
 * do mesmo jeito que a execução completa do fluxo faz.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const nodeId = String(body.nodeId ?? "");
  const positive = String(body.positive ?? "").trim();
  const negative = String(body.negative ?? "").trim();
  const format = String(body.format ?? "");
  const imageProvider = body.imageProvider || "GEMINI";
  const FLOW_DAEMON_URL = process.env.FLOW_DAEMON_URL || "http://127.0.0.1:9334";
  if (!positive) return NextResponse.json({ error: "escreva o prompt positivo antes de gerar o keyframe" }, { status: 400 });

  const wf = await prisma.workflow.findUnique({ where: { id } });
  if (!wf) return NextResponse.json({ error: "workflow não encontrado" }, { status: 404 });

  const refs: string[] = [];
  let sceneContext = "";
  try {
    const graph = WorkflowGraph.parse(JSON.parse(wf.graph));
    const sourceIds = graph.edges.filter((e) => e.target === nodeId).map((e) => e.source);
    const sourceNodes = graph.nodes.filter((n) => sourceIds.includes(n.id));
    for (const n of sourceNodes) {
      if (n.type === "AVATAR") {
        const d = n.data as Extract<WorkflowNodeData, { kind: "AVATAR" }>;
        if (d.imageUrl) refs.push(absPath(d.imageUrl));
      }
      if (n.type === "PRODUCT") {
        const d = n.data as Extract<WorkflowNodeData, { kind: "PRODUCT" }>;
        if (d.imageUrl) refs.push(absPath(d.imageUrl));
      }
      if (n.type === "SCENE") {
        const d = n.data as Extract<WorkflowNodeData, { kind: "SCENE" }>;
        sceneContext = `Cenário: ${d.name} — ${d.description} (clima: ${d.mood}, iluminação: ${d.timeOfDay}).`;
      }
    }
  } catch {
    // grafo salvo mal formado — segue só com o prompt digitado, sem contexto extra
  }

  try {
    const aspectRatio = /9:16|16:9|1:1/.exec(format)?.[0];
    const prompt = [positive, sceneContext || null].filter(Boolean).join(" ");
    let fallbackNotice: string | null = null;

    if (imageProvider === "FLOW") {
      // Enfileira geração direta no Flow Studio via daemon local na porta 9334
      const enqueueRes = await fetch(`${FLOW_DAEMON_URL}/enqueue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project: `wf_${id.slice(0, 8)}`,
          prompt,
          mode: "image",
          engine: "nano-banana-2",
          aspect_ratio: aspectRatio === "16:9" ? "16:9" : "9:16",
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (!enqueueRes.ok) {
        throw new Error("Flow Daemon na porta 9334 não aceitou o job. Verifique se o daemon está ativo.");
      }

      const enqData = await enqueueRes.json();
      const jobId = enqData.job_id || enqData.id;

      // Espera até 30s pelo resultado da imagem no Flow
      let completedFileUrl: string | null = null;
      for (let i = 0; i < 15; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const statusRes = await fetch(`${FLOW_DAEMON_URL}/jobs/${jobId}`, { signal: AbortSignal.timeout(4000) });
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          if (statusData.status === "completed" || statusData.status === "done") {
            // Baixa o arquivo gerado
            const fileRes = await fetch(`${FLOW_DAEMON_URL}/jobs/${jobId}/file`, { signal: AbortSignal.timeout(10000) });
            if (fileRes.ok) {
              const buf = Buffer.from(await fileRes.arrayBuffer());
              const dir = path.join(storageRoot(), "workflows", id, "keyframes");
              await mkdir(dir, { recursive: true });
              const safeNodeId = nodeId.replace(/[^a-zA-Z0-9_-]/g, "") || "node";
              const filePath = path.join(dir, `${safeNodeId}-flow-${Date.now()}.png`);
              await writeFile(filePath, buf);
              return NextResponse.json({ imageUrl: relPath(filePath), warning: fallbackNotice });
            }
          }
          if (statusData.status === "failed") {
            throw new Error(`Geração no Flow falhou: ${statusData.error || "erro desconhecido"}`);
          }
        }
      }
      return NextResponse.json({
        imageUrl: null,
        status: "queued",
        message: "Job enviado para a fila do Google Flow. Acompanhe na aba Flow Studio.",
      });
    }

    if (imageProvider === "MINIMAX") {
      const apiKey = process.env.MINIMAX_API_KEY;
      if (!apiKey) {
        throw new Error(
          "Chave MINIMAX_API_KEY não configurada. Adicione sua chave da MiniMax no arquivo .env ou em Configurações para gerar vídeos diretamente via Hailuo/MiniMax."
        );
      }
      // Chamada à API da MiniMax Video Generation
      const mmRes = await fetch("https://api.minimax.chat/v1/video_generation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "video-01",
          prompt,
          prompt_optimizer: true,
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!mmRes.ok) {
        const mmErr = await mmRes.text();
        throw new Error(`MiniMax API respondeu com status ${mmRes.status}: ${mmErr}`);
      }

      const mmData = await mmRes.json();
      return NextResponse.json({
        imageUrl: null,
        status: "queued",
        jobId: mmData.task_id,
        message: `Tarefa de vídeo MiniMax criada com sucesso (Task ID: ${mmData.task_id}).`,
      });
    }

    let result: Awaited<ReturnType<typeof generateImageGemini>>;
    let estimatedCost = 0;

    if (imageProvider === "POLLINATIONS") {
      result = await generateImagePollinations({ prompt, negativePrompt: negative || undefined, referenceImagePaths: refs, aspectRatio });
    } else {
      try {
        estimatedCost = estimateImageCostUsd();
        await checkBudget(estimatedCost);
        result = await generateImageGemini({ prompt, negativePrompt: negative || undefined, referenceImagePaths: refs, aspectRatio });
        await recordImageUsage(null, "GEMINI_IMAGE", estimatedCost);
      } catch (geminiErr: any) {
        // Fallback automático para Pollinations se a chave Gemini não tiver faturamento ou der erro
        console.warn("Falha no Gemini Image, usando fallback Pollinations:", geminiErr.message);
        fallbackNotice = `Gemini indisponível (${geminiErr.message}). Imagem gerada via Pollinations.ai.`;
        result = await generateImagePollinations({ prompt, negativePrompt: negative || undefined, referenceImagePaths: refs, aspectRatio });
      }
    }
    const ext = result.mimeType.includes("png") ? "png" : "jpg";
    const dir = path.join(storageRoot(), "workflows", id, "keyframes");
    await mkdir(dir, { recursive: true });
    const safeNodeId = nodeId.replace(/[^a-zA-Z0-9_-]/g, "") || "node";
    const filePath = path.join(dir, `${safeNodeId}-${Date.now()}.${ext}`);
    await writeFile(filePath, result.buffer);
    return NextResponse.json({ imageUrl: relPath(filePath), warning: fallbackNotice });
  } catch (err) {
    const msg = err instanceof ProviderError ? err.message : err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
