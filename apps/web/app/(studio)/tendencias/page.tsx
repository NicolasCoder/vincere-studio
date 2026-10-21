"use client";

import { useCallback, useEffect, useState } from "react";
import { Topbar } from "@/components/Topbar";
import { PageHeader } from "@/components/PageHeader";
import { chamarClaude } from "@/components/ClaudeButton";
import { Icon, cn } from "@vincere-studio/ui";
import { IDIOMAS, idiomaPorId } from "@/lib/idiomas";
import { NICHOS, nichoPorId, pedidoDoNicho } from "@/lib/nichos";

interface Evidencia {
  fonte: string;
  url?: string;
  dado: string;
  data: string;
}
interface Sugestao {
  titulo: string;
  tema: string;
  nicho: string;
  idioma: string;
  mercados: string[];
  porque: string;
  foraDaCaixa?: string;
  evidencias: Evidencia[];
  formato: "9:16" | "16:9" | "1:1";
  ganchos: string[];
  concorrencia: "baixa" | "media" | "alta";
  confianca: number;
}
interface Relatorio {
  id: string;
  criadoEm: string;
  status: "pesquisando" | "pronto" | "erro";
  pedido: { idiomas: string[]; foco?: string; foraDaCaixa: boolean };
  resumo?: string;
  metodologia?: string;
  sugestoes?: Sugestao[];
  erro?: string;
}

const COR_CONCORRENCIA = { baixa: "text-success", media: "text-warning", alta: "text-error" } as const;

