"use client";

import { useMemo, useState } from "react";
import { Topbar } from "@/components/Topbar";
import { PageHeader } from "@/components/PageHeader";
import { chamarClaude } from "@/components/ClaudeButton";
import { Icon, cn } from "@vincere-studio/ui";
import { PROMPTS, PROMPT_CATEGORIAS, type PromptItem } from "@/lib/prompt-library";

/** Destaca os trechos entre colchetes: são as partes que você troca no prompt. */
function PromptText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\[[^\]]+\])/g).map((part, i) =>
        part.startsWith("[") ? (
          <mark key={i} className="rounded bg-primary/15 px-0.5 text-primary-bright">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

export default function PromptLibraryPage() {
  const [cat, setCat] = useState<string>("todas");
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<string | null>(null);
  const [zoom, setZoom] = useState<PromptItem | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return PROMPTS.filter(
      (p) =>
        (cat === "todas" || p.categoria === cat) &&
        (!q || `${p.titulo} ${p.tags.join(" ")} ${p.prompt}`.toLowerCase().includes(q)),
    );
  }, [cat, busca]);

  const copiar = (p: PromptItem) => {
    navigator.clipboard?.writeText(p.prompt).catch(() => {});
    setCopiado(p.id);
    setTimeout(() => setCopiado(null), 2000);
  };

  const tipoDe = (p: PromptItem) => PROMPT_CATEGORIAS.find((c) => c.id === p.categoria)?.tipo ?? "imagem";

  const pedir = (p: PromptItem) =>
    chamarClaude({
      pedido:
        tipoDe(p) === "video"
          ? `Use o prompt de vídeo "${p.titulo}" da biblioteca para gerar a cena no /flow-studio (Veo). Me diga qual imagem de partida usar e preencha os campos entre colchetes.`
          : `Use o prompt "${p.titulo}" da biblioteca no /flow-studio (Nano Banana) sobre a imagem que eu indicar. Preencha os campos entre colchetes.`,
      anexo: p.prompt,
    });

  return (
    <>
      <Topbar crumbs={["Gerar com IA", "Biblioteca de prompts"]} />
      <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        <PageHeader
          icon="photo_library"
          title="Biblioteca de prompts"
          subtitle="Prompts testados para imagem e vídeo, cada um com a imagem do resultado. Os trechos em destaque são os que você troca."
        />

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {[{ id: "todas", nome: "Todas" }, ...PROMPT_CATEGORIAS].map((c) => (
              <button
                key={c.id}
                onClick={() => setCat(c.id)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  cat === c.id ? "border-primary bg-primary font-semibold text-void" : "border-line text-fg-secondary hover:text-fg",
                )}
              >
                {c.nome}
                <span className="ml-1.5 opacity-60">
                  {c.id === "todas" ? PROMPTS.length : PROMPTS.filter((p) => p.categoria === c.id).length}
                </span>
              </button>
            ))}
          </div>
          <div className="field flex h-9 w-full items-center gap-2 px-3 lg:w-72">
            <Icon name="search" className="text-[18px] text-muted" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar: close-up, upscale, câmera…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
            />
          </div>
        </div>

        {cat !== "todas" && (
          <p className="text-xs text-muted">{PROMPT_CATEGORIAS.find((c) => c.id === cat)?.descricao}</p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {lista.map((p) => {
            const expandido = aberto === p.id;
            return (
              <article key={p.id} className="flex flex-col overflow-hidden rounded-lg border border-line bg-surface-low">
                <button type="button" onClick={() => setZoom(p)} className="group relative aspect-video overflow-hidden bg-void" title="Ampliar referência">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.imagem} alt={`Referência: ${p.titulo}`} loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  <span className="absolute left-2 top-2 rounded bg-void/80 px-1.5 py-0.5 font-mono text-[10px] text-fg-secondary">
                    {tipoDe(p) === "video" ? "VÍDEO" : "IMAGEM"}
                  </span>
                </button>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <h3 className="font-display text-sm font-semibold text-fg">{p.titulo}</h3>
                  <div className="flex flex-wrap gap-1">
                    {p.tags.map((t) => (
                      <span key={t} className="rounded border border-line px-1.5 py-0.5 text-[10px] text-muted">
                        {t}
                      </span>
                    ))}
                  </div>
                  <p className={cn("whitespace-pre-line text-xs leading-relaxed text-fg-secondary", !expandido && "line-clamp-4")}>
                    <PromptText text={p.prompt} />
                  </p>
                  <button onClick={() => setAberto(expandido ? null : p.id)} className="self-start text-[11px] text-primary-bright hover:underline">
                    {expandido ? "Mostrar menos" : "Ver prompt completo"}
                  </button>
                  <div className="mt-auto flex gap-2 pt-2">
                    <button onClick={() => copiar(p)} className="flex-1 rounded border border-line py-1.5 text-xs text-fg-secondary hover:text-fg">
                      {copiado === p.id ? "Copiado!" : "Copiar prompt"}
                    </button>
                    <button onClick={() => pedir(p)} className="flex-1 rounded bg-primary/15 py-1.5 text-xs font-semibold text-primary-bright hover:bg-primary/25">
                      Pedir ao Claude
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {lista.length === 0 && <p className="py-10 text-center text-sm text-muted">Nenhum prompt encontrado.</p>}
      </main>

      {zoom && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-void/90 p-4 backdrop-blur-sm" onClick={() => setZoom(null)}>
          <figure className="max-h-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={zoom.imagem} alt={zoom.titulo} className="max-h-[80vh] w-auto rounded-lg border border-line" />
            <figcaption className="mt-2 flex items-center justify-between text-sm text-fg">
              {zoom.titulo}
              <button onClick={() => setZoom(null)} className="text-muted hover:text-fg">
                Fechar
              </button>
            </figcaption>
          </figure>
        </div>
      )}
    </>
  );
}
