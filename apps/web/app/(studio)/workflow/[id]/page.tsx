import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@vincere-studio/db";
import { unstable_noStore as noStore } from "next/cache";
import { WorkflowGraph } from "@vincere-studio/core";
import { Icon, cn } from "@vincere-studio/ui";
import { Topbar } from "@/components/Topbar";
import { WorkflowCanvas } from "@/components/canvas/WorkflowCanvas";
import { getUsageSummary, parseJson } from "@/lib/data";

export default async function WorkflowPage({ params }: { params: Promise<{ id: string }> }) {
  noStore();
  const { id } = await params;
  const [wf, allWorkflows, usage] = await Promise.all([
    prisma.workflow.findUnique({ where: { id } }),
    prisma.workflow.findMany({ orderBy: { updatedAt: "desc" } }),
    getUsageSummary(),
  ]);
  if (!wf) notFound();
  const graph = WorkflowGraph.parse(JSON.parse(wf.graph));

  return (
    <div className="flex h-[calc(100dvh-3rem)] flex-col lg:h-screen">
      <Topbar crumbs={["Copiloto & Fluxo", wf.name]} costUsd={usage.costUsd} />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Coluna Esquerda: Fluxos Salvos + Botão "+" (Novo Fluxo estilo n8n/GPT) */}
        <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-white/[0.06] bg-surface-low/80 backdrop-blur-xl">
          <div className="flex items-center justify-between px-3.5 py-3 border-b border-white/[0.05]">
            <span className="text-[10px] font-semibold tracking-[0.08em] uppercase text-muted">
              Fluxos Salvos ({allWorkflows.length})
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {allWorkflows.map((item) => {
              const active = item.id === wf.id;
              const g = parseJson<WorkflowGraph>(item.graph, { nodes: [], edges: [] });
              return (
                <Link
                  key={item.id}
                  href={`/workflow/${item.id}`}
                  className={cn(
                    "apple-press flex flex-col gap-0.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                    active
                      ? "bg-primary/15 text-fg shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]"
                      : "text-fg-secondary hover:bg-white/[0.04] hover:text-fg",
                  )}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="truncate font-display text-xs font-medium">{item.name}</span>
                    {active && <span className="size-1.5 shrink-0 rounded-full bg-primary-bright" />}
                  </div>
                  <span className="font-mono text-[10px] text-muted">
                    {g.nodes.length} nodes · {new Date(item.updatedAt).toLocaleDateString("pt-BR")}
                  </span>
                </Link>
              );
            })}
          </div>

          {/* Botão "+" embaixo para Criar Novo Fluxo (abre a tela n8n / GPT) */}
          <div className="p-2.5 border-t border-white/[0.06]">
            <Link
              href="/workflow"
              className="apple-press flex w-full items-center justify-center gap-2 rounded-xl gradient-cta px-3 py-2.5 text-xs font-semibold text-fg shadow-glow-cta hover:brightness-110"
            >
              <Icon name="add" className="text-[17px]" />
              <span>Novo Fluxo (IA / Templates)</span>
            </Link>
          </div>
        </aside>

        {/* Área Principal: Canvas de Nodes */}
        <div className="min-h-0 flex-1">
          <WorkflowCanvas id={wf.id} name={wf.name} status={wf.status} initialGraph={graph} />
        </div>
      </div>
    </div>
  );
}