export default function TendenciasPage() {
  const [relatorios, setRelatorios] = useState<Relatorio[]>([]);
  const [aberto, setAberto] = useState<string | null>(null);
  const [idiomas, setIdiomas] = useState<string[]>(["pt-BR", "en-US", "es-419"]);
  const [foco, setFoco] = useState("");
  const [foraDaCaixa, setForaDaCaixa] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const r = await fetch("/api/tendencias", { cache: "no-store" }).then((x) => x.json()).catch(() => null);
    if (r?.ok) {
      setRelatorios(r.relatorios);
      setAberto((a) => a ?? r.relatorios.find((x: Relatorio) => x.status === "pronto")?.id ?? null);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const pesquisando = relatorios.some((r) => r.status === "pesquisando");
  useEffect(() => {
    if (!pesquisando) return;
    const id = setInterval(carregar, 15_000);
    return () => clearInterval(id);
  }, [pesquisando, carregar]);

  const pesquisar = async () => {
    setEnviando(true);
    setMsg(null);
    const r = await fetch("/api/tendencias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "pesquisar", idiomas, foco: foco.trim() || undefined, foraDaCaixa }),
    })
      .then((x) => x.json())
      .catch(() => null);
    setEnviando(false);
    if (!r?.ok) return setMsg(r?.error ?? "Não foi possível pedir a pesquisa.");
    setMsg("Pesquisa enviada ao Claude. O resultado aparece aqui (no PC, deixe rodando /loop 1m /vincere-pedidos).");
    carregar();
  };

  const criarVideo = (s: Sugestao) => {
    const nicho = nichoPorId(s.nicho) ?? NICHOS[0];
    chamarClaude({
      pedido: `${pedidoDoNicho(nicho, s.titulo, s.formato, `ângulo: ${s.tema}. Ganchos sugeridos: ${s.ganchos.join(" | ")}`, idiomaPorId(s.idioma))}`,
      anexo: JSON.stringify(s, null, 2),
    });
  };

  const atual = relatorios.find((r) => r.id === aberto);

  return (
    <>
      <Topbar crumbs={["Criar", "Tendências"]} />
      <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
        <PageHeader
          icon="trending_up"
          title="Tendências"
          subtitle="Temas e nichos com dados reais, por idioma e mercado. Cada sugestão vem com a evidência (fonte, número e data) e vira vídeo com um clique."
        />

        <section className="space-y-3 rounded-lg border border-line bg-surface-low p-4">
          <div className="flex flex-wrap gap-2">
            {IDIOMAS.map((i) => {
              const marcado = idiomas.includes(i.id);
              return (
                <button
                  key={i.id}
                  onClick={() => setIdiomas((xs) => (marcado ? xs.filter((x) => x !== i.id) : [...xs, i.id]))}
                  className={cn("rounded-full border px-3 py-1.5 text-xs", marcado ? "border-primary bg-primary/15 text-fg" : "border-line text-muted")}
                >
                  {i.bandeira} {i.nome}
                </button>
              );
            })}
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <input
              value={foco}
              onChange={(e) => setFoco(e.target.value)}
              placeholder="Foco opcional: ex. história de marcas, mistérios do oceano, IA no dia a dia…"
              className="field h-10 px-3 text-sm"
            />
            <label className="flex items-center gap-2 rounded border border-line px-3 text-xs text-fg-secondary">
              <input type="checkbox" checked={foraDaCaixa} onChange={(e) => setForaDaCaixa(e.target.checked)} className="accent-[var(--color-primary)]" />
              Fora da caixa
            </label>
            <button
              onClick={pesquisar}
              disabled={enviando || idiomas.length === 0}
              className="gradient-cta flex h-10 items-center justify-center gap-2 rounded px-5 font-display text-sm font-semibold text-fg disabled:opacity-40"
            >
              <Icon name="travel_explore" className="text-[18px]" />
              {enviando ? "Enviando…" : "Pesquisar agora"}
            </button>
          </div>
          <p className="text-[11px] text-muted">
            Fontes: vidIQ (outliers e buscas em alta do YouTube), busca na web, Reddit e X, notícias. Usa poucos créditos do vidIQ por pesquisa (o plano grátis tem 50 por ciclo).
          </p>
          {msg && <p className="text-xs text-primary-bright">{msg}</p>}
        </section>

        {relatorios.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {relatorios.map((r) => (
              <button
                key={r.id}
                onClick={() => setAberto(r.id)}
                className={cn("rounded border px-2.5 py-1 text-[11px]", aberto === r.id ? "border-primary bg-primary/10 text-fg" : "border-line text-muted")}
              >
                {new Date(r.criadoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} · {r.pedido.idiomas.map((i) => idiomaPorId(i).bandeira).join("")}
                {r.status === "pesquisando" ? " · pesquisando…" : r.status === "erro" ? " · erro" : ` · ${r.sugestoes?.length ?? 0} temas`}
              </button>
            ))}
          </div>
        )}

        {!atual ? (
          <p className="rounded-lg border border-line bg-surface-low p-8 text-center text-sm text-muted">Nenhuma pesquisa ainda. Escolha os idiomas e clique em Pesquisar agora.</p>
        ) : atual.status === "pesquisando" ? (
          <p className="rounded-lg border border-primary/40 bg-primary/5 p-6 text-center text-sm text-primary-bright">Pesquisando com o Claude… esta tela atualiza sozinha.</p>
        ) : atual.status === "erro" ? (
          <p className="rounded-lg border border-error/40 bg-error/10 p-4 text-sm text-error">{atual.erro}</p>
        ) : (
          <section className="space-y-4">
            {atual.resumo && <p className="text-sm leading-relaxed text-fg-secondary">{atual.resumo}</p>}
            <div className="grid gap-4 md:grid-cols-2">
              {atual.sugestoes?.map((s, idx) => (
                <article key={idx} className="flex flex-col gap-3 rounded-lg border border-line bg-surface-low p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[11px] text-muted">
                        {idiomaPorId(s.idioma).bandeira} {s.mercados.join(" · ")} · {nichoPorId(s.nicho)?.nome ?? s.nicho} · {s.formato}
                      </div>
                      <h3 className="mt-1 font-display text-base font-semibold leading-tight text-fg">{s.titulo}</h3>
                    </div>
                    <span className="shrink-0 rounded-full border border-line px-2 py-0.5 font-mono text-[11px] text-fg" title="Confiança na oportunidade">
                      {s.confianca}%
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-fg-secondary">{s.porque}</p>
                  {s.foraDaCaixa && (
                    <p className="text-xs text-primary-bright">
                      <Icon name="lightbulb" className="mr-1 align-[-3px] text-[14px]" />
                      {s.foraDaCaixa}
                    </p>
                  )}
                  <div className="space-y-1">
                    <div className="label-mono text-[9px] text-muted">EVIDÊNCIAS</div>
                    {s.evidencias.map((e, j) => (
                      <div key={j} className="rounded border border-line/70 bg-void/40 p-2 text-[11px]">
                        <span className="font-semibold text-fg">{e.fonte}</span> <span className="text-muted">· {e.data}</span>
                        <div className="text-fg-secondary">{e.dado}</div>
                        {e.url && (
                          <a href={e.url} target="_blank" rel="noreferrer" className="break-all text-primary-bright hover:underline">
                            {e.url}
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                  {s.ganchos.length > 0 && (
                    <ul className="space-y-1 text-[11px] text-fg-secondary">
                      {s.ganchos.map((g) => (
                        <li key={g}>“{g}”</li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-auto flex items-center justify-between gap-2 border-t border-line/60 pt-3 text-[11px]">
                    <span>
                      Concorrência: <span className={COR_CONCORRENCIA[s.concorrencia]}>{s.concorrencia}</span>
                    </span>
                    <span className="flex gap-2">
                      <a
                        href={`/copiloto?tema=${encodeURIComponent(s.titulo)}&nicho=${encodeURIComponent(s.nicho)}&formato=${s.formato === "16:9" ? "LONG_16_9" : "SHORT_9_16"}&angulo=${encodeURIComponent(s.tema ?? "")}&ganchos=${encodeURIComponent(s.ganchos.join("|"))}`}
                        className="rounded bg-primary px-3 py-1.5 font-semibold text-void hover:brightness-110"
                      >
                        Levar ao Copiloto
                      </a>
                      <button onClick={() => criarVideo(s)} className="rounded bg-primary/15 px-3 py-1.5 font-semibold text-primary-bright hover:bg-primary/25">
                        Pedir ao Claude
                      </button>
                    </span>
                  </div>
                </article>
              ))}
            </div>
            {atual.metodologia && (
              <details className="rounded-lg border border-line bg-surface-low p-3 text-xs text-muted">
                <summary className="cursor-pointer">Como esta pesquisa foi feita</summary>
                <p className="mt-2 whitespace-pre-wrap">{atual.metodologia}</p>
              </details>
            )}
          </section>
        )}
      </main>
    </>
  );
}
