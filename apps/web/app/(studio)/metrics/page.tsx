import { Badge, Card, Stat } from "@vincere-studio/ui";
import { Topbar } from "@/components/Topbar";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@vincere-studio/db";
import { getUsageSummary, listProjects, parseJson } from "@/lib/data";
import { listarCanaisMonitorados, temChaveYoutube } from "@/lib/canais-stats";
import { CanaisDashboard } from "./CanaisDashboard";

export default async function MetricsPage({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const sp = await searchParams;
  const aviso = sp.ok ? "Dados atualizados." : sp.erro === "url" ? "Use o link do canal no formato youtube.com/@nome ou youtube.com/channel/UC…" : sp.erro === "chave" ? "Canal salvo, mas falta a chave do YouTube para buscar os números." : undefined;
  const [canais, projects, usage, byProvider] = await Promise.all([
    listarCanaisMonitorados(),
    listProjects(),
    getUsageSummary(),
    prisma.usage.groupBy({ by: ["provider", "unit"], _sum: { quantity: true, costUsd: true } }),
  ]);
  const published = projects.filter((p) => p.publications.length);
  const views = published.reduce((s, p) => s + (parseJson<{ views?: number }>(p.publications[0]?.stats, {}).views ?? 0), 0);
  return (
    <>
      <Topbar crumbs={["Métricas & Desempenho"]} costUsd={usage.costUsd} />
      <main className="space-y-6 p-6">
        <PageHeader icon="monitoring" title="Métricas & Desempenho" subtitle="Desempenho dos canais (o seu e os concorrentes), dos vídeos publicados e o consumo de API por provedor." right={<Badge tone="cyan" pill dot>Live</Badge>} />
        <CanaisDashboard canais={canais} temChave={temChaveYoutube()} aviso={aviso} />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Vídeos publicados" value={published.length} />
          <Stat label="Views totais" value={views.toLocaleString("pt-BR")} />
          <Stat label="Custo total API" value={`US$ ${usage.costUsd.toFixed(2)}`} tone="violet" />
          <Stat label="Custo médio / vídeo" value={`US$ ${(published.length ? usage.costUsd / published.length : 0).toFixed(2)}`} tone="fg" />
        </div>
        <Card className="p-5">
          <h3 className="font-display text-lg font-semibold">Consumo por provedor (base dos créditos)</h3>
          <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="label-mono border-b border-line text-muted"><tr><th className="py-2 text-left font-medium">Provedor</th><th className="py-2 text-left font-medium">Unidade</th><th className="py-2 text-right font-medium">Quantidade</th><th className="py-2 text-right font-medium">Custo</th></tr></thead>
            <tbody className="divide-y divide-line font-mono text-xs">
              {byProvider.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-muted">Nenhum consumo registrado.</td></tr>}
              {byProvider.map((r) => <tr key={r.provider + r.unit}><td className="py-2">{r.provider}</td><td className="py-2 text-fg-secondary">{r.unit}</td><td className="py-2 text-right">{(r._sum.quantity ?? 0).toLocaleString("pt-BR")}</td><td className="py-2 text-right text-primary-bright">US$ {(r._sum.costUsd ?? 0).toFixed(3)}</td></tr>)}
            </tbody>
          </table>
          </div>
        </Card>
      </main>
    </>
  );
}
