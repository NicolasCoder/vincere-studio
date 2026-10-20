"use client";

import { useState } from "react";
import { Icon, cn } from "@vincere-studio/ui";
import { chamarClaude } from "@/components/ClaudeButton";
import { NICHOS, pedidoDoNicho, type Formato, type Nicho } from "@/lib/nichos";
import { IDIOMAS, idiomaPorId } from "@/lib/idiomas";

export function NichoLauncher() {
  const [sel, setSel] = useState<Nicho | null>(null);
  const [tema, setTema] = useState("");
  const [formato, setFormato] = useState<Formato>("9:16");
  const [notas, setNotas] = useState("");
  const [idiomaId, setIdiomaId] = useState("pt-BR");

  const escolher = (n: Nicho) => {
    setSel(n);
    setFormato(n.formato);
    setTema("");
    setNotas("");
  };

  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-display text-lg font-bold text-fg">O que vamos criar hoje?</h2>
        <p className="text-xs text-muted">Escolha o nicho, diga o tema e o Claude monta a primeira versão no HyperFrames.</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        {NICHOS.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => escolher(n)}
            className={cn(
              "flex flex-col items-start gap-2 rounded-lg border p-3 text-left transition-colors",
              sel?.id === n.id ? "border-primary bg-primary/10" : "border-line bg-surface-low hover:border-primary/40",
            )}
          >
            <Icon name={n.icone} className="text-[22px] text-primary-bright" />
            <span className="font-display text-[13px] font-semibold leading-tight text-fg">{n.nome}</span>
            <span className="line-clamp-2 text-[11px] leading-snug text-muted">{n.resumo}</span>
          </button>
        ))}
      </div>

      {sel && (
        <div className="space-y-3 rounded-lg border border-primary/40 bg-surface-low p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-display text-sm font-bold text-fg">{sel.nome}</div>
              <p className="text-[11px] text-muted">Traga: {sel.precisa}</p>
            </div>
            <button onClick={() => setSel(null)} className="text-muted hover:text-fg" aria-label="Fechar">
              <Icon name="close" className="text-[18px]" />
            </button>
          </div>

          <ol className="flex flex-wrap gap-1.5 text-[11px]">
            {sel.passos.map((p, i) => (
              <li key={p} className="rounded border border-line bg-void/50 px-2 py-1 text-fg-secondary">
                <span className="mr-1 font-mono text-primary-bright">{i + 1}</span>
                {p}
              </li>
            ))}
          </ol>

          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <input
              value={tema}
              onChange={(e) => setTema(e.target.value)}
              placeholder={`Tema — ex.: ${sel.exemploTema}`}
              className="field px-3 py-2 text-sm"
            />
            <div className="flex gap-1">
              {(["9:16", "16:9", "1:1"] as Formato[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormato(f)}
                  className={cn(
                    "rounded border px-3 font-mono text-xs",
                    formato === f ? "border-primary bg-primary text-void" : "border-line text-fg-secondary",
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <input
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Notas opcionais: tom, duração, referência, público…"
              className="field w-full px-3 py-2 text-sm"
            />
            <select value={idiomaId} onChange={(e) => setIdiomaId(e.target.value)} className="field px-3 py-2 text-sm" title="Idioma e mercado do vídeo">
              {IDIOMAS.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.bandeira} {i.nome}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            disabled={tema.trim().length < 3}
            onClick={() => chamarClaude({ pedido: pedidoDoNicho(sel, tema.trim(), formato, notas.trim() || undefined, idiomaPorId(idiomaId)) })}
            className="flex h-10 w-full items-center justify-center gap-2 rounded bg-primary text-sm font-bold text-void disabled:opacity-40 sm:w-auto sm:px-6"
          >
            <Icon name="forum" className="text-[18px]" />
            Começar com o Claude
          </button>
        </div>
      )}
    </section>
  );
}
