import Link from "next/link";
import { FORMATS, STAGE_META, type Stage, type VideoFormat } from "@docupulse/core";
import { Badge, Card, Chip, Icon } from "@docupulse/ui";
import { Topbar } from "@/components/Topbar";
import { PageHeader } from "@/components/PageHeader";
import { getUsageSummary, listProjects } from "@/lib/data";

export default async function HistoryPage() {
  const [projects, usage] = await Promise.all([listProjects(), getUsageSummary()]);
  return (
    <>
      <Topbar crumbs={["Histórico de Produção"]} costUsd={usage.costUsd} />
      <main className="space-y-6 p-6">
        <PageHeader icon="history_edu" title="Histórico de Produção" subtitle="Todos os projetos, em qualquer estágio. Reabra, duplique ou arquive." />
        <Card>
          <table className="w-full text-sm">
            <thead className="label-mono border-b border-line text-muted"><tr>{["Projeto", "Formato", "Estágio", "Status", "Custo", "Atualizado", ""].map((h) => <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">
              {projects.map((p) => {
                const st = STAGE_META[p.stage as Stage];
                return (
                  <tr key={p.id} className="hover:bg-line/20">
                    <td className="max-w-md truncate px-4 py-3 font-medium">{p.title}</td>
                    <td className="px-4 py-3"><Chip active tone={p.format === "SHORT_9_16" ? "violet" : "cyan"}>{FORMATS[p.format as VideoFormat].ratio}</Chip></td>
                    <td className="px-4 py-3 text-fg-secondary">{st.step}. {st.title}</td>
                    <td className="px-4 py-3"><Badge tone={p.status === "PUBLISHED" ? "success" : p.status === "IN_PROGRESS" ? "cyan" : "neutral"} pill>{p.status}</Badge></td>
                    <td className="px-4 py-3 font-mono text-xs">US$ {p.costUsd.toFixed(2)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted">{new Date(p.updatedAt).toLocaleDateString("pt-BR")}</td>
                    <td className="px-4 py-3 text-right"><Link href={`/projects/${p.id}/${st.href}`} className="text-primary-bright"><Icon name="open_in_new" className="text-[18px]" /></Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </main>
    </>
  );
}
