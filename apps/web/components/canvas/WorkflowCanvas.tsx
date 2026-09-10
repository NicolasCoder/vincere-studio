"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  MiniMap,
  Panel,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type IsValidConnection,
  type OnConnect,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { NODE_KINDS, NODE_META, canConnect, defaultNodeData, type NodeKind, type WorkflowGraph, type WorkflowNodeData } from "@docupulse/core";
import { Badge, Button, Icon, cn } from "@docupulse/ui";
import { nodeTypes, WorkflowIdContext, type CanvasNode } from "./nodes";
import { TONE } from "./NodeShell";
import { runWorkflow, saveWorkflow } from "@/app/(studio)/workflow/actions";

const EDGE_COLOR: Record<NodeKind, string> = {
  AVATAR: TONE.violet.handle,
  PRODUCT: TONE.cyan.handle,
  SCENE: TONE.violet.handle,
  PROMPT: TONE.violet.handle,
  VOICE: TONE.amber.handle,
  RENDER: TONE.emerald.handle,
};

function toNodes(g: WorkflowGraph): CanvasNode[] {
  return g.nodes.map((n, i) => ({ id: n.id, type: n.type, position: n.position, data: { ...n.data, index: i + 1 } }));
}
function styledEdge(e: Edge, nodes: CanvasNode[]): Edge {
  const src = nodes.find((n) => n.id === e.source);
  const color = src ? EDGE_COLOR[src.type as NodeKind] : "#22d3ee";
  return { ...e, animated: true, style: { stroke: color, strokeWidth: 2.5, strokeDasharray: "8 6" } };
}
function toEdges(g: WorkflowGraph, nodes: CanvasNode[]): Edge[] {
  return g.edges.map((e) => styledEdge({ id: e.id, source: e.source, target: e.target }, nodes));
}

/**
 * Monta um roteiro de shots em texto simples pra colar no Google Flow (labs.google/flow) — motores
 * de vídeo de ponta que ainda não integramos por API (custam caro). Cada nó Prompt vira um bloco com
 * o contexto de Avatar/Produto/Voz conectados; imagens de referência ficam salvas em
 * storage/workflows/<id>/refs e o export só aponta o caminho, porque o Flow pede o anexo manual.
 */
function buildFlowExport(nodes: CanvasNode[], edges: Edge[], name: string, workflowId: string): string {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const incoming = (nid: string) => edges.filter((e) => e.target === nid).map((e) => byId.get(e.source)).filter(Boolean) as CanvasNode[];
  const prompts = nodes.filter((n) => n.type === "PROMPT");
  const lines: string[] = [
    `# Roteiro de shots — ${name}`,
    `# Exportado do Workflow Studio (Vincere Studio) para gerar externamente no Google Flow (labs.google/flow).`,
    `# Cole cada bloco "Prompt positivo/negativo" no Flow, escolhendo o motor indicado; anexe manualmente`,
    `# as imagens de referência listadas (estão salvas na sua máquina em storage/workflows/${workflowId}/refs/).`,
    "",
  ];
  if (!prompts.length) lines.push("(Nenhum node de Prompt no grafo ainda — adicione um pra gerar o roteiro de shots.)");
  prompts.forEach((p, i) => {
    const d = p.data as Extract<WorkflowNodeData, { kind: "PROMPT" }>;
    const ctx = incoming(p.id);
    const avatar = ctx.find((n) => n.type === "AVATAR")?.data as Extract<WorkflowNodeData, { kind: "AVATAR" }> | undefined;
    const product = ctx.find((n) => n.type === "PRODUCT")?.data as Extract<WorkflowNodeData, { kind: "PRODUCT" }> | undefined;
    const scene = ctx.find((n) => n.type === "SCENE")?.data as Extract<WorkflowNodeData, { kind: "SCENE" }> | undefined;
    const voice = ctx.find((n) => n.type === "VOICE")?.data as Extract<WorkflowNodeData, { kind: "VOICE" }> | undefined;
    lines.push(`=== Shot ${i + 1} — ${d.format} · ${d.fps}fps · motor sugerido: ${d.engine} ===`);
    if (avatar) lines.push(`Avatar: ${avatar.name} (${avatar.role}) — olhar: ${avatar.gaze}, expressão: ${avatar.expression}, pose: ${avatar.headPose}${avatar.imageUrl ? ` [imagem de referência: ${avatar.imageUrl}]` : " [sem imagem de referência anexada]"}`);
    if (product) lines.push(`Produto: ${product.name} — ${product.description} (luz: ${product.lighting}, interação: ${product.interaction})${product.imageUrl ? ` [imagem de referência: ${product.imageUrl}]` : " [sem imagem de referência anexada]"}`);
    if (scene) lines.push(`Cenário: ${scene.name} — ${scene.description} (clima: ${scene.mood}, iluminação: ${scene.timeOfDay})`);
    lines.push("Prompt positivo:", d.positive || "(vazio)", "Prompt negativo:", d.negative || "(vazio)");
    if (voice) lines.push(`Roteiro de voz conectado (${voice.provider}, ${voice.durationSec}s): ${voice.script || "(vazio)"}`);
    lines.push("");
  });
  return lines.join("\n");
}

