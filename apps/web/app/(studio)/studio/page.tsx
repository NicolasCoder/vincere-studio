"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Badge, Button, Card, Icon, cn } from "@vincere-studio/ui";
import { chamarClaude, HF_PROJECT_KEY } from "@/components/ClaudeButton";
import { NICHOS } from "@/lib/nichos";
import { PreviasPanel } from "./PreviasPanel";
import { AtualizarVersao } from "@/components/AtualizarVersao";

const PROFILES = [
  { id: "1", tipo: "Curto Vertical (9:16 Reels / Shorts)", largura: 1080, altura: 1920, rota: "/general-video", estilo: "igor", skill: "/editar-igor", desc: "Shorts dinâmicos de alta retenção para Reels/TikTok" },
  { id: "4", tipo: "Documentário Narrado (Dossiê 9:16)", largura: 1080, altura: 1920, rota: "/faceless-explainer", estilo: "documentario", skill: "/editar-documentario-narrado", desc: "Histórias, marcas e investigações (estilo Nike/True Crime)" },
  { id: "5", tipo: "Corte de Desenho / Filme / Anime", largura: 1080, altura: 1920, rota: "/embedded-captions", estilo: "legenda", skill: "/caosanimado-video-pipeline", desc: "Cortes acelerados com legendas cinéticas e SFX" },
  { id: "6", tipo: "Reel de Oferta / Comercial UGC", largura: 1080, altura: 1920, rota: "/general-video", estilo: "oferta", skill: "/reel-de-oferta", desc: "Anúncios para produtos gerados no Flow ou e-commerce" },
  { id: "2", tipo: "Longo Horizontal (16:9 YouTube)", largura: 1920, altura: 1080, rota: "/general-video", estilo: "profissional", skill: "/anthropic-skills:edicao-profissional", desc: "Documentários e ensaios em 16:9 cinema" },
  { id: "3", tipo: "Motion Graphic Puro (16:9)", largura: 1920, altura: 1080, rota: "/motion-graphics", estilo: "motion", skill: "/motion-aplicar-da-biblioteca", desc: "Intros de marca, tipografia animada e lower-thirds" },
];

const MOTIONS_CATALOG = [
  { name: "abertura-impacto", tag: "Gancho", desc: "Palavra batendo sobre grade técnica com corte de lâmina", cue: "[motion: abertura-impacto @0.2 TEXTO]" },
  { name: "revelacao-titulo", tag: "Título", desc: "Flare de luz cruza a tela e revela o título com light leak", cue: "[motion: revelacao-titulo @0 TEXTO]" },
  { name: "lista-em-cascata", tag: "Lista", desc: "Itens em cascata vertical, o último destacado", cue: "[motion: lista-em-cascata @0.5 A|B|C]" },
  { name: "chamada-final", tag: "CTA", desc: "Chamada para ação pulsante no fim, com flash de entrada", cue: "[motion: chamada-final @1 TEXTO]" },
  { name: "caption-kinetic-slam", tag: "Legenda", desc: "Palavra com ênfase batendo na tela com câmera shake", cue: "[fx: word_slam @0.2 d=1.5 ENFASE]" },
  { name: "katana-slash", tag: "Corte", desc: "Lâmina cortando a tela na transição de cena", cue: "[fx: katana_slash @0 d=0.8]" },
  { name: "snap-zoom", tag: "Câmera", desc: "Zoom seco e rápido para o centro do quadro", cue: "[fx: snap_zoom @0 d=0.5]" },
  { name: "focus-zoom", tag: "Câmera", desc: "Aproximação suave e dramática de foco", cue: "[fx: focus_zoom @0.5 d=2.0]" },
  { name: "carimbo-censura", tag: "Dossiê", desc: "Tarja de carimbo vermelho cobrindo data ou documento", cue: "[fx: tarja @0.3 cor=#c4302b]" },
  { name: "carimbo-data", tag: "Dossiê", desc: "Carimbo de borracha rotacionado que bate na mesa 3D", cue: "[motion: carimbo-data @0 texto='1971 SEGREDO']" },
];

interface HfSelection {
  label?: string;
  tagName?: string;
  currentTime?: number;
  textContent?: string | null;
  sourceFile?: string;
  target?: {
    id?: string | null;
    hfId?: string;
    selector?: string;
  };
  inlineStyles?: Record<string, string>;
}

