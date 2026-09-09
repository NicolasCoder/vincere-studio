"use client";
import { createContext, useContext, useState } from "react";
import { useReactFlow, type Node, type NodeProps, type NodeTypes } from "@xyflow/react";
import type { WorkflowNodeData, NodeKind } from "@docupulse/core";
import { Icon } from "@docupulse/ui";
import { Field, Meter, NodeShell, Thumb } from "./NodeShell";

export type CanvasNode = Node<WorkflowNodeData & { index?: number }, NodeKind>;

/** Id do workflow atual + callback pra marcar o grafo como alterado (dispara o autosave). */
export const WorkflowIdContext = createContext<{ workflowId: string; markDirty: () => void }>({ workflowId: "", markDirty: () => {} });

function useUpdate(id: string) {
  const { updateNodeData } = useReactFlow();
  return (patch: Record<string, unknown>) => updateNodeData(id, patch);
}

/** Upload de imagem de referência (Avatar/Produto) — salva em storage/workflows/<id>/refs. */
function useImageUpload(nodeId: string, set: (patch: Record<string, unknown>) => void) {
  const { workflowId, markDirty } = useContext(WorkflowIdContext);
  const [uploading, setUploading] = useState(false);
  const onPick = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("nodeId", nodeId);
      const res = await fetch(`/api/workflows/${workflowId}/upload`, { method: "POST", body: fd });
      const json = await res.json();
      if (json.imageUrl) {
        set({ imageUrl: json.imageUrl });
        // updateNodeData não passa pelo onNodesChange do canvas, então sem isso o grafo nunca
        // ficava "dirty" e a imagem enviada podia se perder se o usuário não salvasse na mão.
        markDirty();
      }
    } finally {
      setUploading(false);
    }
  };
  return { onPick, uploading };
}

function AvatarNode({ id, data, selected }: NodeProps<CanvasNode>) {
  const d = data as Extract<WorkflowNodeData, { kind: "AVATAR" }> & { index?: number };
  const set = useUpdate(id);
  const { onPick, uploading } = useImageUpload(id, set);
  return (
    <NodeShell kind="AVATAR" index={d.index ?? 1} selected={selected}>
      <div className="flex gap-3 rounded border border-line bg-void/40 p-3">
        <Thumb label="9:16 FEED" icon="person" imageUrl={d.imageUrl} onPick={onPick} uploading={uploading} />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <input className="nodrag w-full bg-transparent font-display text-base font-semibold outline-none" value={d.name} onChange={(e) => set({ name: e.target.value })} />
            <span className="rounded-sm bg-secondary/30 px-1.5 py-0.5 font-mono text-[9px] text-secondary-soft">UGC</span>
          </div>
          <input className="nodrag w-full bg-transparent font-mono text-[11px] text-fg-secondary outline-none" value={d.role} onChange={(e) => set({ role: e.target.value })} />
          <Meter label="Face Consistency" value={d.faceConsistency} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Gaze Direction" value={d.gaze} onChange={(v) => set({ gaze: v })} />
        <Field label="Expression Mode" value={d.expression} onChange={(v) => set({ expression: v })} />
      </div>
      <Field label="Head Pose Tracking" value={d.headPose} onChange={(v) => set({ headPose: v })} />
    </NodeShell>
  );
}

