"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Icon } from "@vincere-studio/ui";

interface Voice {
  id: string;
  name: string;
  ref_text: string;
  language: string;
  kind: string;
  audio_url: string;
  full_audio_url: string | null;
}

export default function VoiceStudioPage() {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(true);
  const [tunnelOnline, setTunnelOnline] = useState(false);
  const [vpsHost, setVpsHost] = useState("143.95.167.129");
  const [error, setError] = useState<string | null>(null);

  const fetchVoices = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/voicestudio");
      const data = await res.json();
      if (data.ok) {
        setVoices(data.voices || []);
        setTunnelOnline(data.tunnelOnline);
        if (data.vps) setVpsHost(data.vps);
      } else {
        setTunnelOnline(false);
        setError(data.error || "Falha ao conectar no VoiceStudio");
      }
    } catch (err: unknown) {
      setTunnelOnline(false);
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVoices();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="VoiceStudio"
        subtitle={`Vozes neurais clonadas & síntese em alta fidelidade rodando na sua VPS HostGator (${vpsHost}:3900)`}
        right={
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-mono tracking-wider ${
                tunnelOnline
                  ? "border-success/40 bg-success/10 text-success"
                  : "border-warning/40 bg-warning/10 text-warning"
              }`}
            >
              <span
                className={`size-2 rounded-full ${
                  tunnelOnline ? "bg-success animate-pulse" : "bg-warning"
                }`}
              />
              {tunnelOnline ? "VPS Conectada (Túnel 3900)" : "Túnel Offline"}
            </span>

            <button
              onClick={fetchVoices}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded border border-line bg-surface-mid px-3 py-1.5 text-xs font-medium text-fg hover:bg-line/40 transition-colors"
            >
              <Icon name="refresh" className={`text-base ${loading ? "animate-spin" : ""}`} />
              Sincronizar Vozes
            </button>
          </div>
        }
      />

      {/* Cards de Status */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-line bg-surface-low/80 p-4">
          <div className="flex items-center gap-2 text-xs font-mono text-muted uppercase">
            <Icon name="mic" className="text-primary-bright" />
            Voz Canônica do Igor
          </div>
          <div className="mt-2 text-lg font-bold font-display text-fg">
            ID 352e875e · 39.2s ref
          </div>
          <p className="mt-1 text-xs text-muted">
            Voz principal clonada com a maior fidelidade neural e timbre calibrado.
          </p>
        </div>

        <div className="rounded-lg border border-line bg-surface-low/80 p-4">
          <div className="flex items-center gap-2 text-xs font-mono text-muted uppercase">
            <Icon name="subtitles" className="text-secondary-soft" />
            Legendas Whisper
          </div>
          <div className="mt-2 text-lg font-bold font-display text-fg">
            large-v3-turbo (VPS)
          </div>
          <p className="mt-1 text-xs text-muted">
            Alinhamento por palavra em milissegundos sem limite de 20 segundos.
          </p>
        </div>

        <div className="rounded-lg border border-line bg-surface-low/80 p-4">
          <div className="flex items-center gap-2 text-xs font-mono text-muted uppercase">
            <Icon name="dns" className="text-success" />
            Infraestrutura VPS
          </div>
          <div className="mt-2 text-lg font-bold font-display text-fg">
            8 Cores · 31 GB RAM
          </div>
          <p className="mt-1 text-xs text-muted">
            Container Docker <code className="text-primary-bright">voicestudio</code> operando 24/7.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
          <div className="font-semibold">Aviso de conexão com o VoiceStudio</div>
          <p className="mt-1 text-xs text-warning/80">{error}</p>
        </div>
      )}

      {/* Lista de Vozes */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-fg font-display">
            Vozes Disponíveis ({voices.length})
          </h2>
          <span className="text-xs text-muted">
            Sincronizadas automaticamente com o VoiceStudio
          </span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-44 rounded-lg border border-line bg-surface-low animate-pulse" />
            ))}
          </div>
        ) : voices.length === 0 ? (
          <div className="rounded-lg border border-line bg-surface-low p-8 text-center text-muted">
            Nenhuma voz encontrada no VoiceStudio.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {voices.map((v) => {
              const isMainIgor = v.id === "352e875e";
              return (
                <div
                  key={v.id}
                  className={`relative flex flex-col justify-between rounded-lg border p-5 transition-all ${
                    isMainIgor
                      ? "border-primary/50 bg-primary/5 shadow-[0_0_20px_rgba(77,107,255,0.06)]"
                      : "border-line bg-surface-low hover:border-line-bright"
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-bold text-fg font-display">
                            {v.name}
                          </span>
                          {isMainIgor && (
                            <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold font-mono tracking-wider text-primary-bright">
                              OFICIAL IGOR
                            </span>
                          )}
                          <span className="rounded bg-surface-mid px-1.5 py-0.5 text-[10px] font-mono text-muted">
                            {v.language || "pt"}
                          </span>
                        </div>
                        <div className="mt-0.5 font-mono text-[11px] text-muted">
                          ID: <span className="text-fg-secondary">{v.id}</span>
                        </div>
                      </div>

                      <div className="grid size-8 place-items-center rounded-full bg-surface-mid text-muted">
                        <Icon name="record_voice_over" className="text-base" />
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="text-[11px] font-mono uppercase text-muted">
                        Referência de Áudio:
                      </div>
                      <p className="mt-1 line-clamp-3 text-xs italic text-fg-secondary/80 bg-surface-mid/40 rounded p-2 border border-line/40">
                        &ldquo;{v.ref_text}&rdquo;
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-line/60">
                    <div className="text-[11px] font-mono text-muted mb-1.5">
                      Ouvir Amostra:
                    </div>
                    {v.full_audio_url ? (
                      <audio
                        controls
                        src={v.full_audio_url}
                        className="w-full h-8 brightness-90 contrast-125"
                        preload="none"
                      />
                    ) : (
                      <div className="text-xs text-muted">Áudio não disponível</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
