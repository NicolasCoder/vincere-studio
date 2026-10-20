import { FORMATS, type VideoFormat } from "@vincere-studio/core";
import { Badge, Button, Card, Chip, Icon } from "@vincere-studio/ui";
import { loadProjectShell } from "@/components/ProjectShell";
import { fmtDuration, parseJson } from "@/lib/data";
import { generateIdeas, selectIdea } from "../../actions";
import { JobWatcher } from "@/components/JobWatcher";
import Link from "next/link";

export default async function IdeationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ blocked?: string; job?: string; view?: "all" | "viral" | "hooks" }> }) {
  const { id } = await params;
  const { blocked, job, view = "all" } = await searchParams;
  const { project, header, busy } = await loadProjectShell(id, "IDEATION", blocked, job);
  const format = FORMATS[project.format as VideoFormat];
  const hooks = parseJson<string[]>(project.hooks, []);
  const ideas = [...project.ideas].sort((a, b) =>
    view === "viral" ? (b.ctrEstimate ?? 0) - (a.ctrEstimate ?? 0) : view === "hooks" ? (b.retention30s ?? 0) - (a.retention30s ?? 0) : (b.score ?? 0) - (a.score ?? 0),
  );

  return (
    <>
      {header}
      <main className="space-y-6 p-6">
        <Card className="p-6" accent="dual">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-display text-2xl font-semibold">{project.niche}</h1>
                <Badge tone="violet">{format.ratio}</Badge>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-fg-secondary">
                <Chip>{project.tone ?? "Tom livre"}</Chip>
                <Chip>{fmtDuration(project.targetDuration)}</Chip>
                <Chip>{project.audience ?? "Público geral"}</Chip>
                {hooks.map((h) => <Chip key={h} active icon="check">{h}</Chip>)}
              </div>
            </div>
            <div className="flex gap-2">
              <form action={generateIdeas.bind(null, project.id, { append: false, focus: "all" })}>
                <Button type="submit" variant="primary" icon="bolt" disabled={busy}>
                  Gerar Ideias Magnéticas com IA <span className="ml-1 rounded-sm bg-void/30 px-1.5 font-mono text-[10px] font-normal">Gemini</span>
                </Button>
              </form>
              <form action={generateIdeas.bind(null, project.id, { append: false, focus: (["all", "viral", "hooks"] as const)[Math.floor(Math.random() * 3)], count: 3 })}>
                <Button type="submit" icon="shuffle" disabled={busy}>Randomizar</Button>
              </form>
            </div>
          </div>
        </Card>

        <section>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 font-display text-xl font-semibold"><Icon name="insights" className="text-primary-bright" /> Ideias Geradas pela IA para Alta Retenção</h2>
              <p className="mt-1 text-sm text-fg-secondary">Calibradas com base no tráfego de documentários investigativos e algoritmo de sugestão do YouTube.</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded border border-line bg-void/40 p-0.5 font-mono text-[11px]">
                {([["all", "Todas"], ["viral", "Maior Viralidade"], ["hooks", "Ganchos Psicológicos"]] as const).map(([v, t]) => (
                  <Link key={v} href={`?view=${v}`} className={v === view ? "rounded-sm bg-primary/15 px-3 py-1 text-primary-bright" : "px-3 py-1 text-fg-secondary hover:text-fg"}>
                    {t}{v === "all" && ` (${project.ideas.length})`}
                  </Link>
                ))}
              </div>
              <form action={generateIdeas.bind(null, project.id, { append: true, focus: view, count: 3 })}>
                <Button type="submit" size="sm" icon="refresh" disabled={busy || project.ideas.length === 0}>Gerar mais 3 variações</Button>
              </form>
            </div>
          </div>

          {job && <div className="mt-4"><JobWatcher jobId={job} label="Gerando ideias magnéticas com o Gemini" /></div>}

          {project.ideas.length === 0 ? (
            !job && <Card className="mt-4 p-10 text-center text-sm text-muted">Nenhuma ideia ainda. Clique em "Gerar Ideias Magnéticas com IA".</Card>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {ideas.map((idea) => {
                const lines = parseJson<string[]>(idea.hookLines, []);
                return (
                  <Card key={idea.id} className="flex flex-col p-4" glow={idea.recommended ? "cyan" : "none"} accent={idea.recommended ? "dual" : "none"}>
                    {idea.recommended && (
                      <span className="absolute left-1/2 top-2 -translate-x-1/2 rounded-full border border-primary/40 bg-surface-elevated px-3 py-0.5 font-mono text-[10px] text-primary-bright shadow-glow-cyan">
                        <Icon name="auto_awesome" className="mr-1 text-[12px]" />OPÇÃO RECOMENDADA IA
                      </span>
                    )}
                    <div className="relative mt-4 aspect-video overflow-hidden rounded border border-line bg-gradient-to-br from-surface-low via-void to-secondary/20">
                      <div className="absolute left-2 top-2 flex gap-1.5">
                        <Badge tone="cyan">CTR {idea.ctrEstimate?.toFixed(1)}%</Badge>
                        <Badge tone="violet">Score: {idea.score}/100</Badge>
                      </div>
                      <div className="absolute bottom-2 left-2 flex gap-1.5">
                        <Badge tone="neutral">{format.ratio} Master</Badge>
                      </div>
                      <div className="absolute bottom-2 right-2 font-mono text-xs text-fg">{fmtDuration(project.targetDuration)}</div>
                      <div className="absolute inset-0 grid place-items-center text-muted"><Icon name="image" className="text-[40px]" /></div>
                    </div>
                    <div className="label-mono mt-3 text-primary-bright">{idea.category}</div>
                    <h3 className={`mt-1 font-display text-lg font-semibold leading-snug ${idea.recommended ? "text-primary-bright" : ""}`}>{idea.title}</h3>
                    <p className="mt-2 line-clamp-3 text-sm text-fg-secondary">{idea.synopsis}</p>
                    {idea.viralityReason && <p className="mt-1 text-[11px] italic text-muted">“{idea.viralityReason}”</p>}
                    <div className="mt-3 rounded border border-line bg-void/60 p-3">
                      <div className="label-mono mb-2 flex items-center justify-between text-fg-secondary"><span><Icon name="record_voice_over" className="mr-1 text-[12px]" />O Gancho (primeiros 30s)</span><span className="normal-case tracking-normal">Teleprompter</span></div>
                      <ol className="space-y-1.5 font-mono text-[11px] leading-relaxed text-fg-secondary">
                        {lines.map((l, i) => <li key={i}><span className="text-primary-bright">0{i + 1}:</span> <em>“{l}”</em></li>)}
                      </ol>
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                      <div><div className="label-mono text-muted">Retenção Estimada</div><div className="mt-0.5"><span className="font-display text-base font-semibold text-primary-bright">{idea.retention30s}%</span> aos 30s</div></div>
                      <div><div className="label-mono text-muted">Ritmo de Edição</div><div className="mt-0.5 font-medium">{idea.editingPace}</div></div>
                    </div>
                    {idea.model && <div className="mt-2 font-mono text-[9px] text-muted">{idea.model} · {idea.promptVersion}</div>}
                    <form action={selectIdea.bind(null, project.id, idea.id)} className="mt-4">
                      <Button type="submit" variant={idea.recommended ? "primary" : "ghost"} className="w-full" iconRight="arrow_forward">
                        {idea.recommended ? "Selecionar e Iniciar Roteiro" : "Selecionar e Avançar"}
                      </Button>
                    </form>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        <Card className="flex items-center gap-4 p-4">
          <Icon name="info" className="text-primary-bright" />
          <div className="flex-1 text-sm">
            <div className="font-semibold">Próximo Passo no Pipeline: Geração Estruturada de Roteiro</div>
            <div className="text-xs text-fg-secondary">Ao confirmar uma ideia, o Vincere Studio dividirá sua narrativa em {format.structure.acts} atos cinematográficos com marcações de B-Roll e trilha sonora adaptativa.</div>
          </div>
          <Badge tone="cyan" pill dot>Modo Studio Ativo</Badge>
        </Card>
      </main>
    </>
  );
}
