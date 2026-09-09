import path from "node:path";
import { mkdir } from "node:fs/promises";
import { prisma } from "@docupulse/db";
import { WorkflowGraph, NODE_META, type NodeKind, type WorkflowNodeData } from "@docupulse/core";
import { EdgeVoiceProvider, FFMPEG, run, absPath, relPath, storageRoot } from "@docupulse/providers";
import type { JobContext } from "../queue";

/**
 * Executor do grafo. Percorre os nós em ordem topológica e, pras peças que já temos de graça
 * (imagem de referência do Avatar/Produto + roteiro do node de Voz via Edge TTS), monta de
 * verdade uma prévia vertical com ffmpeg (Ken Burns + a locução real). Os nós Prompt continuam
 * "simulados" — geração de vídeo por IA (Veo/Wan) é paga e fica pro "Exportar p/ Flow".
 */
export async function runWorkflow(ctx: JobContext) {
  const workflowId = String(ctx.payload.workflowId ?? "");
  const wf = await prisma.workflow.findUnique({ where: { id: workflowId } });
  if (!wf) throw new Error(`Workflow ${workflowId} não encontrado`);

  try {
    const graph = WorkflowGraph.parse(JSON.parse(wf.graph));
    const renderNode = graph.nodes.find((n) => n.type === "RENDER");
    if (!renderNode) throw new Error("O fluxo precisa de um nó Renderizador (alvo).");

    // Ordenação topológica (Kahn)
    const indeg = new Map(graph.nodes.map((n) => [n.id, 0]));
    for (const e of graph.edges) indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
    const queue = graph.nodes.filter((n) => (indeg.get(n.id) ?? 0) === 0).map((n) => n.id);
    const order: string[] = [];
    while (queue.length) {
      const id = queue.shift()!;
      order.push(id);
      for (const e of graph.edges.filter((e) => e.source === id)) {
        indeg.set(e.target, (indeg.get(e.target) ?? 1) - 1);
        if (indeg.get(e.target) === 0) queue.push(e.target);
      }
    }
    if (order.length !== graph.nodes.length) throw new Error("O grafo tem um ciclo; remova a conexão circular.");

    const feeding = graph.edges.filter((e) => e.target === renderNode.id).length;
    if (feeding === 0) throw new Error("Nada está conectado ao Renderizador.");

    await ctx.log(`Grafo válido: ${graph.nodes.length} nós, ${graph.edges.length} conexões. Ordem: ${order.join(" → ")}`);

    // 1ª passada: recolhe o que já temos de real (imagens de referência + roteiro de voz).
    let avatarImg: string | null = null;
    let productImg: string | null = null;
    let voiceScript = "";
    let voiceId = "pt-BR-FranciscaNeural";
    for (const id of order) {
      const node = graph.nodes.find((n) => n.id === id)!;
      if (node.type === "AVATAR") {
        const d = node.data as Extract<WorkflowNodeData, { kind: "AVATAR" }>;
        if (d.imageUrl) avatarImg = absPath(d.imageUrl);
      }
      if (node.type === "PRODUCT") {
        const d = node.data as Extract<WorkflowNodeData, { kind: "PRODUCT" }>;
        if (d.imageUrl) productImg = absPath(d.imageUrl);
      }
      if (node.type === "VOICE") {
        const d = node.data as Extract<WorkflowNodeData, { kind: "VOICE" }>;
        if (d.script?.trim()) {
          voiceScript = d.script.trim();
          voiceId = d.voiceId || voiceId;
        }
      }
    }

    // 2ª passada: percorre e loga cada nó (PROMPT/AVATAR/PRODUCT seguem simulados quanto ao
    // motor de vídeo — só a Voz sintetiza de verdade).
    let voiceFile: string | null = null;
    let voiceDurationMs = 0;
    const outDir = path.join(storageRoot(), "workflows", workflowId, "renders");
    await mkdir(outDir, { recursive: true });

    for (let i = 0; i < order.length; i++) {
      if (await ctx.isCancelled()) return { cancelled: true };
      const node = graph.nodes.find((n) => n.id === order[i])!;
      const meta = NODE_META[node.type as NodeKind];
      await ctx.progress({ percent: ((i + 0.5) / order.length) * 90, message: `${meta.label} (${node.id})` });

      if (node.type === "AVATAR" || node.type === "PRODUCT") {
        const hasImg = node.type === "AVATAR" ? !!avatarImg : !!productImg;
        await ctx.log(`[${node.type}] ${meta.label}: ${hasImg ? "imagem de referência anexada, usada na composição" : "sem imagem de referência (composição vira placeholder ou some, se faltar dos dois)"}`);
      } else if (node.type === "PROMPT") {
        await ctx.log(`[${node.type}] ${meta.label}: simulado — geração de vídeo por IA (Veo/Wan) é paga; use "Exportar p/ Flow" pra gerar externamente com esse prompt`);
      } else if (node.type === "VOICE") {
        if (voiceScript) {
          voiceFile = path.join(outDir, `voice-${Date.now()}.mp3`);
          const r = await new EdgeVoiceProvider().synthesize({ text: voiceScript, voiceId, rate: 1, language: "pt-BR" }, voiceFile);
          voiceDurationMs = r.durationMs;
          await ctx.log(`[${node.type}] ${meta.label}: locução real sintetizada (Edge TTS, ${(r.durationMs / 1000).toFixed(1)}s)`);
        } else {
          await ctx.log(`[${node.type}] ${meta.label}: sem roteiro — nenhuma locução gerada`);
        }
      } else {
        await ctx.log(`[${node.type}] ${meta.label}: nó alvo, composição a seguir`);
      }
    }

    // 3ª passada: compõe o vídeo final se der pra montar algo real (pelo menos 1 imagem).
    if (!avatarImg && !productImg) {
      await prisma.workflow.update({ where: { id: wf.id }, data: { status: "READY" } });
      await ctx.log("Nenhuma imagem de referência anexada (Avatar/Produto) — sem isso não dá pra montar uma prévia real ainda. Anexe uma imagem nos nós e rode de novo.");
      return { order, composed: false };
    }

    const renderData = renderNode.data as Extract<WorkflowNodeData, { kind: "RENDER" }>;
    const W = renderData.width || 1080;
    const H = renderData.height || 1920;
    const fps = Math.min(30, renderData.fps || 30); // Ken Burns em still não precisa de 60fps
    const durationSec = voiceFile ? Math.max(3, voiceDurationMs / 1000) : 6;
    const frames = Math.max(2, Math.round(durationSec * fps));
    const outFile = path.join(outDir, `run-${Date.now()}.mp4`);

    const inputs: string[] = [];
    let filter: string;
    if (avatarImg && productImg) {
      let topH = Math.round(H * 0.56);
      topH -= topH % 2; // yuv420p exige dimensões pares — ímpar aqui derruba o ffmpeg
      const botH = H - topH;
      inputs.push("-loop", "1", "-framerate", String(fps), "-t", durationSec.toFixed(2), "-i", avatarImg);
      inputs.push("-loop", "1", "-framerate", String(fps), "-t", durationSec.toFixed(2), "-i", productImg);
      filter =
        `[0:v]scale=${W}:${topH}:force_original_aspect_ratio=increase,crop=${W}:${topH},setsar=1,zoompan=z='1+0.06*on/${frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${topH}:fps=${fps}[top];` +
        `[1:v]scale=${W}:${botH}:force_original_aspect_ratio=increase,crop=${W}:${botH},setsar=1,zoompan=z='1.08-0.06*on/${frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${botH}:fps=${fps}[bot];` +
        `[top][bot]vstack=inputs=2,format=yuv420p[vout]`;
    } else {
      const only = avatarImg || productImg!;
      inputs.push("-loop", "1", "-framerate", String(fps), "-t", durationSec.toFixed(2), "-i", only);
      filter = `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,zoompan=z='1+0.08*on/${frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=${fps},format=yuv420p[vout]`;
    }

    const audioInputIndex = inputs.filter((a) => a === "-i").length; // índice do próximo -i
    if (voiceFile) inputs.push("-i", voiceFile);
    else inputs.push("-f", "lavfi", "-i", `anullsrc=r=44100:cl=stereo:d=${durationSec.toFixed(2)}`);

    await ctx.progress({ percent: 92, message: "Compondo prévia com ffmpeg" });
    await run(FFMPEG, [
      "-y", "-hide_banner", "-loglevel", "error",
      ...inputs,
      "-filter_complex", filter,
      "-map", "[vout]",
      "-map", `${audioInputIndex}:a`,
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-r", String(fps),
      "-c:a", "aac", "-b:a", "160k",
      "-shortest", "-movflags", "+faststart",
      outFile,
    ]);
    await ctx.log(`Prévia composta (${avatarImg && productImg ? "Avatar + Produto" : "1 imagem"}${voiceFile ? " + locução real" : " + áudio mudo"}): ${path.basename(outFile)}`);

    renderData.status = "DONE";
    renderData.outputUrl = relPath(outFile);
    renderData.renderedAt = new Date().toISOString();
    await prisma.workflow.update({ where: { id: wf.id }, data: { status: "DONE", graph: JSON.stringify(graph) } });
    return { order, composed: true, outputUrl: relPath(outFile) };
  } catch (err) {
    await prisma.workflow.update({ where: { id: wf.id }, data: { status: "READY" } });
    throw err;
  }
}