function ProductNode({ id, data, selected }: NodeProps<CanvasNode>) {
  const d = data as Extract<WorkflowNodeData, { kind: "PRODUCT" }> & { index?: number };
  const set = useUpdate(id);
  const { onPick, uploading } = useImageUpload(id, set);
  return (
    <NodeShell kind="PRODUCT" index={d.index ?? 2} selected={selected}>
      <div className="flex gap-3 rounded border border-line bg-void/40 p-3">
        <Thumb label="ASSET 3D" icon="deployed_code" imageUrl={d.imageUrl} onPick={onPick} uploading={uploading} />
        <div className="min-w-0 flex-1 space-y-2">
          <input className="nodrag w-full bg-transparent font-display text-base font-semibold outline-none" value={d.name} onChange={(e) => set({ name: e.target.value })} />
          <input className="nodrag w-full bg-transparent font-mono text-[11px] text-fg-secondary outline-none" value={d.description} onChange={(e) => set({ description: e.target.value })} />
          <Meter label="Fidelity Weight" value={d.fidelity} max={1} unit="" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Lighting Match" value={d.lighting} onChange={(v) => set({ lighting: v })} />
        <Field label="Interaction Mode" value={d.interaction} onChange={(v) => set({ interaction: v })} />
      </div>
      <Field label="Reflection Mapping" value={d.reflection} onChange={(v) => set({ reflection: v })} />
    </NodeShell>
  );
}

function SceneNode({ id, data, selected }: NodeProps<CanvasNode>) {
  const d = data as Extract<WorkflowNodeData, { kind: "SCENE" }> & { index?: number };
  const set = useUpdate(id);
  return (
    <NodeShell kind="SCENE" index={d.index ?? 3} selected={selected}>
      <input className="nodrag w-full bg-transparent font-display text-base font-semibold outline-none" value={d.name} onChange={(e) => set({ name: e.target.value })} />
      <Field label="Descrição do cenário (contexto pro Prompt)" value={d.description} onChange={(v) => set({ description: v })} multiline mono={false} />
      <div className="grid grid-cols-2 gap-2">
        <Field label="Clima / Mood" value={d.mood} onChange={(v) => set({ mood: v })} />
        <Field label="Iluminação / Hora" value={d.timeOfDay} onChange={(v) => set({ timeOfDay: v })} />
      </div>
    </NodeShell>
  );
}

/** Prévia de keyframe sob demanda (botão "Gerar Keyframe") — chama a geração de imagem real
 * (Gemini/Nano Banana) só pra esse nó, usando o Avatar/Produto/Cenário já conectados como
 * contexto, sem precisar rodar o fluxo inteiro. Espelha o padrão de prévia do nó de Voz. */
