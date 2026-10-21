"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@vincere-studio/db";
import {
  AvatarData,
  ProductData,
  PromptData,
  RenderData,
  SceneData,
  VoiceData,
  WORKFLOW_KINDS,
  WorkflowGraph,
  templateGraph,
  type WorkflowKind,
  type WorkflowNode,
  type WorkflowEdge,
} from "@vincere-studio/core";
import { getTextProvider } from "@vincere-studio/providers";
import { createRequest } from "@/lib/claude-inbox";

function edge(source: string, target: string): WorkflowEdge {
  return { id: `e-${source}-${target}`, source, target };
}

/**
 * Monta um grafo ComfyUI completo a partir da descrição em linguagem natural do usuário
 * (e enriquecido pela IA quando disponível).
 */
async function buildGraphFromGoal(
  goal: string,
  format: string,
  stylePreset: string,
): Promise<{ name: string; kind: WorkflowKind; graph: WorkflowGraph }> {
  const isHorizontal = format === "16:9";
  const width = isHorizontal ? 1920 : 1080;
  const height = isHorizontal ? 1080 : 1920;
  const cleanGoal = goal.trim() || "Vídeo dinâmico com alta retenção";

  let hookShotPrompt = `Hook visual cinematográfico (${format}) para: ${cleanGoal}, iluminação dramática, ultra-detalhado`;
  let bodyShotPrompt = `Cena de desenvolvimento e corte dinâmico (${format}) ilustrando: ${cleanGoal}, movimento de câmera fluido`;
  let voiceScript = `${cleanGoal}. Veja como cada etapa se conecta para entregar o resultado final com ritmo e retenção máxima.`;
  let flowTitle = cleanGoal.length > 42 ? `${cleanGoal.slice(0, 42)}…` : cleanGoal;

  try {
    const provider = getTextProvider();
    const prompt = [
      "Você é o arquiteto de fluxos nodais (estilo ComfyUI) do Vincere Studio.",
      `Meta do usuário: "${cleanGoal}" | Formato: ${format} | Estilo base: ${stylePreset}.`,
      "Responda APENAS um JSON puro com as chaves:",
      '{"title":"nome curto do fluxo","hookPrompt":"prompt visual em inglês/português para o Shot 1 (gancho)","bodyPrompt":"prompt visual para o Shot 2 (desenvolvimento/corte)","voiceScript":"roteiro de locução natural de 15 a 25 segundos em português"}',
    ].join("\n");
    const res = await provider.generateText(prompt, { temperature: 0.3, maxOutputTokens: 500 });
    const match = res.text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]) as {
        title?: string;
        hookPrompt?: string;
        bodyPrompt?: string;
        voiceScript?: string;
      };
      if (parsed.title) flowTitle = parsed.title.slice(0, 60);
      if (parsed.hookPrompt) hookShotPrompt = parsed.hookPrompt;
      if (parsed.bodyPrompt) bodyShotPrompt = parsed.bodyPrompt;
      if (parsed.voiceScript) voiceScript = parsed.voiceScript;
    }
  } catch {
    // Fallback determinístico instantâneo se o provedor de texto estiver sem chave
  }

  const useAvatar =
    stylePreset === "ugc" ||
    stylePreset === "cortes" ||
    /avatar|pessoa|falando|apresentador|corte|ugc|clone/i.test(cleanGoal);

  const sourceNode: WorkflowNode = useAvatar
    ? {
        id: "avatar-1",
        type: "AVATAR",
        position: { x: 60, y: 120 },
        data: AvatarData.parse({
          kind: "AVATAR",
          name: stylePreset === "cortes" ? "Apresentador / Corte Principal" : "Criador IA Consistente",
          role: `Estilo: ${stylePreset.toUpperCase()} (${format})`,
          gaze: `Direct-to-Camera (${format})`,
          expression: "Alta Retenção & Gancho",
        }),
      }
    : {
        id: "product-1",
        type: "PRODUCT",
        position: { x: 60, y: 120 },
        data: ProductData.parse({
          kind: "PRODUCT",
          name: flowTitle,
          description: `Ativo visual principal (${stylePreset})`,
        }),
      };

  const sceneNode: WorkflowNode = {
    id: "scene-1",
    type: "SCENE",
    position: { x: 60, y: 440 },
    data: SceneData.parse({
      kind: "SCENE",
      name: `Direção Visual (${stylePreset})`,
      description: `Ambiente configurado para: ${cleanGoal}`,
      mood: stylePreset === "dossie" ? "Investigativo & Contrastado" : "Cinematográfico & Dinâmico",
      timeOfDay: "Iluminação de Estúdio / Recorte Profundo",
    }),
  };

  const promptShot1: WorkflowNode = {
    id: "prompt-1",
    type: "PROMPT",
    position: { x: 520, y: 40 },
    data: PromptData.parse({
      kind: "PROMPT",
      format: `${format} — Shot 1 (Gancho 0-3s)`,
      fps: 60,
      positive: hookShotPrompt,
      negative: "blurry, low quality, watermark, distorted",
      imageProvider: "POLLINATIONS",
    }),
  };

  const promptShot2: WorkflowNode = {
    id: "prompt-2",
    type: "PROMPT",
    position: { x: 520, y: 340 },
    data: PromptData.parse({
      kind: "PROMPT",
      format: `${format} — Shot 2 (Corte & B-Roll)`,
      fps: 60,
      positive: bodyShotPrompt,
      negative: "blurry, low quality, watermark, static",
      imageProvider: "POLLINATIONS",
    }),
  };

  const voiceNode: WorkflowNode = {
    id: "voice-1",
    type: "VOICE",
    position: { x: 520, y: 640 },
    data: VoiceData.parse({
      kind: "VOICE",
      provider: "GPU Local (RVC V2 + Whisper) / Edge TTS",
      voiceId: "pt-BR-AntonioNeural",
      script: voiceScript,
      durationSec: 18,
    }),
  };

  const renderNode: WorkflowNode = {
    id: "render-1",
    type: "RENDER",
    position: { x: 1040, y: 260 },
    data: RenderData.parse({
      kind: "RENDER",
      title: `${flowTitle} (${format})`,
      width,
      height,
      fps: 60,
      captions: true,
      status: "READY",
    }),
  };

  const nodes: WorkflowNode[] = [sourceNode, sceneNode, promptShot1, promptShot2, voiceNode, renderNode];
  const edges: WorkflowEdge[] = [
    edge(sourceNode.id, promptShot1.id),
    edge(sourceNode.id, promptShot2.id),
    edge(sceneNode.id, promptShot1.id),
    edge(sceneNode.id, promptShot2.id),
    edge(promptShot1.id, renderNode.id),
    edge(promptShot2.id, renderNode.id),
    edge(voiceNode.id, renderNode.id),
  ];

  return {
    name: flowTitle,
    kind: useAvatar ? "UGC" : "VERTICAL_COMMERCIAL",
    graph: { nodes, edges },
  };
}

