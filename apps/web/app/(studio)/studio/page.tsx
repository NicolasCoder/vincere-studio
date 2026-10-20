"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button, Card, Icon } from "@vincere-studio/ui";
import { chamarClaude, HF_PROJECT_KEY } from "@/components/ClaudeButton";

const PROFILES = [
  { id: "1", tipo: "Curto Vertical (Estilo Igor)", largura: 1080, altura: 1920, rota: "/general-video", estilo: "igor", skill: "/editar-igor", desc: "Shorts dinâmicos de alta retenção para Reels/TikTok" },
  { id: "4", tipo: "Documentário Narrado (Dossiê)", largura: 1080, altura: 1920, rota: "/faceless-explainer", estilo: "documentario", skill: "/editar-documentario-narrado", desc: "Histórias, marcas e investigações (estilo Nike/True Crime)" },
  { id: "5", tipo: "Corte de Desenho / Filme / Anime", largura: 1080, altura: 1920, rota: "/embedded-captions", estilo: "legenda", skill: "/caosanimado-video-pipeline", desc: "Cortes acelerados com legendas cinéticas e SFX" },
  { id: "6", tipo: "Reel de Oferta / Comercial", largura: 1080, altura: 1920, rota: "/general-video", estilo: "oferta", skill: "/reel-de-oferta", desc: "Anúncios para produtos gerados no Flow ou e-commerce" },
  { id: "2", tipo: "Longo Horizontal (YouTube)", largura: 1920, altura: 1080, rota: "/general-video", estilo: "profissional", skill: "/anthropic-skills:edicao-profissional", desc: "Documentários e ensaios em 16:9 cinema" },
  { id: "3", tipo: "Motion Graphic Puro", largura: 1920, altura: 1080, rota: "/motion-graphics", estilo: "motion", skill: "/motion-aplicar-da-biblioteca", desc: "Intros de marca, tipografia animada e lower-thirds" },
];

const MOTIONS_CATALOG = [
  { name: "abertura-impacto", tag: "Gancho", desc: "Palavra batendo sobre grade técnica com corte de lâmina", cue: "[motion: abertura-impacto @0.2 TEXTO]" },
  { name: "revelacao-titulo", tag: "Título", desc: "Flare de luz cruza a tela e revela o título com light leak", cue: "[motion: revelacao-titulo @0 TEXTO]" },
  { name: "lista-em-cascata", tag: "Lista", desc: "Itens em cascata vertical, o último destacado", cue: "[motion: lista-em-cascata @0.5 A|B|C]" },
  { name: "chamada-final", tag: "CTA", desc: "Chamada para ação pulsante no fim, com flash de entrada", cue: "[motion: chamada-final @1 TEXTO]" },
  { name: "caption-kinetic-slam", tag: "Legenda", desc: "Palavra com ênfase batendo na tela com câmera shake", cue: "[fx: word_slam @0.2 d=1.5 ENFASE]" },
  { name: "katana-slash", tag: "Corte", desc: "Lâmina cortando a tela na transição de cena", cue: "[fx: katana_slash @0 d=0.8]" },
  { name: "snap-zoom", tag: "Câmera", desc: "Zoom seco e rápido para o centro do quadro", cue: "[fx: snap_zoom @0 d=0.5]" },
  { name: "focus-zoom", tag: "Câmera", desc: "Aproximação suave e dramática de foco", cue: "[fx: focus_zoom @0.5 d=2.0]" },
  { name: "carimbo-censura", tag: "Dossiê", desc: "Tarja de carimbo vermelho cobrindo data ou documento", cue: "[fx: tarja @0.3 cor=#c4302b]" },
  { name: "carimbo-data", tag: "Dossiê", desc: "Carimbo de borracha rotacionado que bate na mesa 3D", cue: "[motion: carimbo-data @0 texto='1971 SEGREDO']" },
];

