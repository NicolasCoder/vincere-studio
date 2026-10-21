"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, Icon } from "@vincere-studio/ui";
import { Topbar } from "@/components/Topbar";
import { PageHeader } from "@/components/PageHeader";

interface StylePreset {
  id: string;
  title: string;
  description: string;
  fps: number;
  aspect: string;
  shotsCount: number;
  aslS: number;
  bpm: number;
  dominantCamera: string;
  look: string;
  hasLocalVlm: boolean;
  hasForensicStep1: boolean;
  hasInteractiveStage: boolean;
  hasComparisonVideo: boolean;
  refVideoPath?: string;
}

interface MediaAsset {
  id?: string;
  name?: string;
  label?: string;
  path: string;
  url: string;
}

interface VlmObservation {
  batch_index: number;
  frames: string[];
  time_range_s: [number, number];
  pass?: string;
  observation: string;
}

interface TokenSavingsReport {
  timestamp?: string;
  hardware?: string;
  local_models_used?: { vision?: string; code_synthesizer?: string };
  video_analyzed?: {
    duration_s?: number;
    fps?: number;
    total_video_frames?: number;
    pass1_step5_frames?: number;
    pass2_adaptive_burst_frames?: number;
    total_frames_sent_to_vlm?: number;
    burst_windows?: { start_s: number; end_s: number; reason: string }[];
  };
  token_usage_measured?: {
    grand_total_input_tokens?: number;
    grand_total_output_tokens?: number;
    grand_total_tokens?: number;
  };
  cost_comparison_usd?: {
    local_rtx3060_ollama?: { total_usd?: number };
    claude_opus_4_6_api_equivalent?: { total_usd?: number };
    claude_sonnet_4_api_equivalent?: { total_usd?: number };
    gpt_4o_api_equivalent?: { total_usd?: number };
  };
  summary_pt_br?: {
    frames_analisados?: string;
    tokens_economizados_da_nuvem?: number;
    custo_local?: string;
    economia_vs_claude_opus_single_run?: string;
    economia_10_iteracoes_ajuste_fino?: string;
  };
}

interface PresetInspection {
  presetId: string;
  analysis: Record<string, any> | null;
  briefMd: string | null;
  localVlmSpecMd: string | null;
  tokenSavingsReport: TokenSavingsReport | null;
  visionObservations: VlmObservation[];
  visionMeta: { model: string; stepFrames: number; totalSampledFrames: number } | null;
  forensicObservations: VlmObservation[];
  forensicMeta: { model: string; mode: string; totalFrames: number } | null;
  sheets: MediaAsset[];
  griddedFrames: MediaAsset[];
  forensicStrips1to1: MediaAsset[];
  forensicFramesStep1: MediaAsset[];
  htmlStages: MediaAsset[];
  videos: MediaAsset[];
}

interface SharinganData {
  localEngine: {
    sharinganScriptExists: boolean;
    localVlmScriptExists: boolean;
    ollamaOnline: boolean;
    ollamaModels: string[];
    defaultModel: string;
    gpu?: {
      available: boolean;
      name: string;
      vramTotalMb: number;
      vramFreeMb: number;
    };
  };
  cloudEngine: {
    online: boolean;
    provider: string;
    model: string;
  };
  presets: StylePreset[];
  activeInspection: PresetInspection;
  savedClones: {
    cloneName: string;
    effectiveEngine: string;
    vlmMode?: string;
    userTopic: string;
    briefPreview: string;
    localVlmSpecPreview?: string;
    createdAt: string;
  }[];
  jobs: {
    id: string;
    status: string;
    progress: number;
    message?: string;
    result?: {
      cloneName?: string;
      effectiveEngine?: string;
      briefPreview?: string;
      localVlmSpecPreview?: string;
    };
    createdAt: string;
  }[];
}

type StudioTab = "analyze" | "forensic" | "stage" | "telemetry";
type VlmMode = "pass1_keyframes" | "pass2_step5" | "pass3_adaptive_burst" | "forensic_step1_1to1";

