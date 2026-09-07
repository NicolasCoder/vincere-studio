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
  provider: z.string().default("Gemini TTS"),
  voiceId: z.string().default("Clara - Conversational"),
  script: z.string().default(""),
  durationSec: z.number().default(15),
  lipSync: z.string().default("LivePortrait"),
  latencyMs: z.number().default(42),
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