export default function HyperFramesStudioPage() {
  const [activeProject, setActiveProject] = useState("nike-história");
  const [availableProjects, setAvailableProjects] = useState<Array<{ name: string; path: string }>>([]);
  const [engineOnline, setEngineOnline] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState("1");
  const [search, setSearch] = useState("");
  const [iframeKey, setIframeKey] = useState(1);

  useEffect(() => {
    try {
      localStorage.setItem(HF_PROJECT_KEY, activeProject);
    } catch {}
  }, [activeProject]);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/hyperframes");
      const data = await res.json();
      setEngineOnline(data.running);
      if (data.projects && data.projects.length > 0) {
        setAvailableProjects(data.projects);
        // If current project not in list, pick first
        if (!data.projects.some((p: any) => p.name === activeProject)) {
          setActiveProject(data.projects[0].name);
        }
      }
    } catch {
      setEngineOnline(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 6000);
    return () => clearInterval(interval);
  }, []);

  const slug = newProjectName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/^-+|-+$/g, "");
  const selectedProfile = PROFILES.find((p) => p.id === selectedProfileId);
  // A web roda na VPS e não enxerga o disco do PC: o projeto é criado no PC (terminal ou
  // pedindo ao Claude), e o HyperFrames passa a listá-lo sozinho.
  const createCommand = slug
    ? `cd C:\Users\Igor\Videos-HF; npx hyperframes init ${slug}`
    : "";
  const claudePrompt = slug && selectedProfile
    ? `Crie o projeto HyperFrames "${slug}" em C:\Users\Igor\Videos-HF no perfil "${selectedProfile.tipo}" (${selectedProfile.largura}x${selectedProfile.altura}) usando a skill ${selectedProfile.skill}.`
    : "";

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
  };

  // Mesmo host do navegador: no PC vira localhost, no celular vira o IP do PC na rede.
  const [hfHost, setHfHost] = useState("localhost");
  useEffect(() => {
    setHfHost(window.location.hostname);
  }, []);

  const studioUrl = `http://${hfHost}:3010/#project/${encodeURIComponent(activeProject)}`;

  const filteredMotions = MOTIONS_CATALOG.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.desc.toLowerCase().includes(search.toLowerCase()) ||
      m.tag.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-[calc(100vh-4.5rem)] space-y-3 p-4 sm:p-6">
      {/* Studio Header & Project Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-low border border-line rounded-lg px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded bg-primary/10 text-primary-bright">
            <Icon name="movie_filter" className="text-[20px]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-sm text-fg">HyperFrames Studio</span>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-mono ${
                  engineOnline
                    ? "border-success/40 bg-success/10 text-success"
                    : "border-warning/40 bg-warning/10 text-warning"
                }`}
              >
                <span className={`size-1.5 rounded-full ${engineOnline ? "bg-success" : "bg-warning animate-pulse"}`} />
                {engineOnline ? "Porta 3010 Online" : "Motor Desconectado"}
              </span>
            </div>
            <p className="text-[11px] text-muted">Timeline interativa viva · Seleção de elemento por clique</p>
          </div>
        </div>

        {/* Project Selector & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Project Dropdown */}
          <div className="flex items-center gap-1.5 bg-surface-mid/80 border border-line rounded px-2.5 py-1 text-xs">
            <span className="text-muted font-mono text-[10px] uppercase">Projeto:</span>
            <select
              value={activeProject}
              onChange={(e) => {
                setActiveProject(e.target.value);
                setIframeKey((k) => k + 1);
              }}
              className="bg-transparent font-display font-medium text-fg focus:outline-none cursor-pointer"
            >
              {availableProjects.length > 0 ? (
                availableProjects.map((p) => (
                  <option key={p.name} value={p.name} className="bg-surface-elevated text-fg">
                    🎬 {p.name}
                  </option>
                ))
              ) : (
                <option value="nike-história" className="bg-surface-elevated text-fg">
                  🎬 nike-história
                </option>
              )}
            </select>
          </div>

          <Button
            size="sm"
            variant="primary"
            icon="forum"
            onClick={() => chamarClaude({ pedido: `No projeto ${activeProject}: ` })}
          >
            Pedir ao Claude
          </Button>

          <Button
            size="sm"
            variant="outline"
            icon="add"
            onClick={() => setShowNewModal(true)}
          >
            Novo Projeto
          </Button>

          <Button
            size="sm"
            variant="outline"
            icon="auto_awesome"
            onClick={() => setShowCatalog(!showCatalog)}
          >
            Catálogo ({MOTIONS_CATALOG.length})
          </Button>

          <a
            href={studioUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary-bright hover:bg-primary/20 transition-colors"
          >
            <Icon name="open_in_new" className="text-[14px]" />
            Abrir em Tela Cheia
          </a>
        </div>
      </div>

      <p className="rounded-lg border border-line bg-surface-low px-3 py-2 text-[11px] text-muted sm:hidden">
        No celular, o melhor é revisar em <strong className="text-fg">Abrir em Tela Cheia</strong> e pedir ajustes pelo
        <strong className="text-fg"> Pedir ao Claude</strong>. A edição fina na timeline fica mais confortável no computador.
      </p>

      {/* Main Studio Frame or Offline Launcher */}
      <div className="relative flex-1 rounded-xl border border-line/80 overflow-hidden bg-void shadow-2xl flex flex-col">
        {engineOnline ? (
          <iframe
            key={iframeKey}
            src={studioUrl}
            className="w-full h-full border-0 bg-void flex-1"
            title="HyperFrames Studio"
            allow="camera; microphone; display-capture"
          />
        ) : (
          <div className="flex-1 grid place-items-center p-8 text-center bg-void/90">
            <div className="max-w-md space-y-4">
              <div className="mx-auto grid size-16 place-items-center rounded-2xl border border-primary/30 bg-primary/10 text-primary-bright">
                <Icon name="movie_filter" className="text-[36px]" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-fg">
                  HyperFrames Studio não está respondendo
                </h3>
                <p className="mt-1 text-xs text-muted leading-relaxed">
                  O preview roda no seu PC e chega aqui pelo túnel. No PC, dê dois cliques em{" "}
                  <strong className="text-fg">Iniciar Vincere.bat</strong> (pasta do Vincere Studio): ele
                  sobe o túnel, o HyperFrames, o Flow e o acesso pelo celular. Esta tela reconecta sozinha.
                </p>
              </div>

              <button
                type="button"
                onClick={() => copy("npx hyperframes preview --port 3010 --no-open --no-browser-gpu")}
                className="w-full rounded border border-line bg-surface-mid/60 p-2 text-left font-mono text-[11px] text-primary-bright hover:border-primary/50"
                title="Copiar comando"
              >
                cd C:\Users\Igor\Videos-HF; npx hyperframes preview --port 3010 --no-open --no-browser-gpu
              </button>
            </div>
          </div>
        )}

        {/* Floating Motions & SFX Drawer */}
        {showCatalog && (
          <aside className="absolute inset-y-0 right-0 w-80 sm:w-96 border-l border-line bg-surface-low/95 backdrop-blur-md p-4 flex flex-col gap-3 shadow-2xl z-20 overflow-y-auto">
            <div className="flex items-center justify-between border-b border-line/60 pb-3">
              <div>
                <h3 className="text-sm font-bold font-display text-fg flex items-center gap-1.5">
                  <Icon name="auto_awesome" className="text-primary-bright text-[16px]" />
                  Catálogo de Efeitos & Motions
                </h3>
                <p className="text-[11px] text-muted">Atalhos mais usados — clique no cue para copiar</p>
              </div>
              <button
                onClick={() => setShowCatalog(false)}
                className="grid size-7 place-items-center rounded hover:bg-line/40 text-muted hover:text-fg text-sm"
              >
                ✕
              </button>
            </div>

            <input
              type="text"
              placeholder="Filtrar por nome, tag ou cue..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="field w-full px-3 py-1.5 text-xs placeholder:text-muted"
            />

            <div className="space-y-2.5 flex-1 overflow-y-auto pr-1">
              {filteredMotions.map((m) => (
                <div
                  key={m.name}
                  className="rounded-lg border border-line/80 bg-surface-mid/60 p-2.5 space-y-1.5 hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-fg font-display">{m.name}</span>
                    <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[9px] font-mono text-primary-bright">
                      {m.tag}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted leading-relaxed">{m.desc}</p>
                  <div onClick={() => copy(m.cue)} title="Copiar" className="cursor-pointer rounded bg-void/90 p-1.5 font-mono text-[10px] text-primary-bright select-all border border-line/40 hover:border-primary/50">
                    {m.cue}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        )}
      </div>

      {/* Modal Novo Projeto HyperFrames */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-void/80 backdrop-blur-sm p-4">
          <Card className="w-full max-w-lg p-5 border-line shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="font-display text-base font-bold text-fg flex items-center gap-2">
                <Icon name="add_circle" className="text-primary-bright" />
                Criar Novo Projeto no HyperFrames
              </h3>
              <button onClick={() => setShowNewModal(false)} className="text-muted hover:text-fg">
                ✕
              </button>
            </div>

            <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
              <div>
                <label className="label-mono mb-1 block text-muted">Nome do Projeto *</label>
                <input
                  required
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="Ex: misterio-area-51, corte-dragonball-01, nike-historia-v2"
                  className="field w-full px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="label-mono mb-1.5 block text-muted">Escolha o Tipo de Edição</label>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {PROFILES.map((prof) => (
                    <label
                      key={prof.id}
                      className={`flex items-start gap-2.5 p-2.5 rounded border cursor-pointer text-xs transition-colors ${
                        selectedProfileId === prof.id
                          ? "border-primary bg-primary/10 text-fg"
                          : "border-line bg-surface-low text-fg-secondary hover:border-line/80"
                      }`}
                    >
                      <input
                        type="radio"
                        name="perfil"
                        checked={selectedProfileId === prof.id}
                        onChange={() => setSelectedProfileId(prof.id)}
                        className="mt-0.5 accent-primary"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-fg">{prof.tipo}</span>
                          <span className="font-mono text-[10px] text-muted">
                            {prof.largura}×{prof.altura}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted mt-0.5">{prof.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {slug && (
                <div className="space-y-2 rounded border border-line bg-surface-low p-3 text-[11px]">
                  <p className="text-muted">
                    O projeto é criado no seu PC. Escolha uma das opções e ele aparece no seletor acima:
                  </p>
                  <button
                    type="button"
                    onClick={() => copy(claudePrompt)}
                    className="w-full rounded border border-primary/40 bg-primary/10 p-2 text-left text-primary-bright hover:bg-primary/20"
                  >
                    <span className="label-mono block text-[10px] text-muted">Pedir ao Claude (copiar)</span>
                    {claudePrompt}
                  </button>
                  <button
                    type="button"
                    onClick={() => copy(createCommand)}
                    className="w-full rounded border border-line bg-void/80 p-2 text-left font-mono text-primary-bright hover:border-primary/50"
                  >
                    <span className="label-mono block font-sans text-[10px] text-muted">Terminal do PC (copiar)</span>
                    {createCommand}
                  </button>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
                <Button variant="outline" size="sm" type="button" onClick={() => setShowNewModal(false)}>
                  Fechar
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
