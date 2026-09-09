import { z } from "zod";

/**
 * Workflow Studio (Video Canvas): grafo de nós para criação manual e encadeada
 * de comerciais e vídeos verticais. O front-end edita o grafo; o worker, em uma
 * sprint futura, executa-o (job RUN_WORKFLOW) percorrendo as arestas.
 *
 * Tudo aqui é aditivo: não toca no pipeline de documentários.
 */

export const NODE_KINDS = ["AVATAR", "PRODUCT", "PROMPT", "VOICE", "RENDER"] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

export const AvatarData = z.object({
  kind: z.literal("AVATAR"),
  name: z.string().default("Aria v3.4"),
  role: z.string().default("Digital Creator · Beauty & Tech"),
  imageUrl: z.string().optional(),
  faceConsistency: z.number().min(0).max(100).default(96),
  gaze: z.string().default("Direct-to-Camera (9:16)"),
  expression: z.string().default("Conversational & Hook"),
  headPose: z.string().default("Natural Micro-Nod"),
});

export const ProductData = z.object({
  kind: z.literal("PRODUCT"),
  name: z.string().default("Aura Night Serum"),
  description: z.string().default("Cosmetic Matte Black 30ml"),
  imageUrl: z.string().optional(),
  fidelity: z.number().min(0).max(1).default(0.94),
  lighting: z.string().default("Studio Dark Rim Light"),
  interaction: z.string().default("Product In-Hand Reveal"),
  reflection: z.string().default("HDRI Studio Velvet"),
});

export const PromptData = z.object({
  kind: z.literal("PROMPT"),
  format: z.string().default("9:16 UGC Commercial"),
  fps: z.number().default(60),
  positive: z.string().default(""),
  negative: z.string().default(""),
  engine: z.string().default("Veo / Wan 2.1"),
  motionStrength: z.number().min(0).max(1).default(0.78),
  steps: z.number().default(35),
});

export const VoiceData = z.object({
  kind: z.literal("VOICE"),
  provider: z.string().default("Edge TTS (grátis)"),
  voiceId: z.string().default("pt-BR-FranciscaNeural"),
  script: z.string().default(""),
  durationSec: z.number().default(15),
  lipSync: z.string().default("LivePortrait"),
  latencyMs: z.number().default(42),
  /** relPath (storage/…) da última prévia de áudio gerada de fato (Edge TTS), se houver. */
  previewUrl: z.string().optional(),
});

export const RenderData = z.object({
  kind: z.literal("RENDER"),
  title: z.string().default("Comercial 9:16"),
  width: z.number().default(1080),
  height: z.number().default(1920),
  fps: z.number().default(60),
  bitrate: z.string().default("24 Mbps H.265"),
  captions: z.boolean().default(true),
  status: z.enum(["IDLE", "READY", "RENDERING", "DONE", "FAILED"]).default("IDLE"),
  /** relPath (storage/…) do MP4 de fato renderizado pela última execução (montagem gratuita via
   * ffmpeg a partir das imagens de referência + voz do fluxo — não é geração de vídeo por IA). */
  outputUrl: z.string().optional(),
  renderedAt: z.string().optional(),
});

export const WorkflowNodeData = z.discriminatedUnion("kind", [AvatarData, ProductData, PromptData, VoiceData, RenderData]);
export type WorkflowNodeData = z.infer<typeof WorkflowNodeData>;

export const WorkflowNode = z.object({
  id: z.string(),
  type: z.enum(NODE_KINDS),
  position: z.object({ x: z.number(), y: z.number() }),
  data: WorkflowNodeData,
});
export const WorkflowEdge = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
});
export const WorkflowGraph = z.object({
  nodes: z.array(WorkflowNode).default([]),
  edges: z.array(WorkflowEdge).default([]),
  viewport: z.object({ x: z.number(), y: z.number(), zoom: z.number() }).optional(),
});
export type WorkflowGraph = z.infer<typeof WorkflowGraph>;
export type WorkflowNode = z.infer<typeof WorkflowNode>;
export type WorkflowEdge = z.infer<typeof WorkflowEdge>;

/** Metadados de cada tipo de nó: usados pela paleta, pelo header e pela cor da aresta. */
export const NODE_META: Record<NodeKind, { label: string; icon: string; tone: "cyan" | "violet" | "amber" | "emerald"; description: string }> = {
  AVATAR: { label: "Avatar / IA Influencer", icon: "face_6", tone: "violet", description: "Apresentador digital consistente, olhar e expressão" },
  PRODUCT: { label: "Produto & Packshot 3D", icon: "shelves", tone: "cyan", description: "Objeto/produto com fidelidade e iluminação" },
  PROMPT: { label: "Prompt & Qualidade Visual", icon: "psychology", tone: "violet", description: "Prompt positivo/negativo, motor e parâmetros" },
  VOICE: { label: "Voz & Sincronização Labial", icon: "graphic_eq", tone: "amber", description: "Locução, voice ID e lip-sync" },
  RENDER: { label: "Renderizador Vertical", icon: "video_camera_front", tone: "emerald", description: "Composição final 9:16 (alvo do fluxo)" },
};

