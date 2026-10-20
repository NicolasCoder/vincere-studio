"use client";

import { useState } from "react";
import { Icon, cn } from "@vincere-studio/ui";
import { chamarClaude } from "@/components/ClaudeButton";
import { NICHOS } from "@/lib/nichos";
import { SKILLS, type Motor, type Preview } from "@/lib/skills-catalog";



const RECEITAS = NICHOS.map((n) => ({ titulo: `${n.nome} · ${n.formato}`, passos: n.passos }));

const MOTORES: Array<Motor | "Todos"> = ["Todos", "HyperFrames", "Legendas", "Pesquisa", "Google Flow", "Remotion"];

const MOTOR_COR: Record<Motor, string> = {
  HyperFrames: "border-primary/40 bg-primary/10 text-primary-bright",
  Legendas: "border-warning/40 bg-warning/10 text-warning",
  Pesquisa: "border-success/40 bg-success/10 text-success",
  "Google Flow": "border-secondary/50 bg-secondary/15 text-secondary-soft",
  Remotion: "border-line bg-surface-mid text-fg-secondary",
};

/** Prévia animada leve (CSS puro) do que a skill produz. */
function SkillPreview({ kind }: { kind: Preview }) {
  return (
    <div className={cn("skill-preview relative h-24 overflow-hidden rounded-md border border-line bg-void", `pv-${kind}`)} aria-hidden="true">
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

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  const lista = motor === "Todos" ? SKILLS : SKILLS.filter((s) => s.motor === motor);

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <div>
          <h3 className="flex items-center gap-2 font-display text-base font-bold text-fg">
            <Icon name="route" className="text-[20px] text-primary-bright" />
            Receitas por nicho
          </h3>
          <p className="text-xs text-muted">Siga na ordem. Cada passo é um pedido ao Claude.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {RECEITAS.map((r) => (
            <div key={r.titulo} className="rounded-lg border border-line bg-surface-low p-4">
              <div className="mb-3 font-display text-sm font-semibold text-fg">{r.titulo}</div>
              <ol className="flex flex-wrap items-center gap-1.5 text-[11px]">
                {r.passos.map((p, i) => (
                  <li key={p} className="flex items-center gap-1.5">
                    <span className="rounded border border-line bg-void/60 px-2 py-1 text-fg-secondary">
                      <span className="mr-1 font-mono text-primary-bright">{i + 1}</span>
                      {p}
                    </span>
                    {i < r.passos.length - 1 && <Icon name="arrow_forward" className="text-[12px] text-muted" />}
                  </li>
                ))}
              </ol>
            </div>
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
