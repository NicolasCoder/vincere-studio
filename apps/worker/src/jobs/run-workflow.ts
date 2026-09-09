import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { prisma } from "@docupulse/db";
import { WorkflowGraph, NODE_META, type NodeKind, type WorkflowNodeData } from "@docupulse/core";
import { EdgeVoiceProvider, EDGE_VOICES, FFMPEG, run, absPath, relPath, storageRoot, generateImageGemini, ProviderError } from "@docupulse/providers";
import type { JobContext } from "../queue";

/**
 * Executor do grafo. Percorre os nós em ordem topológica e, pras peças que já temos de graça
 * (imagem de referência do Avatar/Produto + roteiro do node de Voz via Edge TTS), monta de
 * verdade uma prévia vertical com ffmpeg (Ken Burns + a locução real). O nó Prompt agora gera
 * uma imagem de verdade via Gemini ("Nano Banana", image-to-image quando há Avatar/Produto de
 * referência) — exige GEMINI_IMAGE_API_KEY (normalmente com faturamento habilitado; não é o
 * nível grátis do texto). Sem a chave, cai de volta pra composição só com as imagens de
 * referência, como antes. Quando o grafo tem mais de 1 nó Prompt com imagem gerada, os shots
 * entram em sequência (concat) na prévia final, na ordem topológica — uma adaptação real da ideia
 * de "linha do tempo" do mockup do Stitch, sem as partes fictícias (telemetria de consistência,
 * color science, ponte com DaVinci/Unreal). Geração de vídeo por IA (Veo/Wan) continua fora do
 * escopo — segue pro "Exportar p/ Flow".
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
    let sceneContext = "";
    let voiceScript = "";
    let voiceId = "pt-BR-FranciscaNeural";
    let voiceIdFallbackWarning: string | null = null;
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
      if (node.type === "SCENE") {
        const d = node.data as Extract<WorkflowNodeData, { kind: "SCENE" }>;
        sceneContext = `Cenário: ${d.name} — ${d.description} (clima: ${d.mood}, iluminação: ${d.timeOfDay}).`;
      }
      if (node.type === "VOICE") {
        const d = node.data as Extract<WorkflowNodeData, { kind: "VOICE" }>;
        if (d.script?.trim()) {
          voiceScript = d.script.trim();
          // O campo de voiceId do nó só oferece opções reais do Edge TTS na UI atual, mas o
          // grafo pode ter sido criado/editado com outro valor (ex.: rótulo do Gemini TTS tipo
          // "Clara - Conversational", que o Edge não reconhece e derruba o job). Valida contra a
          // lista canônica antes de usar; se não bater, cai pro default sem quebrar a execução.
          if (d.voiceId && EDGE_VOICES.some((v) => v.id === d.voiceId)) {
            voiceId = d.voiceId;
          } else if (d.voiceId) {
            voiceIdFallbackWarning = `voiceId salvo no nó ("${d.voiceId}") não é uma voz Edge TTS válida — usando "${voiceId}" no lugar.`;
          }
        }
      }
    }

    // 2ª passada: percorre e loga cada nó (PROMPT/AVATAR/PRODUCT seguem simulados quanto ao
    // motor de vídeo — só a Voz sintetiza de verdade).
    let voiceFile: string | null = null;
    let voiceDurationMs = 0;
    // Um item por nó Prompt que gerou imagem de verdade, na ordem topológica — vira 1 shot na
    // sequência final quando há mais de 1 (concatenados), ou a única imagem quando há só 1.
    const promptShots: { file: string; nodeId: string }[] = [];
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
      } else if (node.type === "SCENE") {
        await ctx.log(`[${node.type}] ${meta.label}: ${sceneContext ? "descrição de cenário anexada ao prompt do node Prompt conectado" : "sem descrição preenchida"}`);
      } else if (node.type === "PROMPT") {
        const d = node.data as Extract<WorkflowNodeData, { kind: "PROMPT" }>;
        if (!d.positive?.trim()) {
          await ctx.log(`[${node.type}] ${meta.label}: sem prompt positivo — nada gerado`);
        } else {
          const refs = [avatarImg, productImg].filter((p): p is string => !!p);
          try {
            const aspectRatio = /9:16|16:9|1:1/.exec(d.format ?? "")?.[0];
            const prompt = [d.positive.trim(), sceneContext || null].filter(Boolean).join(" ");
            const result = await generateImageGemini({
              prompt,
              negativePrompt: d.negative?.trim() || undefined,
              referenceImagePaths: refs,
              aspectRatio,
            });
            const ext = result.mimeType.includes("png") ? "png" : "jpg";
            const shotFile = path.join(outDir, `prompt-${node.id}-${Date.now()}.${ext}`);
            await writeFile(shotFile, result.buffer);
            promptShots.push({ file: shotFile, nodeId: node.id });
            await ctx.log(
              `[${node.type}] ${meta.label}: imagem gerada de verdade via Gemini (Nano Banana)${refs.length ? ` usando ${refs.length} referência(s)` : ""} — ${path.basename(shotFile)}`,
            );
          } catch (err) {
            const msg = err instanceof ProviderError ? err.message : err instanceof Error ? err.message : String(err);
            await ctx.log(`[${node.type}] ${meta.label}: geração real falhou (${msg}) — seguindo sem a imagem desse nó, composição usa só Avatar/Produto se houver.`);
          }
        }
      } else if (node.type === "VOICE") {
        if (voiceIdFallbackWarning) {
          await ctx.log(`[${node.type}] ${meta.label}: ${voiceIdFallbackWarning}`);
          voiceIdFallbackWarning = null; // loga uma vez só
        }
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

    // 3ª passada: compõe o vídeo final se der pra montar algo real (pelo menos 1 imagem — gerada
    // pelo Prompt, ou de referência do Avatar/Produto).
    if (!promptShots.length && !avatarImg && !productImg) {
      await prisma.workflow.update({ where: { id: wf.id }, data: { status: "READY" } });
      await ctx.log("Nenhuma imagem disponível (nem gerada pelo Prompt, nem de referência do Avatar/Produto) — sem isso não dá pra montar uma prévia real ainda.");
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
    if (promptShots.length >= 2) {
      // Sequência: 1 shot por nó Prompt que gerou imagem, concatenados na ordem topológica. Cada
      // shot recebe uma fatia proporcional da duração total e seu próprio Ken Burns, depois
      // "concat" costura tudo num único vídeo antes de aplicar a locução/áudio.
      const n = promptShots.length;
      const perSec = Math.max(1.2, durationSec / n);
      const perFrames = Math.max(2, Math.round(perSec * fps));
      for (const shot of promptShots) {
        inputs.push("-loop", "1", "-framerate", String(fps), "-t", perSec.toFixed(2), "-i", shot.file);
      }
      const chain = promptShots
        .map(
          (_, i) =>
            `[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,zoompan=z='1+0.08*on/${perFrames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${perFrames}:s=${W}x${H}:fps=${fps}[s${i}];`,
        )
        .join("");
      const concatInputs = promptShots.map((_, i) => `[s${i}]`).join("");
      filter = `${chain}${concatInputs}concat=n=${n}:v=1:a=0,format=yuv420p[vout]`;
    } else if (!promptShots.length && avatarImg && productImg) {
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
      // A imagem gerada pelo Prompt (quando existe) é o resultado mais "final" — tem prioridade
      // sobre as referências cruas de Avatar/Produto na composição de 1 imagem só.
      const only = promptShots[0]?.file || avatarImg || productImg!;
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
    const visualSource = promptShots.length
      ? promptShots.length > 1
        ? `sequência de ${promptShots.length} shots gerados pelo Prompt (IA)`
        : "imagem gerada pelo Prompt (IA)"
      : avatarImg && productImg
        ? "Avatar + Produto"
        : "1 imagem de referência";
    await ctx.log(`Prévia composta (${visualSource}${voiceFile ? " + locução real" : " + áudio mudo"}): ${path.basename(outFile)}`);

    renderData.status = "DONE";
    renderData.outputUrl = relPath(outFile);
    renderData.renderedAt = new Date().toISOString();
    if (promptShots.length) {
      renderData.shots = promptShots.map((s, i) => ({ url: relPath(s.file), label: `Shot ${i + 1}` }));
    }
    await prisma.workflow.update({ where: { id: wf.id }, data: { status: "DONE", graph: JSON.stringify(graph) } });
    return { order, composed: true, outputUrl: relPath(outFile) };
  } catch (err) {
    await prisma.workflow.update({ where: { id: wf.id }, data: { status: "READY" } });
    throw err;
  }
}
