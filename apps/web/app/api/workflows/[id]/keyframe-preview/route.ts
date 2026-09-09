import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "@docupulse/db";
import { WorkflowGraph, type WorkflowNodeData } from "@docupulse/core";
import { generateImageGemini, generateImagePollinations, estimateImageCostUsd, checkBudget, recordImageUsage, ProviderError, storageRoot, relPath, absPath } from "@docupulse/providers";

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
  const imageProvider = body.imageProvider === "POLLINATIONS" ? "POLLINATIONS" : "GEMINI";
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
    let result: Awaited<ReturnType<typeof generateImageGemini>>;
    let estimatedCost = 0;
    if (imageProvider === "POLLINATIONS") {
      result = await generateImagePollinations({ prompt, negativePrompt: negative || undefined, referenceImagePaths: refs, aspectRatio });
    } else {
      estimatedCost = estimateImageCostUsd();
      await checkBudget(estimatedCost); // não gasta nada se estourar o orçamento — lança antes de chamar a API paga
      result = await generateImageGemini({ prompt, negativePrompt: negative || undefined, referenceImagePaths: refs, aspectRatio });
      await recordImageUsage(null, "GEMINI_IMAGE", estimatedCost);
    }
    const ext = result.mimeType.includes("png") ? "png" : "jpg";
    const dir = path.join(storageRoot(), "workflows", id, "keyframes");
    await mkdir(dir, { recursive: true });
    const safeNodeId = nodeId.replace(/[^a-zA-Z0-9_-]/g, "") || "node";
    const filePath = path.join(dir, `${safeNodeId}-${Date.now()}.${ext}`);
    await writeFile(filePath, result.buffer);
    return NextResponse.json({ imageUrl: relPath(filePath) });
  } catch (err) {
    const msg = err instanceof ProviderError ? err.message : err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
