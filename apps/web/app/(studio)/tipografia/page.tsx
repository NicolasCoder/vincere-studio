"use client";

import { useEffect, useMemo, useState } from "react";
import { Topbar } from "@/components/Topbar";
import { PageHeader } from "@/components/PageHeader";
import { chamarClaude, HF_PROJECT_KEY } from "@/components/ClaudeButton";
import { Icon, cn } from "@vincere-studio/ui";
import { NICHOS } from "@/lib/nichos";
import { PARES, trechoParaHyperframes, urlGoogleFonts, type ParTipografico } from "@/lib/tipografia";

/** Carrega do Google Fonts só as letras usadas na prévia (subset via &text=). */
function useFontesDaPrevia(pares: ParTipografico[], textoExtra: string) {
  useEffect(() => {
    const links = pares.flatMap((p) => {
      const texto = `${p.exemplo.titulo}${p.exemplo.apoio}${textoExtra}${p.exemplo.titulo.toLowerCase()}${p.exemplo.titulo.toUpperCase()}`;
      // urlGoogleFonts pode devolver duas URLs (subset + fonte da interface completa).
      return urlGoogleFonts(p.fontes, texto)
        .split(" ")
        .map((href: string) => {
          const el = document.createElement("link");
          el.rel = "stylesheet";
          el.href = href;
          document.head.appendChild(el);
          return el;
        });
    });
    return () => links.forEach((l) => l.remove());
  }, [pares, textoExtra]);
}

export default function TipografiaPage() {
  const [nicho, setNicho] = useState("todos");
  const [textoTeste, setTextoTeste] = useState("");
  const [copiado, setCopiado] = useState<string | null>(null);

  const lista = useMemo(() => (nicho === "todos" ? PARES : PARES.filter((p) => p.nichos.includes(nicho))), [nicho]);
  // Atraso curto para não recarregar fontes a cada tecla.
  const [textoFontes, setTextoFontes] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setTextoFontes(textoTeste), 400);
    return () => clearTimeout(id);
  }, [textoTeste]);
  useFontesDaPrevia(lista, textoFontes);

  const copiar = (p: ParTipografico) => {
    navigator.clipboard?.writeText(trechoParaHyperframes(p)).catch(() => {});
    setCopiado(p.id);
    setTimeout(() => setCopiado(null), 2000);
  };

  const aplicar = (p: ParTipografico) => {
    let projeto = "";
    try {
      projeto = localStorage.getItem(HF_PROJECT_KEY) ?? "";
    } catch {}
    const [a, b] = p.fontes;
    chamarClaude({
      pedido: `Aplique a combinação tipográfica "${p.nome}" no projeto HyperFrames${projeto ? ` ${projeto}` : ""}: ${a.familia} (${a.papel}, pesos ${a.pesos.join("/")}) e ${b.familia} (${b.papel}, pesos ${b.pesos.join("/")}), acento ${p.cores.acento}. Siga hyperframes-creative/typography (tamanhos de vídeo, tracking -0.03em nos títulos) e rode o check.`,
      anexo: trechoParaHyperframes(p),
    });
  };

  return (
    <>
      <Topbar crumbs={["Biblioteca", "Tipografia"]} />
      <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        <PageHeader
          icon="text_fields"
          title="Tipografia"
          subtitle="Combinações de fontes do Google testadas para vídeo, por nicho. Cada par explica por que funciona e já vem pronto para o HyperFrames."
        />

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {[{ id: "todos", nome: "Todos" }, ...NICHOS].map((n) => (
              <button
                key={n.id}
                onClick={() => setNicho(n.id)}
                className={cn("rounded-full border px-3 py-1 text-xs", nicho === n.id ? "border-primary bg-primary font-semibold text-void" : "border-line text-fg-secondary hover:text-fg")}
              >
                {n.nome}
              </button>
            ))}
          </div>
          <input
            value={textoTeste}
            onChange={(e) => setTextoTeste(e.target.value)}
            placeholder="Teste com o seu título…"
            className="field h-9 w-full px-3 text-sm lg:w-72"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {lista.map((p) => {
            const [titulo, apoio] = [p.fontes.find((f) => f.papel === "título") ?? p.fontes[0], p.fontes.find((f) => f.papel !== "título") ?? p.fontes[1]];
            return (
              <article key={p.id} className="flex flex-col overflow-hidden rounded-lg border border-line bg-surface-low">
                <div className="flex aspect-[4/3] flex-col justify-center gap-2 overflow-hidden p-5 [container-type:inline-size]" style={{ background: p.cores.fundo, color: p.cores.texto }}>
                  <div
                    className="leading-[0.95] [overflow-wrap:anywhere]"
                    style={{
                      fontFamily: `"${titulo.familia}", sans-serif`,
                      fontWeight: Math.max(...titulo.pesos),
                      // Encolhe com o tamanho do texto para a palavra caber inteira, sem quebrar no meio.
                      // Tamanho pela largura do cartão (cqw): ~1,2 largura / nº de letras cabe até nas fontes largas.
                      fontSize: `clamp(1.2rem, ${(120 / Math.max(6, (textoTeste || p.exemplo.titulo).length)).toFixed(1)}cqw, 3.1rem)`,
                      letterSpacing: "-0.03em",
                    }}
                  >
                    {textoTeste || p.exemplo.titulo}
                  </div>
                  <div style={{ fontFamily: `"${apoio.familia}", serif`, fontWeight: Math.min(...apoio.pesos), fontSize: "1rem", color: p.cores.acento }}>{p.exemplo.apoio}</div>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <h3 className="font-display text-sm font-semibold text-fg">{p.nome}</h3>
                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    {p.fontes.map((f) => (
                      <span key={f.familia} className="rounded border border-line px-1.5 py-0.5 text-fg-secondary" title={f.embutida ? "Embutida no HyperFrames: renderiza offline" : "Baixada do Google Fonts no render"}>
                        {f.familia} <span className="text-muted">· {f.papel} · {f.pesos.join("/")}</span>
                        {f.embutida && <Icon name="offline_pin" className="ml-1 align-[-3px] text-[13px] text-success" />}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs leading-relaxed text-muted">{p.porque}</p>
                  <div className="mt-auto flex gap-2 pt-2">
                    <button onClick={() => copiar(p)} className="flex-1 rounded border border-line py-1.5 text-xs text-fg-secondary hover:text-fg">
                      {copiado === p.id ? "Copiado!" : "Copiar CSS"}
                    </button>
                    <button onClick={() => aplicar(p)} className="flex-1 rounded bg-primary/15 py-1.5 text-xs font-semibold text-primary-bright hover:bg-primary/25">
                      Aplicar no projeto
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <p className="text-[11px] text-muted">
          <Icon name="offline_pin" className="mr-1 align-[-3px] text-[13px] text-success" />
          Fonte embutida no HyperFrames (renderiza offline). As demais são baixadas do Google Fonts no momento do render.
        </p>
      </main>
    </>
  );
}
