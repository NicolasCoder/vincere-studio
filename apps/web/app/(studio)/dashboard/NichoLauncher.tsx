"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Badge, Icon, cn } from "@vincere-studio/ui";
import { chamarClaude } from "@/components/ClaudeButton";
import { NICHOS, pedidoDoNicho, type Formato, type Nicho } from "@/lib/nichos";
import { IDIOMAS, idiomaPorId } from "@/lib/idiomas";

const FORMATOS_OPCOES: {
  id: Formato;
  titulo: string;
  subtitulo: string;
  icone: string;
  tag: string;
}[] = [
  {
    id: "9:16",
    titulo: "Vertical (9:16)",
    subtitulo: "Reels, TikTok, Shorts, Cortes Dinâmicos e UGC",
    icone: "stay_current_portrait",
    tag: "Mais usado",
  },
  {
    id: "16:9",
    titulo: "Horizontal (16:9)",
    subtitulo: "YouTube Longo, Documentário, VSL e Cinema",
    icone: "stay_current_landscape",
    tag: "YouTube / VSL",
  },
  {
    id: "1:1",
    titulo: "Quadrado (1:1)",
    subtitulo: "Carrossel Animado, Post de Feed e Criativo Ads",
    icone: "crop_square",
    tag: "Feed / Ads",
  },
];

