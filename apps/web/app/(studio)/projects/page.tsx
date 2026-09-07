import Link from "next/link";
import { COST_MODES, FORMATS, STAGE_META, formatList, type Stage, type VideoFormat } from "@docupulse/core";
import { Badge, Button, Card, Chip, Icon } from "@docupulse/ui";
import { Topbar } from "@/components/Topbar";
import { PageHeader } from "@/components/PageHeader";
import { getUsageSummary, listProjects } from "@/lib/data";
import { createProject } from "./actions";
import { FormatSelector } from "./FormatSelector";

const HOOKS = ["Clímax nos 30s", "Cliffhangers Triplos", "Revelação Gradual", "Conflito Não Resolvido"];

export default async function ProjectsPage() {
  const [projects, usage] = await Promise.all([listProjects(), getUsageSummary()]);
  return (
    <>
      <Topbar crumbs={["Ideation", "Novo projeto"]} costUsd={usage.costUsd} />
      <main className="space-y-8 p-6">
        <Card className="p-6" accent="dual">
          <PageHeader
            icon="auto_awesome"
            title={
              <span className="flex items-center gap-3">
                Definição do Nicho e Ideação Inicial <Badge tone="violet">v0.1 Core</Badge>
              </span>
            }
            subtitle="Configure os parâmetros do documentário para a IA calibrar tom, retenção e ganchos de alta conversão."
            right={<Badge tone="neutral" className="normal-case"><Icon name="hub" className="text-[14px]" /> Cluster: Dark Documentaries v2</Badge>}
          />
          <form action={createProject} className="mt-6 space-y-5">
            <fieldset className="rounded border border-line bg-void/40 p-4">
              <div className="mb-3 flex items-center justify-between">
                <legend className="label-mono flex items-center gap-2 text-fg"><Icon name="aspect_ratio" className="text-[16px] text-primary-bright" /> Formato & Dinâmica do Documentário *</legend>
                <span className="font-mono text-[11px] text-muted">Selecione a proporção cinematográfica</span>
              </div>
              <FormatSelector formats={formatList} />
            </fieldset>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="label-mono text-fg" htmlFor="niche">Nicho ou Tema Central do Documentário *</label>
                <span className="font-mono text-[11px] text-muted">máx. 120 caracteres</span>
              </div>
              <div className="field flex h-12 items-center gap-3 px-4">
                <Icon name="explore" className="text-primary-bright" />
                <input id="niche" name="niche" required minLength={3} maxLength={120} placeholder="Mistérios Ocultos da Antiguidade e Civilizações Perdidas" className="w-full bg-transparent text-base outline-none placeholder:text-muted" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <Select label="Tom Narrativo" icon="theater_comedy" name="tone" options={["Misterioso & Investigativo", "Épico & Cinematográfico", "Sombrio & Perturbador", "Científico & Curioso", "Frenético & Imersivo"]} />
              <Select label="Duração Estimada" icon="timer" name="targetDuration" options={[["900", "Long-form (12 – 15 min)"], ["1200", "Long-form (18 – 20 min)"], ["1500", "Long-form (25 min)"], ["60", "Short (60s)"], ["90", "Short (90s)"]]} />
              <Select label="Público-Alvo & Canal" icon="groups" name="audience" options={["Audiência Curiosa & Dark Channel", "Ciência & Tecnologia", "História & Arqueologia", "True Crime", "Finanças & Geopolítica"]} />
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

            <div className="flex items-center gap-4 pt-2">
              <Button type="submit" variant="primary" size="lg" icon="bolt" className="min-w-72">
                Criar Projeto e Gerar Ideias
                <span className="ml-2 rounded-sm bg-void/30 px-1.5 font-mono text-[10px] font-normal">Sprint 1: IA</span>
              </Button>
              <Button type="button" icon="shuffle">Randomizar</Button>
              <span className="flex items-center gap-2 font-mono text-[11px] text-muted"><Icon name="verified_user" className="text-[14px]" /> Provedores gratuitos por padrão; API paga só quando você ligar.</span>
            </div>
          </form>
        </Card>

        <section>
          <h2 className="mb-3 font-display text-lg font-semibold">Projetos ({projects.length})</h2>
          <div className="grid grid-cols-3 gap-4">
            {projects.map((p) => {
              const stage = STAGE_META[p.stage as Stage];
              return (
                <Link key={p.id} href={`/projects/${p.id}/${stage.href}`}>
                  <Card className="h-full p-4 hover:border-line-glow" accent={p.format === "SHORT_9_16" ? "violet" : "cyan"}>
                    <div className="flex items-center justify-between">
                      <Chip active tone={p.format === "SHORT_9_16" ? "violet" : "cyan"}>{FORMATS[p.format as VideoFormat].ratio}</Chip>
                      <Badge tone="neutral">Passo {stage.step}</Badge>
                    </div>
                    <div className="mt-3 line-clamp-2 font-display font-semibold">{p.title}</div>
                    <div className="mt-2 text-xs text-fg-secondary">{p.niche}</div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      </main>
    </>
  );
}

function Select({ label, icon, name, options }: { label: string; icon: string; name: string; options: (string | [string, string])[] }) {
  return (
    <div>
      <label className="label-mono mb-1.5 flex items-center gap-1.5 text-fg"><Icon name={icon} className="text-[14px] text-primary-bright" /> {label}</label>
      <div className="field flex h-11 items-center px-3">
        <select name={name} className="w-full bg-transparent text-sm outline-none">
          {options.map((o) => {
            const [v, l] = Array.isArray(o) ? o : [o, o];
            return <option key={v} value={v} className="bg-surface-low">{l}</option>;
          })}
        </select>
      </div>
    </div>
  );
}
