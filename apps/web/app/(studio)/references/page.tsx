import { prisma } from "@docupulse/db";
import { Badge, Button, Card, Icon } from "@docupulse/ui";
import { Topbar } from "@/components/Topbar";
import { PageHeader } from "@/components/PageHeader";
import { getUsageSummary } from "@/lib/data";
import { addReference, deleteReference } from "./actions";

export default async function ReferencesPage() {
  const [usage, refs] = await Promise.all([
    getUsageSummary(),
    prisma.referenceChannel.findMany({ orderBy: { createdAt: "desc" } }),
  ]);
  const niches = Array.from(new Set(refs.map((r) => r.niche))).sort();

  return (
    <>
      <Topbar crumbs={["Referências"]} costUsd={usage.costUsd} />
      <main className="space-y-6 p-6">
        <PageHeader
          icon="collections_bookmark"
          title="Biblioteca de Referências"
          subtitle="Canais concorrentes/inspiração pra consultar título, thumbnail e estilo na hora de criar uma ideia nova."
        />

        <Card className="p-5">
          <h3 className="font-display font-semibold"><Icon name="add_link" className="mr-1 align-middle text-primary-bright" />Adicionar canal de referência</h3>
          <form action={addReference} className="mt-3 grid grid-cols-[2fr_1fr_2fr_auto] items-end gap-3">
            <div>
              <label className="label-mono mb-1 block text-muted">URL do canal *</label>
              <input name="url" required placeholder="https://www.youtube.com/@fatosdesconhecidos" className="field w-full px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="label-mono mb-1 block text-muted">Nicho *</label>
              <input name="niche" required placeholder="Mistério/Ciência" className="field w-full px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="label-mono mb-1 block text-muted">Notas (opcional)</label>
              <input name="notes" placeholder="Por que é referência" className="field w-full px-3 py-2 text-sm" />
            </div>
            <Button type="submit" variant="primary" icon="bookmark_add">Salvar</Button>
          </form>
          <p className="mt-2 text-[11px] text-fg-secondary">Nome e foto do canal são extraídos automaticamente da URL quando disponíveis.</p>
        </Card>

        {refs.length === 0 ? (
          <Card className="grid place-items-center p-16 text-center text-sm text-muted">
            <Icon name="collections_bookmark" className="text-[40px]" />
            <p className="mt-3">Nenhuma referência salva ainda.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {refs.map((r) => (
              <Card key={r.id} className="p-4">
                <div className="flex items-center gap-3">
                  {r.avatarUrl ? (
                    <img src={r.avatarUrl} alt="" className="size-10 shrink-0 rounded-full border border-line object-cover" />
                  ) : (
                    <div className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-void/60 text-muted"><Icon name="smart_display" className="text-[18px]" /></div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-display text-sm font-semibold">{r.name ?? r.url}</div>
                    <Badge tone="cyan">{r.niche}</Badge>
                  </div>
                  <form action={deleteReference.bind(null, r.id)}><button className="text-muted hover:text-error"><Icon name="delete" className="text-[16px]" /></button></form>
                </div>
                {r.notes && <p className="mt-2 text-[11px] text-fg-secondary">{r.notes}</p>}
                <a href={r.url} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-1 truncate text-[11px] text-primary-bright hover:underline">
                  <Icon name="open_in_new" className="text-[12px]" />{r.url}
                </a>
              </Card>
            ))}
          </div>
        )}

        {niches.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {niches.map((n) => <Badge key={n} tone="neutral">{n} · {refs.filter((r) => r.niche === n).length}</Badge>)}
          </div>
        )}
      </main>
    </>
  );
}
