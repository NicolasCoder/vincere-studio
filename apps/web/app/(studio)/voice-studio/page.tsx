"use client";

import { useCallback, useEffect, useState } from "react";
import { Topbar } from "@/components/Topbar";
import { PageHeader } from "@/components/PageHeader";
import { Badge, Card, Icon, cn } from "@vincere-studio/ui";
import { IDIOMAS, idiomaPorId } from "@/lib/idiomas";

// Central de Vozes (Duas Vias): Executa geração de voz, análise/preparação para clonagem e
// transcrição Whisper diretamente no Computador do usuário (GPU Local RTX 3060: RVC V2 rmvpe +
// F5-TTS + Faster-Whisper CUDA float16), com fallback opcional para a VPS.

interface Voz {
  id: string;
  name: string;
  ref_text: string;
  language: string;
  kind: string;
  rvcModel?: string;
  acoustics?: {
    duration_s?: number;
    sampleRate?: number;
    snrDb?: number;
    voicedPct?: number;
    medianF0Hz?: number;
    voiceType?: string;
    qualityVerdict?: string;
  };
  full_audio_url: string | null;
}

interface VozEdge {
  id: string;
  label: string;
  description: string;
}

interface Tarefa {
  id: string;
  status: "fila" | "gerando" | "pronto" | "erro";
  criadoEm: string;
  atualizadoEm: string;
  textoOriginal: string;
  trechos: number;
  feitos: number;
  vozId: string;
  qualidade: string;
  motor?: "PC_GPU" | "VPS_CPU";
  arquivo?: string;
  legendas?: { words: string; srt: string };
  duracaoS?: number;
  erro?: string;
}

interface PcGpuInfo {
  gpu: {
    available: boolean;
    name: string;
    vramTotalMb: number;
    vramFreeMb: number;
    utilizationPct: number;
  };
  engines: {
    rvcV2Gpu: boolean;
    f5TtsGpu: boolean;
    fasterWhisperGpu: boolean;
    crisperWhisperGpu: boolean;
  };
  rvcModelsCount: number;
  localVoicesCount: number;
}

type Aba = "narrar" | "rascunho" | "clonar" | "transcrever";
const TEXTO_KEY = "vincere.voz.texto";
const VOZ_PADRAO = "local_vinicius_v1";

const QUALIDADES = [
  { id: "rascunho", label: "Rascunho", dica: "Rápido, para testar ritmo" },
  { id: "equilibrado", label: "Equilibrado", dica: "Bom para a maioria" },
  { id: "final", label: "Final", dica: "Máxima qualidade RVC rmvpe + Whisper GPU" },
] as const;

function paraBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

