"use client";

import { useState, useEffect } from "react";
import { Icon, cn } from "@vincere-studio/ui";
import { chamarClaude } from "@/components/ClaudeButton";
import { NICHOS } from "@/lib/nichos";
import { SKILLS, type Motor, type Preview } from "@/lib/skills-catalog";

interface SkillReport {
  timestamp: string;
  skillsDirFound: string[];
  totalSkillsDetected: number;
  skills: {
    name: string;
    locations: { path: string; modifiedAt: string; hasSkillMd: boolean }[];
    status: "up_to_date" | "outdated" | "missing_in_target" | "updated";
    actionTaken?: string;
  }[];
  updatedCount: number;
}



const RECEITAS = NICHOS.map((n) => ({ titulo: `${n.nome} · ${n.formato}`, passos: n.passos }));

const MOTORES: Array<Motor | "Todos"> = ["Todos", "HyperFrames", "Google Flow", "Legendas", "Pesquisa", "Código", "Imagem", "Estratégia"];

const MOTOR_COR: Record<Motor, string> = {
  HyperFrames: "border-primary/40 bg-primary/10 text-primary-bright",
  Legendas: "border-warning/40 bg-warning/10 text-warning",
  Pesquisa: "border-success/40 bg-success/10 text-success",
  "Google Flow": "border-secondary/50 bg-secondary/15 text-secondary-soft",
  Código: "border-line-bright bg-void text-fg",
  Imagem: "border-secondary/40 bg-secondary/10 text-secondary-soft",
  Estratégia: "border-warning/30 bg-transparent text-warning",
};

/** Prévia animada leve (CSS puro) do que a skill produz. */
function SkillPreview({ kind }: { kind: Preview }) {
  return (
    // A classe da animação (pv-zoom, pv-stamp…) fica só no elemento interno: no contêiner, ela
    // escalava/girava o cartão inteiro e estourava a largura da página no celular.
    <div className="skill-preview relative h-24 overflow-hidden rounded-md border border-line bg-void" aria-hidden="true">
      {kind === "slash" && (
        <>
          <span className="pv-word">DOSSIÊ</span>
          <span className="pv-blade" />
        </>
      )}
      {kind === "lockup" && (
        <div className="pv-lockup">
          <span className="pv-small">a marca que</span>
          <span className="pv-big">MUDOU</span>
          <span className="pv-small">tudo</span>
        </div>
      )}
      {kind === "grid" && (
        <div className="pv-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} style={{ animationDelay: `${i * 0.25}s` }} className={i === 4 ? "pv-ok" : ""} />
          ))}
        </div>
      )}
      {kind === "zoom" && <span className="pv-zoom">FOCO</span>}
      {kind === "stamp" && <span className="pv-stamp">CONFIDENCIAL</span>}
      {kind === "frames" && (
        <div className="pv-frames">
          {Array.from({ length: 4 }).map((_, i) => (
            <span key={i} style={{ animationDelay: `${i * 0.4}s` }} />
          ))}
        </div>
      )}
      {kind === "orbit" && (
        <div className="pv-orbit">
          <span className="pv-core" />
          <span className="pv-sat" />
        </div>
      )}
      {kind === "nodes" && (
        <div className="pv-nodes">
          {["roteiro", "voz", "cenas", "render"].map((n, i) => (
            <span key={n} style={{ animationDelay: `${i * 0.5}s` }}>
              {n}
            </span>
          ))}
        </div>
      )}
      {kind === "wave" && (
        <div className="pv-wave">
          {Array.from({ length: 16 }).map((_, i) => (
            <span key={i} style={{ animationDelay: `${(i % 8) * 0.12}s` }} />
          ))}
        </div>
      )}
    </div>
  );
}

