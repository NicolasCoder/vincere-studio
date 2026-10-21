"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@vincere-studio/ui";

interface EngineStatus {
  hyperframes: boolean;
  voiceStudio: boolean;
  flowDaemon: boolean;
  sharinganLocal: boolean;
  computeMode: string;
  loading: boolean;
}

export function EnginesHub() {
  const [status, setStatus] = useState<EngineStatus>({
    hyperframes: true,
    voiceStudio: false,
    flowDaemon: false,
    sharinganLocal: false,
    computeMode: "AUTO",
    loading: true,
  });

  const checkEngines = async () => {
    setStatus((prev) => ({ ...prev, loading: true }));
    let hf = false;
    let vs = false;
    let fl = false;
    let sh = false;
    let mode = "AUTO";

    try {
      const res = await fetch("/api/hyperframes");
      const d = await res.json();
      hf = !!d.running;
    } catch {
      hf = false;
    }

    try {
      const res = await fetch("/api/voicestudio");
      const d = await res.json();
      vs = !!d.tunnelOnline;
    } catch {
      vs = false;
    }

    try {
      const res = await fetch("/api/flow");
      const d = await res.json();
      fl = !!d.running;
    } catch {
      fl = false;
    }

    try {
      const res = await fetch("/api/reels-tools");
      const d = await res.json();
      sh = !!d.nodes?.localGpu?.online;
      mode = d.computeMode || "AUTO";
    } catch {
      sh = false;
    }

    setStatus({
      hyperframes: hf,
      voiceStudio: vs,
      flowDaemon: fl,
      sharinganLocal: sh,
      computeMode: mode,
      loading: false,
    });
  };

  useEffect(() => {
    checkEngines();
    const interval = setInterval(checkEngines, 12000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {/* HyperFrames Engine */}
      <div className="flex flex-col justify-between rounded-lg border border-line bg-surface-low/80 p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded bg-primary/10 text-primary-bright">
              <Icon name="movie_filter" className="text-[18px]" />
            </span>
            <span className="font-display font-semibold text-xs text-fg">HyperFrames Studio</span>
          </div>
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-mono ${
              status.hyperframes
                ? "border-success/40 bg-success/10 text-success"
                : "border-warning/40 bg-warning/10 text-warning"
            }`}
          >
            <span className={`size-1.5 rounded-full ${status.hyperframes ? "bg-success" : "bg-warning"}`} />
            {status.hyperframes ? "Porta 3010" : "Pausado"}
          </span>
        </div>
        <p className="text-[11px] text-muted">
          Timeline ao vivo dos projetos em Videos-HF, no seu PC.
        </p>
        <Link
          href="/studio"
          className="inline-flex items-center justify-between rounded border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-[11px] font-medium text-primary-bright hover:bg-primary/20 transition-colors"
        >
          <span>Abrir Studio</span>
          <Icon name="chevron_right" className="text-[14px]" />
        </Link>
      </div>

      {/* VoiceStudio (GPU Local RTX 3060 + VPS) */}
      <div className="flex flex-col justify-between rounded-lg border border-line bg-surface-low/80 p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded bg-secondary/10 text-secondary-soft">
              <Icon name="record_voice_over" className="text-[18px]" />
            </span>
            <span className="font-display font-semibold text-xs text-fg">Vozes & Whisper (GPU PC)</span>
          </div>
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-mono ${
              status.voiceStudio
                ? "border-success/40 bg-success/10 text-success"
                : "border-secondary/40 bg-secondary/10 text-secondary-soft"
            }`}
          >
            <span className={`size-1.5 rounded-full ${status.voiceStudio ? "bg-success" : "bg-secondary-bright"}`} />
            {status.voiceStudio ? "RTX 3060 + RVC V2" : "PC / VPS"}
          </span>
        </div>
        <p className="text-[11px] text-muted">
          Geração de voz, análise acústica para clonagem (RVC V2 rmvpe) e Faster-Whisper na GPU do PC.
        </p>
        <Link
          href="/voice-studio"
          className="inline-flex items-center justify-between rounded border border-secondary/30 bg-secondary/10 px-2.5 py-1.5 text-[11px] font-medium text-secondary-soft hover:bg-secondary/20 transition-colors"
        >
          <span>Central de Vozes</span>
          <Icon name="chevron_right" className="text-[14px]" />
        </Link>
      </div>

      {/* Flow Studio MCP */}
      <div className="flex flex-col justify-between rounded-lg border border-line bg-surface-low/80 p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded bg-secondary/10 text-secondary">
              <Icon name="auto_awesome" className="text-[18px]" />
            </span>
            <span className="font-display font-semibold text-xs text-fg">Google Flow MCP</span>
          </div>
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-mono ${
              status.flowDaemon
                ? "border-success/40 bg-success/10 text-success"
                : "border-secondary/40 bg-secondary/10 text-secondary"
            }`}
          >
            <span className={`size-1.5 rounded-full ${status.flowDaemon ? "bg-success" : "bg-secondary"}`} />
            {status.flowDaemon ? "Porta 9334" : "Automação"}
          </span>
        </div>
        <p className="text-[11px] text-muted">
          Imagens (Nano Banana) e vídeos (Veo) pela sua conta Google.
        </p>
        <Link
          href="/flow-studio"
          className="inline-flex items-center justify-between rounded border border-secondary/30 bg-secondary/10 px-2.5 py-1.5 text-[11px] font-medium text-secondary hover:bg-secondary/20 transition-colors"
        >
          <span>Fila do Flow</span>
          <Icon name="chevron_right" className="text-[14px]" />
        </Link>
      </div>

      {/* Sharingan & Reels Tools (Duas Vias: Local GPU + Cloud) */}
      <div className="flex flex-col justify-between rounded-lg border border-line bg-surface-low/80 p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded bg-primary/10 text-primary-bright">
              <Icon name="visibility" className="text-[18px]" />
            </span>
            <span className="font-display font-semibold text-xs text-fg">Sharingan & Talking Head</span>
          </div>
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-mono ${
              status.sharinganLocal
                ? "border-success/40 bg-success/10 text-success"
                : "border-primary/40 bg-primary/10 text-primary-bright"
            }`}
          >
            <span className={`size-1.5 rounded-full ${status.sharinganLocal ? "bg-success" : "bg-primary-bright"}`} />
            {status.sharinganLocal ? `GPU Local (${status.computeMode})` : "Cloud Switch"}
          </span>
        </div>
        <p className="text-[11px] text-muted">
          Duas vias: leve na Nuvem + clonagem de vídeo e áudio na GPU local (ou Cloud).
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          <Link
            href="/talking-head"
            className="inline-flex items-center justify-between rounded border border-line px-2 py-1.5 text-[11px] font-medium text-fg-secondary hover:border-primary/50 hover:text-fg transition-colors"
          >
            <span>Talking Head</span>
            <Icon name="chevron_right" className="text-[14px]" />
          </Link>
          <Link
            href="/sharingan"
            className="inline-flex items-center justify-between rounded border border-primary/30 bg-primary/10 px-2 py-1.5 text-[11px] font-medium text-primary-bright hover:bg-primary/20 transition-colors"
          >
            <span>Sharingan</span>
            <Icon name="chevron_right" className="text-[14px]" />
          </Link>
        </div>
      </div>
    </div>
  );
}