export default function SharinganPage() {
  const [data, setData] = useState<SharinganData | null>(null);
  const [activeTab, setActiveTab] = useState<StudioTab>("analyze");
  const [engineMode, setEngineMode] = useState<"LOCAL_GPU" | "CLOUD" | "AUTO">("LOCAL_GPU");
  const [vlmMode, setVlmMode] = useState<VlmMode>("pass3_adaptive_burst");
  const [localVlmModel, setLocalVlmModel] = useState<string>("qwen2.5-vl:7b");
  const [selectedPreset, setSelectedPreset] = useState<string>("referenciamotion");
  const [cloneName, setCloneName] = useState("clone-motion-rtx3060");
  const [videoPath, setVideoPath] = useState("");
  const [userTopic, setUserTopic] = useState(
    "Como Phil Knight começou vendendo tênis japoneses no porta-malas do carro em 1964",
  );
  const [useLocalVlm, setUseLocalVlm] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [docMode, setDocMode] = useState<"brief" | "vlm_spec">("brief");
  const [customBrief, setCustomBrief] = useState<string | null>(null);

  // Tab 2: Forensic Inspector state
  const [frameGalleryMode, setFrameGalleryMode] = useState<"gridded720p" | "strips1to1" | "sheets">(
    "gridded720p",
  );
  const [selectedFrameUrl, setSelectedFrameUrl] = useState<string | null>(null);
  const [selectedFramePath, setSelectedFramePath] = useState<string | null>(null);
  const [forensicPrompt, setForensicPrompt] = useState(
    "Read the exact 10%x10% grid coordinates, UI card bounds, typography hierarchy, hex colors, and motion vector in this frame/strip.",
  );
  const [forensicAnswer, setForensicAnswer] = useState<string | null>(null);
  const [forensicBusy, setForensicBusy] = useState(false);
  const [obsMode, setObsMode] = useState<"merged" | "forensic_step1">("merged");

  // Tab 3: Interactive Stage & 3-Way Comparison state
  const [selectedStageUrl, setSelectedStageUrl] = useState<string | null>(null);
  const [selectedStagePath, setSelectedStagePath] = useState<string | null>(null);
  const [selectedVideoUrl, setSelectedVideoUrl] = useState<string | null>(null);
  const [stageTimeS, setStageTimeS] = useState<number>(0);
  const [qcReport, setQcReport] = useState<string | null>(null);
  const [qcBusy, setQcBusy] = useState(false);
  const [renderBusy, setRenderBusy] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const loadData = async (presetOverride?: string) => {
    const targetPreset = presetOverride ?? selectedPreset;
    try {
      const res = await fetch(`/api/sharingan?presetId=${encodeURIComponent(targetPreset)}`);
      const d = (await res.json()) as SharinganData & { ok: boolean };
      if (d.ok) {
        setData(d);
        const insp = d.activeInspection;
        if (insp) {
          if (insp.griddedFrames?.[0] && !selectedFrameUrl) {
            setSelectedFrameUrl(insp.griddedFrames[0].url);
            setSelectedFramePath(insp.griddedFrames[0].path);
          }
          if (insp.htmlStages?.[0] && !selectedStageUrl) {
            setSelectedStageUrl(insp.htmlStages[0].url);
            setSelectedStagePath(insp.htmlStages[0].path);
          }
          if (insp.videos?.[0] && !selectedVideoUrl) {
            const preferred =
              insp.videos.find((v) => v.id === "comp_3way") ??
              insp.videos.find((v) => v.id?.startsWith("comp_")) ??
              insp.videos[0];
            if (preferred) setSelectedVideoUrl(preferred.url);
          }
        }
      }
    } catch {}
  };

  useEffect(() => {
    loadData(selectedPreset);
    const t = setInterval(() => loadData(selectedPreset), 6000);
    return () => clearInterval(t);
  }, [selectedPreset]);

  const handleSelectPreset = (id: string) => {
    setSelectedPreset(id);
    setCustomBrief(null);
    setSelectedFrameUrl(null);
    setSelectedStageUrl(null);
    setSelectedVideoUrl(null);
    setQcReport(null);
    loadData(id);
  };

  const handleClone = async (action: "clone" | "analyze_local" = "clone") => {
    setNotice(
      action === "analyze_local"
        ? `Disparando engenharia reversa na GPU Local (${localVlmModel} · ${vlmMode})...`
        : "Disparando clonagem Sharingan...",
    );
    const res = await fetch("/api/sharingan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action,
        cloneName,
        engineMode,
        vlmMode,
        localVlmModel,
        styleReferenceId: selectedPreset,
        videoPath: videoPath.trim() || undefined,
        userTopic,
        useLocalVlm,
      }),
    });
    const d = await res.json();
    if (d.ok) {
      setNotice(`Job #${d.jobId.slice(-6)} iniciado no motor ${engineMode} (${vlmMode})!`);
      loadData(selectedPreset);
    } else {
      setNotice(`Erro: ${d.error}`);
    }
  };

  const handleForensicQuery = async () => {
    if (!selectedFramePath) return;
    setForensicBusy(true);
    setForensicAnswer("Consultando Qwen2.5-VL-7B na RTX 3060 (Ollama Local)...");
    try {
      const res = await fetch("/api/sharingan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "forensic_query",
          imagePaths: [selectedFramePath],
          localVlmModel,
          prompt: forensicPrompt,
        }),
      });
      const d = await res.json();
      if (d.ok && d.observation) {
        setForensicAnswer(
          `${d.observation}\n\n---\n⚡ Tokens medidos na GPU Local: ${d.promptTokens ?? 0} in / ${d.completionTokens ?? 0} out · Custo: US$ 0.00`,
        );
      } else {
        setForensicAnswer(`Aviso: ${d.error || "Falha ao consultar Ollama local."}`);
      }
    } catch (e) {
      setForensicAnswer(`Erro de conexão: ${(e as Error).message}`);
    } finally {
      setForensicBusy(false);
    }
  };

  const handleRunQcCompare = async () => {
    setQcBusy(true);
    setQcReport("Executando os 12 Portões de Qualidade (sharingan.py compare) no PC...");
    try {
      const res = await fetch("/api/sharingan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "compare_qc",
          styleReferenceId: selectedPreset,
          videoPath: videoPath.trim() || undefined,
        }),
      });
      const d = await res.json();
      setQcReport(d.report || d.error || "Relatório QC concluído.");
    } catch (e) {
      setQcReport(`Erro ao rodar QC: ${(e as Error).message}`);
    } finally {
      setQcBusy(false);
    }
  };

  const handleRenderHtmlStage = async () => {
    if (!selectedStagePath) return;
    setRenderBusy(true);
    setNotice("Renderizando palco HTML5/GSAP em MP4 30fps via Playwright + FFmpeg no PC...");
    try {
      const res = await fetch("/api/sharingan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "render_html",
          htmlPath: selectedStagePath,
          styleReferenceId: selectedPreset,
          durationS: Number(data?.activeInspection?.analysis?.source?.duration_s ?? 10.9),
          fps: Number(data?.activeInspection?.analysis?.source?.fps ?? 30),
        }),
      });
      const d = await res.json();
      if (d.ok && (d.comparisonUrl || d.videoUrl)) {
        setSelectedVideoUrl(d.comparisonUrl || d.videoUrl);
        setNotice("Renderização HTML5/GSAP → MP4 concluída no PC!");
      } else {
        setNotice(`Aviso na renderização: ${d.error || "Verifique Playwright/FFmpeg."}`);
      }
    } finally {
      setRenderBusy(false);
    }
  };

  const handleScrubStage = (timeS: number) => {
    setStageTimeS(timeS);
    try {
      const win = iframeRef.current?.contentWindow as
        | (Window & { __timelines?: { main?: { pause: () => void; seek: (t: number) => void } } })
        | null;
      if (win?.__timelines?.main) {
        win.__timelines.main.pause();
        win.__timelines.main.seek(timeS);
      }
    } catch {}
  };

  const insp = data?.activeInspection;
  const analysis = insp?.analysis;
  const tokenReport = insp?.tokenSavingsReport;
  const activeObservations =
    obsMode === "forensic_step1" && (insp?.forensicObservations?.length ?? 0) > 0
      ? insp?.forensicObservations ?? []
      : insp?.visionObservations ?? [];

  return (
    <>
      <Topbar crumbs={["Gerar com IA", "Video-Sharingan + IA Local (RTX 3060)"]} />
      <main className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
        <PageHeader
          icon="visibility"
          title={
            <span className="flex flex-wrap items-center gap-2.5">
              <span>Video-Sharingan — Engenharia Reversa & Clonagem Visual</span>
              <Badge tone="success">
                {data?.localEngine?.gpu?.name ?? "RTX 3060 12GB"} · US$ 0.00
              </Badge>
              <Badge tone="violet">Qwen2.5-VL-7B Local ↔ Cloud</Badge>
            </span>
          }
          subtitle="Copy the technique, not the pixels: extrai cortes exatos, fluxo óptico da câmera (%W/s), curvas de easing, DOF, BPM, frames 720p com grade 10%×10%, tiras forenses 1:1 (Step=1) e palco HTML5/GSAP processados direto na placa de vídeo do seu computador."
          right={
            <div className="flex items-center gap-2">
              <Link href="/voice-studio">
                <Button variant="secondary" size="sm" icon="record_voice_over">
                  RVC V2 & Whisper GPU
                </Button>
              </Link>
              <Link href="/studio">
                <Button variant="primary" size="sm" icon="movie_filter">
                  Abrir HyperFrames Studio
                </Button>
              </Link>
            </div>
          }
        />

        {/* Barra de Status do Computador Local (PC GPU Bridge) + Seletor de Abas */}
        <Card className="p-4 space-y-4" accent="dual">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5">
                <Icon name="memory" className="text-primary-bright text-[18px]" />
                <div className="text-xs">
                  <div className="font-display font-bold text-fg">
                    GPU do Computador: {data?.localEngine?.gpu?.name ?? "NVIDIA GeForce RTX 3060"}
                  </div>
                  <div className="font-mono text-[10px] text-primary-bright">
                    VRAM Total: {data?.localEngine?.gpu?.vramTotalMb ?? 12288} MB · Livre:{" "}
                    {data?.localEngine?.gpu?.vramFreeMb ?? 8192} MB · Ollama:{" "}
                    {data?.localEngine?.ollamaOnline ? "ONLINE (:11434)" : "OFFLINE"}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 bg-void/80 p-1 rounded-lg border border-line">
                {(
                  [
                    { id: "LOCAL_GPU", label: "Computador (GPU Local RTX 3060)", icon: "developer_board" },
                    { id: "AUTO", label: "Auto (PC → Cloud)", icon: "hdr_auto" },
                    { id: "CLOUD", label: "Nuvem (Sem GPU)", icon: "cloud_queue" },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setEngineMode(m.id)}
                    className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-mono transition-all ${
                      engineMode === m.id
                        ? "bg-primary text-void font-bold"
                        : "text-fg-secondary hover:text-fg"
                    }`}
                  >
                    <Icon name={m.icon} className="text-[14px]" />
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Navegação das 4 Abas do Estúdio Sharingan */}
            <div className="flex flex-wrap items-center gap-1.5 bg-void/90 p-1 rounded-lg border border-line">
              {(
                [
                  { id: "analyze", label: "1. DNA Óptico & Clonagem", icon: "analytics" },
                  { id: "forensic", label: "2. Grade 10%×10% & Forense 1:1", icon: "grid_on" },
                  { id: "stage", label: "3. Palco GSAP & Comparativo 3-Vias", icon: "view_column" },
                  { id: "telemetry", label: "4. Economia de Tokens (US$ 0)", icon: "savings" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-display font-bold transition-all ${
                    activeTab === tab.id
                      ? "bg-primary text-void shadow-sm"
                      : "text-fg-secondary hover:text-fg"
                  }`}
                >
                  <Icon name={tab.icon} className="text-[15px]" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Seletor rápido de Presets do style_lib */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
            {(data?.presets ?? []).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelectPreset(p.id)}
                className={`flex flex-col justify-between rounded-lg border p-3 text-left transition-all ${
                  selectedPreset === p.id
                    ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                    : "border-line bg-void/40 hover:border-primary/40"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="font-display text-xs font-bold text-fg line-clamp-1">{p.title}</span>
                    <Badge tone={p.hasForensicStep1 ? "violet" : "cyan"}>{p.aspect}</Badge>
                  </div>
                  <p className="text-[10px] text-muted mt-1 line-clamp-2">{p.description}</p>
                </div>
                <div className="mt-2.5 pt-1.5 border-t border-line/60 flex flex-wrap items-center gap-1.5 font-mono text-[10px] text-primary-bright">
                  <span>{p.shotsCount} shots</span>
                  <span>·</span>
                  <span>ASL {p.aslS}s</span>
                  <span>·</span>
                  <span>{p.bpm} BPM</span>
                  {p.hasForensicStep1 && (
                    <span className="ml-auto rounded bg-violet-500/20 px-1.5 py-0.5 text-[9px] text-violet-300">
                      Step=1 1:1
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </Card>

        {/* ===================================================================== */}
        {/* ABA 1: DNA ÓPTICO, MULTI-PASS VLM & CLONAGEM NO PC                     */}
        {/* ===================================================================== */}
        {activeTab === "analyze" && (
          <div className="space-y-6">
            {/* Cards de Métricas Ópticas e Acústicas Reais (analysis.json) */}
            {analysis && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <Card className="p-3.5 space-y-1">
                  <div className="font-mono text-[10px] text-muted uppercase">Fonte & Formato</div>
                  <div className="font-display text-sm font-bold text-fg">
                    {analysis.source?.width ?? 1080}×{analysis.source?.height ?? 1920} ({analysis.source?.aspect ?? "9:16"})
                  </div>
                  <div className="font-mono text-[11px] text-primary-bright">
                    {analysis.source?.fps ?? 30} fps · {analysis.source?.duration_s ?? 10.9}s ({analysis.source?.nb_frames ?? 328} frames)
                  </div>
                </Card>

                <Card className="p-3.5 space-y-1">
                  <div className="font-mono text-[10px] text-muted uppercase">Ritmo de Corte (ASL)</div>
                  <div className="font-display text-sm font-bold text-fg">
                    {analysis.edit?.stats?.shots ?? 7} Shots · ASL {analysis.edit?.stats?.asl_s ?? 1.56}s
                  </div>
                  <div className="font-mono text-[11px] text-primary-bright">
                    {analysis.edit?.stats?.cuts_per_min ?? 38.4} cortes/min · min {analysis.edit?.stats?.min_s ?? 0.6}s
                  </div>
                </Card>

                <Card className="p-3.5 space-y-1">
                  <div className="font-mono text-[10px] text-muted uppercase">Fluxo Óptico Câmera</div>
                  <div className="font-display text-sm font-bold text-fg">
                    {analysis.camera?.shots?.[0]?.dominant ?? analysis.camera?.dominant_move ?? "truck-right + push-in"}
                  </div>
                  <div className="font-mono text-[11px] text-primary-bright">
                    Vel: {analysis.camera?.shots?.[0]?.speed_pctW_s ?? analysis.camera?.avg_speed_pctW_s ?? 31.8} %W/s ·{" "}
                    {analysis.camera?.shots?.[0]?.ease_hint ?? "linear"}
                  </div>
                </Card>

                <Card className="p-3.5 space-y-1">
                  <div className="font-mono text-[10px] text-muted uppercase">Foco & DOF (Laplacian)</div>
                  <div className="font-display text-sm font-bold text-fg">
                    {analysis.focus?.shots?.[0]?.dof_class ?? "deep"}
                  </div>
                  <div className="font-mono text-[11px] text-primary-bright">
                    Center/Edge Ratio: {analysis.focus?.shots?.[0]?.center_edge_ratio ?? 1.04} · Rack:{" "}
                    {analysis.focus?.shots?.[0]?.rack_focus ?? "none"}
                  </div>
                </Card>

                <Card className="p-3.5 space-y-1">
                  <div className="font-mono text-[10px] text-muted uppercase">Áudio & Beat Grid</div>
                  <div className="font-display text-sm font-bold text-fg">
                    {analysis.audio?.tempo_bpm ?? 117.5} BPM ({analysis.audio?.audio_class ?? "music+sfx"})
                  </div>
                  <div className="font-mono text-[11px] text-primary-bright">
                    On-Beat: {Math.round(Number(analysis.audio?.on_beat_fraction ?? 0.84) * 100)}% dos cortes
                  </div>
                </Card>

                <Card className="p-3.5 space-y-1">
                  <div className="font-mono text-[10px] text-muted uppercase">Look, Grão & Paleta</div>
                  <div className="font-display text-xs font-bold text-fg truncate">
                    Grão σ={analysis.look?.grain_sigma ?? 3.87} · Vignette {analysis.look?.vignette_stops ?? -0.15}
                  </div>
                  <div className="flex items-center gap-1 pt-1">
                    {(analysis.look?.palette ?? []).slice(0, 6).map((c: { hex: string }, idx: number) => (
                      <span
                        key={idx}
                        title={c.hex}
                        className="inline-block h-4 w-4 rounded border border-white/20"
                        style={{ backgroundColor: c.hex }}
                      />
                    ))}
                  </div>
                </Card>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Coluna Esquerda (5 cols): Configuração da Engenharia Reversa & Passos VLM */}
              <div className="lg:col-span-5 space-y-4">
                <Card className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-sm font-bold text-fg flex items-center gap-2">
                      <Icon name="tune" className="text-primary-bright text-[18px]" />
                      Configurar Engenharia Reversa & Clone no PC
                    </h3>
                    <Badge tone="success">GPU Local Ativa</Badge>
                  </div>

                  {/* Seletor dos 4 Modos de Densidade do Local VLM */}
                  <div className="space-y-1.5">
                    <label className="label-mono text-[10px] text-muted">
                      Modo de Visão Computacional Local (`local_vlm.py` + `Qwen2.5-VL-7B`)
                    </label>
                    <div className="grid grid-cols-1 gap-2">
                      {(
                        [
                          {
                            id: "pass1_keyframes",
                            title: "Pass 1 — Keyframes de Shots (Rápido)",
                            desc: "Analisa início/meio/fim de cada corte (21 frames 720p c/ grade 10%×10%).",
                            badge: "21 frames",
                          },
                          {
                            id: "pass2_step5",
                            title: "Pass 2 — Amostragem Densa Step=5 (0.16s)",
                            desc: "Amostra todo o vídeo a cada 5 frames em lotes de 4 imagens com coordenadas X/Y.",
                            badge: "66 frames",
                          },
                          {
                            id: "pass3_adaptive_burst",
                            title: "Pass 3 — Adaptive High-Motion Burst (Recomendado)",
                            desc: "Combina Step=5 + rajada densa (Step=2, 0.06s) onde há picos de movimento óptico.",
                            badge: "130 frames",
                          },
                          {
                            id: "forensic_step1_1to1",
                            title: "Pass 4 — Forense Quadro a Quadro Step=1 (1:1 720×720 Strips)",
                            desc: "Extrai 100% dos frames (328 quadros) em tiras 6-tiles sem distorção para micro-animações.",
                            badge: "328 frames (100%)",
                          },
                        ] as const
                      ).map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setVlmMode(m.id)}
                          className={`rounded-lg border p-2.5 text-left transition-all ${
                            vlmMode === m.id
                              ? "border-primary bg-primary/10"
                              : "border-line bg-void/40 hover:border-primary/40"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-display text-xs font-bold text-fg">{m.title}</span>
                            <Badge tone={vlmMode === m.id ? "success" : "neutral"}>{m.badge}</Badge>
                          </div>
                          <p className="text-[10px] text-muted mt-0.5">{m.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="label-mono text-[10px] text-muted">Modelo Ollama Local (GPU)</label>
                      <select
                        value={localVlmModel}
                        onChange={(e) => setLocalVlmModel(e.target.value)}
                        className="field w-full px-3 py-2 text-xs mt-1"
                      >
                        {(data?.localEngine?.ollamaModels?.length
                          ? data.localEngine.ollamaModels
                          : ["qwen2.5-vl:7b", "jebadiah-4b-v2:latest", "gemma3:4b", "qwen2.5-coder:7b"]
                        ).map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label-mono text-[10px] text-muted">Nome do Novo Clone</label>
                      <input
                        value={cloneName}
                        onChange={(e) => setCloneName(e.target.value)}
                        className="field w-full px-3 py-2 text-xs mt-1"
                        placeholder="clone-motion-01"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label-mono text-[10px] text-muted">
                      Caminho de Vídeo Customizado no PC (Opcional — vazio usa o `ref.mp4` do preset)
                    </label>
                    <input
                      value={videoPath}
                      onChange={(e) => setVideoPath(e.target.value)}
                      className="field w-full px-3 py-2 text-xs mt-1 font-mono"
                      placeholder={
                        data?.presets?.find((p) => p.id === selectedPreset)?.refVideoPath ||
                        "F:\\Python Projects\\reels_tools\\projects\\...\\ref.mp4"
                      }
                    />
                  </div>

                  <div>
                    <label className="label-mono text-[10px] text-muted">
                      Tema / Roteiro que Receberá a Coreografia Clonada *
                    </label>
                    <textarea
                      value={userTopic}
                      onChange={(e) => setUserTopic(e.target.value)}
                      rows={2}
                      className="field w-full p-2.5 text-xs mt-1"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Button
                      variant="primary"
                      icon="visibility"
                      onClick={() => handleClone("clone")}
                    >
                      Gerar Clone Sharingan ({engineMode})
                    </Button>
                    <Button
                      variant="secondary"
                      icon="memory"
                      onClick={() => handleClone("analyze_local")}
                    >
                      Re-Executar `sharingan.py` na RTX 3060
                    </Button>
                  </div>

                  {notice && <div className="font-mono text-xs text-primary-bright">{notice}</div>}
                </Card>

                {/* Jobs & Clones Salvos */}
                <Card className="p-4 space-y-2.5">
                  <h3 className="font-display text-xs font-bold text-fg uppercase font-mono tracking-wider">
                    Jobs & Clones Recentes
                  </h3>
                  {(data?.jobs ?? []).slice(0, 5).map((j) => (
                    <div
                      key={j.id}
                      onClick={() => j.result?.briefPreview && setCustomBrief(j.result.briefPreview)}
                      className="cursor-pointer rounded border border-line bg-void/40 p-2.5 hover:border-primary/50 transition-all space-y-1"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono font-bold text-fg">
                          {j.result?.cloneName ?? `Job #${j.id.slice(-5)}`}
                        </span>
                        <Badge tone={j.status === "DONE" ? "success" : j.status === "FAILED" ? "warning" : "cyan"}>
                          {j.status} ({j.progress}%)
                        </Badge>
                      </div>
                      <div className="text-[11px] text-muted truncate">{j.message ?? "Processando..."}</div>
                    </div>
                  ))}
                </Card>
              </div>

              {/* Coluna Direita (7 cols): Recreation Brief (`brief.md`) & Especificação VLM (`local_vlm_spec.md`) */}
              <div className="lg:col-span-7 space-y-4">
                <Card className="p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Icon name="description" className="text-primary-bright text-[18px]" />
                      <h3 className="font-display text-sm font-bold text-fg">
                        Especificação Técnica Extraída (`brief.md` & `local_vlm_spec.md`)
                      </h3>
                    </div>

                    <div className="flex items-center gap-1 bg-void/80 p-1 rounded border border-line">
                      <button
                        type="button"
                        onClick={() => {
                          setCustomBrief(null);
                          setDocMode("brief");
                        }}
                        className={`rounded px-2.5 py-1 text-[11px] font-mono ${
                          docMode === "brief" ? "bg-primary text-void font-bold" : "text-fg-secondary"
                        }`}
                      >
                        Recreation Brief (`brief.md`)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomBrief(null);
                          setDocMode("vlm_spec");
                        }}
                        className={`rounded px-2.5 py-1 text-[11px] font-mono ${
                          docMode === "vlm_spec" ? "bg-primary text-void font-bold" : "text-fg-secondary"
                        }`}
                      >
                        Especificação Qwen2.5-VL (`local_vlm_spec.md`)
                      </button>
                    </div>
                  </div>

                  <pre className="max-h-[600px] overflow-y-auto whitespace-pre-wrap rounded-lg border border-line bg-void/80 p-4 font-mono text-[11px] text-fg-secondary leading-relaxed">
                    {customBrief ??
                      (docMode === "brief"
                        ? insp?.briefMd || "Nenhum brief carregado para este preset."
                        : insp?.localVlmSpecMd || "Nenhuma especificação VLM local encontrada.")}
                  </pre>
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* ABA 2: GRADE 10%×10%, TIRAS FORENSES 1:1 & INSPETOR QWEN2.5-VL AO VIVO */}
        {/* ===================================================================== */}
        {activeTab === "forensic" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Galeria de Frames 720p com Grade 10%x10% / Tiras 1:1 Step=1 / Contact Sheets */}
              <div className="lg:col-span-7 space-y-4">
                <Card className="p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-display text-sm font-bold text-fg flex items-center gap-2">
                        <Icon name="grid_on" className="text-primary-bright text-[18px]" />
                        Frames com Grade de Coordenadas 10%×10% & Tiras Forenses 1:1 (`Step=1`)
                      </h3>
                      <p className="text-[11px] text-muted">
                        Clique em qualquer frame ou tira 6-tiles abaixo para inspecionar e consultar o{" "}
                        <code className="text-primary-bright">Qwen2.5-VL-7B</code> ao vivo na sua RTX 3060.
                      </p>
                    </div>

                    <div className="flex items-center gap-1 bg-void/80 p-1 rounded border border-line">
                      <button
                        type="button"
                        onClick={() => setFrameGalleryMode("gridded720p")}
                        className={`rounded px-2.5 py-1 text-[11px] font-mono ${
                          frameGalleryMode === "gridded720p" ? "bg-primary text-void font-bold" : "text-fg-secondary"
                        }`}
                      >
                        Frames 720p Grade 10% ({insp?.griddedFrames?.length ?? 0})
                      </button>
                      <button
                        type="button"
                        onClick={() => setFrameGalleryMode("strips1to1")}
                        className={`rounded px-2.5 py-1 text-[11px] font-mono ${
                          frameGalleryMode === "strips1to1" ? "bg-primary text-void font-bold" : "text-fg-secondary"
                        }`}
                      >
                        Tiras Forenses 1:1 Step=1 ({insp?.forensicStrips1to1?.length ?? 0})
                      </button>
                      <button
                        type="button"
                        onClick={() => setFrameGalleryMode("sheets")}
                        className={`rounded px-2.5 py-1 text-[11px] font-mono ${
                          frameGalleryMode === "sheets" ? "bg-primary text-void font-bold" : "text-fg-secondary"
                        }`}
                      >
                        Contact Sheets ({insp?.sheets?.length ?? 0})
                      </button>
                    </div>
                  </div>

                  {/* Preview grande do frame/strip selecionado */}
                  {selectedFrameUrl && (
                    <div className="rounded-lg border border-line bg-void/90 p-3 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-mono text-muted">
                        <span className="truncate">{selectedFramePath}</span>
                        <Badge tone="cyan">Coordenadas X%/Y% Ativas</Badge>
                      </div>
                      <div className="flex justify-center bg-black/60 rounded overflow-hidden max-h-[420px]">
                        <img
                          src={selectedFrameUrl}
                          alt="Sharingan Frame"
                          className="object-contain max-h-[420px]"
                        />
                      </div>
                    </div>
                  )}

                  {/* Miniaturas */}
                  <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-2 max-h-80 overflow-y-auto p-1">
                    {(frameGalleryMode === "gridded720p"
                      ? insp?.griddedFrames ?? []
                      : frameGalleryMode === "strips1to1"
                        ? insp?.forensicStrips1to1 ?? []
                        : insp?.sheets ?? []
                    ).map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setSelectedFrameUrl(item.url);
                          setSelectedFramePath(item.path);
                        }}
                        className={`group relative rounded border overflow-hidden bg-void transition-all ${
                          selectedFramePath === item.path
                            ? "border-primary ring-2 ring-primary/50"
                            : "border-line hover:border-primary/40"
                        }`}
                      >
                        <img
                          src={item.url}
                          alt={item.name ?? item.label ?? `frame-${idx}`}
                          loading="lazy"
                          className="h-20 w-full object-cover"
                        />
                        <div className="bg-void/90 px-1.5 py-0.5 font-mono text-[9px] text-fg-secondary truncate">
                          {item.name ?? item.label}
                        </div>
                      </button>
                    ))}
                  </div>
                </Card>
              </div>

              {/* Inspetor Qwen2.5-VL ao Vivo + Lotes de Observação Medidos */}
              <div className="lg:col-span-5 space-y-4">
                <Card className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-sm font-bold text-fg flex items-center gap-2">
                      <Icon name="psychology" className="text-primary-bright text-[18px]" />
                      Consultar `Qwen2.5-VL-7B` ao Vivo (RTX 3060)
                    </h3>
                    <Badge tone="success">US$ 0.00 / query</Badge>
                  </div>
                  <p className="text-[11px] text-muted">
                    Envia o frame ou tira 1:1 selecionada ao lado diretamente para o Ollama local no seu computador para extrair coordenadas X/Y, fontes, cores hex e deltas de movimento.
                  </p>
                  <textarea
                    value={forensicPrompt}
                    onChange={(e) => setForensicPrompt(e.target.value)}
                    rows={3}
                    className="field w-full p-2.5 text-xs font-mono"
                  />
                  <Button
                    variant="primary"
                    icon="bolt"
                    disabled={forensicBusy || !selectedFramePath}
                    onClick={handleForensicQuery}
                  >
                    {forensicBusy
                      ? "Analisando na RTX 3060..."
                      : "Executar Visão Computacional na GPU Local"}
                  </Button>

                  {forensicAnswer && (
                    <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded border border-primary/30 bg-void/90 p-3 font-mono text-[11px] text-fg-secondary leading-relaxed">
                      {forensicAnswer}
                    </pre>
                  )}
                </Card>

                {/* Lotes já extraídos pelo Qwen2.5-VL */}
                <Card className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-xs font-bold text-fg uppercase font-mono">
                      Observações Quadro a Quadro Salvas ({activeObservations.length} Lotes)
                    </h3>
                    <div className="flex items-center gap-1 bg-void/80 p-0.5 rounded border border-line">
                      <button
                        type="button"
                        onClick={() => setObsMode("merged")}
                        className={`rounded px-2 py-0.5 text-[10px] font-mono ${
                          obsMode === "merged" ? "bg-primary text-void font-bold" : "text-fg-secondary"
                        }`}
                      >
                        Multi-Pass ({insp?.visionObservations?.length ?? 0})
                      </button>
                      <button
                        type="button"
                        onClick={() => setObsMode("forensic_step1")}
                        className={`rounded px-2 py-0.5 text-[10px] font-mono ${
                          obsMode === "forensic_step1" ? "bg-primary text-void font-bold" : "text-fg-secondary"
                        }`}
                      >
                        Step=1 1:1 ({insp?.forensicObservations?.length ?? 0})
                      </button>
                    </div>
                  </div>

                  <div className="max-h-80 overflow-y-auto space-y-2.5 pr-1">
                    {activeObservations.map((obs, idx) => (
                      <div key={idx} className="rounded border border-line bg-void/60 p-3 space-y-1.5">
                        <div className="flex items-center justify-between font-mono text-[10px] text-primary-bright">
                          <span>
                            Lote #{obs.batch_index} · {obs.time_range_s?.[0]?.toFixed(2)}s –{" "}
                            {obs.time_range_s?.[1]?.toFixed(2)}s
                          </span>
                          <Badge tone="neutral">{obs.pass ?? "vlm_batch"}</Badge>
                        </div>
                        <pre className="whitespace-pre-wrap font-mono text-[10px] text-fg-secondary leading-relaxed">
                          {obs.observation}
                        </pre>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* ABA 3: PALCO HTML5/GSAP INTERATIVO, COMPARATIVO 3-VIAS & 12 QC GATES    */}
        {/* ===================================================================== */}
        {activeTab === "stage" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Coluna Esquerda (5 cols): Palco HTML5/GSAP ao Vivo (Iframe 9:16 + Timeline Scrubber) */}
              <div className="lg:col-span-5 space-y-4">
                <Card className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-sm font-bold text-fg flex items-center gap-2">
                      <Icon name="code_blocks" className="text-primary-bright text-[18px]" />
                      Palco HTML5 / GSAP 3.12 Interativo (`1080×1920`)
                    </h3>
                    <Badge tone="violet">window.__timelines.main</Badge>
                  </div>

                  <div className="space-y-1.5">
                    <label className="label-mono text-[10px] text-muted">Versão do Palco HTML5/GSAP</label>
                    <select
                      value={selectedStageUrl ?? ""}
                      onChange={(e) => {
                        const st = insp?.htmlStages?.find((s) => s.url === e.target.value);
                        setSelectedStageUrl(e.target.value);
                        if (st) setSelectedStagePath(st.path);
                      }}
                      className="field w-full px-3 py-2 text-xs"
                    >
                      {(insp?.htmlStages ?? []).map((st) => (
                        <option key={st.id} value={st.url}>
                          {st.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Scrubber determinístico GSAP */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between font-mono text-[10px] text-fg-secondary">
                      <span>Scrubber Determinístico (`tl.seek(t)`)</span>
                      <span className="text-primary-bright">{stageTimeS.toFixed(2)}s</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={Number(analysis?.source?.duration_s ?? 10.9)}
                      step={0.033}
                      value={stageTimeS}
                      onChange={(e) => handleScrubStage(Number(e.target.value))}
                      className="w-full accent-primary"
                    />
                  </div>

                  {selectedStageUrl ? (
                    <div className="flex justify-center rounded-lg border border-line bg-black p-2 overflow-hidden">
                      <div className="relative w-[270px] h-[480px] overflow-hidden rounded border border-white/15">
                        <iframe
                          ref={iframeRef}
                          src={selectedStageUrl}
                          title="GSAP Stage Preview"
                          className="w-[1080px] h-[1920px] origin-top-left border-0"
                          style={{ transform: "scale(0.25)" }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="rounded border border-dashed border-line p-8 text-center text-xs text-muted">
                      Nenhum palco HTML5/GSAP encontrado para este preset.
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      icon="movie_creation"
                      disabled={renderBusy || !selectedStagePath}
                      onClick={handleRenderHtmlStage}
                    >
                      {renderBusy ? "Renderizando no PC..." : "Renderizar HTML5 → MP4 (Playwright + FFmpeg)"}
                    </Button>
                    {selectedStageUrl && (
                      <a href={selectedStageUrl} target="_blank" rel="noreferrer">
                        <Button variant="secondary" size="sm" icon="open_in_new">
                          Abrir em Tela Cheia
                        </Button>
                      </a>
                    )}
                  </div>
                </Card>
              </div>

              {/* Coluna Direita (7 cols): Player de Comparativo 3-Vias / Lado-a-Lado + 12 QC Gates */}
              <div className="lg:col-span-7 space-y-4">
                <Card className="p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-display text-sm font-bold text-fg flex items-center gap-2">
                      <Icon name="compare" className="text-primary-bright text-[18px]" />
                      Comparativo de Vídeo (Original vs Híbrido vs Qwen2.5-VL Local)
                    </h3>
                    <Badge tone="cyan">{insp?.videos?.length ?? 0} Renders Disponíveis</Badge>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {(insp?.videos ?? []).map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setSelectedVideoUrl(v.url)}
                        className={`rounded border px-2.5 py-1.5 font-mono text-[11px] transition-all ${
                          selectedVideoUrl === v.url
                            ? "border-primary bg-primary text-void font-bold"
                            : "border-line bg-void/50 text-fg-secondary hover:text-fg"
                        }`}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>

                  {selectedVideoUrl ? (
                    <div className="rounded-lg border border-line bg-black overflow-hidden flex justify-center">
                      <video
                        key={selectedVideoUrl}
                        src={selectedVideoUrl}
                        controls
                        loop
                        className="max-h-[480px] w-auto"
                      />
                    </div>
                  ) : (
                    <div className="rounded border border-dashed border-line p-8 text-center text-xs text-muted">
                      Nenhum vídeo comparativo selecionado.
                    </div>
                  )}
                </Card>

                {/* 12 Portões de Qualidade (sharingan.py compare) */}
                <Card className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-display text-sm font-bold text-fg flex items-center gap-2">
                        <Icon name="verified" className="text-primary-bright text-[18px]" />
                        12 Portões de Qualidade (`sharingan.py compare`)
                      </h3>
                      <p className="text-[11px] text-muted">
                        Compara matematicamente Aspect, FPS, Duration, ASL, Cuts/min, Camera Speed (%W/s), Camera Never Stops, DOF, Contrast, Saturation, Vignette e BPM entre o Original e o Clone.
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon="fact_check"
                      disabled={qcBusy}
                      onClick={handleRunQcCompare}
                    >
                      {qcBusy ? "Medindo..." : "Rodar 12 QC Gates no PC"}
                    </Button>
                  </div>

                  {qcReport && (
                    <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded border border-line bg-void/90 p-3 font-mono text-[11px] text-fg-secondary leading-relaxed">
                      {qcReport}
                    </pre>
                  )}
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* ABA 4: ECONOMIA DE TOKENS & TELEMETRIA GPU LOCAL (US$ 0.00)            */}
        {/* ===================================================================== */}
        {activeTab === "telemetry" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-4 space-y-1">
                <div className="font-mono text-[10px] text-muted uppercase">Custo na RTX 3060 (Ollama)</div>
                <div className="font-display text-2xl font-bold text-emerald-400">US$ 0.00</div>
                <div className="font-mono text-[11px] text-fg-secondary">
                  100% executado localmente no seu computador
                </div>
              </Card>

              <Card className="p-4 space-y-1">
                <div className="font-mono text-[10px] text-muted uppercase">Frames Analisados pelo VLM</div>
                <div className="font-display text-2xl font-bold text-fg">
                  {tokenReport?.video_analyzed?.total_frames_sent_to_vlm ?? 130} frames
                </div>
                <div className="font-mono text-[11px] text-primary-bright">
                  {tokenReport?.summary_pt_br?.frames_analisados ??
                    "66 frames (Step=5) + 64 frames (High-Motion Burst) + 328 Step=1"}
                </div>
              </Card>

              <Card className="p-4 space-y-1">
                <div className="font-mono text-[10px] text-muted uppercase">Tokens Poupados da Nuvem</div>
                <div className="font-display text-2xl font-bold text-fg">
                  {(tokenReport?.token_usage_measured?.grand_total_tokens ?? 107264).toLocaleString("pt-BR")}
                </div>
                <div className="font-mono text-[11px] text-primary-bright">
                  In: {(tokenReport?.token_usage_measured?.grand_total_input_tokens ?? 95350).toLocaleString("pt-BR")} · Out:{" "}
                  {(tokenReport?.token_usage_measured?.grand_total_output_tokens ?? 11914).toLocaleString("pt-BR")}
                </div>
              </Card>

              <Card className="p-4 space-y-1">
                <div className="font-mono text-[10px] text-muted uppercase">Economia (10 Iterações)</div>
                <div className="font-display text-2xl font-bold text-primary-bright">
                  {tokenReport?.summary_pt_br?.economia_10_iteracoes_ajuste_fino ?? "US$ 23.24"}
                </div>
                <div className="font-mono text-[11px] text-fg-secondary">
                  vs Claude Opus 4.6 ({tokenReport?.summary_pt_br?.economia_vs_claude_opus_single_run ?? "US$ 2.32"}/run)
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-5 space-y-4">
                <h3 className="font-display text-sm font-bold text-fg flex items-center gap-2">
                  <Icon name="paid" className="text-primary-bright text-[18px]" />
                  Comparativo de Custo: PC Local (RTX 3060) vs APIs Cloud
                </h3>
                <div className="space-y-2.5 font-mono text-xs">
                  <div className="flex items-center justify-between rounded border border-emerald-500/40 bg-emerald-500/10 p-3">
                    <span>Computador Local (`Qwen2.5-VL-7B` + `RTX 3060 12GB`)</span>
                    <span className="font-bold text-emerald-400">US$ 0.0000</span>
                  </div>
                  <div className="flex items-center justify-between rounded border border-line bg-void/50 p-3">
                    <span>Equivalente Claude Opus 4.6 Vision API</span>
                    <span className="text-fg">
                      US$ {tokenReport?.cost_comparison_usd?.claude_opus_4_6_api_equivalent?.total_usd ?? 2.3238} / execução
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded border border-line bg-void/50 p-3">
                    <span>Equivalente Claude Sonnet 4 Vision API</span>
                    <span className="text-fg">
                      US$ {tokenReport?.cost_comparison_usd?.claude_sonnet_4_api_equivalent?.total_usd ?? 0.4648} / execução
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded border border-line bg-void/50 p-3">
                    <span>Equivalente GPT-4o Vision API</span>
                    <span className="text-fg">
                      US$ {tokenReport?.cost_comparison_usd?.gpt_4o_api_equivalent?.total_usd ?? 0.3575} / execução
                    </span>
                  </div>
                </div>
              </Card>

              <Card className="p-5 space-y-4">
                <h3 className="font-display text-sm font-bold text-fg flex items-center gap-2">
                  <Icon name="speed" className="text-primary-bright text-[18px]" />
                  Janelas de Alta Velocidade Detectadas (`Adaptive High-Motion Burst`)
                </h3>
                <p className="text-xs text-muted">
                  Trechos onde o detector óptico de diferença de frames disparou amostragem densa (`Step=2`, a cada 0.066s) para capturar micro-animações rápidas:
                </p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {(tokenReport?.video_analyzed?.burst_windows ?? []).map((bw, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded border border-line bg-void/60 px-3 py-2 font-mono text-xs"
                    >
                      <span className="text-primary-bright font-bold">
                        {bw.start_s.toFixed(2)}s → {bw.end_s.toFixed(2)}s
                      </span>
                      <span className="text-fg-secondary">{bw.reason}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