function usePromptKeyframe(nodeId: string, data: Extract<WorkflowNodeData, { kind: "PROMPT" }>, set: (patch: Record<string, unknown>) => void) {
  const { workflowId } = useContext(WorkflowIdContext);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generate = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/workflows/${workflowId}/keyframe-preview`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nodeId, positive: data.positive, negative: data.negative, format: data.format, imageProvider: data.imageProvider }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "falha ao gerar keyframe");
      set({ keyframeUrl: json.imageUrl });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };
  return { generate, loading, error };
}

function PromptNode({ id, data, selected }: NodeProps<CanvasNode>) {
  const d = data as Extract<WorkflowNodeData, { kind: "PROMPT" }> & { index?: number };
  const set = useUpdate(id);
  const { generate, loading, error } = usePromptKeyframe(id, d, set);
  return (
    <NodeShell kind="PROMPT" index={d.index ?? 4} selected={selected} width={460}>
      <div className="flex gap-2">
        <span className="rounded-sm border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary-bright">{d.format}</span>
        <span className="rounded-sm border border-line bg-void/60 px-2 py-0.5 font-mono text-[10px] text-fg-secondary">{d.fps} FPS</span>
      </div>
      {d.keyframeUrl && (
        <div className="relative overflow-hidden rounded border border-line bg-void/60">
          <img src={`/api/media/${d.keyframeUrl}`} alt="Keyframe" className="max-h-48 w-full object-contain" />
        </div>
      )}
      <Field label="Prompt Positivo (Comercial 9:16)" value={d.positive} onChange={(v) => set({ positive: v })} multiline mono={false} suffix={<span className="font-mono text-[10px] text-primary-bright">{d.positive.length} chars</span>} />
      <Field label="Prompt Negativo" value={d.negative} onChange={(v) => set({ negative: v })} mono={false} />
      <div className="grid grid-cols-2 gap-2">
        <Field label="Model Engine" value={d.engine} onChange={(v) => set({ engine: v })} />
        <Field label="Motion Strength" value={d.motionStrength} onChange={(v) => set({ motionStrength: Number(v) || 0 })} />
      </div>
      <Field label="Sampling Steps" value={`${d.steps} Steps · Euler A`} />
      <div className="rounded border border-line bg-void/60 px-3 py-2">
        <span className="label-mono text-muted">Motor de imagem</span>
        <select
          className="nodrag mt-1 w-full bg-transparent font-mono text-[12px] text-primary-bright outline-none"
          value={d.imageProvider}
          onChange={(e) => set({ imageProvider: e.target.value })}
        >
          <option value="GEMINI" className="bg-surface-low">Gemini · Nano Banana (pago, controlado por orçamento)</option>
          <option value="POLLINATIONS" className="bg-surface-low">Pollinations.ai (grátis, sem referência)</option>
        </select>
      </div>
      <div className="nodrag flex items-center gap-2">
        <button
          type="button"
          onClick={generate}
          disabled={loading || !d.positive.trim()}
          className="flex items-center gap-1 rounded border border-primary/40 bg-primary/10 px-2 py-1 font-mono text-[10px] text-primary-bright disabled:opacity-40"
        >
          <Icon name={loading ? "sync" : "auto_awesome"} className={loading ? "animate-spin text-[14px]" : "text-[14px]"} />
          {loading ? "Gerando…" : d.keyframeUrl ? "Regenerar Keyframe" : "Gerar Keyframe (IA real)"}
        </button>
      </div>
      {error && <div className="font-mono text-[10px] text-error">{error}</div>}
    </NodeShell>
  );
}

const EDGE_VOICES = [
  { id: "pt-BR-AntonioNeural", label: "Antônio · Grave" },
  { id: "pt-BR-FranciscaNeural", label: "Francisca · Clara" },
  { id: "pt-BR-ThalitaNeural", label: "Thalita · Jovem" },
  { id: "pt-BR-MacerioMultilingualNeural", label: "Macério · Multilíngue" },
];

function VoiceNode({ id, data, selected }: NodeProps<CanvasNode>) {
  const d = data as Extract<WorkflowNodeData, { kind: "VOICE" }> & { index?: number };
  const set = useUpdate(id);
  const { workflowId } = useContext(WorkflowIdContext);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/workflows/${workflowId}/voice-preview`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nodeId: id, text: d.script, voiceId: d.voiceId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "falha ao gerar prévia");
      set({ previewUrl: json.audioUrl, durationSec: Math.round(json.durationMs / 1000) });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <NodeShell kind="VOICE" index={d.index ?? 5} selected={selected}>
      <div className="rounded border border-line bg-void/60 p-3">
        <div className="flex items-center justify-between font-mono text-[10px]">
          <span className="text-fg-secondary">EDGE TTS · PRÉVIA REAL</span>
          <span className="text-warning">{d.durationSec}s</span>
        </div>
        <div className="mt-2 flex h-8 items-end gap-[3px]">
          {Array.from({ length: 40 }).map((_, i) => <div key={i} className="flex-1 rounded-sm bg-primary-bright/70" style={{ height: `${25 + Math.abs(Math.sin(i * 0.9) * 75)}%` }} />)}
        </div>
        <div className="nodrag mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={preview}
            disabled={loading || !d.script.trim()}
            className="flex items-center gap-1 rounded border border-warning/40 bg-warning/10 px-2 py-1 font-mono text-[10px] text-warning disabled:opacity-40"
          >
            <Icon name={loading ? "sync" : "play_circle"} className={loading ? "animate-spin text-[14px]" : "text-[14px]"} />
            {loading ? "Gerando…" : "Ouvir prévia (Edge TTS)"}
          </button>
          {d.previewUrl && !loading && <audio controls preload="none" src={`/api/media/${d.previewUrl}`} className="nodrag h-7 flex-1" />}
        </div>
        {error && <div className="mt-1 font-mono text-[10px] text-error">{error}</div>}
      </div>
      <Field label="Roteiro da locução" value={d.script} onChange={(v) => set({ script: v })} multiline mono={false} tone="amber" />
      <div className="rounded border border-line bg-void/60 px-3 py-2">
        <span className="label-mono text-muted">Voice ID (Edge TTS)</span>
        <select
          className="nodrag mt-1 w-full bg-transparent font-mono text-[12px] text-warning outline-none"
          value={EDGE_VOICES.some((v) => v.id === d.voiceId) ? d.voiceId : EDGE_VOICES[1].id}
          onChange={(e) => set({ voiceId: e.target.value })}
        >
          {EDGE_VOICES.map((v) => (
            <option key={v.id} value={v.id} className="bg-surface-low">{v.label}</option>
          ))}
        </select>
      </div>
      <Field label="Lip-Sync Engine" value={d.lipSync} onChange={(v) => set({ lipSync: v })} tone="amber" />
    </NodeShell>
  );
}

