import Link from "next/link";
import { FORMATS, STAGE_META, type Stage, type VideoFormat } from "@vincere-studio/core";
import { Badge, Button, Card, Icon, Stat } from "@vincere-studio/ui";
import { Topbar } from "@/components/Topbar";
import { PageHeader } from "@/components/PageHeader";
import { getUsageSummary, listJobs, listProjects, parseJson } from "@/lib/data";
import { NichoLauncher } from "./NichoLauncher";
import { EnginesHub } from "./EnginesHub";

export default async function Dashboard() {
  const [projects, usage, jobs] = await Promise.all([listProjects(), getUsageSummary(), listJobs(6)]);
  const published = projects.filter((p) => p.status === "PUBLISHED");
  const views = published.reduce((s, p) => s + (parseJson<{ views?: number }>(p.publications[0]?.stats, {}).views ?? 0), 0);

  return (
    <>
      <Topbar crumbs={["Início"]} costUsd={usage.costUsd} />
      <main className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
        <PageHeader
          icon="home"
          title="Início"
          subtitle="Escolha um nicho para começar, acompanhe os projetos e veja se os motores estão no ar."
          right={
            <Link href="/studio">
              <Button variant="primary" size="sm" icon="movie_filter">
                Abrir HyperFrames Studio
              </Button>
            </Link>
          }
        />

        <NichoLauncher />

        <EnginesHub />

        {/* Global Statistics */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Projetos no Acervo" value={projects.length} sub={`${published.length} publicados no canal`} />
          <Stat label="Orçamento & API" value={`US$ ${usage.costUsd.toFixed(2)}`} sub="Custo equivalente de API" tone="violet" />
          <Stat label="Views (YouTube)" value={views.toLocaleString("pt-BR")} sub="Audiência acumulada" />
          <Stat label="Fila do Worker" value={jobs.filter((j) => j.status === "QUEUED" || j.status === "RUNNING").length} sub="Jobs de render/síntese ativos" tone="fg" />
        </div>

        {/* Recent Projects & Worker Feed */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-fg flex items-center gap-2">
                <Icon name="movie" className="text-primary-bright text-[18px]" />
                Projetos Recentes no Estúdio
              </h2>
              <Link href="/projects" className="text-xs text-primary-bright hover:underline font-medium">
                Ver todos ({projects.length}) →
              </Link>
            </div>

            {projects.length === 0 ? (
              <Card className="p-8 text-center text-muted">
                <Icon name="video_library" className="text-[32px] mx-auto text-muted" />
                <p className="mt-2 text-xs">Nenhum projeto criado ainda. Escolha um fluxo acima para começar.</p>
              </Card>
            ) : (
              projects.slice(0, 5).map((p) => {
                const f = FORMATS[p.format as VideoFormat] || FORMATS["SHORT_9_16"];
                const stage = STAGE_META[p.stage as Stage] || STAGE_META["IDEATION"];
                return (
                  <Card
                    key={p.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:border-line-glow transition-all"
                    accent={p.stage === "SCRIPT" ? "violet" : p.stage === "PUBLISH" ? "dual" : "cyan"}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="grid size-11 shrink-0 place-items-center rounded border border-line bg-void/80 font-mono text-[10px] text-primary-bright font-bold">
                        {f.ratio}
                      </span>
                      <div className="min-w-0">
                        <Link href={`/projects/${p.id}/${stage.href}`} className="truncate font-display font-semibold text-sm text-fg hover:text-primary-bright transition-colors block">
                          {p.title}
                        </Link>
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-fg-secondary">
                          <span className="font-medium text-fg-secondary">{p.niche}</span>
                          <span className="text-muted">·</span>
                          <span className="font-mono text-muted">{f.label}</span>
                          <span className="text-muted">·</span>
                          <span className="text-muted">{new Date(p.createdAt).toLocaleDateString("pt-BR")}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                      <Badge tone={p.status === "PUBLISHED" ? "success" : p.status === "IN_PROGRESS" ? "cyan" : "neutral"} pill dot={p.status === "IN_PROGRESS"}>
                        {p.status === "PUBLISHED" ? "Publicado" : `Passo ${stage.step} · ${stage.short}`}
                      </Badge>
                      <Link
                        href="/studio"
                        className="inline-flex items-center gap-1 rounded border border-line bg-surface-mid px-2.5 py-1 text-xs text-fg hover:border-primary/50 transition-colors"
                        title="Abrir no HyperFrames Studio"
                      >
                        <Icon name="movie_filter" className="text-[14px] text-primary-bright" />
                        <span className="text-[11px]">Studio</span>
                      </Link>
                    </div>
                  </Card>
                );
              })
            )}
          </div>

          {/* Worker Pipeline Activity */}
          <div className="space-y-3">
            <h2 className="font-display text-base font-bold text-fg flex items-center gap-2">
              <Icon name="sync" className="text-primary-bright text-[18px]" />
              Fila de Processamento & Render
            </h2>
            <Card className="divide-y divide-line/60">
              {jobs.length === 0 && (
                <div className="p-4 text-xs text-muted text-center">
                  Fila vazia no momento. Os jobs de narração e render aparecerão aqui.
                </div>
              )}
              {jobs.map((j) => (
                <div key={j.id} className="flex items-center gap-3 p-3 text-xs">
                  <Icon
                    name={j.status === "DONE" ? "check_circle" : j.status === "FAILED" ? "error" : j.status === "RUNNING" ? "sync" : "schedule"}
                    className={`text-[16px] ${
                      j.status === "DONE"
                        ? "text-success"
                        : j.status === "FAILED"
                          ? "text-error"
                          : j.status === "RUNNING"
                            ? "text-primary-bright animate-spin"
                            : "text-muted"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-[11px] font-bold text-fg">{j.type}</div>
                    <div className="truncate text-[11px] text-muted">{j.message ?? j.project?.title ?? "Processando..."}</div>
                  </div>
                  <span className="font-mono text-[11px] text-primary-bright font-bold">{j.progress}%</span>
                </div>
              ))}
            </Card>
          </div>
        </section>
      </main>
    </>
  );
}
