"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, Icon } from "@vincere-studio/ui";
import { Topbar } from "@/components/Topbar";
import { PageHeader } from "@/components/PageHeader";

interface MediaAsset {
  id?: string;
  name?: string;
  label?: string;
  path: string;
  url: string;
}

interface SharinganData {
  localEngine: {
    sharinganScriptExists: boolean;
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
  presets: {
    id: string;
    title: string;
    description: string;
    fps: number;
    aspect: string;
    shotsCount: number;
    aslS: number;
    bpm: number;
    look: string;
  }[];
  activeInspection: {
    presetId: string;
    analysis: Record<string, any> | null;
    briefMd: string | null;
    localVlmSpecMd: string | null;
    tokenSavingsReport: {
      video_analyzed?: { total_frames_sent_to_vlm?: number };
      token_usage_measured?: { grand_total_tokens?: number };
      summary_pt_br?: {
        custo_local?: string;
        economia_vs_claude_opus_single_run?: string;
        economia_10_iteracoes_ajuste_fino?: string;
      };
    } | null;
    sheets: MediaAsset[];
    griddedFrames: MediaAsset[];
    forensicStrips1to1: MediaAsset[];
    htmlStages: MediaAsset[];
    videos: MediaAsset[];
  };
  savedClones: {
    cloneName: string;
    effectiveEngine: string;
    userTopic: string;
    briefPreview: string;
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
    };
    createdAt: string;
  }[];
}

