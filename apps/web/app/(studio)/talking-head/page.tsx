"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, Icon } from "@vincere-studio/ui";
import { Topbar } from "@/components/Topbar";
import { PageHeader } from "@/components/PageHeader";
import type {
  CompiledColorGradeRecipe,
  LockupAnalysis,
  ScriptReviewReport,
  TalkingHeadClip,
} from "@vincere-studio/core";

interface ReelsToolsStatus {
  computeMode: "AUTO" | "LOCAL_GPU" | "CLOUD_FAST";
  nodes: {
    cloudWeb: { online: boolean; label: string; tasks: string[] };
    localGpu: {
      online: boolean;
      reelsToolsLocal: boolean;
      sharinganLocal: boolean;
      ollamaOnline: boolean;
      voiceStudioOnline: boolean;
      label: string;
      tasks: string[];
    };
  };
  looks: { id: string; name: string; badge: string; description: string; category: string }[];
  recentJobs: {
    id: string;
    type: string;
    status: string;
    progress: number;
    message?: string;
    createdAt: string;
  }[];
}

export default function TalkingHeadPage() {
  const [status, setStatus] = useState<ReelsToolsStatus | null>(null);
  const [computeMode, setComputeMode] = useState<"AUTO" | "LOCAL_GPU" | "CLOUD_FAST">("AUTO");

  // 1. Limpeza Cirúrgica de Áudio & Mascaramento de Escala ("Regra do Vão Livre")
  const [sampleText, setSampleText] = useState(
    "O segredo dos vídeos que batem milhões [respiração] não é sorte. É a regra do vão livre: cortar cada milissegundo de silêncio e mascarar a emenda com salto de escala de doze por cento na batida.",
  );
  const [minGap, setMinGap] = useState(0.35);
  const [timelineRes, setTimelineRes] = useState<{
    clips: TalkingHeadClip[];
    rawDurationS: number;
    cleanDurationS: number;
    savedSeconds: number;
    cutsCount: number;
  } | null>(null);
  const [reviewRes, setReviewRes] = useState<ScriptReviewReport | null>(null);

  // 2. Aninhamento Tipográfico (Lockup Nesting — 07b_nesting.py)
  const [lockupMain, setLockupMain] = useState("limpeza");
  const [lockupAbove, setLockupAbove] = useState("pra fazer");
  const [lockupBelow, setLockupBelow] = useState("das lavouras");
  const [lockupRes, setLockupRes] = useState<LockupAnalysis | null>(null);

  // 3. Color Grading 3D & Live SVG LUT (06b_color_grade.py)
  const [selectedLook, setSelectedLook] = useState("apple_sungazing");
  const [lookRecipe, setLookRecipe] = useState<CompiledColorGradeRecipe | null>(null);

  // 4. Disparo de Job Completo no Worker (Duas Vias)
  const [projectName, setProjectName] = useState("reel-talking-head-01");
  const [videoPath, setVideoPath] = useState("");
  const [jobNotice, setJobNotice] = useState<string | null>(null);

  const loadStatus = async () => {
    try {
      const res = await fetch("/api/reels-tools");
      const d = await res.json();
      if (d.ok) {
        setStatus(d);
        setComputeMode(d.computeMode);
      }
    } catch {}
  };

  const runCleanTimeline = async (txt = sampleText, gap = minGap) => {
    const res = await fetch("/api/reels-tools", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "clean-timeline", text: txt, minSilenceGapS: gap }),
    });
    const d = await res.json();
    if (d.ok) {
      setTimelineRes(d.timeline);
      setReviewRes(d.review);
    }
  };

  const runLockup = async (m = lockupMain, a = lockupAbove, b = lockupBelow) => {
    const res = await fetch("/api/reels-tools", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "lockup", main: m, above: a, below: b }),
    });
    const d = await res.json();
    if (d.ok) setLockupRes(d.analysis);
  };

  const runColorGrade = async (look = selectedLook) => {
    const res = await fetch("/api/reels-tools", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "color-grade", lookId: look }),
    });
    const d = await res.json();
    if (d.ok) setLookRecipe(d.recipe);
  };

  const changeComputeMode = async (m: "AUTO" | "LOCAL_GPU" | "CLOUD_FAST") => {
    setComputeMode(m);
    await fetch("/api/reels-tools", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "set-compute-mode", mode: m }),
    });
    loadStatus();
  };

  const triggerFullPipeline = async () => {
    setJobNotice("Enfileirando pipeline...");
    const res = await fetch("/api/reels-tools", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "run-talking-head-job",
        projectName,
        computeMode,
        lookId: selectedLook,
        transcript: sampleText,
        lockupMain,
        lockupAbove,
        lockupBelow,
        videoPath: videoPath.trim() || undefined,
      }),
    });
    const d = await res.json();
    if (d.ok) {
      setJobNotice(`Job #${d.jobId.slice(-6)} enviado para a fila (${computeMode})!`);
      loadStatus();
    } else {
      setJobNotice(`Erro: ${d.error}`);
    }
  };

  useEffect(() => {
    loadStatus();
    runCleanTimeline();
    runLockup();
    runColorGrade();
  }, []);

  return (
    <>
      <Topbar crumbs={["Criar", "Talking Head & Reels Tools"]} />
      <main className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
        <PageHeader
          icon="person_pin"
          title={
            <span className="flex items-center gap-3">
              Estúdio Talking Head & Reels Tools <Badge tone="cyan">Duas Vias: Nuvem + GPU Local</Badge>
            </span>
          }
          subtitle="Fluxo dedicado para vídeos de fala (apresentador ou clone), separado de Documentário Dark. Inclui Regra do Vão Livre, Lockup Nesting, Color Grading 3D e Mascaramento de Cortes."
          right={
            <div className="flex items-center gap-2">
              <Link href="/projects?modo=talking-head">
                <Button variant="secondary" size="sm" icon="view_kanban">
                  Quadro Talking Head
                </Button>
              </Link>
              <Link href="/sharingan">
                <Button variant="primary" size="sm" icon="visibility">
                  Clonagem Sharingan
                </Button>
              </Link>
            </div>
          }
        />

        {/* Painel do Sistema de Processamento de Duas Vias (Nuvem vs Local GPU) */}
        <Card className="p-5 space-y-4" accent="dual">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Icon name="alt_route" className="text-primary-bright text-[20px]" />
                <h2 className="font-display text-base font-bold text-fg">
                  Roteador de Processamento de Duas Vias (Cloud Web ↔ Local GPU)
                </h2>
              </div>
              <p className="text-xs text-muted mt-0.5">
                Operações leves rodam instantaneamente na Nuvem/Interface; tarefas pesadas (áudio neural, CrisperWhisper, alinhamento MediaPipe e clonagem de vídeo) usam a GPU Local ou fazem fallback pra Nuvem.
              </p>
            </div>

            <div className="flex items-center gap-1.5 bg-void/70 p-1 rounded-lg border border-line self-start">
              {(
                [
                  { id: "AUTO", label: "Automático (Híbrido)", icon: "auto_mode" },
                  { id: "CLOUD_FAST", label: "Só Nuvem (PC Fraco)", icon: "cloud_done" },
                  { id: "LOCAL_GPU", label: "Forçar GPU Local", icon: "memory" },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => changeComputeMode(m.id)}
                  className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-mono transition-all ${
                    computeMode === m.id
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-line bg-void/40 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-display text-xs font-bold text-primary-bright flex items-center gap-1.5">
                  <Icon name="cloud" className="text-[16px]" />
                  {status?.nodes.cloudWeb.label ?? "Via 1 · Nuvem / Interface Web"}
                </span>
                <Badge tone="success" pill dot>
                  Online (0ms)
                </Badge>
              </div>
              <p className="text-[11px] text-muted">
                Executa direto no servidor web (VPS/Nuvem) sem exigir placa de vídeo no computador do usuário:
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {(status?.nodes.cloudWeb.tasks ?? [
                  "Lockup Nesting (07b)",
                  "256-pt SVG Color LUT (06b)",
                  "Regra do Vão Livre & Splice Masking",
                  "Revisão Editorial (07c)",
                ]).map((t) => (
                  <span key={t} className="rounded border border-line bg-surface-low px-2 py-0.5 font-mono text-[10px] text-fg-secondary">
                    ✓ {t}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-line bg-void/40 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-display text-xs font-bold text-secondary-soft flex items-center gap-1.5">
                  <Icon name="developer_board" className="text-[16px]" />
                  {status?.nodes.localGpu.label ?? "Via 2 · Worker Local GPU / PC"}
                </span>
                <Badge tone={status?.nodes.localGpu.online ? "success" : "neutral"} pill dot={status?.nodes.localGpu.online}>
                  {status?.nodes.localGpu.online ? "GPU Local Detectada" : "Modo Cloud Fallback"}
                </Badge>
              </div>
              <p className="text-[11px] text-muted">
                Processamento pesado de áudio e vídeo (quando offline ou em PC sem GPU, chaveia automaticamente para a Nuvem):
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="rounded border border-line bg-surface-low px-2 py-0.5 font-mono text-[10px] text-fg-secondary">
                  reels_tools: {status?.nodes.localGpu.reelsToolsLocal ? "Ativo" : "Cloud Fallback"}
                </span>
                <span className="rounded border border-line bg-surface-low px-2 py-0.5 font-mono text-[10px] text-fg-secondary">
                  video-sharingan: {status?.nodes.localGpu.sharinganLocal ? "Ativo" : "Cloud Fallback"}
                </span>
                <span className="rounded border border-line bg-surface-low px-2 py-0.5 font-mono text-[10px] text-fg-secondary">
                  Ollama VLM: {status?.nodes.localGpu.ollamaOnline ? "Online (:11434)" : "Standby"}
                </span>
                <span className="rounded border border-line bg-surface-low px-2 py-0.5 font-mono text-[10px] text-fg-secondary">
                  VoiceStudio: {status?.nodes.localGpu.voiceStudioOnline ? "Online (:3900)" : "Via Worker"}
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Ferramenta 1 e 2: Limpeza de Timeline ("Regra do Vão Livre") + Lockup Nesting */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 1. Regra do Vão Livre + Mascaramento de Cortes + Revisão 07c */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon name="content_cut" className="text-primary-bright text-[20px]" />
                <div>
                  <h3 className="font-display text-sm font-bold text-fg">
                    1. Limpeza Cirúrgica & Mascaramento de Cortes (`04` + `07_plan_visuals`)
                  </h3>
                  <p className="text-[11px] text-muted">
                    Regra do Vão Livre + micro-fade de 28ms + salto automático de escala (100% ↔ 112%) em cada corte seco.
                  </p>
                </div>
              </div>
              <Badge tone="cyan">Leve · Nuvem</Badge>
            </div>

            <textarea
              value={sampleText}
              onChange={(e) => setSampleText(e.target.value)}
              rows={3}
              className="field w-full p-3 text-xs leading-relaxed"
              placeholder="Cole a transcrição bruta ou roteiro com marcações [respiração]..."
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-xs text-fg-secondary font-mono">
                <span>Vão mínimo p/ corte:</span>
                <input
                  type="number"
                  step={0.05}
                  min={0.15}
                  max={1.5}
                  value={minGap}
                  onChange={(e) => setMinGap(Number(e.target.value))}
                  className="field w-20 px-2 py-1 text-xs"
                />
                <span>s</span>
              </label>
              <Button size="sm" variant="primary" icon="bolt" onClick={() => runCleanTimeline(sampleText, minGap)}>
                Calcular Cortes & Câmera
              </Button>
            </div>

            {timelineRes && (
              <div className="space-y-3 pt-2 border-t border-line">
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="rounded bg-void/60 p-2 border border-line">
                    <div className="font-mono text-xs font-bold text-fg">{timelineRes.rawDurationS}s</div>
                    <div className="text-[10px] text-muted">Bruto</div>
                  </div>
                  <div className="rounded bg-void/60 p-2 border border-line">
                    <div className="font-mono text-xs font-bold text-success">{timelineRes.cleanDurationS}s</div>
                    <div className="text-[10px] text-muted">Limpo</div>
                  </div>
                  <div className="rounded bg-void/60 p-2 border border-line">
                    <div className="font-mono text-xs font-bold text-primary-bright">-{timelineRes.savedSeconds}s</div>
                    <div className="text-[10px] text-muted">Vãos Cortados</div>
                  </div>
                  <div className="rounded bg-void/60 p-2 border border-line">
                    <div className="font-mono text-xs font-bold text-secondary-soft">{timelineRes.cutsCount}</div>
                    <div className="text-[10px] text-muted">Jump-Cuts</div>
                  </div>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {timelineRes.clips.map((c) => (
                    <div key={c.index} className="flex items-center justify-between gap-2 rounded border border-line bg-void/40 px-2.5 py-1.5 text-[11px]">
                      <div className="min-w-0 flex-1">
                        <span className="font-mono text-primary-bright mr-2">
                          #{c.index} [{c.cleanStart.toFixed(1)}s–{c.cleanEnd.toFixed(1)}s]
                        </span>
                        <span className="text-fg truncate">{c.text}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 font-mono text-[10px]">
                        <span className="rounded bg-primary/15 px-1.5 py-0.5 text-primary-bright">
                          {c.cameraMove} ({c.scaleFrom}%→{c.scaleTo}%)
                        </span>
                        {c.spliceJumpMasked && (
                          <span className="rounded bg-success/15 px-1.5 py-0.5 text-success" title="Corte seco mascarado com salto de escala >= 6%">
                            Mask ✓
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {reviewRes && (
                  <div className="flex flex-wrap gap-2 text-[10px] font-mono text-muted pt-1">
                    <span>Revisão 07c:</span>
                    <span>Nomes ({reviewRes.issues.NOME.length})</span>
                    <span>·</span>
                    <span>Números ({reviewRes.issues.NUMERO.length})</span>
                    <span>·</span>
                    <span>Ruídos/Fillers ({reviewRes.issues.BACKCHAN.length})</span>
                    <span>·</span>
                    <span>Pausas ({reviewRes.issues.PAUSA.length})</span>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* 2. Aninhamento Tipográfico (Lockup Nesting — 07b_nesting.py) */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon name="text_fields" className="text-primary-bright text-[20px]" />
                <div>
                  <h3 className="font-display text-sm font-bold text-fg">
                    2. Geometria de Legenda Lockup (`07b_nesting.py`)
                  </h3>
                  <p className="text-[11px] text-muted">
                    Calcula as folgas entre ascendentes (`bdfhkl`) e descendentes (`gjpqyç`) para aninhar palavras auxiliares.
                  </p>
                </div>
              </div>
              <Badge tone="cyan">Leve · Nuvem</Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="label-mono text-[10px] text-muted">Texto Acima (Above)</label>
                <input
                  value={lockupAbove}
                  onChange={(e) => setLockupAbove(e.target.value)}
                  className="field w-full px-2.5 py-1.5 text-xs mt-1"
                  placeholder="pra fazer"
                />
              </div>
              <div>
                <label className="label-mono text-[10px] text-primary-bright">Palavra Principal (minúscula!)</label>
                <input
                  value={lockupMain}
                  onChange={(e) => setLockupMain(e.target.value)}
                  className="field w-full px-2.5 py-1.5 text-xs font-bold mt-1"
                  placeholder="limpeza"
                />
              </div>
              <div>
                <label className="label-mono text-[10px] text-muted">Texto Abaixo (Below)</label>
                <input
                  value={lockupBelow}
                  onChange={(e) => setLockupBelow(e.target.value)}
                  className="field w-full px-2.5 py-1.5 text-xs mt-1"
                  placeholder="das lavouras"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted">
                Dica: evite CAIXA ALTA na palavra principal para preservar os vãos das ascendentes.
              </span>
              <Button size="sm" variant="primary" icon="straighten" onClick={() => runLockup()}>
                Medir Encaixe
              </Button>
            </div>

            {lockupRes && (
              <div className="space-y-3 pt-2 border-t border-line">
                {/* Prévia Visual Ao Vivo do Lockup */}
                <div className="relative flex flex-col items-center justify-center rounded-lg border border-line bg-void py-6 px-4 overflow-hidden">
                  {lockupRes.above && (
                    <div
                      className="font-mono font-semibold text-primary-bright tracking-wide"
                      style={{
                        fontSize: `${Math.round(44 * lockupRes.above.scale)}px`,
                        alignSelf:
                          lockupRes.above.slot?.align === "left"
                            ? "flex-start"
                            : lockupRes.above.slot?.align === "right"
                              ? "flex-end"
                              : "center",
                        marginBottom: lockupRes.above.nest === "tucked" ? "-8px" : "2px",
                        paddingLeft: lockupRes.above.slot ? `${Math.round(lockupRes.above.slot.frac[0] * 100)}%` : undefined,
                      }}
                    >
                      {lockupRes.above.text}
                    </div>
                  )}
                  <div className="font-display font-black text-fg tracking-tight leading-none" style={{ fontSize: "48px" }}>
                    {lockupRes.main.text}
                  </div>
                  {lockupRes.below && (
                    <div
                      className="font-mono font-semibold text-secondary-soft tracking-wide"
                      style={{
                        fontSize: `${Math.round(44 * lockupRes.below.scale)}px`,
                        marginTop: lockupRes.below.nest === "tucked" ? "-6px" : "2px",
                      }}
                    >
                      {lockupRes.below.text}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
                  <div className="rounded border border-line bg-void/50 p-2">
                    <div className="text-muted text-[10px]">Qualidade Lockup</div>
                    <div className="font-bold text-primary-bright">{Math.round(lockupRes.quality * 100)}%</div>
                  </div>
                  <div className="rounded border border-line bg-void/50 p-2">
                    <div className="text-muted text-[10px]">Encaixe Superior</div>
                    <div className="font-bold text-fg">
                      {lockupRes.above ? `${lockupRes.above.nest} (${lockupRes.above.scale}x)` : "—"}
                    </div>
                  </div>
                  <div className="rounded border border-line bg-void/50 p-2">
                    <div className="text-muted text-[10px]">Encaixe Inferior</div>
                    <div className="font-bold text-fg">
                      {lockupRes.below ? `${lockupRes.below.nest} (${lockupRes.below.scale}x)` : "—"}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Ferramenta 3 e 4: Color Grading 3D LUT / SVG + Executor Completo Híbrido */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 3. Color Grading 06b */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon name="palette" className="text-primary-bright text-[20px]" />
                <div>
                  <h3 className="font-display text-sm font-bold text-fg">
                    3. Motor de Color Grading & Emulação de Filme (`06b_color_grade.py`)
                  </h3>
                  <p className="text-[11px] text-muted">
                    Gera matriz `feColorMatrix` 4×5 + curvas `feComponentTransfer` de 256 pontos com proteção de pele (30° HSV).
                  </p>
                </div>
              </div>
              <Badge tone="violet">6 Looks Cinema</Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(status?.looks ?? []).map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => {
                    setSelectedLook(l.id);
                    runColorGrade(l.id);
                  }}
                  className={`rounded border p-2.5 text-left transition-all ${
                    selectedLook === l.id
                      ? "border-primary bg-primary/15 text-fg"
                      : "border-line bg-void/40 text-fg-secondary hover:border-primary/40"
                  }`}
                >
                  <div className="font-mono text-[10px] font-bold text-primary-bright">{l.badge}</div>
                  <div className="text-xs font-semibold truncate mt-0.5">{l.name.split("(")[0]}</div>
                </button>
              ))}
            </div>

            {lookRecipe && (
              <div className="space-y-2 rounded border border-line bg-void/50 p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-fg">{lookRecipe.name}</span>
                  <span className="font-mono text-[10px] text-primary-bright">
                    {lookRecipe.effectiveParams.temperatureK}K · Sat {lookRecipe.effectiveParams.saturationScale}x
                  </span>
                </div>
                <p className="text-[11px] text-muted">{lookRecipe.description}</p>
                <div className="rounded bg-void p-2 font-mono text-[10px] text-fg-secondary overflow-x-auto">
                  filterId: #{lookRecipe.svgFilter.filterId} | feColorMatrix: [{lookRecipe.svgFilter.feColorMatrix.slice(0, 48)}…]
                </div>
              </div>
            )}
          </Card>

          {/* 4. Disparar Pipeline Talking Head Completo (Worker Híbrido) */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon name="rocket_launch" className="text-primary-bright text-[20px]" />
                <div>
                  <h3 className="font-display text-sm font-bold text-fg">
                    4. Processar Projeto Talking Head Completo (`TALKING_HEAD_PIPELINE`)
                  </h3>
                  <p className="text-[11px] text-muted">
                    Salva o pacote completo em `storage/talking-head/` e, no modo GPU Local, aciona o ingest, alinhamento facial (`08_align_face.py`) e compilador HyperFrames (`10_compile_hyperframes.py`).
                  </p>
                </div>
              </div>
              <Badge tone="success">Duas Vias</Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label-mono text-[10px] text-muted">Identificador do Projeto</label>
                <input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="field w-full px-3 py-2 text-xs mt-1"
                  placeholder="reel-talking-head-01"
                />
              </div>
              <div>
                <label className="label-mono text-[10px] text-muted">Vídeo A-Roll no PC (opcional p/ GPU Local)</label>
                <input
                  value={videoPath}
                  onChange={(e) => setVideoPath(e.target.value)}
                  className="field w-full px-3 py-2 text-xs mt-1"
                  placeholder="C:\Users\Igor\Videos-HF\raw_video.mp4"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <Button variant="primary" icon="play_arrow" onClick={triggerFullPipeline}>
                Executar Pipeline ({computeMode})
              </Button>
              {jobNotice && <span className="font-mono text-xs text-primary-bright">{jobNotice}</span>}
            </div>

            {status?.recentJobs && status.recentJobs.length > 0 && (
              <div className="space-y-1.5 border-t border-line pt-3">
                <div className="font-mono text-[10px] text-muted uppercase">Últimas Execuções Híbridas</div>
                {status.recentJobs.slice(0, 4).map((j) => (
                  <div key={j.id} className="flex items-center justify-between text-xs rounded bg-void/40 px-2.5 py-1.5 border border-line">
                    <span className="font-mono text-[11px] text-fg">{j.type}</span>
                    <span className="text-[11px] text-muted truncate max-w-60">{j.message ?? j.status}</span>
                    <Badge tone={j.status === "DONE" ? "success" : j.status === "FAILED" ? "warning" : "cyan"}>
                      {j.status} ({j.progress}%)
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </main>
    </>
  );
}
