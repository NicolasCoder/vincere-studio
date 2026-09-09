import { prisma } from "@docupulse/db";
import { Badge, Button, Card, Icon } from "@docupulse/ui";
import { Topbar } from "@/components/Topbar";
import { PageHeader } from "@/components/PageHeader";
import { getUsageSummary } from "@/lib/data";
import { addSkill, deleteSkill } from "./actions";

const CATEGORIES = ["GANCHO", "ESTRUTURA_ATO", "CTA", "PROMPT_CENA", "OUTRO"];

export default async function SkillsPage() {
  const [usage, skills] = await Promise.all([
    getUsageSummary(),
    prisma.scriptSkill.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <>
      <Topbar crumbs={["Skills"]} costUsd={usage.costUsd} />
      <main className="space-y-6 p-6">
        <PageHeader
          icon="auto_stories"
          title="Biblioteca de Skills"
          subtitle="Estruturas de roteiro, ganchos e prompts que já funcionaram bem — reutilize entre projetos em vez de reinventar."
        />

        <Card className="p-5">
          <h3 className="font-display font-semibold"><Icon name="add_task" className="mr-1 align-middle text-primary-bright" />Salvar nova skill</h3>
          <form action={addSkill} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label-mono mb-1 block text-muted">Título *</label>
              <input name="title" required placeholder="Gancho de mistério nuclear" className="field w-full px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="label-mono mb-1 block text-muted">Categoria</label>
              <select name="category" className="field w-full px-3 py-2 text-sm">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label-mono mb-1 block text-muted">Nicho (opcional)</label>
              <input name="niche" placeholder="Mistério/Ciência" className="field w-full px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="label-mono mb-1 block text-muted">Notas (opcional)</label>
              <input name="notes" placeholder="Por que funcionou" className="field w-full px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="label-mono mb-1 block text-muted">Conteúdo *</label>
              <textarea name="content" required rows={4} placeholder="Cole aqui a estrutura, o gancho ou o trecho de prompt reutilizável" className="field w-full px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2">
              <Button type="submit" variant="primary" icon="bookmark_add">Salvar skill</Button>
            </div>
          </form>
        </Card>

        {skills.length === 0 ? (
          <Card className="grid place-items-center p-16 text-center text-sm text-muted">
            <Icon name="auto_stories" className="text-[40px]" />
            <p className="mt-3">Nenhuma skill salva ainda.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {skills.map((s) => (
              <Card key={s.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-display text-sm font-semibold">{s.title}</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge tone="cyan">{s.category}</Badge>
                      {s.niche && <Badge tone="neutral">{s.niche}</Badge>}
                    </div>
                  </div>
                  <form action={deleteSkill.bind(null, s.id)}><button className="text-muted hover:text-error"><Icon name="delete" className="text-[16px]" /></button></form>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-[11px] text-fg-secondary">{s.content}</p>
                {s.notes && <p className="mt-2 text-[11px] italic text-muted">{s.notes}</p>}
              </Card>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
