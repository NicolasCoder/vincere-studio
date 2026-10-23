"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Icon, cn } from "@vincere-studio/ui";
import type { AutoHealIncident, AutoHealSubsystem } from "@/lib/auto-heal";

export const AUTO_HEAL_TRIGGER_EVENT = "vincere:auto-heal-trigger";
export const AUTO_HEAL_RESOLVED_EVENT = "vincere:auto-heal-resolved";

export interface AcionarAutoHealDetail {
  subsystem?: AutoHealSubsystem;
  titulo: string;
  detalheErro: string;
  pagina?: string;
  projetoId?: string;
  projetoHf?: string;
  projectDir?: string;
  jobId?: string;
  forceAgent?: boolean;
}

/**
 * Qualquer tela ou componente pode chamar `acionarAutoHealing(...)` quando detectar uma falha.
 * O monitor global abre imediatamente a notificação de Auto-Healing e permanece visível até concluir o reparo.
 */
export function acionarAutoHealing(detail: AcionarAutoHealDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AUTO_HEAL_TRIGGER_EVENT, { detail }));
}

function inferSubsystemFromUrl(url: string): AutoHealSubsystem {
  if (url.includes("/api/hyperframes")) return "hyperframes";
  if (url.includes("/api/flow")) return "flow";
  if (url.includes("/api/voicestudio")) return "voicestudio";
  if (url.includes("/api/sharingan") || url.includes("/api/talking-head")) return "pc_gpu";
  if (url.includes("/api/jobs")) return "worker";
  return "api_runtime";
}

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}s`;
}

export function AutoHealingMonitor() {
  const pathname = usePathname();
  const router = useRouter();
  const [incident, setIncident] = useState<AutoHealIncident | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [showSteps, setShowSteps] = useState(true);
  const [elapsedSec, setElapsedSec] = useState(0);
  const prevStatusRef = useRef<string | null>(null);
  const lastAutoInterceptRef = useRef<number>(0);

  const dispararNoServidor = useCallback(
    async (detail: AcionarAutoHealDetail) => {
      const agora = new Date().toISOString();
      // Mostra feedback otimista imediato na tela antes mesmo do roundtrip HTTP terminar
      setMinimized(false);
      setIncident((atual) => {
        if (atual && (atual.status === "detectado" || atual.status === "corrigindo")) {
          return atual;
        }
        return {
          id: `temp_${Date.now()}`,
          subsystem: detail.subsystem ?? "geral",
          titulo: detail.titulo,
          detalheErro: detail.detalheErro,
          pagina: detail.pagina ?? pathname,
          projetoId: detail.projetoId,
          projetoHf: detail.projetoHf,
          projectDir: detail.projectDir,
          jobId: detail.jobId,
          status: "corrigindo",
          etapaAtual: "Diagnosticando problema e acionando Agente / IA...",
          passosExecutados: [`Problema detectado: ${detail.titulo}`, "Iniciando protocolo de Auto-Healing..."],
          motorIa: "Agente / IA vinculada",
          createdAt: agora,
          updatedAt: agora,
        };
      });

      try {
        const res = await fetch("/api/auto-heal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "heal",
            subsystem: detail.subsystem ?? "geral",
            titulo: detail.titulo,
            detalheErro: detail.detalheErro,
            pagina: detail.pagina ?? pathname,
            projetoId: detail.projetoId,
            projetoHf: detail.projetoHf,
            projectDir: detail.projectDir,
            jobId: detail.jobId,
            forceAgent: detail.forceAgent,
          }),
        });
        const data = await res.json();
        if (data?.ok && data.incident) {
          setIncident(data.incident);
        }
      } catch {
        // O polling regular sincronizará o estado
      }
    },
    [pathname],
  );

  const sincronizarEstado = useCallback(
    async (checkHealth = false) => {
      try {
        const qs = new URLSearchParams();
        if (checkHealth) qs.set("checkHealth", "true");
        if (pathname) qs.set("pagina", pathname);
        const res = await fetch(`/api/auto-heal?${qs.toString()}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!data?.ok) return;

        const nextIncident: AutoHealIncident | null = data.active ?? null;
        const prevStatus = prevStatusRef.current;

        if (
          nextIncident &&
          nextIncident.status === "resolvido" &&
          (prevStatus === "detectado" || prevStatus === "corrigindo")
        ) {
          window.dispatchEvent(new CustomEvent(AUTO_HEAL_RESOLVED_EVENT, { detail: nextIncident }));
          router.refresh();
        }

        prevStatusRef.current = nextIncident?.status ?? null;
        setIncident(nextIncident);
      } catch {
        // Ignora erro transitório de rede
      }
    },
    [pathname, router],
  );

  // Escuta eventos manuais/programáticos `acionarAutoHealing(...)`
  useEffect(() => {
    const onTrigger = (ev: Event) => {
      const detail = (ev as CustomEvent<AcionarAutoHealDetail>).detail;
      if (detail?.titulo) {
        void dispararNoServidor(detail);
      }
    };
    window.addEventListener(AUTO_HEAL_TRIGGER_EVENT, onTrigger);
    return () => window.removeEventListener(AUTO_HEAL_TRIGGER_EVENT, onTrigger);
  }, [dispararNoServidor]);

  // Interceptador global de erros de API (>= 500) e exceções não tratadas na plataforma
  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const isInternalApi = urlStr.startsWith("/api/") && !urlStr.startsWith("/api/auto-heal") && !urlStr.startsWith("/api/claude");

      try {
        const response = await originalFetch(input, init);
        if (isInternalApi && response.status >= 500 && Date.now() - lastAutoInterceptRef.current > 15_000) {
          lastAutoInterceptRef.current = Date.now();
          const clone = response.clone();
          const errBody = await clone.json().catch(() => null);
          const msg = errBody?.error || errBody?.message || `Erro HTTP ${response.status} em ${urlStr}`;
          void dispararNoServidor({
            subsystem: inferSubsystemFromUrl(urlStr),
            titulo: `Erro interno detectado em ${urlStr.split("?")[0]}`,
            detalheErro: String(msg),
            pagina: window.location.pathname,
          });
        }
        return response;
      } catch (err) {
        throw err;
      }
    };

    const onRuntimeError = (ev: ErrorEvent) => {
      const msg = ev.message || "";
      if (!msg || msg.includes("ResizeObserver") || msg.includes("AbortError") || msg.includes("hydration")) return;
      if (Date.now() - lastAutoInterceptRef.current < 20_000) return;
      lastAutoInterceptRef.current = Date.now();
      void dispararNoServidor({
        subsystem: "api_runtime",
        titulo: "Erro de execução detectado na interface",
        detalheErro: `${msg} (${ev.filename || "runtime"}:${ev.lineno || 0})`,
        pagina: window.location.pathname,
      });
    };

    window.addEventListener("error", onRuntimeError);
    return () => {
      window.fetch = originalFetch;
      window.removeEventListener("error", onRuntimeError);
    };
  }, [dispararNoServidor]);

  // Polling adaptativo: rápido (1.8s) enquanto está corrigindo, leve (10s) com checkHealth quando ocioso
  const isHealing = incident?.status === "detectado" || incident?.status === "corrigindo";

  useEffect(() => {
    void sincronizarEstado(true);
    const intervalMs = isHealing ? 1800 : 10_000;
    const timer = setInterval(() => {
      void sincronizarEstado(!isHealing);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [isHealing, sincronizarEstado]);

  // Cronômetro em tempo real enquanto o Auto-Healing está operando
  useEffect(() => {
    if (!incident || (incident.status !== "detectado" && incident.status !== "corrigindo")) {
      setElapsedSec(0);
      return;
    }
    const startMs = new Date(incident.createdAt).getTime();
    const updateTimer = () => {
      setElapsedSec(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    };
    updateTimer();
    const t = setInterval(updateTimer, 1000);
    return () => clearInterval(t);
  }, [incident]);

  const handleDismiss = async () => {
    if (!incident) return;
    const id = incident.id;
    setIncident(null);
    if (!id.startsWith("temp_")) {
      await fetch("/api/auto-heal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dismiss", id }),
      }).catch(() => {});
    }
  };

  if (!incident) return null;

  const emAndamento = incident.status === "detectado" || incident.status === "corrigindo";
  const resolvido = incident.status === "resolvido";

  // Versão compacta (pílula) se o usuário minimizar durante o reparo
  if (minimized) {
    return (
      <button
        type="button"
        onClick={() => setMinimized(false)}
        className={cn(
          "fixed top-4 right-4 z-50 flex items-center gap-2.5 rounded-full border px-3.5 py-2 text-xs font-semibold shadow-2xl backdrop-blur-xl transition-all",
          emAndamento
            ? "border-primary/60 bg-surface-elevated/95 text-primary-bright"
            : resolvido
              ? "border-success/60 bg-surface-elevated/95 text-success"
              : "border-warning/60 bg-surface-elevated/95 text-warning",
        )}
      >
        <Icon
          name={emAndamento ? "sync" : resolvido ? "check_circle" : "build_circle"}
          className={cn("text-[16px]", emAndamento && "animate-spin")}
        />
        <span>{emAndamento ? `Auto-Healing (${formatElapsed(elapsedSec)})` : "Auto-Healing Concluído"}</span>
      </button>
    );
  }

  return (
    <aside
      role="status"
      aria-live="polite"
      className={cn(
        "fixed top-4 right-4 z-50 w-[calc(100vw-2rem)] max-w-md overflow-hidden rounded-2xl border bg-surface-elevated/95 shadow-2xl backdrop-blur-2xl transition-all",
        emAndamento
          ? "border-primary/50 shadow-[0_0_40px_-10px_rgba(47,107,255,0.45)]"
          : resolvido
            ? "border-success/50 shadow-[0_0_35px_-10px_rgba(16,185,129,0.35)]"
            : "border-warning/50",
      )}
    >
      {/* Barra de progresso animada no topo enquanto corrige */}
      {emAndamento && (
        <div className="h-1 w-full overflow-hidden bg-primary/15">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-primary/40 via-primary-bright to-primary/40" />
        </div>
      )}

      <div className="p-4 space-y-3">
        {/* Cabeçalho da Notificação de Auto-Healing */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-xl border",
                emAndamento
                  ? "border-primary/40 bg-primary/15 text-primary-bright"
                  : resolvido
                    ? "border-success/40 bg-success/15 text-success"
                    : "border-warning/40 bg-warning/15 text-warning",
              )}
            >
              <Icon
                name={emAndamento ? "auto_fix_high" : resolvido ? "check_circle" : "build_circle"}
                className={cn("text-[20px]", emAndamento && "animate-pulse")}
              />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={cn(
                    "font-display text-xs font-bold uppercase tracking-wider",
                    emAndamento ? "text-primary-bright" : resolvido ? "text-success" : "text-warning",
                  )}
                >
                  {emAndamento
                    ? "Auto-Healing em andamento..."
                    : resolvido
                      ? "Auto-Healing Concluído ✓"
                      : "Auto-Healing · Diagnóstico"}
                </span>
                {emAndamento && (
                  <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-primary-bright">
                    {formatElapsed(elapsedSec)}
                  </span>
                )}
              </div>
              <p className="truncate text-[11px] text-muted">
                Motor: <strong className="text-fg-secondary">{incident.motorIa}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setMinimized(true)}
              className="grid size-7 place-items-center rounded-lg text-muted hover:bg-white/[0.06] hover:text-fg text-xs"
              title="Minimizar para pílula"
            >
              —
            </button>
            {!emAndamento && (
              <button
                type="button"
                onClick={handleDismiss}
                className="grid size-7 place-items-center rounded-lg text-muted hover:bg-white/[0.06] hover:text-fg text-xs"
                title="Fechar notificação"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Problema detectado + Etapa Atual */}
        <div className="rounded-xl border border-white/[0.07] bg-void/60 p-3 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-fg">{incident.titulo}</span>
            <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-muted uppercase">
              {incident.subsystem}
            </span>
          </div>

          <div className="flex items-start gap-2 pt-0.5">
            {emAndamento ? (
              <Icon name="sync" className="text-[14px] text-primary-bright animate-spin mt-0.5 shrink-0" />
            ) : (
              <Icon
                name={resolvido ? "verified" : "info"}
                className={cn("text-[14px] mt-0.5 shrink-0", resolvido ? "text-success" : "text-warning")}
              />
            )}
            <p className="text-xs text-fg-secondary leading-relaxed">
              {resolvido || incident.status === "acao_humana"
                ? incident.solucaoResumo || incident.etapaAtual
                : incident.etapaAtual}
            </p>
          </div>
        </div>

        {/* Passos Executados em Tempo Real */}
        {incident.passosExecutados.length > 0 && (
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => setShowSteps((s) => !s)}
              className="flex w-full items-center justify-between text-[11px] font-medium text-muted hover:text-fg"
            >
              <span>Log de auto-correção ({incident.passosExecutados.length} etapas)</span>
              <span>{showSteps ? "Ocultar ▲" : "Mostrar ▼"}</span>
            </button>

            {showSteps && (
              <div className="max-h-32 overflow-y-auto rounded-lg border border-white/[0.05] bg-void/40 p-2.5 space-y-1 font-mono text-[10px] text-fg-secondary">
                {incident.passosExecutados.map((passo, idx) => {
                  const isLast = idx === incident.passosExecutados.length - 1;
                  return (
                    <div key={idx} className="flex items-start gap-1.5 leading-snug">
                      <span className={cn("shrink-0", isLast && emAndamento ? "text-primary-bright" : "text-success")}>
                        {isLast && emAndamento ? "⟳" : "✓"}
                      </span>
                      <span className={cn(isLast && emAndamento && "text-fg font-semibold")}>{passo}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Ação recomendada caso precise de chave/configuração humana */}
        {incident.acaoRecomendada && (
          <div className="flex items-center justify-end pt-1">
            <a
              href={incident.acaoRecomendada.href}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-void hover:brightness-110"
            >
              <span>{incident.acaoRecomendada.rotulo}</span>
              <Icon name="arrow_forward" className="text-[14px]" />
            </a>
          </div>
        )}
      </div>
    </aside>
  );
}