export function SystemSkillsCatalog() {
  const [motor, setMotor] = useState<Motor | "Todos">("Todos");
  const [copied, setCopied] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  // Estados para atualização de skills do sistema
  const [updateStatus, setUpdateStatus] = useState<SkillReport | null>(null);
  const [activeJob, setActiveJob] = useState<{ id: string; status: string; progress: number } | null>(null);
  const [checking, setChecking] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const carregarStatusAtualizacao = async () => {
    try {
      const res = await fetch("/api/skills/check-updates");
      if (res.ok) {
        const data = await res.json();
        setUpdateStatus(data.status);
        setActiveJob(data.activeJob);
        return data;
      }
    } catch {}
    return null;
  };

  useEffect(() => {
    carregarStatusAtualizacao();
  }, []);

  useEffect(() => {
    if (!activeJob || activeJob.status === "DONE" || activeJob.status === "FAILED") return;
    const timer = setInterval(async () => {
      const data = await carregarStatusAtualizacao();
      if (!data?.activeJob) {
        setChecking(false);
        setFeedbackMsg("Varredura de skills concluída!");
        setTimeout(() => setFeedbackMsg(null), 5000);
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [activeJob]);

  const dispararVerificacao = async () => {
    setChecking(true);
    setFeedbackMsg("Disparando job de verificação e atualização...");
    try {
      const res = await fetch("/api/skills/check-updates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoUpdate: true }),
      });
      if (res.ok) {
        const data = await res.json();
        setActiveJob({ id: data.jobId, status: "QUEUED", progress: 0 });
        setFeedbackMsg("Job enfileirado! O Worker está varrendo as pastas da máquina.");
      } else {
        setFeedbackMsg("Erro ao iniciar o job.");
        setChecking(false);
      }
    } catch {
      setFeedbackMsg("Falha na conexão com o servidor.");
      setChecking(false);
    }
  };

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  const q = busca.trim().toLowerCase();
  const lista = SKILLS.filter(
    (s) => (motor === "Todos" || s.motor === motor) && (!q || `${s.nome} ${s.comando} ${s.quando}`.toLowerCase().includes(q)),
  );

  return (
    <div className="space-y-10">
      {/* 0. Central de Atualização de Skills na Máquina */}
      <section className="relative overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-br from-surface-low via-surface-low to-primary/5 p-4 sm:p-5 shadow-lg">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-lg border border-primary/40 bg-primary/10 text-primary-bright">
              <Icon name="sync" className={cn("text-[24px]", (checking || !!activeJob) && "animate-spin text-primary-bright")} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-base font-bold text-fg">Sincronizador & Atualizador de Skills</h3>
                <span className="rounded bg-primary/20 px-2 py-0.5 font-mono text-[10px] font-semibold text-primary-bright">
                  Job Automático
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted max-w-xl">
                Varre as pastas de skills locais (<code className="text-primary-bright">~/.gemini</code>, <code className="text-primary-bright">~/.claude</code>, <code className="text-primary-bright">~/.agents</code>), compara versões e propaga atualizações mais recentes automaticamente.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {updateStatus && (
              <button
                type="button"
                onClick={() => setShowDetails(!showDetails)}
                className="flex items-center gap-1.5 rounded-lg border border-line bg-surface-mid px-3 py-2 text-xs font-semibold text-fg-secondary hover:text-fg hover:border-line-bright transition-colors"
              >
                <Icon name={showDetails ? "expand_less" : "tune"} className="text-[16px]" />
                {showDetails ? "Ocultar Detalhes" : "Ver Detalhes"}
              </button>
            )}
            <button
              type="button"
              disabled={checking || !!activeJob}
              onClick={dispararVerificacao}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all shadow-md",
                checking || activeJob
                  ? "cursor-not-allowed bg-primary/30 text-primary-bright/60"
                  : "bg-primary text-void hover:bg-primary-bright active:scale-95"
              )}
            >
              <Icon name="autorenew" className={cn("text-[18px]", (checking || !!activeJob) && "animate-spin")} />
              {checking || activeJob ? "Verificando..." : "Verificar e Atualizar Skills"}
            </button>
          </div>
        </div>

        {/* Status / Notificação */}
        {feedbackMsg && (
          <div className="mt-3 flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs text-primary-bright">
            <Icon name="info" className="text-[16px]" />
            <span>{feedbackMsg}</span>
          </div>
        )}

        {/* Cartões de Status Rápido */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-line/70 bg-void/50 p-2.5">
            <span className="label-mono block text-[10px] text-muted">SKILLS DETECTADAS</span>
            <span className="font-display text-lg font-bold text-fg">
              {updateStatus ? updateStatus.totalSkillsDetected : "—"}
            </span>
          </div>
          <div className="rounded-lg border border-line/70 bg-void/50 p-2.5">
            <span className="label-mono block text-[10px] text-muted">ATUALIZADAS / SINCRONIZADAS</span>
            <span className="font-display text-lg font-bold text-success">
              {updateStatus ? updateStatus.updatedCount : "—"}
            </span>
          </div>
          <div className="rounded-lg border border-line/70 bg-void/50 p-2.5">
            <span className="label-mono block text-[10px] text-muted">PASTAS DO SISTEMA</span>
            <span className="font-display text-lg font-bold text-secondary-soft">
              {updateStatus ? updateStatus.skillsDirFound.length : "—"}
            </span>
          </div>
          <div className="rounded-lg border border-line/70 bg-void/50 p-2.5">
            <span className="label-mono block text-[10px] text-muted">ÚLTIMA VARREDURA</span>
            <span className="text-xs text-fg-secondary truncate block font-mono mt-1">
              {updateStatus ? new Date(updateStatus.timestamp).toLocaleTimeString("pt-BR") : "Ainda não executado"}
            </span>
          </div>
        </div>

        {/* Detalhes expandidos */}
        {showDetails && updateStatus && (
          <div className="mt-4 border-t border-line/70 pt-4 space-y-3">
            <h4 className="font-display text-xs font-bold text-fg flex items-center gap-2">
              <Icon name="folder_open" className="text-primary-bright text-[16px]" />
              Diretórios Monitorados:
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {updateStatus.skillsDirFound.map((dir) => (
                <code key={dir} className="rounded border border-line bg-void px-2 py-1 font-mono text-[11px] text-muted">
                  {dir}
                </code>
              ))}
            </div>

            <h4 className="font-display text-xs font-bold text-fg flex items-center gap-2 pt-2">
              <Icon name="check_circle" className="text-success text-[16px]" />
              Status por Skill:
            </h4>
            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
              {updateStatus.skills.map((s) => (
                <div key={s.name} className="flex items-center justify-between rounded border border-line/60 bg-surface-mid/40 px-3 py-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-fg">{s.name}</span>
                    <span className="text-[10px] text-muted font-mono">({s.locations.length} localizações)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.actionTaken && (
                      <span className="text-[10px] text-secondary-soft font-mono">{s.actionTaken}</span>
                    )}
                    <span className={cn(
                      "rounded px-2 py-0.5 text-[10px] font-mono font-semibold",
                      s.status === "up_to_date" && "border border-success/40 bg-success/10 text-success",
                      s.status === "updated" && "border border-primary/40 bg-primary/10 text-primary-bright",
                      s.status === "outdated" && "border border-warning/40 bg-warning/10 text-warning",
                      s.status === "missing_in_target" && "border border-line bg-void text-muted"
                    )}>
                      {s.status === "up_to_date" && "Em dia"}
                      {s.status === "updated" && "Atualizado"}
                      {s.status === "outdated" && "Desatualizado"}
                      {s.status === "missing_in_target" && "Pendente"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
      <section className="space-y-3">
        <div>
          <h3 className="flex items-center gap-2 font-display text-base font-bold text-fg">
            <Icon name="route" className="text-[20px] text-primary-bright" />
            Receitas por nicho
          </h3>
          <p className="text-xs text-muted">Siga na ordem. Cada passo é um pedido ao Claude.</p>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {RECEITAS.map((r, idx) => (
            <details key={r.titulo} open={idx === 0} className="group rounded-lg border border-line bg-surface-low open:border-primary/40">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 font-display text-sm font-semibold text-fg">
                <span>{r.titulo}</span>
                <span className="flex items-center gap-1 text-[11px] font-normal text-muted">
                  {r.passos.length} passos
                  <Icon name="expand_more" className="text-[18px] transition-transform group-open:rotate-180" />
                </span>
              </summary>
              <ol className="space-y-1.5 px-4 pb-4 text-xs">
                {r.passos.map((p, i) => (
                  <li key={p} className="flex items-start gap-2 text-fg-secondary">
                    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary/15 font-mono text-[10px] text-primary-bright">{i + 1}</span>
                    <span className="pt-0.5">{p}</span>
                  </li>
                ))}
              </ol>
            </details>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h3 className="flex items-center gap-2 font-display text-base font-bold text-fg">
              <Icon name="school" className="text-[20px] text-primary-bright" />
              Suas skills ({SKILLS.length})
            </h3>
            <p className="text-xs text-muted">
              Copie o exemplo e cole no Claude Code, ou mande direto pelo botão. O selo mostra onde a skill trabalha.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar skill…"
              className="field h-8 w-full px-3 text-xs sm:w-48"
            />
            {MOTORES.map((m) => (
              <button
                key={m}
                onClick={() => setMotor(m)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  motor === m ? "border-primary bg-primary text-void font-semibold" : "border-line text-fg-secondary hover:text-fg",
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {lista.map((s) => (
            <article key={s.id} className="flex flex-col gap-3 rounded-lg border border-line bg-surface-low p-4 transition-colors hover:border-primary/40">
              <SkillPreview kind={s.preview} />
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-display text-sm font-bold leading-tight text-fg">{s.nome}</h4>
                <span className={cn("shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px]", MOTOR_COR[s.motor])}>{s.motor}</span>
              </div>
              <p className="text-xs leading-relaxed text-fg-secondary">{s.quando}</p>
              <dl className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded border border-line/70 bg-void/40 p-2">
                  <dt className="label-mono mb-0.5 text-[9px] text-muted">VOCÊ DÁ</dt>
                  <dd className="text-fg-secondary">{s.voceDa}</dd>
                </div>
                <div className="rounded border border-line/70 bg-void/40 p-2">
                  <dt className="label-mono mb-0.5 text-[9px] text-muted">VOCÊ RECEBE</dt>
                  <dd className="text-fg-secondary">{s.voceRecebe}</dd>
                </div>
              </dl>
              <div className="mt-auto space-y-2 border-t border-line/60 pt-3">
                <div className="label-mono text-[9px] text-muted">EXEMPLO DE PEDIDO</div>
                <p className="rounded bg-void/70 p-2 text-[11px] italic text-fg">&ldquo;{s.exemplo}&rdquo;</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => copy(s.exemplo)}
                    className="flex-1 rounded border border-line px-2 py-1.5 text-[11px] text-fg-secondary hover:text-fg"
                  >
                    {copied === s.exemplo ? "Copiado!" : "Copiar exemplo"}
                  </button>
                  <button
                    type="button"
                    onClick={() => chamarClaude({ pedido: s.exemplo })}
                    className="flex-1 rounded bg-primary/15 px-2 py-1.5 text-[11px] font-semibold text-primary-bright hover:bg-primary/25"
                  >
                    Pedir ao Claude
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