export default function SharinganPage() {
  const [data, setData] = useState<SharinganData | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string>("referenciamotion");
  const [engineMode, setEngineMode] = useState<"LOCAL_GPU" | "CLOUD">("LOCAL_GPU");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [userTopic, setUserTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeMediaUrl, setActiveMediaUrl] = useState<string | null>(null);
  const [activeMediaKind, setActiveMediaKind] = useState<"video" | "image" | "stage">("video");
  const [showBriefModal, setShowBriefModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadData = async (presetId = selectedPreset) => {
    try {
      const res = await fetch(`/api/sharingan?presetId=${encodeURIComponent(presetId)}`);
      const d = await res.json();
      if (d.ok) {
        setData(d);
        const insp = d.activeInspection;
        if (insp && !activeMediaUrl) {
          const defaultVid =
            insp.videos?.find((v: MediaAsset) => v.id?.startsWith("comp_")) ?? insp.videos?.[0];
          if (defaultVid) {
            setActiveMediaUrl(defaultVid.url);
            setActiveMediaKind("video");
          } else if (insp.griddedFrames?.[0]) {
            setActiveMediaUrl(insp.griddedFrames[0].url);
            setActiveMediaKind("image");
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

  const handleFilesSelected = (filesList: FileList | null) => {
    if (!filesList) return;
    setSelectedFiles((prev) => [...prev, ...Array.from(filesList)]);
  };

  const removeFile = (idx: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleClonar = async () => {
    setBusy(true);
    setNotice("Preparando arquivos e iniciando clonagem com Sharingan na GPU...");
    try {
      let uploadedVideoPath: string | undefined;
      if (selectedFiles.length > 0) {
        const fd = new FormData();
        for (const f of selectedFiles) fd.append("files", f);
        const upRes = await fetch("/api/sharingan/upload", { method: "POST", body: fd });
        const upData = await upRes.json();
        if (upData.ok && upData.files?.length > 0) {
          const firstVideo =
            upData.files.find((x: any) => /\.(mp4|mov|webm|mkv)$/i.test(x.name)) ??
            upData.files[0];
          uploadedVideoPath = firstVideo.path;
        }
      }

      const cloneName =
        selectedFiles[0]?.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "-") ||
        `clone-${selectedPreset}-${Date.now().toString().slice(-4)}`;

      const res = await fetch("/api/sharingan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "clone",
          cloneName,
          engineMode,
          vlmMode: "pass3_adaptive_burst",
          styleReferenceId: selectedPreset,
          videoPath: uploadedVideoPath,
          userTopic:
            userTopic.trim() ||
            `Clonagem automática de ritmo, câmera e motion (${selectedFiles.length || 1} arquivo(s))`,
          useLocalVlm: true,
        }),
      });
      const d = await res.json();
      if (d.ok) {
        setNotice(
          `Clonagem iniciada com sucesso (${engineMode === "LOCAL_GPU" ? "GPU Local RTX 3060 · US$ 0.00" : "Nuvem"})! Veja a galeria e o histórico abaixo.`,
        );
        setSelectedFiles([]);
        loadData(selectedPreset);
      } else {
        setNotice(`Erro: ${d.error}`);
      }
    } catch (e) {
      setNotice(`Falha ao clonar: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const insp = data?.activeInspection;
  const tokenReport = insp?.tokenSavingsReport;
  const galleryItems: { label: string; url: string; kind: "video" | "image" | "stage" }[] = [
    ...(insp?.videos ?? []).map((v) => ({
      label: v.label || v.name || "Vídeo Clonado",
      url: v.url,
      kind: "video" as const,
    })),
    ...(insp?.htmlStages ?? []).map((s) => ({
      label: s.label || "Palco Interativo GSAP",
      url: s.url,
      kind: "stage" as const,
    })),
    ...(insp?.sheets ?? []).map((sh) => ({
      label: sh.label || "Contact Sheet",
      url: sh.url,
      kind: "image" as const,
    })),
    ...(insp?.forensicStrips1to1 ?? []).slice(0, 8).map((st) => ({
      label: `Tira Forense 1:1 (${st.name})`,
      url: st.url,
      kind: "image" as const,
    })),
    ...(insp?.griddedFrames ?? []).slice(0, 12).map((fr) => ({
      label: `Frame 720p (${fr.name})`,
      url: fr.url,
      kind: "image" as const,
    })),
  ];

  return (
    <>
      <Topbar crumbs={["MotionDex", "Clonagem (Sharingan)"]} />
      <main className="space-y-6 p-4 sm:p-6 max-w-6xl mx-auto">
        <PageHeader
          icon="visibility"
          title={
            <span className="flex flex-wrap items-center gap-2.5">
              <span>Clonagem Sharingan</span>
              <Badge tone="success">GPU Local · US$ 0.00</Badge>
            </span>
          }
          subtitle="Envie vídeos ou imagens de referência, clique em Clonar e o Sharingan extrai todo o movimento, cortes e estética usando a sua placa de vídeo."
          right={
            <Link href="/motion-dex">
              <Button variant="secondary" size="sm" icon="auto_awesome_motion">
                Abrir MotionDex
              </Button>
            </Link>
          }
        />

        {/* 1. Banner de Economia usando a Placa de Vídeo Local vs Nuvem */}
        <Card className="p-4" accent="dual">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <Icon name="savings" className="text-[24px]" />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-sm font-bold text-fg">
                    Economia na Placa de Vídeo ({data?.localEngine?.gpu?.name ?? "RTX 3060 12GB"}):
                  </span>
                  <span className="font-mono text-sm font-bold text-emerald-400">
                    {tokenReport?.summary_pt_br?.economia_10_iteracoes_ajuste_fino ?? "US$ 23,24"} poupados
                  </span>
                </div>
                <p className="text-xs text-muted mt-0.5">
                  Custo na sua GPU: <strong className="text-emerald-400">US$ 0.00</strong> ·{" "}
                  {(tokenReport?.token_usage_measured?.grand_total_tokens ?? 107264).toLocaleString("pt-BR")}{" "}
                  tokens de visão processados localmente ({tokenReport?.summary_pt_br?.economia_vs_claude_opus_single_run ?? "US$ 2,32"} economizados por vídeo vs API na nuvem).
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 bg-void/80 p-1 rounded-lg border border-line self-start sm:self-center shrink-0">
              <button
                type="button"
                onClick={() => setEngineMode("LOCAL_GPU")}
                className={`rounded px-3 py-1.5 font-mono text-xs transition-all ${
                  engineMode === "LOCAL_GPU"
                    ? "bg-primary text-void font-bold"
                    : "text-fg-secondary hover:text-fg"
                }`}
              >
                Placa de Vídeo (US$ 0)
              </button>
              <button
                type="button"
                onClick={() => setEngineMode("CLOUD")}
                className={`rounded px-3 py-1.5 font-mono text-xs transition-all ${
                  engineMode === "CLOUD"
                    ? "bg-primary text-void font-bold"
                    : "text-fg-secondary hover:text-fg"
                }`}
              >
                Nuvem
              </button>
            </div>
          </div>
        </Card>

        {/* 2. Caixa Única e Direta: Arrastar Vários Arquivos (Vídeo/Imagem) + Botão Clonar */}
        <Card className="p-5 space-y-4">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFilesSelected(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className="cursor-pointer rounded-xl border-2 border-dashed border-primary/40 bg-void/40 hover:bg-primary/5 hover:border-primary transition-all p-6 text-center space-y-2"
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="video/*,image/*"
              className="hidden"
              onChange={(e) => handleFilesSelected(e.target.files)}
            />
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-primary/15 text-primary-bright">
              <Icon name="cloud_upload" className="text-[26px]" />
            </span>
            <div className="font-display text-sm font-bold text-fg">
              Solte aqui seus vídeos e imagens de referência (ou clique para selecionar vários arquivos)
            </div>
            <p className="text-xs text-muted">
              Suporta múltiplos arquivos `.mp4`, `.mov`, `.webm`, `.png`, `.jpg` — ou escolha abaixo um estilo já capturado para inspecionar.
            </p>
          </div>

          {selectedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedFiles.map((f, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-fg"
                >
                  <Icon
                    name={f.type.startsWith("video") ? "movie" : "image"}
                    className="text-[15px] text-primary-bright"
                  />
                  <span className="truncate max-w-[200px]">{f.name}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="text-muted hover:text-fg"
                  >
                    <Icon name="close" className="text-[14px]" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
            <input
              value={userTopic}
              onChange={(e) => setUserTopic(e.target.value)}
              placeholder="Opcional: sobre qual tema você quer aplicar esse estilo clonado?"
              className="field px-3.5 py-2.5 text-sm"
            />
            <Button
              variant="primary"
              size="lg"
              icon="visibility"
              disabled={busy}
              onClick={handleClonar}
            >
              {busy ? "Clonando na GPU..." : "Clonar"}
            </Button>
          </div>

          {notice && (
            <div className="rounded-lg border border-primary/30 bg-primary/10 px-3.5 py-2 font-mono text-xs text-primary-bright">
              {notice}
            </div>
          )}
        </Card>

        {/* 3. Galeria do que foi Clonado */}
        <Card className="p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-bold text-fg flex items-center gap-2">
                <Icon name="collections" className="text-primary-bright text-[20px]" />
                Galeria da Clonagem
              </h2>
              <p className="text-xs text-muted">
                Visualize o resultado clonado, o comparativo lado a lado, o palco GSAP e os quadros analisados.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {(data?.presets ?? []).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setSelectedPreset(p.id);
                    setActiveMediaUrl(null);
                  }}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-mono transition-all ${
                    selectedPreset === p.id
                      ? "border-primary bg-primary text-void font-bold"
                      : "border-line bg-void/50 text-fg-secondary hover:text-fg"
                  }`}
                >
                  {p.id}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowBriefModal(!showBriefModal)}
                className="rounded-lg border border-line bg-void/60 px-2.5 py-1 text-xs font-mono text-primary-bright hover:border-primary"
              >
                {showBriefModal ? "Ocultar Brief Técnico" : "Ver Brief Técnico"}
              </button>
            </div>
          </div>

          {/* Visualizador Principal da Galeria */}
          {activeMediaUrl && (
            <div className="rounded-xl border border-line bg-black/90 p-3 flex justify-center overflow-hidden">
              {activeMediaKind === "video" ? (
                <video
                  key={activeMediaUrl}
                  src={activeMediaUrl}
                  controls
                  loop
                  className="max-h-[440px] w-auto rounded"
                />
              ) : activeMediaKind === "stage" ? (
                <div className="relative w-[270px] h-[480px] overflow-hidden rounded border border-white/15 bg-black">
                  <iframe
                    src={activeMediaUrl}
                    title="Palco Clonado"
                    className="w-[1080px] h-[1920px] origin-top-left border-0"
                    style={{ transform: "scale(0.25)" }}
                  />
                </div>
              ) : (
                <img
                  src={activeMediaUrl}
                  alt="Resultado Clonado"
                  className="max-h-[440px] object-contain rounded"
                />
              )}
            </div>
          )}

          {/* Miniaturas da Galeria */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5 max-h-72 overflow-y-auto pr-1">
            {galleryItems.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setActiveMediaUrl(item.url);
                  setActiveMediaKind(item.kind);
                }}
                className={`group flex flex-col justify-between rounded-lg border overflow-hidden text-left transition-all ${
                  activeMediaUrl === item.url
                    ? "border-primary ring-2 ring-primary/40 bg-primary/10"
                    : "border-line bg-void/50 hover:border-primary/40"
                }`}
              >
                {item.kind === "image" ? (
                  <img
                    src={item.url}
                    alt={item.label}
                    loading="lazy"
                    className="h-20 w-full object-cover"
                  />
                ) : (
                  <div className="h-20 w-full flex items-center justify-center bg-void/90">
                    <Icon
                      name={item.kind === "video" ? "play_circle" : "code_blocks"}
                      className="text-[28px] text-primary-bright"
                    />
                  </div>
                )}
                <div className="px-2 py-1.5 font-mono text-[10px] text-fg-secondary truncate w-full">
                  {item.label}
                </div>
              </button>
            ))}
          </div>

          {showBriefModal && (
            <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-lg border border-line bg-void/90 p-4 font-mono text-[11px] text-fg-secondary leading-relaxed">
              {insp?.briefMd || insp?.localVlmSpecMd || "Nenhuma especificação técnica carregada."}
            </pre>
          )}
        </Card>

        {/* 4. Histórico das Últimas Clonagens Feitas */}
        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-fg flex items-center gap-2">
              <Icon name="history" className="text-primary-bright text-[18px]" />
              Histórico de Clonagens Recentes
            </h3>
            <span className="font-mono text-[11px] text-muted">
              {(data?.jobs?.length ?? 0) + (data?.savedClones?.length ?? 0)} registros
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(data?.jobs ?? []).map((j) => (
              <div
                key={j.id}
                className="rounded-lg border border-line bg-void/40 p-3 space-y-1.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono font-bold text-fg truncate">
                    {j.result?.cloneName ?? `Clone #${j.id.slice(-5)}`}
                  </span>
                  <Badge
                    tone={
                      j.status === "DONE"
                        ? "success"
                        : j.status === "FAILED"
                          ? "warning"
                          : "cyan"
                    }
                  >
                    {j.status === "DONE" ? "Concluído" : `${j.progress}%`}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted line-clamp-2">
                  {j.message ?? "Clonado com Sharingan"}
                </p>
                <div className="text-[10px] font-mono text-fg-secondary">
                  {new Date(j.createdAt).toLocaleString("pt-BR")}
                </div>
              </div>
            ))}

            {(data?.savedClones ?? []).map((c, i) => (
              <div
                key={i}
                className="rounded-lg border border-line bg-void/40 p-3 space-y-1.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono font-bold text-fg truncate">{c.cloneName}</span>
                  <Badge tone="success">{c.effectiveEngine}</Badge>
                </div>
                <p className="text-[11px] text-muted line-clamp-2">{c.userTopic}</p>
                <div className="text-[10px] font-mono text-fg-secondary">
                  {new Date(c.createdAt).toLocaleString("pt-BR")}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </main>
    </>
  );
}
