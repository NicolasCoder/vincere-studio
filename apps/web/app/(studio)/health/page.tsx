import { Badge, Card, Icon, Stat } from "@docupulse/ui";
import { Topbar } from "@/components/Topbar";
import { PageHeader } from "@/components/PageHeader";
import { getSystemHealth, getUsageSummary, fmtAge } from "@/lib/data";

const STATUS_META = {
  online: { label: "Worker online", tone: "success" as const, icon: "check_circle" },
  atencao: { label: "Worker sem sinal recente", tone: "cyan" as const, icon: "warning" },
  offline: { label: "Worker offline", tone: "error" as const, icon: "error" },
};

export default async function HealthPage() {
  const [health, usage] = await Promise.all([getSystemHealth(), getUsageSummary()]);
  const status = STATUS_META[health.workerStatus];

  return (
    <>
      <Topbar crumbs={["Saúde do Sistema"]} costUsd={usage.costUsd} />
      <main className="space-y-6 p-6">
        <PageHeader
          icon="monitor_heart"
          title="Saúde do Sistema"
          subtitle="Status do worker, fila de jobs e falhas recentes — sem precisar abrir o terminal."
          right={
            <Badge tone={status.tone} pill dot={health.workerStatus === "online"}>
              {status.label}
            </Badge>
          }
        />

        {health.workerDesatualizado && (
          <Card className="border-warning/50 p-4">
            <div className="flex items-start gap-3">
              <Icon name="update" className="text-warning" />
              <div className="text-sm">
                <div className="font-semibold text-warning">Worker desatualizado</div>
                <div className="mt-1 text-xs text-fg-secondary">
                  Há código mais novo no disco do que o worker carregou. Ele executa por <code className="font-mono text-[10px]">tsx</code>,
                  sem observador, então correção só vale depois de reiniciar — rode{" "}
                  <code className="font-mono text-[10px]">pnpm start</code> na raiz. Até lá, um erro já corrigido pode reaparecer.
                </div>
                <div className="mt-1 font-mono text-[11px] text-muted">
                  worker subiu {health.subidaAt ? new Date(health.subidaAt).toLocaleString("pt-BR") : "—"} · código de{" "}
                  {health.codigoAt ? new Date(health.codigoAt).toLocaleString("pt-BR") : "—"}
                </div>
              </div>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Último pulso do worker" value={fmtAge(health.heartbeatAgeMs)} tone={health.workerStatus === "offline" ? "error" : "fg"} />
          <Stat label="Na fila" value={health.queued} sub="aguardando" />
          <Stat label="Em execução" value={health.running} tone="cyan" />
          <Stat label="Falharam" value={health.failed} tone={health.failed > 0 ? "error" : "fg"} />
        </div>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <Icon name="report" className={health.stuckJobs.length ? "text-error" : "text-muted"} />
              <h3 className="font-display text-lg font-semibold">Jobs possivelmente travados</h3>
            </div>
            <p className="mt-1 text-xs text-muted">RUNNING há mais de 20 minutos sem nenhuma atualização de progresso.</p>
            <div className="mt-3 divide-y divide-line">
              {health.stuckJobs.length === 0 && <div className="py-6 text-center text-sm text-muted">Nenhum. Tudo fluindo normalmente.</div>}
              {health.stuckJobs.map((j) => (
                <div key={j.id} className="flex items-center gap-3 py-3 text-sm">
                  <Icon name="sync_problem" className="text-error" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-xs">{j.type}</div>
                    <div className="truncate text-xs text-muted">{j.project?.title ?? "—"} · {j.message ?? "sem mensagem"}</div>
                  </div>
                  <span className="font-mono text-xs text-error">{fmtAge(Date.now() - new Date(j.updatedAt).getTime())}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2">
              <Icon name="error" className={health.recentFailed.length ? "text-error" : "text-muted"} />
              <h3 className="font-display text-lg font-semibold">Falhas recentes</h3>
            </div>
            <p className="mt-1 text-xs text-muted">Últimos 5 jobs que terminaram com erro.</p>
            <div className="mt-3 divide-y divide-line">
              {health.recentFailed.length === 0 && <div className="py-6 text-center text-sm text-muted">Nenhuma falha registrada.</div>}
              {health.recentFailed.map((j) => (
                <div key={j.id} className="py-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-mono text-xs text-fg">{j.type}</span>
                    <span className="text-xs text-muted">· {j.project?.title ?? "—"}</span>
                  </div>
                  <div className="mt-1 truncate text-xs text-error/80">{(j.error ?? "").split("\n")[0]}</div>
                </div>
              ))}
            </div>
          </Card>
        </section>
      </main>
    </>
  );
}
