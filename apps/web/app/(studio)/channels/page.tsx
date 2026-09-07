import { Card, Icon } from "@docupulse/ui";
import { Topbar } from "@/components/Topbar";
import { PageHeader } from "@/components/PageHeader";
import { getUsageSummary } from "@/lib/data";

export default async function ChannelsPage() {
  const usage = await getUsageSummary();
  return (
    <>
      <Topbar crumbs={["Channel Manager"]} costUsd={usage.costUsd} />
      <main className="space-y-6 p-6">
        <PageHeader icon="smart_display" title="Channel Manager" subtitle="Canais do YouTube conectados via OAuth (Sprint 5). Cada canal guarda voz padrão, estilo de thumbnail e cota de upload." />
        <Card className="grid place-items-center p-16 text-center text-sm text-muted"><Icon name="link" className="text-[40px]" /><p className="mt-3">Nenhum canal conectado ainda.</p></Card>
      </main>
    </>
  );
}
