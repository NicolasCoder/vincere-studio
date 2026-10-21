import Link from "next/link";
import { FORMATS, STAGE_META, type Stage, type VideoFormat } from "@vincere-studio/core";
import { getYoutubeConnection } from "@vincere-studio/providers";
import { Badge, Card, Icon, Stat } from "@vincere-studio/ui";
import { Topbar } from "@/components/Topbar";
import { PageHeader } from "@/components/PageHeader";
import { getUsageSummary, listJobs, listProjects, parseJson } from "@/lib/data";
import { NichoLauncher } from "./NichoLauncher";

export default async function Dashboard() {
  const [projects, usage, jobs, youtubeConnection] = await Promise.all([
    listProjects(),
    getUsageSummary(),
    listJobs(6),
    getYoutubeConnection().catch(() => null),
  ]);
  const published = projects.filter((p) => p.status === "PUBLISHED");
  const views = published.reduce(
    (s, p) => s + (parseJson<{ views?: number }>(p.publications[0]?.stats, {}).views ?? 0),
    0,
  );
  const ytConnected = Boolean(youtubeConnection);
  const hasApiCost = usage.costUsd > 0;
  const activeJobsCount = jobs.filter((j) => j.status === "QUEUED" || j.status === "RUNNING").length;

  return (
    <>
      <Topbar crumbs={["Início"]} costUsd={usage.costUsd} />
      <main className="space-y-6 p-4 sm:p-6 max-w-6xl mx-auto">
        <PageHeader
          icon="home"
          title="Início"
          subtitle="Escolha a proporção e o estilo visual abaixo ou acompanhe suas criações em andamento."
        />

        {/* 1. O que vamos criar hoje? (Seletor de Formato + Carrossel de Estilos) */}
        <NichoLauncher />

        {/* 2. Fila de Processamento em Destaque + Projetos Recentes */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Fila de Processamento & Render (Prioridade no topo/direita) */}
          <div className="space-y-3 lg:order-2">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold text-fg flex items-center gap-2">
                <Icon name="sync" className="text-primary-bright text-[16px]" />
                Fila de Processamento
              </h2>
              {activeJobsCount > 0 && (
                <Badge tone="cyan" pill dot>
                  {activeJobsCount} em execução
                </Badge>
              )}
            </div>
            <Card className="divide-y divide-white/[0.05]">
              {jobs.length === 0 && (
                <div className="p-5 text-xs text-muted text-center">
                  Nenhum processamento ativo no momento.
                </div>
              )}
              {jobs.map((j) => (
                <div key={j.id} className="flex items-center gap-3 p-3.5 text-xs">
                  <Icon
                    name={
                      j.status === "DONE"
                        ? "check_circle"
                        : j.status === "FAILED"
                          ? "error"
                          : j.status === "RUNNING"
                            ? "sync"
                            : "schedule"
                    }
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
                    <div className="truncate font-mono text-[11px] font-medium text-fg">{j.type}</div>
                    <div className="truncate text-[11px] text-muted">
                      {j.message ?? j.project?.title ?? "Processando..."}
                    </div>
                  </div>
                  <span className="font-mono text-[11px] text-fg-secondary tabular-nums">{j.progress}%</span>
                </div>
              ))}
            </Card>
          </div>

          {/* Projetos Recentes */}
          <div className="space-y-3 lg:col-span-2 lg:order-1">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold text-fg flex items-center gap-2">
                <Icon name="movie" className="text-primary-bright text-[16px]" />
                Projetos Recentes
              </h2>
              <Link href="/workflow" className="text-xs text-fg-secondary hover:text-fg transition-colors">
                Abrir Copiloto & Fluxo →
              </Link>
            </div>

            {projects.length === 0 ? (
              <Card className="p-8 text-center text-muted">
                <Icon name="video_library" className="text-[28px] mx-auto text-muted/60" />
                <p className="mt-2 text-xs">
                  Nenhum projeto criado ainda. Escolha um formato e estilo acima para começar.
                </p>
              </Card>
            ) : (
              <div className="space-y-2.5">
                {projects.slice(0, 5).map((p) => {
                  const f = FORMATS[p.format as VideoFormat] || FORMATS["SHORT_9_16"];
                  const stage = STAGE_META[p.stage as Stage] || STAGE_META["IDEATION"];
                  return (
                    <Card
                      key={p.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 hover:border-white/[0.14] transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-white/[0.07] bg-void/60 font-mono text-[10px] text-fg-secondary font-medium">
                          {f.ratio}
                        </span>
                        <div className="min-w-0">
                          <Link
                            href={`/projects/${p.id}/${stage.href}`}
                            className="truncate font-display font-medium text-sm text-fg hover:text-primary-bright transition-colors block"
                          >
                            {p.title}
                          </Link>
                          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
                            <span>{p.niche}</span>
                            <span>·</span>
                            <span className="font-mono">{f.label}</span>
                            <span>·</span>
                            <span>{new Date(p.createdAt).toLocaleDateString("pt-BR")}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                        <Badge
                          tone={
                            p.status === "PUBLISHED"
                              ? "success"
                              : p.status === "IN_PROGRESS"
                                ? "cyan"
                                : "neutral"
                          }
                          pill
                          dot={p.status === "IN_PROGRESS"}
                        >
                          {p.status === "PUBLISHED" ? "Publicado" : stage.short}
                        </Badge>
                        <Link
                          href="/studio"
                          className="apple-press inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-xs text-fg-secondary hover:border-white/[0.16] hover:text-fg"
                          title="Abrir no HyperFrames Studio"
                        >
                          <Icon name="movie_filter" className="text-[14px] text-primary-bright" />
                          <span className="text-[11px]">Studio</span>
                        </Link>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* 3. Indicadores Globais (Views e Orçamento só aparecem quando conectados/ativos) */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat
            label="Projetos no Acervo"
            value={projects.length}
            sub={`${published.length} finalizados`}
          />
          <Stat
            label="Fila do Worker"
            value={activeJobsCount}
            sub="Jobs de render/síntese ativos"
            tone="fg"
          />
          {ytConnected && (
            <Stat
              label="Views (YouTube)"
              value={views.toLocaleString("pt-BR")}
              sub="Canal conectado"
            />
          )}
          {hasApiCost && (
            <Stat
              label="Orçamento & API"
              value={`US$ ${usage.costUsd.toFixed(2)}`}
              sub="Custo de API no mês"
              tone="violet"
            />
          )}
        </div>
      </main>
    </>
  );
}