/** Cria os dados padrão de um nó novo. */
export function defaultNodeData(kind: NodeKind): WorkflowNodeData {
  switch (kind) {
    case "AVATAR": return AvatarData.parse({ kind });
    case "PRODUCT": return ProductData.parse({ kind });
    case "PROMPT": return PromptData.parse({ kind });
    case "VOICE": return VoiceData.parse({ kind });
    case "RENDER": return RenderData.parse({ kind });
  }
}

/** Regras de conexão: o que pode alimentar o quê. */
export const ALLOWED_EDGES: Record<NodeKind, NodeKind[]> = {
  AVATAR: ["PROMPT", "VOICE", "RENDER"],
  PRODUCT: ["PROMPT", "RENDER"],
  PROMPT: ["RENDER", "VOICE"],
  VOICE: ["RENDER"],
  RENDER: [],
};
export const canConnect = (from: NodeKind, to: NodeKind) => ALLOWED_EDGES[from].includes(to);

/**
 * "Tipo de workflow": hoje é só um rótulo salvo no banco (Workflow.kind). Passa a ter efeito real
 * na criação — cada tipo começa com um template de nós já encadeado, em vez de sempre a mesma
 * tela em branco com 1 nó Renderizador.
 */
export const WORKFLOW_KINDS = ["VERTICAL_COMMERCIAL", "UGC", "CUSTOM"] as const;
export type WorkflowKind = (typeof WORKFLOW_KINDS)[number];

export const WORKFLOW_KIND_META: Record<WorkflowKind, { label: string; description: string; icon: string }> = {
  VERTICAL_COMMERCIAL: { label: "Comercial Vertical", icon: "shelves", description: "Produto em destaque: packshot + prompt de cena + locução, prontos pra conectar." },
  UGC: { label: "UGC / Influencer", icon: "face_6", description: "Avatar/criador digital falando direto pra câmera, com prompt de cena e locução já ligados a ele." },
  CUSTOM: { label: "Personalizado", icon: "hub", description: "Canvas em branco — só o nó Renderizador, você monta o fluxo do seu jeito." },
};

function edge(source: string, target: string): WorkflowEdge {
  return { id: `e-${source}-${target}`, source, target };
}

/** Grafo inicial de cada tipo de workflow, usado ao criar um fluxo novo. */
export function templateGraph(kind: WorkflowKind): WorkflowGraph {
  if (kind === "VERTICAL_COMMERCIAL") {
    return {
      nodes: [
        { id: "product-1", type: "PRODUCT", position: { x: 80, y: 160 }, data: defaultNodeData("PRODUCT") },
        { id: "prompt-1", type: "PROMPT", position: { x: 560, y: 60 }, data: defaultNodeData("PROMPT") },
        { id: "voice-1", type: "VOICE", position: { x: 560, y: 420 }, data: defaultNodeData("VOICE") },
        { id: "render-1", type: "RENDER", position: { x: 1080, y: 220 }, data: defaultNodeData("RENDER") },
      ],
      edges: [edge("product-1", "prompt-1"), edge("prompt-1", "voice-1"), edge("prompt-1", "render-1"), edge("voice-1", "render-1")],
    };
  }
  if (kind === "UGC") {
    return {
      nodes: [
        { id: "avatar-1", type: "AVATAR", position: { x: 80, y: 160 }, data: defaultNodeData("AVATAR") },
        { id: "prompt-1", type: "PROMPT", position: { x: 560, y: 60 }, data: defaultNodeData("PROMPT") },
        { id: "voice-1", type: "VOICE", position: { x: 560, y: 420 }, data: defaultNodeData("VOICE") },
        { id: "render-1", type: "RENDER", position: { x: 1080, y: 220 }, data: defaultNodeData("RENDER") },
      ],
      edges: [edge("avatar-1", "prompt-1"), edge("avatar-1", "voice-1"), edge("prompt-1", "render-1"), edge("voice-1", "render-1")],
    };
  }
  // CUSTOM: canvas em branco, só o alvo do fluxo.
  return {
    nodes: [{ id: "render-1", type: "RENDER", position: { x: 900, y: 200 }, data: defaultNodeData("RENDER") }],
    edges: [],
  };
}
