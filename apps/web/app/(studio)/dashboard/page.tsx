import Link from "next/link";
import { FORMATS, STAGE_META, type Stage, type VideoFormat } from "@docupulse/core";
import { Badge, Button, Card, Icon, Stat } from "@docupulse/ui";
import { Topbar } from "@/components/Topbar";
import { PageHeader } from "@/components/PageHeader";
import { getUsageSummary, listJobs, listProjects, parseJson } from "@/lib/data";

export default async function Dashboard() {
  const [projects, usage, jobs] = await Promise.all([listProjects(), getUsageSummary(), listJobs(6)]);
  const published = projects.filter((p) => p.status === "PUBLISHED");
  const views = published.reduce((s, p) => s + (parseJson<{ views?: number }>(p.publications[0]?.stats, {}).views ?? 0), 0);

  return (
    <>
      <Topbar crumbs={["Dashboard"]} costUsd={usage.costUsd} />
      <main className="space-y-6 p-6">
        <PageHeader
          icon="dashboard"
          title="Visão Geral do Estúdio"
          subtitle="Projetos em andamento, consumo de API e próximas ações do pipeline."
          right={
            <Link href="/projects">
              <Button variant="primary" icon="add">Novo Documentário</Button>
            </Link>
          }
        />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Projetos" value={projects.length} sub={`${published.length} publicados`} />
          <Stat label="Custo acumulado" value={`US$ ${usage.costUsd.toFixed(2)}`} sub={`${usage.entries} chamadas medidas`} tone="violet" />
          <Stat label="Views (YouTube)" value={views.toLocaleString("pt-BR")} sub="agregado dos publicados" />
          <Stat label="Fila do worker" value={jobs.filter((j) => j.status === "QUEUED" || j.status === "RUNNING").length} sub="jobs ativos" tone="fg" />
        </div>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-2">
            <h2 className="font-display text-lg font-semibold">Projetos recentes</h2>
            {projects.map((p) => {
              const f = FORMATS[p.format as VideoFormat];
              const stage = STAGE_META[p.stage as Stage];
              return (
                <Link key={p.id} href={`/projects/${p.id}/${stage.href}`}>
                  <Card className="mb-3 flex items-center gap-4 p-4 hover:border-line-glow" accent={p.stage === "SCRIPT" ? "violet" : p.stage === "PUBLISH" ? "dual" : "cyan"}>
                    <span className="grid size-12 shrink-0 place-items-center rounded border border-line bg-void/60 font-mono text-[10px] text-primary-bright">
                      {f.ratio}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-display font-semibold">{p.title}</div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-fg-secondary">
                        <span>{p.niche}</span>
                        <span className="text-muted">·</span>
                        <span className="font-mono">{f.label}</span>
                      </div>
                    </div>
                    <Badge tone={p.status === "PUBLISHED" ? "success" : p.status === "IN_PROGRESS" ? "cyan" : "neutral"} pill dot={p.status === "IN_PROGRESS"}>
                      {p.status === "PUBLISHED" ? "Publicado" : `Passo ${stage.step}`}
                    </Badge>
                    <Icon name="chevron_right" className="text-muted" />
                  </Card>
                </Link>
              );
            })}
          </div>
          <div className="space-y-3">
            <h2 className="font-display text-lg font-semibold">Atividade do worker</h2>
            <Card className="divide-y divide-line">
              {jobs.length === 0 && <div className="p-4 text-sm text-muted">Nenhum job ainda. Enfileire um teste em Settings.</div>}
              {jobs.map((j) => (
                <div key={j.id} className="flex items-center gap-3 p-3 text-sm">
                  <Icon
                    name={j.status === "DONE" ? "check_circle" : j.status === "FAILED" ? "error" : j.status === "RUNNING" ? "sync" : "schedule"}
                    className={j.status === "DONE" ? "text-success" : j.status === "FAILED" ? "text-error" : "text-primary-bright"}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-xs">{j.type}</div>
                    <div className="truncate text-xs text-muted">{j.message ?? j.project?.title ?? "—"}</div>
                  </div>
                  <span className="font-mono text-xs text-fg-secondary">{j.progress}%</span>
                </div>
              ))}
            </Card>
          </div>
        </section>
      </main>
    </>
  );
}
