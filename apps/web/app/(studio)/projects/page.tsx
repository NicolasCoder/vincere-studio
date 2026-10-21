import Link from "next/link";
import { COST_MODES, formatList, isTalkingHeadStyle } from "@vincere-studio/core";
import { Badge, Button, Card, Icon } from "@vincere-studio/ui";
import { Topbar } from "@/components/Topbar";
import { PageHeader } from "@/components/PageHeader";
import { getUsageSummary, listProjects } from "@/lib/data";
import { createProject } from "./actions";
import { FormatSelector } from "./FormatSelector";
import { KanbanBoard } from "./KanbanBoard";

const HOOKS = ["Clímax nos 30s", "Cliffhangers Triplos", "Revelação Gradual", "Conflito Não Resolvido"];

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; apagado?: string; modo?: string }>;
}) {
  const { erro, apagado, modo } = await searchParams;
  const activeTab = modo === "talking-head" ? "talking-head" : modo === "todos" ? "todos" : "dark";
  const [projects, usage] = await Promise.all([listProjects(), getUsageSummary()]);

  const darkProjects = projects.filter((p) => !isTalkingHeadStyle(p.visualStyle));
  const talkingHeadProjects = projects.filter((p) => isTalkingHeadStyle(p.visualStyle));
  const filteredProjects =
    activeTab === "talking-head" ? talkingHeadProjects : activeTab === "todos" ? projects : darkProjects;

  return (
    <>
      <Topbar crumbs={["Projetos", activeTab === "talking-head" ? "Talking Head" : "Dark & Documentários"]} costUsd={usage.costUsd} />
      <main className="space-y-8 p-6">
        {erro && (
          <Card className="border-warning/50 p-4 text-sm text-warning">
            <Icon name="warning" className="mr-2 align-middle" />
            {erro}
          </Card>
        )}
        {apagado && (
          <Card className="p-4 text-sm text-fg-secondary">
            <Icon name="delete" className="mr-2 align-middle text-muted" />
            Projeto apagado, com os arquivos do disco junto.
          </Card>
        )}

        {/* Seletor de Linha de Produção: Dark / Documentário vs Talking Head */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/projects?modo=dark"
              className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-semibold transition-all ${
                activeTab === "dark"
                  ? "border-primary bg-primary/15 text-primary-bright"
                  : "border-line bg-surface-low text-fg-secondary hover:text-fg"
              }`}
            >
              <Icon name="movie" className="text-[16px]" />
              <span>Dark & Documentários ({darkProjects.length})</span>
            </Link>
            <Link
              href="/projects?modo=talking-head"
              className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-semibold transition-all ${
                activeTab === "talking-head"
                  ? "border-primary bg-primary/15 text-primary-bright"
                  : "border-line bg-surface-low text-fg-secondary hover:text-fg"
              }`}
            >
              <Icon name="person_pin" className="text-[16px]" />
              <span>Talking Head & Reels ({talkingHeadProjects.length})</span>
            </Link>
            <Link
              href="/projects?modo=todos"
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-all ${
                activeTab === "todos"
                  ? "border-primary bg-primary/15 text-primary-bright font-semibold"
                  : "border-line bg-surface-low text-muted hover:text-fg"
              }`}
            >
              <span>Todos ({projects.length})</span>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/talking-head">
              <Button variant="secondary" size="sm" icon="record_voice_over">
                Abrir Estúdio Talking Head (reels_tools)
              </Button>
            </Link>
            <Link href="/sharingan">
              <Button variant="secondary" size="sm" icon="visibility">
                Clonagem Sharingan
              </Button>
            </Link>
          </div>
        </div>

        <Card className="p-6" accent="dual">
          <PageHeader
            icon={activeTab === "talking-head" ? "person_pin" : "auto_awesome"}
            title={
              <span className="flex items-center gap-3">
                {activeTab === "talking-head"
                  ? "Novo Projeto Talking Head & Reels"
                  : "Novo Projeto Dark & Documentário Investigativo"}{" "}
                <Badge tone="violet">v2.0 Dual-Mode</Badge>
              </span>
            }
            subtitle={
              activeTab === "talking-head"
                ? "Fluxo separado para vídeos de apresentador / clone: limpeza cirúrgica de áudio (Regra do Vão Livre), salto de escala nas emendas, Lockup e Color Grading 3D."
                : "Configure os parâmetros do documentário dark/dossiê para a IA calibrar tom, retenção, arquivos reais e ganchos de alta conversão."
            }
            right={
              <Badge tone="neutral" className="normal-case">
                <Icon name="hub" className="text-[14px]" />{" "}
                {activeTab === "talking-head" ? "Cluster: Talking Head & Reels Tools" : "Cluster: Dark Documentaries v2"}
              </Badge>
            }
          />
          <form action={createProject} className="mt-6 space-y-5">
            <input type="hidden" name="visualStyle" value={activeTab === "talking-head" ? "TALKING_HEAD" : "DARK_DOC"} />
            <fieldset className="rounded border border-line bg-void/40 p-4">
              <div className="mb-3 flex items-center justify-between">
                <legend className="label-mono flex items-center gap-2 text-fg">
                  <Icon name="aspect_ratio" className="text-[16px] text-primary-bright" /> Formato & Proporção *
                </legend>
                <span className="font-mono text-[11px] text-muted">Selecione a proporção cinematográfica</span>
              </div>
              <FormatSelector formats={formatList} />
            </fieldset>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="label-mono text-fg" htmlFor="niche">
                  {activeTab === "talking-head" ? "Tema ou Assunto do Vídeo Talking Head *" : "Nicho ou Tema Central do Documentário *"}
                </label>
                <span className="font-mono text-[11px] text-muted">máx. 120 caracteres</span>
              </div>
              <div className="field flex h-12 items-center gap-3 px-4">
                <Icon name="explore" className="text-primary-bright" />
                <input
                  id="niche"
                  name="niche"
                  required
                  minLength={3}
                  maxLength={120}
                  placeholder={
                    activeTab === "talking-head"
                      ? "3 erros que travam o alcance dos seus Reels e como corrigir"
                      : "Mistérios Ocultos da Antiguidade e Civilizações Perdidas"
                  }
                  className="w-full bg-transparent text-base outline-none placeholder:text-muted"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Select
                label="Tom Narrativo"
                icon="theater_comedy"
                name="tone"
                options={
                  activeTab === "talking-head"
                    ? ["Autoridade & Direto ao Ponto", "Dinâmico & Conversacional", "Storytelling Pessoal", "Educacional Prático", "Provocativo & Viral"]
                    : ["Misterioso & Investigativo", "Épico & Cinematográfico", "Sombrio & Perturbador", "Científico & Curioso", "Frenético & Imersivo"]
                }
              />
              <Select
                label="Duração Estimada"
                icon="timer"
                name="targetDuration"
                options={[
                  ["45", "Short / Reel retenção (45s)"],
                  ["60", "Short / Reel completo (60s)"],
                  ["90", "Reel estendido (90s)"],
                  ["30", "Short rápido (30s)"],
                  ["900", "Long-form (12 – 15 min)"],
                  ["1200", "Long-form (18 – 20 min)"],
                ]}
              />
              <Select
                label="Público-Alvo & Canal"
                icon="groups"
                name="audience"
                options={
                  activeTab === "talking-head"
                    ? ["Empreendedores & Criadores", "Negócios & Vendas", "Tecnologia & IA", " Produtividade & Carreira", "Lifestyle & Alta Performance"]
                    : ["Audiência Curiosa & Dark Channel", "Ciência & Tecnologia", "História & Arqueologia", "True Crime", "Finanças & Geopolítica"]
                }
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="label-mono mr-2 text-muted">Micro-hooks:</span>
              {HOOKS.map((h, i) => (
                <label key={h} className="cursor-pointer">
                  <input type="checkbox" name="hooks" value={h} defaultChecked={i < 2} className="peer sr-only" />
                  <span className="inline-flex h-6 items-center gap-1 rounded border border-line bg-void/60 px-2 font-mono text-[11px] text-fg-secondary peer-checked:border-primary/60 peer-checked:bg-primary/10 peer-checked:text-primary-bright">
                    + {h}
                  </span>
                </label>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="label-mono mr-2 text-muted">Modo de custo:</span>
              {(Object.keys(COST_MODES) as (keyof typeof COST_MODES)[]).map((m, i) => (
                <label key={m} className="cursor-pointer" title={COST_MODES[m].description}>
                  <input type="radio" name="costMode" value={m} defaultChecked={i === 0} className="peer sr-only" />
                  <span className="inline-flex h-6 items-center rounded border border-line bg-void/60 px-2 font-mono text-[11px] text-fg-secondary peer-checked:border-secondary/60 peer-checked:bg-secondary/10 peer-checked:text-secondary-soft">
                    {COST_MODES[m].label}
                  </span>
                </label>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Button type="submit" variant="primary" size="lg" icon="bolt" className="w-full min-w-0 sm:w-auto sm:min-w-72">
                {activeTab === "talking-head" ? "Criar Projeto Talking Head" : "Criar Projeto Dark e Gerar Ideias"}
              </Button>
              <span className="flex items-center gap-2 font-mono text-[11px] text-muted">
                <Icon name="verified_user" className="text-[14px]" /> Processamento de Duas Vias ativo (Nuvem leve + Worker Local GPU).
              </span>
            </div>
          </form>
        </Card>

        <section>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-lg font-semibold">
              Quadro de Produção —{" "}
              {activeTab === "talking-head"
                ? `Talking Head (${filteredProjects.length})`
                : activeTab === "todos"
                  ? `Todos os Projetos (${filteredProjects.length})`
                  : `Dark & Documentários (${filteredProjects.length})`}
            </h2>
            <span className="font-mono text-[11px] text-muted">arraste as cartas entre as colunas · clique para abrir</span>
          </div>
          <KanbanBoard
            projects={filteredProjects.map((p) => ({
              id: p.id,
              title: p.title,
              niche: p.niche,
              format: p.format,
              stage: p.stage,
              visualStyle: p.visualStyle,
            }))}
          />
        </section>
      </main>
    </>
  );
}

function Select({ label, icon, name, options }: { label: string; icon: string; name: string; options: (string | [string, string])[] }) {
  return (
    <div>
      <label className="label-mono mb-1.5 flex items-center gap-1.5 text-fg">
        <Icon name={icon} className="text-[14px] text-primary-bright" /> {label}
      </label>
      <div className="field flex h-11 items-center px-3">
        <select name={name} className="w-full bg-transparent text-sm outline-none">
          {options.map((o) => {
            const [v, l] = Array.isArray(o) ? o : [o, o];
            return (
              <option key={v} value={v} className="bg-surface-low">
                {l}
              </option>
            );
          })}
        </select>
      </div>
    </div>
  );
}
