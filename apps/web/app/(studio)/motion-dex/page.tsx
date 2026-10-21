"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, Icon } from "@vincere-studio/ui";
import { Topbar } from "@/components/Topbar";
import { PageHeader } from "@/components/PageHeader";
import { chamarClaude } from "@/components/ClaudeButton";

interface MotionEntry {
  dexNumber: string;
  id: string;
  title: string;
  category: "Sharingan Clone" | "UI Micro-Motion" | "Kinetic Typography" | "Editorial VSL";
  rarity: "Lendário (Step=1 1:1)" | "Épico (Multi-Pass)" | "Raro (Beat-Locked)";
  description: string;
  fps: number;
  aspect: string;
  shotsCount: number;
  aslS: number;
  bpm: number;
  dominantCamera: string;
  look: string;
  previewImageUrl?: string;
  previewVideoUrl?: string;
  stageUrl?: string;
  tags: string[];
}

const DEFAULT_MOTION_DEX: MotionEntry[] = [
  {
    dexNumber: "#001",
    id: "referenciamotion",
    title: "Apple / macOS / Discord UI Micro-Animations",
    category: "UI Micro-Motion",
    rarity: "Lendário (Step=1 1:1)",
    description:
      "Coreografia cirúrgica de UI cards, cursores, dock macOS, contadores e transições elásticas GSAP extraídas em 328 frames 1:1 na RTX 3060.",
    fps: 30,
    aspect: "9:16",
    shotsCount: 7,
    aslS: 1.56,
    bpm: 117.5,
    dominantCamera: "truck-right + push-in contínuo",
    look: "High-Contrast Dark + Warm Vibrant",
    tags: ["GSAP 3.12", "macOS Dock", "UI Cards", "Cursor Physics", "Step=1 Forense"],
  },
  {
    dexNumber: "#002",
    id: "reels_imobiliario",
    title: "Reels Imobiliário 3-Atos (104 BPM Beat-Locked)",
    category: "Sharingan Clone",
    rarity: "Épico (Multi-Pass)",
    description:
      "Análise de 439 frames via Qwen2.5-VL-7B + grid rítmico de 104 BPM + staging virtual 3D e tipografia arquitetônica de luxo.",
    fps: 30,
    aspect: "9:16",
    shotsCount: 16,
    aslS: 2.1,
    bpm: 104,
    dominantCamera: "truck-right + push-in (1.8 %W/s)",
    look: "Kodak Portra 400",
    tags: ["104 BPM", "Luxury Real Estate", "3-Act Structure", "Veo 3.1 Staging"],
  },
  {
    dexNumber: "#003",
    id: "estilo222",
    title: "Estilo 222 — 110-Edit Kinetic Talking Head",
    category: "Kinetic Typography",
    rarity: "Épico (Multi-Pass)",
    description:
      "Talking Head de altíssima retenção com 110 micro-edições, punch-ins sincronizados (≥ 8%), Lockups tipográficos com brilho e B-roll mascarando cortes.",
    fps: 30,
    aspect: "9:16",
    shotsCount: 18,
    aslS: 1.9,
    bpm: 112,
    dominantCamera: "punch_in + jump_in",
    look: "Apple Sungazing",
    tags: ["Lockup Kinetic", "110 Micro-Edits", "Splice Masking", "High Retention"],
  },
  {
    dexNumber: "#004",
    id: "g4_valley",
    title: "G4 Valley VSL — Editorial Business Authority",
    category: "Editorial VSL",
    rarity: "Raro (Beat-Locked)",
    description:
      "Estrutura VSL executiva com cards de métricas animados, lower thirds de autoridade, contraste Kodak 2383 e cortes secos na batida.",
    fps: 30,
    aspect: "9:16",
    shotsCount: 14,
    aslS: 2.4,
    bpm: 105,
    dominantCamera: "push_slow + hold",
    look: "Kodak 2383",
    tags: ["Executive VSL", "Data Cards", "Lower Thirds", "Kodak 2383"],
  },
  {
    dexNumber: "#005",
    id: "dossie_investigativo",
    title: "Dossiê Investigativo — Mesa de Arquivo & Carimbos",
    category: "Editorial VSL",
    rarity: "Épico (Multi-Pass)",
    description:
      "Textura de papel antigo, recortes de jornal com destaque marcador amarelo, fotos polaroid emolduradas e legenda monoespaçada.",
    fps: 60,
    aspect: "9:16",
    shotsCount: 12,
    aslS: 2.2,
    bpm: 98,
    dominantCamera: "ken-burns + parallax-soft",
    look: "Archival Noir",
    tags: ["Paper Texture", "Redacted Stamp", "Newspaper Highlight", "DVP"],
  },
  {
    dexNumber: "#006",
    id: "lockup_shine_pack",
    title: "Lockup Kinetic Shine — Encaixe Geométrico Anti-Pisca",
    category: "Kinetic Typography",
    rarity: "Lendário (Step=1 1:1)",
    description:
      "Palavras de apoio encaixadas geometricamente nos vãos das ascendentes/descendentes da palavra principal (weight 900) com varredura .shine.",
    fps: 60,
    aspect: "9:16",
    shotsCount: 20,
    aslS: 1.4,
    bpm: 120,
    dominantCamera: "punch-zoom + micro-shake",
    look: "Neon Contrast",
    tags: ["Subtitles Studio", "Anti-Flicker", "Shine Sweep", "Geometric Lockup"],
  },
];

