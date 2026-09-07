import { Card } from "@docupulse/ui";
import { Topbar } from "@/components/Topbar";
import { PageHeader } from "@/components/PageHeader";
import { getUsageSummary } from "@/lib/data";

export default async function DocsPage() {
  const usage = await getUsageSummary();
  return (
    <>
      <Topbar crumbs={["Documentation & Support"]} costUsd={usage.costUsd} />
      <main className="space-y-6 p-6">
        <PageHeader icon="help_outline" title="Documentação" subtitle="Os documentos do projeto ficam em docs/ na raiz do repositório." />
        <Card className="p-6 text-sm text-fg-secondary">
          <ul className="list-disc space-y-1 pl-5"><li><code>docs/PLANO_DE_DESENVOLVIMENTO.md</code> — arquitetura, stack e sprints</li><li><code>docs/SETUP.md</code> — como rodar localmente</li></ul>
        </Card>
      </main>
    </>
  );
}