export function WorkflowCanvas(props: { id: string; name: string; status: string; initialGraph: WorkflowGraph }) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  );
}

function Canvas({ id, name, status, initialGraph }: { id: string; name: string; status: string; initialGraph: WorkflowGraph }) {
  const initialNodes = useMemo(() => toNodes(initialGraph), [initialGraph]);
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(toEdges(initialGraph, initialNodes));
  const { zoomIn, zoomOut, fitView, getZoom, screenToFlowPosition } = useReactFlow();
  const [zoom, setZoom] = useState(100);
  const [grid, setGrid] = useState<"dots" | "lines">("dots");
  const [menuOpen, setMenuOpen] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [liveStatus, setLiveStatus] = useState(status);
  const [job, setJob] = useState<{ status: string; progress: number; message?: string | null; error?: string | null; logs?: string } | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [pending, startTransition] = useTransition();
  const history = useRef<{ nodes: CanvasNode[]; edges: Edge[] }[]>([]);
  const future = useRef<{ nodes: CanvasNode[]; edges: Edge[] }[]>([]);

  const snapshot = useCallback(() => {
    history.current.push({ nodes: structuredClone(nodes), edges: structuredClone(edges) });
    if (history.current.length > 50) history.current.shift();
    future.current = [];
    setDirty(true);
  }, [nodes, edges]);

  const undo = () => {
    const prev = history.current.pop();
    if (!prev) return;
    future.current.push({ nodes, edges });
    setNodes(prev.nodes);
    setEdges(prev.edges);
  };
  const redo = () => {
    const next = future.current.pop();
    if (!next) return;
    history.current.push({ nodes, edges });
    setNodes(next.nodes);
    setEdges(next.edges);
  };

  const isValidConnection: IsValidConnection = useCallback(
    (c) => {
      const s = nodes.find((n) => n.id === c.source);
      const t = nodes.find((n) => n.id === c.target);
      return !!s && !!t && s.id !== t.id && canConnect(s.type as NodeKind, t.type as NodeKind);
    },
    [nodes],
  );

  const onConnect: OnConnect = useCallback(
    (c: Connection) => {
      snapshot();
      setEdges((eds) => addEdge(styledEdge({ ...c, id: `e-${c.source}-${c.target}-${Date.now()}` } as Edge, nodes), eds));
    },
    [nodes, setEdges, snapshot],
  );

  const addNode = (kind: NodeKind) => {
    snapshot();
    const pos = screenToFlowPosition({ x: window.innerWidth / 2 + Math.random() * 80, y: window.innerHeight / 2 + Math.random() * 80 });
    setNodes((ns) => [...ns, { id: `${kind.toLowerCase()}-${Date.now()}`, type: kind, position: pos, data: { ...defaultNodeData(kind), index: ns.length + 1 } }]);
    setMenuOpen(false);
  };

  const duplicateSelected = () => {
    const sel = nodes.filter((n) => n.selected);
    if (!sel.length) return;
    snapshot();
    setNodes((ns) => [
      ...ns.map((n) => ({ ...n, selected: false })),
      ...sel.map((n, i) => ({ ...n, id: `${n.id}-copy-${Date.now()}-${i}`, position: { x: n.position.x + 60, y: n.position.y + 60 }, selected: true })),
    ]);
  };

  const graphJson = useCallback(() =>
    JSON.stringify({
      nodes: nodes.map((n) => {
        const { index: _i, ...data } = n.data;
        return { id: n.id, type: n.type, position: n.position, data };
      }),
      edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
    }), [nodes, edges]);

  // Autosave: 1,5 s depois da última alteração.
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => {
      startTransition(async () => {
        const r = await saveWorkflow(id, graphJson());
        setSavedAt(r.savedAt);
        setDirty(false);
      });
    }, 1500);
    return () => clearTimeout(t);
  }, [dirty, nodes, edges, id, graphJson]);

  // Polling do status enquanto o worker executa o fluxo.
  useEffect(() => {
    if (liveStatus !== "RUNNING") return;
    const t = setInterval(async () => {
      const r = await fetch(`/api/workflows/${id}`).then((x) => x.json()).catch(() => null);
      if (!r) return;
      setLiveStatus(r.status);
      setJob(r.job);
      // Quando terminar, traz de volta o resultado real do node Renderizador (vídeo composto,
      // status) que o worker gravou direto no banco — o canvas não reconsulta isso sozinho.
      if (r.status !== "RUNNING" && r.graph) {
        try {
          const fresh = JSON.parse(r.graph) as WorkflowGraph;
          const freshRender = fresh.nodes.find((n) => n.type === "RENDER");
          if (freshRender) setNodes((ns) => ns.map((n) => (n.type === "RENDER" ? { ...n, data: { ...freshRender.data, index: n.data.index } } : n)));
        } catch {}
      }
    }, 2000);
    return () => clearInterval(t);
  }, [liveStatus, id, setNodes]);

  const save = () =>
    startTransition(async () => {
      const r = await saveWorkflow(id, graphJson());
      setSavedAt(r.savedAt);
      setDirty(false);
    });

  const run = () =>
    startTransition(async () => {
      await saveWorkflow(id, graphJson());
      await runWorkflow(id);
      setDirty(false);
      setJob(null);
      setLiveStatus("RUNNING");
      setShowLog(true);
    });

  const totalSec = nodes.filter((n) => n.type === "VOICE").reduce((s, n) => s + Number((n.data as { durationSec?: number }).durationSec ?? 0), 0);

  const exportToFlow = () => {
    const text = buildFlowExport(nodes, edges, name, id);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `flow-shots-${id.slice(-6)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const workflowCtx = useMemo(() => ({ workflowId: id, markDirty: () => setDirty(true) }), [id]);

  return (
    <div className="relative h-full w-full bg-void">
      <WorkflowIdContext.Provider value={workflowCtx}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={(ch) => {
          if (ch.some((c) => c.type === "remove" || c.type === "replace" || (c.type === "position" && c.dragging === false))) setDirty(true);
          onNodesChange(ch);
        }}
        onEdgesChange={(ch) => {
          if (ch.some((c) => c.type === "remove")) setDirty(true);
          onEdgesChange(ch);
        }}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onNodeDragStart={snapshot}
        onMove={() => setZoom(Math.round(getZoom() * 100))}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.2}
        maxZoom={2}
        deleteKeyCode={["Delete", "Backspace"]}
        proOptions={{ hideAttribution: true }}
        colorMode="dark"
        defaultEdgeOptions={{ animated: true }}
        connectionLineStyle={{ stroke: "#22d3ee", strokeWidth: 2.5, strokeDasharray: "8 6" }}
      >
        <Background variant={grid === "dots" ? BackgroundVariant.Dots : BackgroundVariant.Lines} gap={28} size={grid === "dots" ? 1.5 : 1} color="#2e3b52" />
        <MiniMap
          position="bottom-right"
          pannable
          zoomable
          style={{ background: "rgba(11,15,23,0.9)", border: "1px solid #2e3b52", borderRadius: 6 }}
          maskColor="rgba(11,15,23,0.6)"
          nodeColor={(n) => EDGE_COLOR[n.type as NodeKind] ?? "#64748b"}
        />

        {/* Barra superior */}
        <Panel position="top-left" className="!m-3">
          <div className="glass-elevated flex items-center gap-3 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2 border-r border-line pr-3">
              <span className="font-mono text-[11px] text-fg-secondary">Flow #{id.slice(-6).toUpperCase()}:</span>
              <span className="max-w-64 truncate font-mono text-[11px] text-primary-bright">{name}</span>
              <Badge tone={liveStatus === "RUNNING" ? "cyan" : liveStatus === "DONE" ? "violet" : "success"} pill dot={liveStatus === "RUNNING"}>
                {liveStatus === "RUNNING" ? `Executando ${job?.progress ?? 0}%` : liveStatus === "DONE" ? "Concluído" : "Online"}
              </Badge>
            </div>
            <div className="flex items-center gap-1 border-r border-line pr-3">
              <Button variant="icon" icon="remove" onClick={() => zoomOut()} />
              <span className="w-12 text-center font-mono text-xs">{zoom}%</span>
              <Button variant="icon" icon="add" onClick={() => zoomIn()} />
              <Button variant="icon" icon="center_focus_strong" title="Enquadrar" onClick={() => fitView({ padding: 0.15, duration: 300 })} />
              <Button variant="icon" icon={grid === "dots" ? "grid_4x4" : "grain"} title="Alternar malha" className={cn(grid === "lines" && "bg-primary/15 text-primary-bright")} onClick={() => setGrid(grid === "dots" ? "lines" : "dots")} />
            </div>
            <div className="flex items-center gap-2 font-mono text-[11px] text-fg-secondary">
              <Icon name="memory" className="text-[16px] text-primary-bright" />
              Node Engine: <span className="text-fg">{nodes.length} nós · {edges.length} conexões</span>
            </div>
          </div>
        </Panel>

        <Panel position="top-right" className="!m-3">
          <div className="flex items-center gap-2">
            {savedAt && !dirty && <span className="font-mono text-[10px] text-muted">salvo {new Date(savedAt).toLocaleTimeString("pt-BR")}</span>}
            {dirty && <span className="font-mono text-[10px] text-warning">{pending ? "salvando..." : "salvando em instantes"}</span>}
            <Button variant="icon" icon="terminal" title="Log da execução" className={cn(showLog && "bg-primary/15 text-primary-bright")} onClick={() => setShowLog((v) => !v)} />
            <Button icon="ios_share" title="Exporta os prompts pra colar no Google Flow (labs.google/flow) e gerar externamente com motores de ponta" onClick={exportToFlow}>Exportar p/ Flow</Button>
            <Button icon="save" onClick={save} disabled={pending}>Salvar Grafo</Button>
            <Button variant="primary" icon="motion_play" onClick={run} disabled={pending || liveStatus === "RUNNING"}>
              Executar Fluxo Vertical <kbd className="ml-1 rounded-sm bg-void/30 px-1 font-mono text-[10px] font-normal">F5</kbd>
            </Button>
          </div>
        </Panel>

        {/* Barra inferior */}
        <Panel position="bottom-left" className="!m-3">
          <div className="glass-elevated flex items-center gap-3 rounded-lg px-3 py-2">
            <div className="relative">
              <Button variant="primary" icon="add_circle" onClick={() => setMenuOpen((v) => !v)}>Adicionar Node</Button>
              {menuOpen && (
                <div className="glass-elevated absolute bottom-12 left-0 z-50 w-72 rounded-lg p-1">
                  {NODE_KINDS.map((k) => (
                    <button key={k} onClick={() => addNode(k)} className="flex w-full items-center gap-3 rounded px-3 py-2 text-left text-sm hover:bg-line/40">
                      <Icon name={NODE_META[k].icon} className={cn("text-[18px]", TONE[NODE_META[k].tone].text)} />
                      <span><span className="font-display font-semibold">{NODE_META[k].label}</span><br /><span className="text-[11px] text-fg-secondary">{NODE_META[k].description}</span></span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 border-l border-line pl-3">
              <Button variant="icon" icon="undo" title="Desfazer" onClick={undo} />
              <Button variant="icon" icon="redo" title="Refazer" onClick={redo} />
              <Button variant="icon" icon="content_copy" title="Duplicar selecionados" onClick={duplicateSelected} />
              <Button variant="icon" icon="delete" title="Excluir selecionados (Delete)" onClick={() => { snapshot(); setNodes((ns) => ns.filter((n) => !n.selected)); setEdges((es) => es.filter((e) => !e.selected)); }} />
            </div>
            <div className="flex items-center gap-2 border-l border-line pl-3">
              <span className="label-mono text-muted">Biblioteca rápida:</span>
              {(["AVATAR", "PRODUCT", "SCENE", "VOICE", "RENDER"] as NodeKind[]).map((k) => (
                <button key={k} onClick={() => addNode(k)} className="flex items-center gap-1 rounded border border-line bg-void/60 px-2 py-1 font-mono text-[11px] text-fg-secondary hover:border-line-glow hover:text-fg">
                  <Icon name={NODE_META[k].icon} className="text-[14px]" />{NODE_META[k].label.split(" ")[0]}
                </button>
              ))}
            </div>
            <div className="border-l border-line pl-3 font-mono text-[11px] text-fg-secondary">
              Tempo total de fluxo <span className="text-primary-bright">{String(Math.floor(totalSec / 60)).padStart(2, "0")}m {String(totalSec % 60).padStart(2, "0")}s</span>
            </div>
          </div>
        </Panel>
        {showLog && (
          <Panel position="top-right" className="!mt-16 !mr-3">
            <div className="glass-elevated w-[26rem] rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="label-mono text-muted">Log do Workflow Runner</span>
                <span className={cn("font-mono text-[10px]", job?.status === "FAILED" ? "text-error" : "text-primary-bright")}>{job?.status ?? liveStatus}{job ? ` · ${job.progress}%` : ""}</span>
              </div>
              <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded border border-line bg-void/70 p-2 font-mono text-[10px] leading-relaxed text-fg-secondary">
                {job?.logs || (liveStatus === "RUNNING" ? "Aguardando o worker pegar o job..." : "Nenhuma execução ainda. Clique em Executar Fluxo Vertical.")}
                {job?.error ? `\nERRO: ${job.error.split("\n")[0]}` : ""}
              </pre>
            </div>
          </Panel>
        )}
      </ReactFlow>
      </WorkflowIdContext.Provider>
    </div>
  );
}