export async function createWorkflowWithAi(formData: FormData) {
  const goal = String(formData.get("goal") ?? "").trim();
  const format = String(formData.get("format") ?? "9:16");
  const stylePreset = String(formData.get("stylePreset") ?? "motion");

  const built = await buildGraphFromGoal(goal, format, stylePreset);
  const wf = await prisma.workflow.create({
    data: {
      name: built.name,
      kind: built.kind,
      graph: JSON.stringify(built.graph),
      status: "READY",
    },
  });

  await createRequest({
    pedido: `[Fluxo Nodal IA Criado: "${built.name}" (${format} · ${stylePreset})] Meta do usuário: "${goal}". O grafo de nodes já foi montado em /workflow/${wf.id} pronto para aprovação e execução.`,
    pagina: `/workflow/${wf.id}`,
  }).catch(() => {});

  redirect(`/workflow/${wf.id}`);
}

export async function createWorkflow(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim() || "Novo fluxo vertical";
  const kindRaw = String(formData.get("kind") ?? "");
  const kind: WorkflowKind = (WORKFLOW_KINDS as readonly string[]).includes(kindRaw) ? (kindRaw as WorkflowKind) : "CUSTOM";
  const graph = templateGraph(kind);
  const hasRender = graph.nodes.some((n) => n.type === "RENDER");
  const wf = await prisma.workflow.create({
    data: { name, kind, graph: JSON.stringify(graph), status: hasRender && graph.edges.length > 0 ? "READY" : "DRAFT" },
  });
  redirect(`/workflow/${wf.id}`);
}

export async function saveWorkflow(id: string, graphJson: string) {
  const graph = WorkflowGraph.parse(JSON.parse(graphJson));
  const hasRender = graph.nodes.some((n) => n.type === "RENDER");
  await prisma.workflow.update({
    where: { id },
    data: { graph: JSON.stringify(graph), status: hasRender && graph.edges.length > 0 ? "READY" : "DRAFT" },
  });
  revalidatePath(`/workflow/${id}`);
  return { ok: true, savedAt: new Date().toISOString() };
}

export async function runWorkflow(id: string) {
  const job = await prisma.job.create({ data: { type: "RUN_WORKFLOW", payload: JSON.stringify({ workflowId: id }) } });
  await prisma.workflow.update({ where: { id }, data: { status: "RUNNING" } });
  revalidatePath(`/workflow/${id}`);
  return job.id;
}

export async function deleteWorkflow(id: string) {
  await prisma.workflow.delete({ where: { id } });
  revalidatePath("/workflow");
}