async function post(body: Record<string, unknown>) {
  const r = await fetch("/api/voicestudio", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json().catch(() => ({ ok: false, error: `Erro ${r.status}` }));
}

function estimativa(texto: string, qualidade: string, engine: "PC_GPU" | "VPS_CPU") {
  const palavras = texto.split(/\s+/).filter(Boolean).length;
  const segAudio = palavras / 2.5;
  if (engine === "PC_GPU") {
    const segProc = Math.max(4, Math.round(segAudio * (qualidade === "final" ? 0.65 : 0.35)));
    return { segAudio: Math.round(segAudio), labelTempo: `~${segProc}s na GPU do PC (RTX 3060)` };
  }
  const fator = qualidade === "rascunho" ? 22 : qualidade === "final" ? 80 : 40;
  return {
    segAudio: Math.round(segAudio),
    labelTempo: `~${Math.max(1, Math.round((segAudio * fator) / 60))} min na CPU da VPS`,
  };
}

export default function VoiceStudioPage() {
  const [aba, setAba] = useState<Aba>("narrar");
  const [vozes, setVozes] = useState<Voz[]>([]);
  const [vozesEdge, setVozesEdge] = useState<VozEdge[]>([]);
  const [online, setOnline] = useState<boolean | null>(null);
  const [pcGpuOnline, setPcGpuOnline] = useState(false);
  const [pcGpu, setPcGpu] = useState<PcGpuInfo | null>(null);
  const [engine, setEngine] = useState<"PC_GPU" | "VPS_CPU">("PC_GPU");
  const [erroConexao, setErroConexao] = useState<string | null>(null);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const [texto, setTexto] = useState("");
  const [textoFalado, setTextoFalado] = useState("");
  const [vozId, setVozId] = useState(VOZ_PADRAO);
  const [qualidade, setQualidade] = useState<(typeof QUALIDADES)[number]["id"]>("equilibrado");
  const [velocidade, setVelocidade] = useState(1);
  const [pitch, setPitch] = useState(0);
  const [estilo, setEstilo] = useState("");

  const [idiomaId, setIdiomaId] = useState("pt-BR");
  const idioma = idiomaPorId(idiomaId);
  const [vozEdge, setVozEdge] = useState("pt-BR-AntonioNeural");
  useEffect(() => {
    setVozEdge(idiomaPorId(idiomaId).vozesEdge[0].id);
  }, [idiomaId]);
  const [rascunhoUrl, setRascunhoUrl] = useState<string | null>(null);

  const [nomeClone, setNomeClone] = useState("");
  const [arquivoClone, setArquivoClone] = useState<File | null>(null);
  const [urlClone, setUrlClone] = useState<string | null>(null);
  const [duracaoClone, setDuracaoClone] = useState<number | null>(null);
  const [textoRef, setTextoRef] = useState("");
  const [cloneAcoustics, setCloneAcoustics] = useState<Record<string, unknown> | null>(null);

  const [arquivoTrans, setArquivoTrans] = useState<File | null>(null);
  const [whisperModelSize, setWhisperModelSize] = useState<"base" | "medium" | "large-v3">("base");
  const [transcricao, setTranscricao] = useState("");
  const [transMeta, setTransMeta] = useState<{ device?: string; gpuName?: string; elapsed_s?: number; wordsCount?: number } | null>(null);

  const carregar = useCallback(async () => {
    const r = await fetch("/api/voicestudio", { cache: "no-store" })
      .then((x) => x.json())
      .catch(() => null);
    if (r?.ok) {
      const lista = (r.voices ?? []) as Voz[];
      setVozes(lista);
      if (lista.length > 0 && !lista.some((v) => v.id === vozId)) {
        setVozId(lista[0]!.id);
      }
      setVozesEdge(r.edgeVoices ?? []);
      setOnline(true);
      setPcGpuOnline(Boolean(r.pcGpuOnline));
      setPcGpu(r.pcGpu ?? null);
      setErroConexao(null);
    } else {
      setOnline(false);
      setErroConexao(r?.error ?? "Sem resposta do motor de vozes");
    }
  }, [vozId]);

  const carregarTarefas = useCallback(async () => {
    const r = await fetch("/api/voicestudio?action=tarefas", { cache: "no-store" })
      .then((x) => x.json())
      .catch(() => null);
    if (r?.ok) setTarefas(r.tarefas);
  }, []);

  useEffect(() => {
    carregar();
    carregarTarefas();
    try {
      const t = localStorage.getItem(TEXTO_KEY);
      if (t) {
        setTexto(t);
        localStorage.removeItem(TEXTO_KEY);
      }
      const lingua = localStorage.getItem("vincere.voz.idioma");
      if (lingua) {
        setIdiomaId(lingua);
        localStorage.removeItem("vincere.voz.idioma");
      }
    } catch {}
  }, [carregar, carregarTarefas]);

  const ativas = tarefas.some((t) => t.status === "fila" || t.status === "gerando");
  useEffect(() => {
    if (!ativas) return;
    const id = setInterval(carregarTarefas, 2500);
    return () => clearInterval(id);
  }, [ativas, carregarTarefas]);

  useEffect(() => {
    if (!texto.trim()) {
      setTextoFalado("");
      return;
    }
    const id = setTimeout(async () => {
      const r = await post({ action: "preparar", texto, idioma: idioma.codigo });
      if (r.ok) setTextoFalado(r.textoFalado);
    }, 500);
    return () => clearTimeout(id);
  }, [texto, idioma.codigo]);

  useEffect(
    () => () => {
      if (urlClone) URL.revokeObjectURL(urlClone);
    },
    [urlClone],
  );

  const gerar = async () => {
    setOcupado(true);
    setMsg(null);
    const r = await post({
      action: "gerar",
      texto,
      vozId,
      qualidade,
      velocidade,
      pitch,
      engine,
      idioma: idioma.codigo,
      ...(estilo ? { estilo } : {}),
    });
    setOcupado(false);
    if (!r.ok) return setMsg({ tipo: "erro", texto: r.error });
    setMsg({
      tipo: "ok",
      texto:
        engine === "PC_GPU"
          ? "Narração iniciada na GPU do seu Computador (RTX 3060 + RVC V2 + Faster-Whisper)!"
          : "Narração na fila da VPS.",
    });
    carregarTarefas();
  };

  const rascunho = async () => {
    setOcupado(true);
    setMsg(null);
    setRascunhoUrl(null);
    const r = await post({ action: "rascunho", texto, vozEdge });
    if (!r.ok) {
      setOcupado(false);
      return setMsg({ tipo: "erro", texto: r.error });
    }
    for (let i = 0; i < 60; i++) {
      await new Promise((res) => setTimeout(res, 1500));
      const j = await fetch(`/api/jobs/${r.jobId}`, { cache: "no-store" })
        .then((x) => x.json())
        .catch(() => null);
      if (j?.status === "DONE") {
        const file = JSON.parse(j.result ?? "{}").file;
        if (file) setRascunhoUrl(`/api/media/${file}?t=${Date.now()}`);
        break;
      }
      if (j?.status === "FAILED") {
        setMsg({ tipo: "erro", texto: j.error?.split("\n")[0] ?? "Falha no rascunho" });
        break;
      }
    }
    setOcupado(false);
  };

  const escolherClone = (f: File | null) => {
    setArquivoClone(f);
    setDuracaoClone(null);
    setCloneAcoustics(null);
    const url = f ? URL.createObjectURL(f) : null;
    setUrlClone(url);
    if (!url) return;
    const a = new Audio(url);
    a.onloadedmetadata = () => setDuracaoClone(a.duration);
  };

  const clonar = async () => {
    if (!arquivoClone) return;
    setOcupado(true);
    setMsg(null);
    const r = await post({
      action: "clonar",
      nome: nomeClone,
      audioBase64: await paraBase64(arquivoClone),
      textoReferencia: textoRef,
      engine,
    });
    setOcupado(false);
    if (!r.ok) return setMsg({ tipo: "erro", texto: r.error });
    if (r.acoustics) setCloneAcoustics(r.acoustics);
    if (r.transcription?.text && !textoRef) setTextoRef(r.transcription.text);
    setMsg({
      tipo: "ok",
      texto: `Voz "${nomeClone}" analisada, limpa (44.1kHz) e clonada no ${r.motor === "PC_GPU" ? "Computador (GPU RTX 3060)" : "Servidor"}! Já disponível na aba Narrar.`,
    });
    setNomeClone("");
    carregar();
  };

  const transcrever = async (destino: "transcrever" | "clonar") => {
    const f = destino === "clonar" ? arquivoClone : arquivoTrans;
    if (!f) return;
    setOcupado(true);
    setMsg(null);
    const r = await post({
      action: "transcrever",
      audioBase64: await paraBase64(f),
      idioma: "pt",
      modelSize: whisperModelSize,
      engine,
    });
    setOcupado(false);
    if (!r.ok) return setMsg({ tipo: "erro", texto: r.error });
    const t = String(r.resultado?.text ?? "").trim();
    if (destino === "clonar") {
      setTextoRef(t);
      setMsg({
        tipo: "ok",
        texto: `Transcrição automática concluída na GPU (${r.resultado?.gpuName ?? "Faster-Whisper CUDA"}) em ${r.resultado?.elapsed_s ?? 1}s!`,
      });
    } else {
      setTranscricao(t);
      setTransMeta({
        device: r.resultado?.device,
        gpuName: r.resultado?.gpuName,
        elapsed_s: r.resultado?.elapsed_s,
        wordsCount: Array.isArray(r.resultado?.words) ? r.resultado.words.length : undefined,
      });
    }
  };

  const est = estimativa(texto, qualidade, engine);
  const cloneOk = duracaoClone !== null && duracaoClone >= 3 && duracaoClone <= 120;
  const vozSel = vozes.find((v) => v.id === vozId);

  return (
    <>
      <Topbar crumbs={["Gerar com IA", "Central de Vozes (GPU do Computador)"]} />
      <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
        <PageHeader
          icon="record_voice_over"
          title={
            <span className="flex items-center gap-3">
              Central de Vozes <Badge tone="cyan">Processamento no Computador (GPU Local)</Badge>
            </span>
          }
          subtitle="As tarefas pesadas (geração de voz com RVC V2 rmvpe / F5-TTS, análise acústica para clonagem e transcrição Faster-Whisper word-level) agora rodam direto na placa de vídeo do seu computador (RTX 3060 12GB) em segundos."
          right={
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs",
                online
                  ? "border-success/40 bg-success/10 text-success"
                  : online === false
                    ? "border-warning/40 bg-warning/10 text-warning"
                    : "border-line text-muted",
              )}
            >
              <span className={cn("size-2 rounded-full", online ? "bg-success" : online === false ? "bg-warning" : "bg-muted")} />
              {online
                ? `${pcGpuOnline ? pcGpu?.gpu.name || "GPU Local" : "Online"} · ${vozes.length} vozes`
                : online === false
                  ? "Motor offline"
                  : "Conectando…"}
            </span>
          }
        />

        {/* Seletor de Hardware: Computador Local (GPU RTX 3060) vs Servidor VPS */}
        <Card className="p-4 space-y-3" accent="dual">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-lg bg-primary/15 text-primary-bright">
                <Icon name="memory" className="text-[20px]" />
              </span>
              <div>
                <div className="font-display text-sm font-bold text-fg flex items-center gap-2">
                  Motor de Execução de Voz & Análise de Clonagem
                  {pcGpuOnline && (
                    <Badge tone="success" pill>
                      {pcGpu?.gpu.name} · {Math.round((pcGpu?.gpu.vramFreeMb ?? 8100) / 1024)}GB VRAM Livre
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted">
                  O computador executa RVC V2 (`rmvpe`), F5-TTS, normalização 44.1kHz, cálculo de F0/SNR e Faster-Whisper (`float16` CUDA) sem sobrecarregar a VPS.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 rounded-lg border border-line bg-void/70 p-1 self-start">
              <button
                type="button"
                onClick={() => setEngine("PC_GPU")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-mono transition-all",
                  engine === "PC_GPU" ? "bg-primary text-void font-bold" : "text-fg-secondary hover:text-fg",
                )}
              >
                <Icon name="developer_board" className="text-[14px]" />
                <span>Computador (GPU Local RTX 3060)</span>
              </button>
              <button
                type="button"
                onClick={() => setEngine("VPS_CPU")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-mono transition-all",
                  engine === "VPS_CPU" ? "bg-primary text-void font-bold" : "text-fg-secondary hover:text-fg",
                )}
              >
                <Icon name="cloud_queue" className="text-[14px]" />
                <span>VPS (CPU Fallback)</span>
              </button>
            </div>
          </div>

          {pcGpu && (
            <div className="flex flex-wrap gap-2 pt-1 text-[10px] font-mono text-fg-secondary">
              <span className="rounded border border-line bg-void/50 px-2 py-0.5">
                ✓ RVC V2 GPU (rmvpe): {pcGpu.rvcModelsCount} modelos (.pth)
              </span>
              <span className="rounded border border-line bg-void/50 px-2 py-0.5">
                ✓ Faster-Whisper CUDA (float16): {pcGpu.engines.fasterWhisperGpu ? "Ativo" : "Standby"}
              </span>
              <span className="rounded border border-line bg-void/50 px-2 py-0.5">
                ✓ CrisperWhisper Word-Level: {pcGpu.engines.crisperWhisperGpu ? "Ativo" : "Standby"}
              </span>
              <span className="rounded border border-line bg-void/50 px-2 py-0.5">
                ✓ F5-TTS Zero-Shot: {pcGpu.engines.f5TtsGpu ? "Instalado no PC" : "Standby"}
              </span>
            </div>
          )}
        </Card>

        {erroConexao && <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning">{erroConexao}</p>}

        <nav className="flex gap-1 overflow-x-auto border-b border-line">
          {(
            [
              ["narrar", "graphic_eq", "Narrar (GPU do PC)"],
              ["rascunho", "bolt", "Rascunho rápido"],
              ["clonar", "content_copy", "Análise & Clonagem de Voz (PC)"],
              ["transcrever", "subtitles", "Transcrever (Whisper GPU)"],
            ] as const
          ).map(([id, icone, label]) => (
            <button
              key={id}
              onClick={() => {
                setAba(id);
                setMsg(null);
              }}
              className={cn(
                "flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm",
                aba === id ? "border-primary font-semibold text-fg" : "border-transparent text-muted hover:text-fg",
              )}
            >
              <Icon name={icone} className="text-[18px]" />
              {label}
            </button>
          ))}
        </nav>

        {msg && (
          <p
            className={cn(
              "rounded-lg border p-3 text-sm",
              msg.tipo === "ok" ? "border-success/40 bg-success/10 text-success" : "border-error/40 bg-error/10 text-error",
            )}
          >
            {msg.texto}
          </p>
        )}

        {(aba === "narrar" || aba === "rascunho") && (
          <section className="grid gap-4 lg:grid-cols-[1fr_340px]">
            <div className="space-y-3 rounded-lg border border-line bg-surface-low p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="label-mono block text-muted">Texto da narração</label>
                <select value={idiomaId} onChange={(e) => setIdiomaId(e.target.value)} className="field h-8 px-2 text-xs" title="Idioma do vídeo">
                  {IDIOMAS.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.bandeira} {i.nome}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={8}
                placeholder="Cole o roteiro. Números, anos, valores e % são escritos por extenso automaticamente."
                className="field w-full p-3 text-sm leading-relaxed"
              />
              {textoFalado && textoFalado !== texto.trim() && (
                <details className="rounded border border-line bg-void/40 p-3 text-xs">
                  <summary className="cursor-pointer text-muted">Como a voz vai ler (texto preparado)</summary>
                  <p className="mt-2 whitespace-pre-wrap text-fg-secondary">{textoFalado}</p>
                </details>
              )}
              <p className="text-[11px] text-muted">
                {texto.trim() ? `~${est.segAudio}s de áudio · ${est.labelTempo}` : "Dica: frases curtas e pontuação clara dão a melhor entonação."}
              </p>
            </div>

            {aba === "narrar" ? (
              <div className="space-y-4 rounded-lg border border-line bg-surface-low p-4">
                <div>
                  <label className="label-mono mb-1 block text-muted">Voz Clonada / Modelo RVC GPU</label>
                  <select value={vozId} onChange={(e) => setVozId(e.target.value)} className="field w-full px-3 py-2 text-xs">
                    {vozes.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                  {vozSel?.full_audio_url && <audio controls preload="none" src={vozSel.full_audio_url} className="mt-2 h-8 w-full" />}
                  {vozSel?.acoustics && (
                    <div className="mt-2 flex flex-wrap gap-1.5 font-mono text-[10px] text-primary-bright">
                      {vozSel.acoustics.medianF0Hz && <span>F0: {vozSel.acoustics.medianF0Hz}Hz</span>}
                      {vozSel.acoustics.snrDb && <span>· SNR: {vozSel.acoustics.snrDb}dB</span>}
                      {vozSel.acoustics.voiceType && <span>· {vozSel.acoustics.voiceType}</span>}
                    </div>
                  )}
                </div>
                <div>
                  <label className="label-mono mb-1 block text-muted">Qualidade</label>
                  <div className="grid grid-cols-3 gap-1">
                    {QUALIDADES.map((q) => (
                      <button
                        key={q.id}
                        onClick={() => setQualidade(q.id)}
                        title={q.dica}
                        className={cn(
                          "rounded border px-2 py-1.5 text-xs",
                          qualidade === q.id ? "border-primary bg-primary/15 text-fg" : "border-line text-muted",
                        )}
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1 text-[11px] text-muted">{QUALIDADES.find((q) => q.id === qualidade)?.dica}</p>
                </div>
                <div>
                  <label className="label-mono mb-1 flex justify-between text-muted">
                    Velocidade <span className="text-fg">{velocidade.toFixed(2)}×</span>
                  </label>
                  <input
                    type="range"
                    min={0.8}
                    max={1.25}
                    step={0.05}
                    value={velocidade}
                    onChange={(e) => setVelocidade(Number(e.target.value))}
                    className="w-full accent-[var(--color-primary)]"
                  />
                </div>
                {engine === "PC_GPU" && (
                  <div>
                    <label className="label-mono mb-1 flex justify-between text-muted">
                      Tom / Pitch RVC V2 (`rmvpe`) <span className="text-fg">{pitch > 0 ? `+${pitch}` : pitch} semitons</span>
                    </label>
                    <input
                      type="range"
                      min={-12}
                      max={12}
                      step={1}
                      value={pitch}
                      onChange={(e) => setPitch(Number(e.target.value))}
                      className="w-full accent-[var(--color-primary)]"
                    />
                  </div>
                )}
                <div>
                  <label className="label-mono mb-1 block text-muted">Estilo (opcional)</label>
                  <input
                    value={estilo}
                    onChange={(e) => setEstilo(e.target.value)}
                    placeholder="ex.: narrator, calm, excited"
                    className="field w-full px-3 py-2 text-sm"
                  />
                </div>
                <button
                  onClick={gerar}
                  disabled={ocupado || !online || texto.trim().length < 2}
                  className="gradient-cta flex h-11 w-full items-center justify-center gap-2 rounded font-display font-semibold text-fg disabled:opacity-40"
                >
                  <Icon name="graphic_eq" className="text-[18px]" />
                  {engine === "PC_GPU" ? "Gerar Narração no Computador (GPU)" : "Gerar Narração (VPS)"}
                </button>
                {texto.trim() && <p className="text-center text-[11px] text-muted">{est.labelTempo}</p>}
              </div>
            ) : (
              <div className="space-y-4 rounded-lg border border-line bg-surface-low p-4">
                <p className="text-xs text-muted">
                  Voz neural da Microsoft (Edge TTS), grátis e em segundos. Use para testar ritmo e texto; a versão final fica com a sua voz clonada na GPU.
                </p>
                <div>
                  <label className="label-mono mb-1 block text-muted">Voz do rascunho</label>
                  <select value={vozEdge} onChange={(e) => setVozEdge(e.target.value)} className="field w-full px-3 py-2 text-sm">
                    {idioma.vozesEdge.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={rascunho}
                  disabled={ocupado || texto.trim().length < 2}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded bg-primary font-semibold text-void disabled:opacity-40"
                >
                  <Icon name="bolt" className="text-[18px]" />
                  {ocupado ? "Gerando…" : "Ouvir rascunho"}
                </button>
                {rascunhoUrl && <audio controls autoPlay src={rascunhoUrl} className="h-9 w-full" />}
              </div>
            )}
          </section>
        )}

        {aba === "clonar" && (
          <section className="grid gap-4 lg:grid-cols-[1fr_340px]">
            <div className="space-y-3 rounded-lg border border-line bg-surface-low p-4">
              <div className="flex items-center justify-between">
                <label className="label-mono block text-muted">Áudio de referência p/ Análise & Clonagem no PC</label>
                <Badge tone="success">Normalização 44.1kHz + F0/SNR + Whisper GPU</Badge>
              </div>
              <input
                type="file"
                accept="audio/*,video/*"
                onChange={(e) => escolherClone(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-fg-secondary file:mr-3 file:rounded file:border-0 file:bg-primary/15 file:px-3 file:py-2 file:text-primary-bright"
              />
              {urlClone && (
                <>
                  <audio controls src={urlClone} className="h-9 w-full" />
                  <p className={cn("text-xs", cloneOk ? "text-success" : "text-warning")}>
                    {duracaoClone === null
                      ? "Lendo duração…"
                      : `${duracaoClone.toFixed(1)}s — ${cloneOk ? "duração pronta para análise e clonagem no PC" : "recomendado entre 5 e 60 segundos"}`}
                  </p>
                </>
              )}
              <label className="label-mono block text-muted">O que é falado no áudio (transcrição de referência)</label>
              <textarea
                value={textoRef}
                onChange={(e) => setTextoRef(e.target.value)}
                rows={4}
                placeholder="Deixe em branco para o Faster-Whisper (GPU RTX 3060) transcrever sozinho durante a clonagem, ou clique no botão abaixo."
                className="field w-full p-3 text-sm"
              />
              <button
                onClick={() => transcrever("clonar")}
                disabled={ocupado || !arquivoClone}
                className="inline-flex items-center gap-1.5 rounded border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-primary-bright hover:bg-primary/20 disabled:opacity-40"
              >
                <Icon name="memory" className="text-[15px]" />
                <span>Transcrever Referência na GPU do PC (Faster-Whisper CUDA)</span>
              </button>

              {cloneAcoustics && (
                <div className="rounded-lg border border-primary/30 bg-void/60 p-3 space-y-2">
                  <div className="font-mono text-xs font-bold text-primary-bright">
                    Relatório de Análise Acústica p/ Clonagem (Executado pelo PC)
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
                    <div className="rounded border border-line bg-surface-low p-2">
                      <div className="text-[10px] text-muted">Frequência F0</div>
                      <div className="font-bold text-fg">{String(cloneAcoustics.medianF0Hz ?? "—")} Hz</div>
                    </div>
                    <div className="rounded border border-line bg-surface-low p-2">
                      <div className="text-[10px] text-muted">Relação Sinal/Ruído</div>
                      <div className="font-bold text-success">{String(cloneAcoustics.snrDb ?? "—")} dB</div>
                    </div>
                    <div className="rounded border border-line bg-surface-low p-2">
                      <div className="text-[10px] text-muted">Fala Ativa</div>
                      <div className="font-bold text-fg">{String(cloneAcoustics.voicedPct ?? "—")}%</div>
                    </div>
                    <div className="rounded border border-line bg-surface-low p-2">
                      <div className="text-[10px] text-muted">Perfil Vocal</div>
                      <div className="font-bold text-primary-bright">{String(cloneAcoustics.voiceType ?? "—")}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-4 rounded-lg border border-line bg-surface-low p-4">
              <div>
                <label className="label-mono mb-1 block text-muted">Nome da voz clonada</label>
                <input
                  value={nomeClone}
                  onChange={(e) => setNomeClone(e.target.value)}
                  placeholder="ex.: Vinicius Estúdio GPU"
                  className="field w-full px-3 py-2 text-sm"
                />
              </div>
              <ul className="space-y-1.5 text-[11px] text-muted">
                <li>• O PC aplica filtro high-pass (75Hz), remoção de silêncio e normalização LUFS (-16dB, 44.1kHz mono).</li>
                <li>• Mede automaticamente F0 (Hz), SNR (dB) e transcreve na GPU RTX 3060 se o texto estiver vazio.</li>
                <li>• Vincula automaticamente ao motor RVC V2 / F5-TTS local.</li>
              </ul>
              <button
                onClick={clonar}
                disabled={ocupado || !arquivoClone || nomeClone.trim().length < 2}
                className="gradient-cta flex h-11 w-full items-center justify-center gap-2 rounded font-display font-semibold text-fg disabled:opacity-40"
              >
                <Icon name="content_copy" className="text-[18px]" />
                {ocupado ? "Analisando & Clonando na GPU…" : "Analisar & Clonar Voz no PC"}
              </button>
            </div>
          </section>
        )}

        {aba === "transcrever" && (
          <section className="space-y-3 rounded-lg border border-line bg-surface-low p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted">
                Envie um áudio ou vídeo e transcreva palavra por palavra na GPU do seu PC (`Faster-Whisper CUDA float16`).
              </p>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-muted">Modelo GPU:</span>
                {(["base", "medium", "large-v3"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setWhisperModelSize(m)}
                    className={cn(
                      "rounded border px-2.5 py-1 text-[11px]",
                      whisperModelSize === m ? "border-primary bg-primary/15 text-primary-bright font-bold" : "border-line text-muted",
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <input
              type="file"
              accept="audio/*,video/*"
              onChange={(e) => setArquivoTrans(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-fg-secondary file:mr-3 file:rounded file:border-0 file:bg-primary/15 file:px-3 file:py-2 file:text-primary-bright"
            />
            <button
              onClick={() => transcrever("transcrever")}
              disabled={ocupado || !arquivoTrans}
              className="flex h-10 items-center gap-2 rounded bg-primary px-5 text-sm font-semibold text-void disabled:opacity-40"
            >
              <Icon name="subtitles" className="text-[18px]" />
              {ocupado ? "Transcrevendo na GPU do PC…" : `Transcrever no Computador (${whisperModelSize})`}
            </button>
            {transMeta && (
              <div className="flex flex-wrap gap-3 font-mono text-[11px] text-primary-bright">
                <span>Dispositivo: {transMeta.gpuName ?? transMeta.device}</span>
                {transMeta.elapsed_s !== undefined && <span>· Tempo: {transMeta.elapsed_s}s</span>}
                {transMeta.wordsCount !== undefined && <span>· Palavras alinhadas: {transMeta.wordsCount}</span>}
              </div>
            )}
            {transcricao && (
              <div className="space-y-2">
                <textarea readOnly value={transcricao} rows={6} className="field w-full p-3 text-sm" />
                <button
                  onClick={() => navigator.clipboard?.writeText(transcricao)}
                  className="rounded border border-line px-3 py-1.5 text-xs text-fg-secondary hover:text-fg"
                >
                  Copiar texto
                </button>
              </div>
            )}
          </section>
        )}

        <section className="space-y-3">
          <h2 className="font-display text-base font-bold text-fg">Narrações recentes</h2>
          {tarefas.length === 0 ? (
            <p className="rounded-lg border border-line bg-surface-low p-6 text-center text-xs text-muted">Nenhuma narração ainda.</p>
          ) : (
            <div className="space-y-2">
              {tarefas.map((t) => {
                const parada = t.status === "gerando" && Date.now() - Date.parse(t.atualizadoEm) > 20 * 60_000;
                return (
                  <div key={t.id} className="space-y-2 rounded-lg border border-line bg-surface-low p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-mono text-muted">
                        {new Date(t.criadoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} ·{" "}
                        {vozes.find((v) => v.id === t.vozId)?.name ?? t.vozId} · {t.qualidade} ·{" "}
                        <span className="text-primary-bright">{t.motor === "VPS_CPU" ? "VPS CPU" : "PC GPU (RTX 3060)"}</span>
                      </span>
                      <span
                        className={cn(
                          "rounded border px-1.5 py-0.5 font-mono text-[10px]",
                          t.status === "pronto"
                            ? "border-success/40 text-success"
                            : t.status === "erro" || parada
                              ? "border-error/40 text-error"
                              : "border-primary/40 text-primary-bright",
                        )}
                      >
                        {parada
                          ? "interrompida"
                          : t.status === "pronto"
                            ? `pronta · ${t.duracaoS}s`
                            : t.status === "erro"
                              ? "erro"
                              : `${t.feitos}/${t.trechos} trechos`}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-xs text-fg-secondary">{t.textoOriginal}</p>
                    {(t.status === "gerando" || t.status === "fila") && !parada && (
                      <div className="h-1 overflow-hidden rounded-full bg-line">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${Math.max(4, (t.feitos / Math.max(1, t.trechos)) * 100)}%` }}
                        />
                      </div>
                    )}
                    {t.erro && <p className="text-[11px] text-error">{t.erro}</p>}
                    {t.arquivo && (
                      <div className="flex flex-wrap items-center gap-2">
                        <audio controls preload="none" src={`/api/media/${t.arquivo}`} className="h-8 min-w-0 flex-1" />
                        <a
                          href={`/api/media/${t.arquivo}?download=1`}
                          className="rounded border border-line px-2.5 py-1 text-[11px] text-fg-secondary hover:text-fg"
                        >
                          Baixar WAV
                        </a>
                        {t.legendas && (
                          <>
                            <a
                              href={`/api/media/${t.legendas.words}?download=1`}
                              title="Palavras com tempo: entrada do subtitles-studio e das legendas do HyperFrames"
                              className="rounded border border-primary/40 px-2.5 py-1 text-[11px] text-primary-bright hover:bg-primary/10"
                            >
                              Legenda (words.json)
                            </a>
                            <a
                              href={`/api/media/${t.legendas.srt}?download=1`}
                              className="rounded border border-line px-2.5 py-1 text-[11px] text-fg-secondary hover:text-fg"
                            >
                              SRT
                            </a>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