export function NichoLauncher() {
  const [formato, setFormato] = useState<Formato>("9:16");
  const [sel, setSel] = useState<Nicho | null>(NICHOS[0] ?? null);
  const [tema, setTema] = useState("");
  const [notas, setNotas] = useState("");
  const [idiomaId, setIdiomaId] = useState("pt-BR");
  const carouselRef = useRef<HTMLDivElement | null>(null);

  const escolherEstilo = (n: Nicho) => {
    setSel(n);
  };

  const scrollCarousel = (dir: "left" | "right") => {
    if (!carouselRef.current) return;
    carouselRef.current.scrollBy({
      left: dir === "left" ? -320 : 320,
      behavior: "smooth",
    });
  };

  return (
    <section className="space-y-5 rounded-2xl border border-white/[0.07] bg-surface-low/60 backdrop-blur-xl p-5 sm:p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight text-fg">O que vamos criar hoje?</h2>
          <p className="text-xs text-muted mt-0.5">
            Escolha a proporção e o estilo visual para iniciar com o Agente ou abrir no fluxo de nodes.
          </p>
        </div>
        <Link
          href={`/workflow?formato=${encodeURIComponent(formato)}&estilo=${encodeURIComponent(sel?.id ?? "motion")}`}
          className="apple-press inline-flex items-center gap-1.5 rounded-lg border border-white/[0.09] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-fg-secondary hover:border-white/[0.18] hover:bg-white/[0.07] hover:text-fg self-start"
        >
          <Icon name="account_tree" className="text-[15px] text-primary-bright" />
          <span>Abrir em Nodes</span>
        </Link>
      </div>

      {/* 1. Escolha o Formato (Vertical, Horizontal, Quadrado) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {FORMATOS_OPCOES.map((f) => {
          const ativo = formato === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFormato(f.id)}
              className={cn(
                "apple-press flex items-center gap-3 rounded-xl border p-3.5 text-left overflow-hidden",
                ativo
                  ? "border-primary/60 bg-primary/[0.11] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]"
                  : "border-white/[0.06] bg-void/40 hover:border-white/[0.14] hover:bg-void/60",
              )}
            >
              <span
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-lg transition-colors",
                  ativo
                    ? "bg-primary text-fg shadow-sm"
                    : "bg-white/[0.05] text-fg-secondary",
                )}
              >
                <Icon name={f.icone} className="text-[18px]" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-[13px] font-semibold text-fg truncate">{f.titulo}</span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                      ativo ? "bg-primary/20 text-primary-bright" : "bg-white/[0.05] text-muted",
                    )}
                  >
                    {f.tag}
                  </span>
                </div>
                <p className="truncate text-[11px] text-muted mt-0.5">{f.subtitulo}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* 2. Estilo de vídeo (Carrossel limpo, cards largos e títulos em até 2 linhas sem vazamento) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-fg-secondary tracking-tight">
            Estilo de vídeo
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => scrollCarousel("left")}
              className="apple-press grid size-7 place-items-center rounded-lg border border-white/[0.07] bg-void/50 text-fg-secondary hover:border-white/[0.16] hover:text-fg"
              aria-label="Anterior"
            >
              <Icon name="chevron_left" className="text-[16px]" />
            </button>
            <button
              type="button"
              onClick={() => scrollCarousel("right")}
              className="apple-press grid size-7 place-items-center rounded-lg border border-white/[0.07] bg-void/50 text-fg-secondary hover:border-white/[0.16] hover:text-fg"
              aria-label="Próximo"
            >
              <Icon name="chevron_right" className="text-[16px]" />
            </button>
          </div>
        </div>

        <div
          ref={carouselRef}
          className="flex gap-3 overflow-x-auto pb-2 pt-0.5 scrollbar-thin"
        >
          {NICHOS.map((n) => {
            const ativo = sel?.id === n.id;
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => escolherEstilo(n)}
                className={cn(
                  "apple-press flex w-64 sm:w-72 shrink-0 flex-col justify-between gap-2 rounded-xl border p-3.5 text-left overflow-hidden",
                  ativo
                    ? "border-primary/60 bg-primary/[0.11] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]"
                    : "border-white/[0.06] bg-void/40 hover:border-white/[0.14] hover:bg-void/60",
                )}
              >
                <div className="flex items-start gap-2.5 min-w-0 w-full">
                  <span
                    className={cn(
                      "mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg",
                      ativo ? "bg-primary/20 text-primary-bright" : "bg-white/[0.05] text-fg-secondary",
                    )}
                  >
                    <Icon name={n.icone} className="text-[16px]" />
                  </span>
                  <span className="min-w-0 flex-1 font-display text-[13px] font-semibold leading-snug text-fg line-clamp-2 break-words">
                    {n.nome}
                  </span>
                </div>
                <p className="line-clamp-2 text-[11px] leading-relaxed text-muted w-full">
                  {n.resumo}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Barra Minimalista de Comando */}
      {sel && (
        <div className="space-y-3 rounded-xl border border-white/[0.07] bg-void/50 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <Badge tone="cyan">{formato}</Badge>
              <span className="font-display font-semibold text-fg truncate">{sel.nome}</span>
              <span className="text-muted hidden md:inline truncate">· {sel.precisa}</span>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-[1.2fr_1fr_auto_auto]">
            <input
              value={tema}
              onChange={(e) => setTema(e.target.value)}
              placeholder={`Tema do vídeo (ex.: ${sel.exemploTema})`}
              className="field h-9 px-3 text-xs"
            />
            <input
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Notas opcionais (tom, duração, referência)..."
              className="field h-9 px-3 text-xs"
            />
            <select
              value={idiomaId}
              onChange={(e) => setIdiomaId(e.target.value)}
              className="field h-9 px-2.5 text-xs"
              title="Idioma do vídeo"
            >
              {IDIOMAS.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.bandeira} {i.nome}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={tema.trim().length < 3}
              onClick={() =>
                chamarClaude({
                  pedido: pedidoDoNicho(
                    sel,
                    tema.trim(),
                    formato,
                    notas.trim() || undefined,
                    idiomaPorId(idiomaId),
                  ),
                })
              }
              className="apple-press inline-flex h-9 items-center justify-center gap-1.5 rounded-lg gradient-cta px-4 text-xs font-semibold text-fg shadow-glow-cta hover:brightness-110 disabled:opacity-40 disabled:pointer-events-none"
            >
              <Icon name="arrow_upward" className="text-[15px]" />
              <span>Criar</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
