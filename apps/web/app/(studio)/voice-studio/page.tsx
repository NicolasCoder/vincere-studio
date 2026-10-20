"use client";

import { useCallback, useEffect, useState } from "react";
import { Topbar } from "@/components/Topbar";
import { PageHeader } from "@/components/PageHeader";
import { Icon, cn } from "@vincere-studio/ui";

// Central de Vozes: tudo do VoiceStudio (VPS) sem abrir a porta 3900. O servidor do Vincere fala
// com o VoiceStudio; aqui só há formulários, prévias e acompanhamento.

interface Voz {
  id: string;
  name: string;
  ref_text: string;
  language: string;
  kind: string;
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
  arquivo?: string;
  duracaoS?: number;
  erro?: string;
}

type Aba = "narrar" | "rascunho" | "clonar" | "transcrever";
const TEXTO_KEY = "vincere.voz.texto";
const VOZ_PADRAO = "352e875e";

const QUALIDADES = [
  { id: "rascunho", label: "Rascunho", dica: "Rápido, para testar ritmo" },
  { id: "equilibrado", label: "Equilibrado", dica: "Bom para a maioria" },
  { id: "final", label: "Final", dica: "Máxima qualidade, ~2× mais lento" },
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
  const r = await fetch("/api/voicestudio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.json().catch(() => ({ ok: false, error: `Erro ${r.status}` }));
}

/** Estimativa em CPU: ~40× o tempo do áudio no modo equilibrado (medido na VPS). */
function estimativa(texto: string, qualidade: string) {
  const palavras = texto.split(/\s+/).filter(Boolean).length;
  const segAudio = palavras / 2.5;
  const fator = qualidade === "rascunho" ? 22 : qualidade === "final" ? 80 : 40;
  return { segAudio: Math.round(segAudio), min: Math.max(1, Math.round((segAudio * fator) / 60)) };
}

export default function VoiceStudioPage() {
  const [aba, setAba] = useState<Aba>("narrar");
  const [vozes, setVozes] = useState<Voz[]>([]);
  const [vozesEdge, setVozesEdge] = useState<VozEdge[]>([]);
  const [online, setOnline] = useState<boolean | null>(null);
  const [erroConexao, setErroConexao] = useState<string | null>(null);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const [texto, setTexto] = useState("");
  const [textoFalado, setTextoFalado] = useState("");
  const [vozId, setVozId] = useState(VOZ_PADRAO);
  const [qualidade, setQualidade] = useState<(typeof QUALIDADES)[number]["id"]>("equilibrado");
  const [velocidade, setVelocidade] = useState(1);
  const [estilo, setEstilo] = useState("");

  const [vozEdge, setVozEdge] = useState("pt-BR-AntonioNeural");
  const [rascunhoUrl, setRascunhoUrl] = useState<string | null>(null);

  const [nomeClone, setNomeClone] = useState("");
  const [arquivoClone, setArquivoClone] = useState<File | null>(null);
  const [urlClone, setUrlClone] = useState<string | null>(null);
  const [duracaoClone, setDuracaoClone] = useState<number | null>(null);
  const [textoRef, setTextoRef] = useState("");

  const [arquivoTrans, setArquivoTrans] = useState<File | null>(null);
  const [transcricao, setTranscricao] = useState("");

  const carregar = useCallback(async () => {
    const r = await fetch("/api/voicestudio", { cache: "no-store" }).then((x) => x.json()).catch(() => null);
    if (r?.ok) {
      setVozes(r.voices ?? []);
      setVozesEdge(r.edgeVoices ?? []);
      setOnline(true);
      setErroConexao(null);
    } else {
      setOnline(false);
      setErroConexao(r?.error ?? "Sem resposta do VoiceStudio");
    }
  }, []);

  const carregarTarefas = useCallback(async () => {
    const r = await fetch("/api/voicestudio?action=tarefas", { cache: "no-store" }).then((x) => x.json()).catch(() => null);
    if (r?.ok) setTarefas(r.tarefas);
  }, []);

  useEffect(() => {
    carregar();
    carregarTarefas();
    // Texto enviado pelo Roteiro em beats ("Narrar no VoiceStudio").
    try {
      const t = localStorage.getItem(TEXTO_KEY);
      if (t) {
        setTexto(t);
        localStorage.removeItem(TEXTO_KEY);
      }
    } catch {}
  }, [carregar, carregarTarefas]);

  const ativas = tarefas.some((t) => t.status === "fila" || t.status === "gerando");
  useEffect(() => {
    if (!ativas) return;
    const id = setInterval(carregarTarefas, 5000);
    return () => clearInterval(id);
  }, [ativas, carregarTarefas]);

  // Prévia de "como a voz vai ler" (números por extenso etc.), com pequeno atraso.
  useEffect(() => {
    if (!texto.trim()) {
      setTextoFalado("");
      return;
    }
    const id = setTimeout(async () => {
      const r = await post({ action: "preparar", texto });
      if (r.ok) setTextoFalado(r.textoFalado);
    }, 500);
    return () => clearTimeout(id);
  }, [texto]);

  useEffect(() => () => {
    if (urlClone) URL.revokeObjectURL(urlClone);
  }, [urlClone]);

  const gerar = async () => {
    setOcupado(true);
    setMsg(null);
    const r = await post({ action: "gerar", texto, vozId, qualidade, velocidade, ...(estilo ? { estilo } : {}) });
    setOcupado(false);
    if (!r.ok) return setMsg({ tipo: "erro", texto: r.error });
    setMsg({ tipo: "ok", texto: "Narração na fila. Pode sair desta tela: ela continua sendo gerada no servidor." });
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
      const j = await fetch(`/api/jobs/${r.jobId}`, { cache: "no-store" }).then((x) => x.json()).catch(() => null);
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
    const r = await post({ action: "clonar", nome: nomeClone, audioBase64: await paraBase64(arquivoClone), textoReferencia: textoRef });
    setOcupado(false);
    if (!r.ok) return setMsg({ tipo: "erro", texto: r.error });
    setMsg({ tipo: "ok", texto: `Voz "${nomeClone}" criada. Ela já aparece na aba Narrar.` });
    setNomeClone("");
    escolherClone(null);
    setTextoRef("");
    carregar();
  };

  const transcrever = async (destino: "transcrever" | "clonar") => {
    const f = destino === "clonar" ? arquivoClone : arquivoTrans;
    if (!f) return;
    setOcupado(true);
    setMsg(null);
    const r = await post({ action: "transcrever", audioBase64: await paraBase64(f), idioma: "pt" });
    setOcupado(false);
    if (!r.ok) return setMsg({ tipo: "erro", texto: r.error });
    const t = String(r.resultado?.text ?? "").trim();
    if (destino === "clonar") setTextoRef(t);
    else setTranscricao(t);
  };

  const est = estimativa(texto, qualidade);
  const cloneOk = duracaoClone !== null && duracaoClone >= 5 && duracaoClone <= 30;
  const vozSel = vozes.find((v) => v.id === vozId);

  return (
    <>
      <Topbar crumbs={["Gerar com IA", "Vozes"]} />
      <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
        <PageHeader
          icon="record_voice_over"
          title="Central de Vozes"
          subtitle="Narração com sua voz clonada, rascunho rápido, clonagem e transcrição. Tudo roda no VoiceStudio da VPS; você não precisa abri-lo."
          right={
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs",
                online ? "border-success/40 bg-success/10 text-success" : online === false ? "border-warning/40 bg-warning/10 text-warning" : "border-line text-muted",
              )}
            >
              <span className={cn("size-2 rounded-full", online ? "bg-success" : online === false ? "bg-warning" : "bg-muted")} />
              {online ? `VoiceStudio online · ${vozes.length} vozes` : online === false ? "VoiceStudio offline" : "Conectando…"}
            </span>
          }
        />

        {erroConexao && <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning">{erroConexao}</p>}

        <nav className="flex gap-1 overflow-x-auto border-b border-line">
          {(
            [
              ["narrar", "graphic_eq", "Narrar"],
              ["rascunho", "bolt", "Rascunho rápido"],
              ["clonar", "content_copy", "Clonar voz"],
              ["transcrever", "subtitles", "Transcrever"],
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
          <p className={cn("rounded-lg border p-3 text-sm", msg.tipo === "ok" ? "border-success/40 bg-success/10 text-success" : "border-error/40 bg-error/10 text-error")}>{msg.texto}</p>
        )}

        {(aba === "narrar" || aba === "rascunho") && (
          <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <div className="space-y-3 rounded-lg border border-line bg-surface-low p-4">
              <label className="label-mono block text-muted">Texto da narração</label>
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
              <p className="text-[11px] text-muted">{texto.trim() ? `~${est.segAudio}s de áudio` : "Dica: frases curtas e pontuação clara dão a melhor entonação."}</p>
            </div>

            {aba === "narrar" ? (
              <div className="space-y-4 rounded-lg border border-line bg-surface-low p-4">
                <div>
                  <label className="label-mono mb-1 block text-muted">Voz</label>
                  <select value={vozId} onChange={(e) => setVozId(e.target.value)} className="field w-full px-3 py-2 text-sm">
                    {vozes.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} · {v.id}
                      </option>
                    ))}
                  </select>
                  {vozSel?.full_audio_url && <audio controls preload="none" src={vozSel.full_audio_url} className="mt-2 h-8 w-full" />}
                </div>
                <div>
                  <label className="label-mono mb-1 block text-muted">Qualidade</label>
                  <div className="grid grid-cols-3 gap-1">
                    {QUALIDADES.map((q) => (
                      <button
                        key={q.id}
                        onClick={() => setQualidade(q.id)}
                        title={q.dica}
                        className={cn("rounded border px-2 py-1.5 text-xs", qualidade === q.id ? "border-primary bg-primary/15 text-fg" : "border-line text-muted")}
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
                  <input type="range" min={0.8} max={1.25} step={0.05} value={velocidade} onChange={(e) => setVelocidade(Number(e.target.value))} className="w-full accent-[var(--color-primary)]" />
                </div>
                <div>
                  <label className="label-mono mb-1 block text-muted">Estilo (opcional)</label>
                  <input value={estilo} onChange={(e) => setEstilo(e.target.value)} placeholder="ex.: narrator, calm, excited" className="field w-full px-3 py-2 text-sm" />
                </div>
                <button
                  onClick={gerar}
                  disabled={ocupado || !online || texto.trim().length < 2}
                  className="gradient-cta flex h-11 w-full items-center justify-center gap-2 rounded font-display font-semibold text-fg disabled:opacity-40"
                >
                  <Icon name="graphic_eq" className="text-[18px]" />
                  Gerar narração
                </button>
                {texto.trim() && <p className="text-center text-[11px] text-muted">Leva cerca de {est.min} min (o VoiceStudio roda em CPU). Roda no servidor.</p>}
              </div>
            ) : (
              <div className="space-y-4 rounded-lg border border-line bg-surface-low p-4">
                <p className="text-xs text-muted">Voz neural da Microsoft (Edge TTS), grátis e em segundos. Use para testar ritmo e texto; a versão final fica com a sua voz clonada.</p>
                <div>
                  <label className="label-mono mb-1 block text-muted">Voz do rascunho</label>
                  <select value={vozEdge} onChange={(e) => setVozEdge(e.target.value)} className="field w-full px-3 py-2 text-sm">
                    {vozesEdge.map((v) => (
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
          <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <div className="space-y-3 rounded-lg border border-line bg-surface-low p-4">
              <label className="label-mono block text-muted">Áudio de referência</label>
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => escolherClone(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-fg-secondary file:mr-3 file:rounded file:border-0 file:bg-primary/15 file:px-3 file:py-2 file:text-primary-bright"
              />
              {urlClone && (
                <>
                  <audio controls src={urlClone} className="h-9 w-full" />
                  <p className={cn("text-xs", cloneOk ? "text-success" : "text-warning")}>
                    {duracaoClone === null ? "Lendo duração…" : `${duracaoClone.toFixed(1)}s — ${cloneOk ? "duração ideal" : "use entre 5 e 30 segundos"}`}
                  </p>
                </>
              )}
              <label className="label-mono block text-muted">O que é falado no áudio (melhora a qualidade)</label>
              <textarea value={textoRef} onChange={(e) => setTextoRef(e.target.value)} rows={4} placeholder="Transcrição exata do áudio" className="field w-full p-3 text-sm" />
              <button onClick={() => transcrever("clonar")} disabled={ocupado || !arquivoClone} className="rounded border border-line px-3 py-1.5 text-xs text-fg-secondary hover:text-fg disabled:opacity-40">
                Preencher automaticamente (Whisper)
              </button>
            </div>
            <div className="space-y-4 rounded-lg border border-line bg-surface-low p-4">
              <div>
                <label className="label-mono mb-1 block text-muted">Nome da voz</label>
                <input value={nomeClone} onChange={(e) => setNomeClone(e.target.value)} placeholder="ex.: Igor calmo" className="field w-full px-3 py-2 text-sm" />
              </div>
              <ul className="space-y-1.5 text-[11px] text-muted">
                <li>• 5 a 30 s, uma pessoa só falando.</li>
                <li>• Sem música, eco ou ruído de fundo.</li>
                <li>• Fale no tom que quer nas narrações.</li>
                <li>• Clone só a sua voz ou de quem autorizou.</li>
              </ul>
              <button
                onClick={clonar}
                disabled={ocupado || !arquivoClone || nomeClone.trim().length < 2 || !cloneOk}
                className="gradient-cta flex h-11 w-full items-center justify-center gap-2 rounded font-display font-semibold text-fg disabled:opacity-40"
              >
                <Icon name="content_copy" className="text-[18px]" />
                {ocupado ? "Clonando…" : "Clonar voz"}
              </button>
            </div>
          </section>
        )}

        {aba === "transcrever" && (
          <section className="space-y-3 rounded-lg border border-line bg-surface-low p-4">
            <p className="text-xs text-muted">Envie um áudio ou vídeo curto e receba o texto (Whisper na VPS). Útil para legendar ou reaproveitar falas.</p>
            <input
              type="file"
              accept="audio/*,video/*"
              onChange={(e) => setArquivoTrans(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-fg-secondary file:mr-3 file:rounded file:border-0 file:bg-primary/15 file:px-3 file:py-2 file:text-primary-bright"
            />
            <button onClick={() => transcrever("transcrever")} disabled={ocupado || !arquivoTrans} className="flex h-10 items-center gap-2 rounded bg-primary px-5 text-sm font-semibold text-void disabled:opacity-40">
              <Icon name="subtitles" className="text-[18px]" />
              {ocupado ? "Transcrevendo…" : "Transcrever"}
            </button>
            {transcricao && (
              <div className="space-y-2">
                <textarea readOnly value={transcricao} rows={6} className="field w-full p-3 text-sm" />
                <button onClick={() => navigator.clipboard?.writeText(transcricao)} className="rounded border border-line px-3 py-1.5 text-xs text-fg-secondary hover:text-fg">
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
                        {new Date(t.criadoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} · {vozes.find((v) => v.id === t.vozId)?.name ?? t.vozId} · {t.qualidade}
                      </span>
                      <span
                        className={cn(
                          "rounded border px-1.5 py-0.5 font-mono text-[10px]",
                          t.status === "pronto" ? "border-success/40 text-success" : t.status === "erro" || parada ? "border-error/40 text-error" : "border-primary/40 text-primary-bright",
                        )}
                      >
                        {parada ? "interrompida" : t.status === "pronto" ? `pronta · ${t.duracaoS}s` : t.status === "erro" ? "erro" : `${t.feitos}/${t.trechos} trechos`}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-xs text-fg-secondary">{t.textoOriginal}</p>
                    {(t.status === "gerando" || t.status === "fila") && !parada && (
                      <div className="h-1 overflow-hidden rounded-full bg-line">
                        <div className="h-full bg-primary transition-all" style={{ width: `${Math.max(4, (t.feitos / Math.max(1, t.trechos)) * 100)}%` }} />
                      </div>
                    )}
                    {t.erro && <p className="text-[11px] text-error">{t.erro}</p>}
                    {t.arquivo && (
                      <div className="flex flex-wrap items-center gap-2">
                        <audio controls preload="none" src={`/api/media/${t.arquivo}`} className="h-8 min-w-0 flex-1" />
                        <a href={`/api/media/${t.arquivo}?download=1`} className="rounded border border-line px-2.5 py-1 text-[11px] text-fg-secondary hover:text-fg">
                          Baixar WAV
                        </a>
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