function RenderNode({ data, selected }: NodeProps<CanvasNode>) {
  const d = data as Extract<WorkflowNodeData, { kind: "RENDER" }>;
  return (
    <NodeShell kind="RENDER" index={5} selected={selected} isTarget>
      <div className="relative overflow-hidden rounded border border-line bg-gradient-to-b from-secondary/20 via-void to-primary/20" style={{ height: 260 }}>
        {d.outputUrl ? (
          <video controls preload="metadata" src={`/api/media/${d.outputUrl}`} className="nodrag h-full w-full bg-black object-contain" />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <div className="font-display text-xl font-bold">{d.title}</div>
              <div className="mt-1 font-mono text-[10px] text-fg-secondary">{d.width} × {d.height} · {d.fps} FPS</div>
              <div className="mt-3 text-[11px] text-fg-secondary">Prévia gratuita: Ken Burns nas imagens de referência + locução real (Edge TTS). Motor de vídeo por IA fica pro Flow.</div>
            </div>
          </div>
        )}
        <span className="absolute left-2 top-2 rounded-sm bg-void/80 px-1.5 font-mono text-[9px] text-primary-bright">{d.outputUrl ? "RENDER REAL" : "PREVIEW 9:16"}</span>
      </div>
      {d.shots && d.shots.length > 1 ? (
        <div className="rounded border border-line bg-void/60 p-2">
          <div className="label-mono mb-1.5 flex items-center gap-1 text-muted">
            <Icon name="view_timeline" className="text-[13px]" />
            Sequência · {d.shots.length} shots
          </div>
          <div className="nodrag flex gap-1.5 overflow-x-auto">
            {d.shots.map((shot, i) => (
              <div key={shot.url + i} className="relative shrink-0 overflow-hidden rounded border border-line" style={{ width: 52, height: 92 }}>
                <img src={`/api/media/${shot.url}`} alt={shot.label ?? `Shot ${i + 1}`} className="h-full w-full object-cover" />
                <span className="absolute bottom-0.5 left-0.5 rounded-sm bg-void/80 px-1 font-mono text-[8px] text-primary-bright">{i + 1}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <Field label="Resolução" value={`${d.width} × ${d.height}`} tone="emerald" />
        <Field label="Bitrate" value={d.bitrate} tone="emerald" />
      </div>
      <div className="flex items-center justify-between rounded border border-line bg-void/60 px-3 py-2">
        <span className="label-mono text-muted">Status Pipeline</span>
        <span className="flex items-center gap-1 font-mono text-[11px] text-success"><Icon name="check_circle" className="text-[14px]" />{d.status === "READY" ? "Pronto p/ Renderizar" : d.status}</span>
      </div>
    </NodeShell>
  );
}

export const nodeTypes: NodeTypes = {
  AVATAR: AvatarNode,
  PRODUCT: ProductNode,
  SCENE: SceneNode,
  PROMPT: PromptNode,
  VOICE: VoiceNode,
  RENDER: RenderNode,
};