export default function MotionDexPage() {
  const [entries, setEntries] = useState<MotionEntry[]>(DEFAULT_MOTION_DEX);
  const [selected, setSelected] = useState<MotionEntry>(DEFAULT_MOTION_DEX[0]);
  const [filterCat, setFilterCat] = useState<string>("TODOS");
  const [search, setSearch] = useState<string>("");
  const [inspectionMedia, setInspectionMedia] = useState<{
    videoUrl?: string;
    stageUrl?: string;
    sheetUrl?: string;
  }>({});

  useEffect(() => {
    const loadPresetMedia = async () => {
      try {
        const res = await fetch(`/api/sharingan?presetId=${encodeURIComponent(selected.id)}`);
        const d = await res.json();
        if (d.ok && d.activeInspection) {
          const insp = d.activeInspection;
          const compVideo =
            insp.videos?.find((v: any) => v.id?.startsWith("comp_")) ?? insp.videos?.[0];
          const stage = insp.htmlStages?.[0];
          const sheet = insp.sheets?.[0] ?? insp.griddedFrames?.[0];
          setInspectionMedia({
            videoUrl: compVideo?.url,
            stageUrl: stage?.url,
            sheetUrl: sheet?.url,
          });
        } else {
          setInspectionMedia({});
        }
      } catch {
        setInspectionMedia({});
      }
    };
    loadPresetMedia();
  }, [selected.id]);

  // Também carrega clones salvos pelo usuário para adicionar à MotionDex
  useEffect(() => {
    fetch("/api/sharingan")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && Array.isArray(d.savedClones) && d.savedClones.length > 0) {
          const customEntries: MotionEntry[] = d.savedClones.map((c: any, idx: number) => ({
            dexNumber: `#${String(DEFAULT_MOTION_DEX.length + idx + 1).padStart(3, "0")}`,
            id: c.cloneName,
            title: c.cloneName,
            category: "Sharingan Clone",
            rarity: "Épico (Multi-Pass)",
            description: c.userTopic || "Motion clonado via Video-Sharingan na GPU Local.",
            fps: 30,
            aspect: "9:16",
            shotsCount: 8,
            aslS: 1.8,
            bpm: 110,
            dominantCamera: "push-in contínuo",
            look: "Custom Clone",
            tags: ["Clone Salvo", c.effectiveEngine || "LOCAL_GPU"],
          }));
          setEntries([...DEFAULT_MOTION_DEX, ...customEntries]);
        }
      })
      .catch(() => {});
  }, []);

  const filtered = entries.filter((e) => {
    const matchesCat = filterCat === "TODOS" || e.category === filterCat;
    const matchesSearch =
      !search.trim() ||
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.description.toLowerCase().includes(search.toLowerCase()) ||
      e.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  return (
    <>
      <Topbar crumbs={["MotionDex", "Coleção de Motions & Estilos"]} />
      <main className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
        <PageHeader
          icon="auto_awesome_motion"
          title={
            <span className="flex flex-wrap items-center gap-2.5">
              <span>MotionDex — Enciclopédia de Motions Clonados</span>
              <Badge tone="violet">{entries.length} Motions Registrados</Badge>
            </span>
          }
          subtitle="Sua 'Pokédex' de Motion Graphics, ritmos de corte e coreografias de câmera capturadas com o Sharingan. Escolha qualquer Motion abaixo para pré-visualizar ou aplicar direto no seu próximo vídeo."
          right={
            <div className="flex items-center gap-2">
              <Link href="/sharingan">
                <Button variant="primary" size="sm" icon="visibility">
                  Capturar Novo Motion (Sharingan)
                </Button>
              </Link>
            </div>
          }
        />

        {/* Barra de Filtro & Busca da MotionDex */}
        <Card className="p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {["TODOS", "UI Micro-Motion", "Sharingan Clone", "Kinetic Typography", "Editorial VSL"].map(
              (cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFilterCat(cat)}
                  className={`rounded-lg px-3 py-1.5 font-mono text-xs transition-all ${
                    filterCat === cat
                      ? "bg-primary text-void font-bold"
                      : "bg-void/60 text-fg-secondary hover:text-fg border border-line"
                  }`}
                >
                  {cat}
                </button>
              ),
            )}
          </div>
          <div className="relative sm:w-72">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, tag, BPM, look..."
              className="field w-full px-3 py-1.5 text-xs"
            />
          </div>
        </Card>

        {/* Grid Principal: Lista da MotionDex (Esquerda) + Card Detalhado Estilo Pokédex (Direita) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Lista de Cards Numerados (#001, #002...) */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3 self-start">
            {filtered.map((item) => {
              const active = selected.id === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelected(item)}
                  className={`flex flex-col justify-between rounded-xl border p-4 text-left transition-all ${
                    active
                      ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                      : "border-line bg-surface-low hover:border-primary/40"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded bg-void/90 px-2 py-0.5 font-mono text-xs font-bold text-primary-bright border border-primary/30">
                        {item.dexNumber}
                      </span>
                      <Badge
                        tone={
                          item.rarity.startsWith("Lendário")
                            ? "violet"
                            : item.rarity.startsWith("Épico")
                              ? "cyan"
                              : "success"
                        }
                      >
                        {item.rarity}
                      </Badge>
                    </div>
                    <div className="font-display text-sm font-bold text-fg leading-snug">
                      {item.title}
                    </div>
                    <p className="text-[11px] text-muted line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-line/60 space-y-2">
                    <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] text-primary-bright">
                      <span>{item.aspect}</span>
                      <span>·</span>
                      <span>{item.fps}fps</span>
                      <span>·</span>
                      <span>ASL {item.aslS}s</span>
                      <span>·</span>
                      <span>{item.bpm} BPM</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {item.tags.slice(0, 3).map((t) => (
                        <span
                          key={t}
                          className="rounded bg-void/70 px-1.5 py-0.5 font-mono text-[9px] text-fg-secondary border border-line/60"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Inspetor Detalhado da MotionDex (Direita) */}
          <div className="lg:col-span-5">
            <Card className="p-5 space-y-4 sticky top-6" accent="dual">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-primary px-2.5 py-1 font-mono text-xs font-bold text-void">
                    {selected.dexNumber}
                  </span>
                  <span className="font-mono text-xs text-muted uppercase">{selected.category}</span>
                </div>
                <Badge tone="violet">{selected.rarity}</Badge>
              </div>

              <div>
                <h3 className="font-display text-base font-bold text-fg">{selected.title}</h3>
                <p className="text-xs text-muted mt-1 leading-relaxed">{selected.description}</p>
              </div>

              {/* Preview de Vídeo ou Palco GSAP ou Sheet */}
              {inspectionMedia.videoUrl ? (
                <div className="rounded-lg border border-line bg-black overflow-hidden flex justify-center">
                  <video
                    key={inspectionMedia.videoUrl}
                    src={inspectionMedia.videoUrl}
                    controls
                    loop
                    className="max-h-72 w-auto"
                  />
                </div>
              ) : inspectionMedia.sheetUrl ? (
                <div className="rounded-lg border border-line bg-black overflow-hidden flex justify-center">
                  <img
                    src={inspectionMedia.sheetUrl}
                    alt={selected.title}
                    className="max-h-64 object-contain"
                  />
                </div>
              ) : (
                <div className="rounded-lg border border-line bg-void/70 p-6 text-center space-y-2">
                  <Icon name="auto_awesome_motion" className="text-[28px] text-primary-bright mx-auto" />
                  <div className="text-xs text-fg font-semibold">DNA de Motion Registrado</div>
                  <div className="text-[11px] text-muted">
                    Pronto para ser aplicado em qualquer roteiro pelo Agente ou no HyperFrames Studio.
                  </div>
                </div>
              )}

              {/* Atributos Técnicos (Stats da Pokédex) */}
              <div className="grid grid-cols-2 gap-2.5 rounded-lg border border-line bg-void/60 p-3 font-mono text-xs">
                <div>
                  <div className="text-[10px] text-muted">CÂMERA DOMINANTE</div>
                  <div className="text-fg font-bold truncate">{selected.dominantCamera}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted">RITMO & BATIDA</div>
                  <div className="text-primary-bright font-bold">
                    {selected.bpm} BPM · ASL {selected.aslS}s
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-muted">COLOR LOOK</div>
                  <div className="text-fg font-bold truncate">{selected.look}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted">FORMATO & CORTES</div>
                  <div className="text-fg font-bold">
                    {selected.aspect} @ {selected.fps}fps ({selected.shotsCount} shots)
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {selected.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary-bright"
                  >
                    #{t}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <Button
                  variant="primary"
                  icon="bolt"
                  onClick={() =>
                    chamarClaude({
                      pedido: `Usar o Motion ${selected.dexNumber} "${selected.title}" (${selected.dominantCamera}, ${selected.bpm} BPM, ASL ${selected.aslS}s, look ${selected.look}) da MotionDex para montar um novo vídeo.`,
                    })
                  }
                >
                  Usar Motion com Agente
                </Button>
                <Link href={`/workflow?motion=${encodeURIComponent(selected.id)}`}>
                  <Button variant="secondary" className="w-full" icon="account_tree">
                    Abrir no Fluxo Nodal
                  </Button>
                </Link>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}
