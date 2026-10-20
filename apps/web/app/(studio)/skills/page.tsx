import { prisma } from "@vincere-studio/db";
import { Badge, Button, Card, Icon } from "@vincere-studio/ui";
import { Topbar } from "@/components/Topbar";
import { PageHeader } from "@/components/PageHeader";
import { getUsageSummary } from "@/lib/data";
import { addSkill, deleteSkill } from "./actions";
import { SystemSkillsCatalog } from "./SystemSkillsCatalog";

const CATEGORIES = ["GANCHO", "ESTRUTURA_ATO", "CTA", "PROMPT_CENA", "OUTRO"];

export default async function SkillsPage() {
  const [usage, skills] = await Promise.all([
    getUsageSummary(),
    prisma.scriptSkill.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <>
      <Topbar crumbs={["Skills & Repertório"]} costUsd={usage.costUsd} />
      <main className="space-y-8 p-4 sm:p-6 max-w-7xl mx-auto">
        <PageHeader
          icon="auto_stories"
          title="Skills e receitas"
          subtitle="O que cada skill faz, quando usar e um pedido pronto para mandar ao Claude. Comece pelas receitas."
        />

        {/* 1. Catálogo de Skills Oficiais Instaladas no PC */}
        <SystemSkillsCatalog />

        {/* 2. Biblioteca de Prompts & Estruturas Salvas pelo Usuário */}
        <div className="space-y-4 pt-6 border-t border-line">
          <div>
            <h3 className="font-display text-base font-bold text-fg flex items-center gap-2">
              <Icon name="bookmark" className="text-secondary-soft text-[20px]" />
              Prompts & Ganchos Personalizados Salvos
            </h3>
            <p className="text-xs text-muted">
              Estruturas de roteiro e blocos de texto que você mesmo catalogou para reutilizar nos documentários.
            </p>
          </div>

          <Card className="p-5 border-line bg-surface-low/80">
            <h4 className="font-display font-semibold text-sm text-fg flex items-center gap-2">
              <Icon name="add_task" className="text-primary-bright" />
              Salvar Novo Trecho de Roteiro ou Gancho
            </h4>
            <form action={addSkill} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label-mono mb-1 block text-muted">Título *</label>
                <input name="title" required placeholder="Ex: Gancho de mistério nuclear anos 70" className="field w-full px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="label-mono mb-1 block text-muted">Categoria</label>
                <select name="category" className="field w-full px-3 py-2 text-sm">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label-mono mb-1 block text-muted">Nicho (opcional)</label>
                <input name="niche" placeholder="Ex: Investigação, Finanças, Anime" className="field w-full px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="label-mono mb-1 block text-muted">Notas (opcional)</label>
                <input name="notes" placeholder="Por que esse gancho gerou alta retenção" className="field w-full px-3 py-2 text-sm" />
              </div>
              <div className="col-span-2">
                <label className="label-mono mb-1 block text-muted">Conteúdo do Prompt ou Fala *</label>
                <textarea name="content" required rows={3} placeholder="Cole aqui a estrutura, a frase de gancho ou o prompt reutilizável..." className="field w-full px-3 py-2 text-sm" />
              </div>
              <div className="col-span-2">
                <Button type="submit" variant="primary" size="sm" icon="bookmark_add">
                  Salvar na Biblioteca
                </Button>
              </div>
            </form>
          </Card>

          {skills.length === 0 ? (
            <Card className="p-8 text-center text-xs text-muted">
              Nenhuma anotação personalizada salva ainda. Suas skills ativas estão listadas acima.
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {skills.map((s) => (
                <Card key={s.id} className="p-4 border-line/80 hover:border-line-glow transition-all">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-display text-sm font-semibold text-fg">{s.title}</div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <Badge tone="cyan">{s.category}</Badge>
                        {s.niche && <Badge tone="neutral">{s.niche}</Badge>}
                      </div>
                    </div>
                    <form action={deleteSkill.bind(null, s.id)}>
                      <button className="text-muted hover:text-error transition-colors p-1" title="Excluir">
                        <Icon name="delete" className="text-[16px]" />
                      </button>
                    </form>
                  </div>
                  <p className="mt-2.5 whitespace-pre-wrap text-xs text-fg-secondary leading-relaxed bg-surface-mid/50 rounded p-2.5 border border-line/40">
                    {s.content}
                  </p>
                  {s.notes && <p className="mt-2 text-[11px] italic text-muted">Nota: {s.notes}</p>}
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
