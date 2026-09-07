import { Card, Icon } from "@docupulse/ui";
import { Topbar } from "@/components/Topbar";
import { PageHeader } from "@/components/PageHeader";
import { getUsageSummary } from "@/lib/data";

export default async function AssetsPage() {
  const usage = await getUsageSummary();
  return (
    <>
      <Topbar crumbs={["Media Assets"]} costUsd={usage.costUsd} />
      <main className="space-y-6 p-6">
        <PageHeader icon="video_library" title="Media Assets" subtitle="Biblioteca de mídia gerada, de acervo e importada (pasta storage/). Sprint 3 popula; Sprint 6 organiza e reutiliza entre projetos." />
        <Card className="grid place-items-center p-16 text-center text-sm text-muted">
          <Icon name="upload_file" className="text-[40px]" />
          <p className="mt-3">Arraste imagens ou vídeos aqui (ex.: cenas geradas no Flow) para vinculá-las a um projeto.</p>
        </Card>
      </main>
    </>
  );
}