interface AgentTaskItem {
  id: string;
  status: "pendente" | "fazendo" | "feito" | "erro";
  pedido: string;
  resposta?: string;
}

export default function HyperFramesStudioPage() {
  const [activeProject, setActiveProject] = useState("referenciamotion-pro");
  const [activeProjectDir, setActiveProjectDir] = useState("");
  const [availableProjects, setAvailableProjects] = useState<Array<{ name: string; path: string }>>([]);
  const [engineOnline, setEngineOnline] = useState(false);
  const [switchingProject, setSwitchingProject] = useState(false);
  const [selection, setSelection] = useState<HfSelection | null>(null);
  const [detectedAgents, setDetectedAgents] = useState<{
    agyPath: string | null;
    claudePath: string | null;
    preferred: "agy" | "claude" | "inbox";
  }>({ agyPath: null, claudePath: null, preferred: "agy" });
  const [selectedAgent, setSelectedAgent] = useState<"auto" | "agy" | "claude">("auto");

  // Barra integrada do Agente no Studio
  const [agentPrompt, setAgentPrompt] = useState("");
  const [agentRunning, setAgentRunning] = useState(false);
  const [activeTask, setActiveTask] = useState<AgentTaskItem | null>(null);
  const [listeningMic, setListeningMic] = useState(false);
  const recRef = useRef<{ stop: () => void } | null>(null);

  // Modais e gavetas
  const [showCatalog, setShowCatalog] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectPrompt, setNewProjectPrompt] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState("1");
  const [templates, setTemplates] = useState<Array<{ nome: string; nicho?: string; origem?: string; formato?: string }>>([]);
  const [templateSel, setTemplateSel] = useState("");
  const [search, setSearch] = useState("");
  const [iframeKey, setIframeKey] = useState(1);

  useEffect(() => {
    fetch("/api/hyperframes?action=templates", { cache: "no-store" })
      .then((r) => r.json())
      .then((r) => r?.ok && setTemplates(r.templates))
      .catch(() => {});
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(HF_PROJECT_KEY, activeProject);
    } catch {}
  }, [activeProject]);

  const fetchStatus = useCallback(async (firstBoot = false) => {
    try {
      const res = await fetch(`/api/hyperframes?autoStart=${firstBoot ? "true" : "false"}`, {
        cache: "no-store",
      });
      const data = await res.json();
      setEngineOnline(Boolean(data.running));
      setHfBaseUrl(typeof data.hfBaseUrl === "string" ? data.hfBaseUrl : null);
      if (data.activeProject) {
        setActiveProject(data.activeProject);
      }
      if (data.activeProjectDir) {
        setActiveProjectDir(data.activeProjectDir);
      }
      if (data.projects && data.projects.length > 0) {
        setAvailableProjects(data.projects);
      }
      setSelection(data.selection ?? null);
      if (data.agents) {
        setDetectedAgents(data.agents);
      }
    } catch {
      setEngineOnline(false);
    }
  }, []);

  // Ao abrir a página, auto-inicia o HyperFrames localmente e mantém polling de seleção (2.5s)
  useEffect(() => {
    fetchStatus(true);
    const interval = setInterval(() => fetchStatus(false), 2500);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Acompanha andamento quando o Agente (agy / claude) está operando
  useEffect(() => {
    if (!activeTask || (activeTask.status !== "pendente" && activeTask.status !== "fazendo")) return;
    const t = setInterval(async () => {
      const r = await fetch("/api/claude", { cache: "no-store" }).then((x) => x.json()).catch(() => null);
      if (!r?.ok || !Array.isArray(r.items)) return;
      const found = r.items.find((i: AgentTaskItem) => i.id === activeTask.id);
      if (found) {
        setActiveTask(found);
        if (found.status === "feito" || found.status === "erro") {
          setAgentRunning(false);
          setIframeKey((k) => k + 1);
        }
      }
    }, 2000);
    return () => clearInterval(t);
  }, [activeTask]);

  const handleSwitchProject = async (projectName: string) => {
    setActiveProject(projectName);
    setSwitchingProject(true);
    setSelection(null);
    try {
      const res = await fetch("/api/hyperframes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "switch", project: projectName }),
      });
      const data = await res.json();
      if (data.ok) {
        setEngineOnline(Boolean(data.running));
        if (data.activeProjectDir) setActiveProjectDir(data.activeProjectDir);
        setIframeKey((k) => k + 1);
      }
    } finally {
      setSwitchingProject(false);
    }
  };

  const handleSendToAgent = async (customPrompt?: string) => {
    const promptToSend = (customPrompt ?? agentPrompt).trim();
    if (promptToSend.length < 3 || agentRunning) return;
    setAgentRunning(true);
    try {
      const res = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pedido: promptToSend,
          pagina: "/studio",
          projetoHf: activeProject,
          projectDir: activeProjectDir,
          engine: selectedAgent,
          selection: selection
            ? {
                label: selection.label,
                tagName: selection.tagName,
                selector: selection.target?.selector || (selection.target?.id ? `#${selection.target.id}` : undefined),
                hfId: selection.target?.hfId,
                currentTime: selection.currentTime,
                textContent: selection.textContent,
                sourceFile: selection.sourceFile,
                inlineStyles: selection.inlineStyles,
              }
            : null,
        }),
      });
      const data = await res.json();
      if (data.ok && data.item) {
        setActiveTask(data.item);
        if (!customPrompt) setAgentPrompt("");
      } else {
        setAgentRunning(false);
      }
    } catch {
      setAgentRunning(false);
    }
  };

  const toggleVoiceDictation = () => {
    if (listeningMic) {
      recRef.current?.stop();
      return;
    }
    const W = window as unknown as { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any };
    const SR = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = "pt-BR";
    rec.interimResults = false;
    rec.onresult = (ev: any) => {
      const transcript = Array.from(ev.results as ArrayLike<any>)
        .slice(ev.resultIndex)
        .map((r) => r[0].transcript)
        .join(" ");
      setAgentPrompt((prev) => (prev ? `${prev} ${transcript}` : transcript).trim());
    };
    rec.onend = () => setListeningMic(false);
    rec.start();
    recRef.current = rec;
    setListeningMic(true);
  };

  const slug = newProjectName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/^-+|-+$/g, "");
  const selectedProfile = PROFILES.find((p) => p.id === selectedProfileId) ?? PROFILES[0];

  const handleCreateProjectLocal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug || creatingProject) return;
    setCreatingProject(true);
    try {
      const res = await fetch("/api/hyperframes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          name: slug,
          width: selectedProfile.largura,
          height: selectedProfile.altura,
          template: templateSel || undefined,
          prompt: newProjectPrompt.trim() || undefined,
          engine: selectedAgent,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        if (data.projects) setAvailableProjects(data.projects);
        setActiveProject(data.project);
        setActiveProjectDir(data.projectDir);
        setEngineOnline(Boolean(data.running));
        setShowNewModal(false);
        setNewProjectName("");
        setNewProjectPrompt("");
        setIframeKey((k) => k + 1);
      }
    } finally {
      setCreatingProject(false);
    }
  };

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
  };

  const [hfHost, setHfHost] = useState("127.0.0.1");
  // Preview em outro computador (configurado em Configurações): o navegador abre esse endereço.
  const [hfBaseUrl, setHfBaseUrl] = useState<string | null>(null);
  useEffect(() => {
    const h = window.location.hostname;
    setHfHost(h === "localhost" ? "127.0.0.1" : h);
  }, []);

  const studioUrl = `${hfBaseUrl ?? `http://${hfHost}:3010`}/#project/${encodeURIComponent(activeProject)}`;

  const filteredMotions = MOTIONS_CATALOG.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.desc.toLowerCase().includes(search.toLowerCase()) ||
      m.tag.toLowerCase().includes(search.toLowerCase()),
  );

  const selectionSummary = selection
    ? `${selection.target?.selector || (selection.target?.id ? `#${selection.target.id}` : selection.label || selection.tagName || "Elemento")}${
        selection.currentTime !== undefined ? ` · ${Number(selection.currentTime).toFixed(2)}s` : ""
      }`
    : null;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] space-y-2.5 p-3 sm:p-5">
      {/* 1. Barra Superior Minimalista do HyperFrames Studio */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-surface-low/80 backdrop-blur-xl px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="grid size-8 place-items-center rounded-lg bg-primary/15 text-primary-bright">
            <Icon name="movie_filter" className="text-[18px]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-semibold text-sm text-fg">HyperFrames Studio</span>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                  engineOnline
                    ? "border-success/30 bg-success/10 text-success"
                    : "border-warning/30 bg-warning/10 text-warning",
                )}
              >
                <span className={cn("size-1.5 rounded-full", engineOnline ? "bg-success" : "bg-warning animate-pulse")} />
                {switchingProject
                  ? "Alternando projeto..."
                  : engineOnline
                    ? "Local :3010 Ativo"
                    : "Iniciando Motor Local..."}
              </span>
            </div>
          </div>
        </div>

        {/* Seletor de Projeto + Ações */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-void/60 px-2.5 py-1 text-xs">
            <span className="text-muted text-[10px] uppercase tracking-wider">Projeto:</span>
            <select
              value={activeProject}
              disabled={switchingProject}
              onChange={(e) => handleSwitchProject(e.target.value)}
              className="bg-transparent font-display font-medium text-fg focus:outline-none cursor-pointer"
            >
              {availableProjects.length > 0 ? (
                availableProjects.map((p) => (
                  <option key={p.name} value={p.name} className="bg-surface-elevated text-fg">
                    {p.name}
                  </option>
                ))
              ) : (
                <option value={activeProject} className="bg-surface-elevated text-fg">
                  {activeProject}
                </option>
              )}
            </select>
          </div>

          <Button
            size="sm"
            variant="secondary"
            icon="add"
            onClick={() => setShowNewModal(true)}
          >
            Novo Projeto
          </Button>

          <Button
            size="sm"
            variant="secondary"
            icon="auto_awesome"
            onClick={() => setShowCatalog(!showCatalog)}
          >
            Catálogo ({MOTIONS_CATALOG.length})
          </Button>

          <AtualizarVersao id="hyperframes" />

          <a
            href={studioUrl}
            target="_blank"
            rel="noreferrer"
            className="apple-press inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-xs font-medium text-fg-secondary hover:border-white/[0.18] hover:text-fg"
          >
            <Icon name="open_in_new" className="text-[14px]" />
            <span>Tela Cheia</span>
          </a>
        </div>
      </div>

      {/* 2. Barra Integrada de Conexão com o Agente (Antigravity agy / Claude Code + Elemento Selecionado no HyperFrames) */}
      <div className="rounded-xl border border-white/[0.08] bg-surface-low/70 backdrop-blur-xl px-3.5 py-2.5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {/* Seletor do Agente Operador */}
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary-bright">
              <Icon name="terminal" className="text-[14px]" />
              <span>Agente:</span>
              <select
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value as "auto" | "agy" | "claude")}
                className="bg-transparent font-semibold text-fg focus:outline-none cursor-pointer"
              >
                <option value="auto" className="bg-surface-elevated text-fg">
                  Auto ({detectedAgents.agyPath ? "Antigravity agy" : detectedAgents.claudePath ? "Claude Code" : "Fila"})
                </option>
                <option value="agy" className="bg-surface-elevated text-fg">
                  Antigravity CLI (agy) {detectedAgents.agyPath ? "✓" : ""}
                </option>
                <option value="claude" className="bg-surface-elevated text-fg">
                  Claude Code CLI {detectedAgents.claudePath ? "✓" : ""}
                </option>
              </select>
            </div>

            {/* Pílula ao vivo do elemento clicado dentro do HyperFrames Studio */}
            {selectionSummary ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1 font-mono text-[11px] text-emerald-300">
                <Icon name="ads_click" className="text-[14px]" />
                <span>Alvo selecionado: <strong>{selectionSummary}</strong></span>
                {selection?.textContent && (
                  <span className="text-emerald-200/75 truncate max-w-44">
                    (&ldquo;{selection.textContent}&rdquo;)
                  </span>
                )}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-void/40 px-2.5 py-1 text-[11px] text-muted">
                <Icon name="touch_app" className="text-[14px] text-primary-bright" />
                <span>Clique em qualquer elemento na timeline/canvas abaixo para o Agente editar direto no alvo</span>
              </span>
            )}
          </div>

          {/* Atalhos Rápidos de Operação do Agente */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={agentRunning}
              onClick={() =>
                handleSendToAgent(
                  "Corrija todos os avisos de lint do HyperFrames neste index.html (substitua animações de left/top/margin por transform x/y/scale e garanta data-composition-id='main').",
                )
              }
              className="apple-press rounded-lg border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 text-[11px] text-fg-secondary hover:border-white/[0.16] hover:text-fg disabled:opacity-40"
            >
              Corrigir Lint (GSAP)
            </button>
            <button
              type="button"
              onClick={() => chamarClaude({ pedido: `No projeto ${activeProject}: ` })}
              className="apple-press rounded-lg border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 text-[11px] text-fg-secondary hover:border-white/[0.16] hover:text-fg"
            >
              Histórico / Vince
            </button>
          </div>
        </div>

        {/* Input direto para o Agente editar o projeto HyperFrames */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendToAgent();
          }}
          className="flex items-center gap-2"
        >
          <input
            value={agentPrompt}
            onChange={(e) => setAgentPrompt(e.target.value)}
            placeholder={
              selectionSummary
                ? `O que o Agente deve fazer no elemento ${selectionSummary}? (Ex.: mudar texto, animar entrada com spring, trocar cor...)`
                : `Peça ao Agente (${detectedAgents.agyPath ? "Antigravity agy" : "Claude"}) para editar "${activeProject}"...`
            }
            className="field h-9 flex-1 px-3 text-xs"
          />
          <button
            type="button"
            onClick={toggleVoiceDictation}
            className={cn(
              "apple-press grid size-9 shrink-0 place-items-center rounded-lg border",
              listeningMic
                ? "border-error bg-error/20 text-error animate-pulse"
                : "border-white/[0.08] bg-void/50 text-fg-secondary hover:text-fg",
            )}
            title="Ditar instrução por voz"
          >
            <Icon name="mic" className="text-[16px]" />
          </button>
          <button
            type="submit"
            disabled={agentRunning || agentPrompt.trim().length < 3}
            className="apple-press inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg gradient-cta px-4 text-xs font-semibold text-fg shadow-glow-cta hover:brightness-110 disabled:opacity-40"
          >
            <Icon name={agentRunning ? "sync" : "bolt"} className={cn("text-[15px]", agentRunning && "animate-spin")} />
            <span>{agentRunning ? "Agente Operando..." : "Executar no Projeto"}</span>
          </button>
        </form>

        {/* Feedback em tempo real da tarefa do Agente */}
        {activeTask && (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-void/60 px-3 py-1.5 text-[11px]">
            <div className="flex items-center gap-2 min-w-0">
              <Badge
                tone={
                  activeTask.status === "feito"
                    ? "success"
                    : activeTask.status === "erro"
                      ? "warning"
                      : "cyan"
                }
              >
                {activeTask.status === "fazendo" || activeTask.status === "pendente"
                  ? "Operando"
                  : activeTask.status === "feito"
                    ? "Concluído"
                    : "Erro"}
              </Badge>
              <span className="truncate text-fg-secondary">
                {activeTask.resposta || activeTask.pedido}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActiveTask(null)}
              className="text-muted hover:text-fg text-xs shrink-0"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      <PreviasPanel projeto={activeProject} />

      {/* 3. Iframe Principal do HyperFrames Studio (Auto-iniciado localmente na porta 3010) */}
      <div className="relative flex-1 rounded-xl border border-white/[0.08] overflow-hidden bg-void shadow-2xl flex flex-col">
        {engineOnline ? (
          <iframe
            key={iframeKey}
            src={studioUrl}
            className="w-full h-full border-0 bg-void flex-1"
            title="HyperFrames Studio"
            allow="camera; microphone; display-capture"
          />
        ) : (
          <div className="flex-1 grid place-items-center p-8 text-center bg-void/90">
            <div className="max-w-md space-y-4">
              <div className="mx-auto grid size-14 place-items-center rounded-2xl border border-primary/30 bg-primary/10 text-primary-bright">
                <Icon name="sync" className="text-[28px] animate-spin" />
              </div>
              <div>
                <h3 className="font-display text-base font-semibold text-fg">
                  Iniciando HyperFrames Studio Localmente...
                </h3>
                <p className="mt-1 text-xs text-muted leading-relaxed">
                  Subindo o servidor local na porta 3010 com Node 22 para o projeto{" "}
                  <strong className="text-fg">{activeProject}</strong>.
                </p>
              </div>
              <Button
                size="sm"
                variant="primary"
                icon="play_arrow"
                onClick={() => fetchStatus(true)}
              >
                Iniciar Agora
              </Button>
            </div>
          </div>
        )}

        {/* Gaveta Flutuante de Catálogo de Motions */}
        {showCatalog && (
          <aside className="absolute inset-y-0 right-0 w-80 sm:w-96 border-l border-white/[0.08] bg-surface-low/95 backdrop-blur-2xl p-4 flex flex-col gap-3 shadow-2xl z-20 overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <div>
                <h3 className="text-sm font-semibold font-display text-fg flex items-center gap-1.5">
                  <Icon name="auto_awesome" className="text-primary-bright text-[16px]" />
                  Catálogo de Efeitos & Motions
                </h3>
                <p className="text-[11px] text-muted">Clique para aplicar com o Agente ou copiar</p>
              </div>
              <button
                onClick={() => setShowCatalog(false)}
                className="grid size-7 place-items-center rounded-lg hover:bg-white/[0.06] text-muted hover:text-fg text-sm"
              >
                ✕
              </button>
            </div>

            <input
              type="text"
              placeholder="Filtrar por nome, tag ou cue..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="field w-full px-3 py-1.5 text-xs placeholder:text-muted"
            />

            <div className="space-y-2.5 flex-1 overflow-y-auto pr-1">
              {filteredMotions.map((m) => (
                <div
                  key={m.name}
                  className="rounded-xl border border-white/[0.07] bg-void/50 p-3 space-y-2 hover:border-white/[0.16] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-fg font-display">{m.name}</span>
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[9px] font-medium text-primary-bright">
                      {m.tag}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted leading-relaxed">{m.desc}</p>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        handleSendToAgent(`Adicione o efeito/motion "${m.name}" (${m.desc} — ${m.cue}) na composição atual.`);
                        setShowCatalog(false);
                      }}
                      className="apple-press flex-1 rounded-lg bg-primary/15 px-2.5 py-1.5 text-[10px] font-semibold text-primary-bright hover:bg-primary/25"
                    >
                      Aplicar com Agente
                    </button>
                    <button
                      type="button"
                      onClick={() => copy(m.cue)}
                      className="apple-press rounded-lg border border-white/[0.08] bg-void px-2.5 py-1.5 font-mono text-[10px] text-muted hover:text-fg"
                      title="Copiar cue"
                    >
                      Copiar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        )}
      </div>

      {/* Modal: Criar Novo Projeto Localmente em 1 Clique */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-void/80 backdrop-blur-md p-4">
          <Card className="w-full max-w-lg p-5 border-white/[0.1] shadow-2xl space-y-4" elevated>
            <div className="flex items-center justify-between border-b border-white/[0.07] pb-3">
              <h3 className="font-display text-base font-semibold text-fg flex items-center gap-2">
                <Icon name="add_circle" className="text-primary-bright" />
                Novo Projeto Local no HyperFrames
              </h3>
              <button onClick={() => setShowNewModal(false)} className="text-muted hover:text-fg">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProjectLocal} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-fg-secondary mb-1 block">Nome do Projeto *</label>
                <input
                  required
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="Ex: abertura-canal, reel-nike-v2, corte-anime-01"
                  className="field w-full px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-fg-secondary mb-1.5 block">Formato & Estilo Base</label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {PROFILES.map((prof) => (
                    <label
                      key={prof.id}
                      className={cn(
                        "flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer text-xs transition-colors",
                        selectedProfileId === prof.id
                          ? "border-primary/60 bg-primary/10 text-fg"
                          : "border-white/[0.06] bg-void/40 text-fg-secondary hover:border-white/[0.14]",
                      )}
                    >
                      <input
                        type="radio"
                        name="perfil"
                        checked={selectedProfileId === prof.id}
                        onChange={() => setSelectedProfileId(prof.id)}
                        className="mt-0.5 accent-primary"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-fg">{prof.tipo}</span>
                          <span className="font-mono text-[10px] text-muted">
                            {prof.largura}×{prof.altura}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted mt-0.5">{prof.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-fg-secondary mb-1 block">
                  Instrução inicial para o Agente (opcional)
                </label>
                <textarea
                  rows={2}
                  value={newProjectPrompt}
                  onChange={(e) => setNewProjectPrompt(e.target.value)}
                  placeholder="Ex.: Crie uma intro de 5 segundos estilo Apple com 3 cards flutuantes e tipografia cinética..."
                  className="field w-full p-2.5 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/[0.07]">
                <Button variant="secondary" size="sm" type="button" onClick={() => setShowNewModal(false)}>
                  Cancelar
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  icon={creatingProject ? "sync" : "bolt"}
                  disabled={!slug || creatingProject}
                >
                  {creatingProject ? "Criando e Abrindo..." : "Criar e Abrir no Studio"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
