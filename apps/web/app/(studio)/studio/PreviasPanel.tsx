"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon, cn } from "@vincere-studio/ui";
import { chamarClaude } from "@/components/ClaudeButton";

interface Previa {
  arquivo: string;
  url: string;
  criadaEm: string;
  tamanhoMB: number;
  decisao: { decisao: "aprovado" | "ajustes"; nota?: string; em: string } | null;
}

/**
 * Prévias leves (render rascunho, 960px) que o scripts/hf.ps1 envia do PC. Dá para assistir e
 * aprovar pelo celular; a decisão vira pedido para o Claude (render final ou ajustes).
 */
export function PreviasPanel({ projeto }: { projeto: string }) {
  const [previas, setPrevias] = useState<Previa[]>([]);
  const [aberta, setAberta] = useState<string | null>(null);
  const [nota, setNota] = useState("");
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async () => {
    const r = await fetch(`/api/hyperframes?action=previas&projeto=${encodeURIComponent(projeto)}`, { cache: "no-store" })
      .then((x) => x.json())
      .catch(() => null);
    if (r?.ok) {
      setPrevias(r.previas);
      setAberta((a) => a ?? r.previas[0]?.arquivo ?? null);
    }
  }, [projeto]);

  useEffect(() => {
    setPrevias([]);
    setAberta(null);
    carregar();
    const id = setInterval(carregar, 30_000);
    return () => clearInterval(id);
  }, [carregar]);

  const decidir = async (arquivo: string, decisao: "aprovado" | "ajustes") => {
    setEnviando(true);
    await fetch("/api/hyperframes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "decidir", projeto, arquivo, decisao, nota }),
    }).catch(() => null);
    setEnviando(false);
    setNota("");
    carregar();
  };

  const pedirPrevia = () =>
    chamarClaude({
      pedido: `Gere uma prévia rápida do projeto ${projeto} para eu aprovar: powershell -File "G:\\Meu Drive\\Vincere Studio\\scripts\\hf.ps1" previa -Projeto ${projeto}`,
    });

  const atual = previas.find((p) => p.arquivo === aberta);

  return (
    <details className="group rounded-lg border border-line bg-surface-low" open={previas.length > 0}>
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-4 py-2.5 text-sm">
        <Icon name="slow_motion_video" className="text-[18px] text-primary-bright" />
        <span className="font-display font-semibold text-fg">Prévias para aprovar</span>
        <span className="font-mono text-xs text-muted">{previas.length}</span>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            pedirPrevia();
          }}
          className="ml-auto rounded border border-line px-2.5 py-1 text-[11px] text-fg-secondary hover:border-primary/50 hover:text-fg"
        >
          Gerar prévia rápida
        </button>
        <Icon name="expand_more" className="text-[18px] text-muted transition-transform group-open:rotate-180" />
      </summary>

      <div className="px-4 pb-4">
        {previas.length === 0 ? (
          <p className="text-xs text-muted">
            Nenhuma prévia ainda. Clique em <strong className="text-fg">Gerar prévia rápida</strong>: o Claude renderiza um rascunho leve no PC e ele aparece aqui para você assistir (inclusive no celular).
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-[minmax(0,260px)_1fr]">
            <div className="mx-auto w-full max-w-[260px]">
              {atual && <video key={atual.url} src={atual.url} controls playsInline className="aspect-[9/16] w-full rounded-lg border border-line bg-void object-contain" />}
            </div>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {previas.map((p) => (
                  <button
                    key={p.arquivo}
                    onClick={() => setAberta(p.arquivo)}
                    className={cn("rounded border px-2 py-1 text-left text-[11px]", aberta === p.arquivo ? "border-primary bg-primary/10 text-fg" : "border-line text-muted")}
                  >
                    {new Date(p.criadaEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} · {p.tamanhoMB} MB
                    {p.decisao && <span className={cn("ml-1", p.decisao.decisao === "aprovado" ? "text-success" : "text-warning")}>· {p.decisao.decisao}</span>}
                  </button>
                ))}
              </div>
              {atual?.decisao ? (
                <p className={cn("rounded border p-2 text-xs", atual.decisao.decisao === "aprovado" ? "border-success/40 text-success" : "border-warning/40 text-warning")}>
                  {atual.decisao.decisao === "aprovado" ? "Aprovada — o Claude faz o render final." : `Ajustes pedidos: ${atual.decisao.nota ?? ""}`}
                </p>
              ) : (
                atual && (
                  <>
                    <textarea
                      value={nota}
                      onChange={(e) => setNota(e.target.value)}
                      rows={3}
                      placeholder='Ajustes (opcional): "aos 0:42 o título some rápido demais; legenda mais alta"'
                      className="field w-full p-2.5 text-sm"
                    />
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        onClick={() => decidir(atual.arquivo, "aprovado")}
                        disabled={enviando}
                        className="flex h-10 flex-1 items-center justify-center gap-2 rounded bg-success/20 text-sm font-semibold text-success hover:bg-success/30 disabled:opacity-40"
                      >
                        <Icon name="task_alt" className="text-[18px]" />
                        Aprovar e renderizar
                      </button>
                      <button
                        onClick={() => decidir(atual.arquivo, "ajustes")}
                        disabled={enviando || nota.trim().length < 3}
                        className="flex h-10 flex-1 items-center justify-center gap-2 rounded border border-warning/50 text-sm font-semibold text-warning hover:bg-warning/10 disabled:opacity-40"
                      >
                        <Icon name="edit_note" className="text-[18px]" />
                        Pedir ajustes
                      </button>
                    </div>
                  </>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </details>
  );
}
