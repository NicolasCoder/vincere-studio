import Link from "next/link";
import { prisma } from "@vincere-studio/db";
import { unstable_noStore as noStore } from "next/cache";
import { NODE_META, WORKFLOW_KINDS, WORKFLOW_KIND_META, WorkflowGraph, type WorkflowKind } from "@vincere-studio/core";
import { Badge, Button, Card, Icon } from "@vincere-studio/ui";
import { Topbar } from "@/components/Topbar";
import { PageHeader } from "@/components/PageHeader";
import { getUsageSummary, parseJson } from "@/lib/data";
import { createWorkflow } from "./actions";

export default async function WorkflowListPage() {
  noStore();
  const [workflows, usage] = await Promise.all([prisma.workflow.findMany({ orderBy: { updatedAt: "desc" } }), getUsageSummary()]);
  return (
    <>
      <Topbar crumbs={["Gerar com IA", "Workflow nodal"]} costUsd={usage.costUsd} />
      <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        <PageHeader
          icon="account_tree"
          title="Workflow nodal"
          subtitle="Monte o vídeo ligando blocos: personagem, produto, cenário, prompt, voz e render. Ideal para comerciais e UGC com IA."
          right={
            <form action={createWorkflow} className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="field flex h-10 items-center px-3"><input name="name" placeholder="Nome do fluxo" className="w-full bg-transparent text-sm outline-none placeholder:text-muted sm:w-56" /></div>
              <select name="kind" defaultValue="VERTICAL_COMMERCIAL" className="field h-10 px-3 text-sm" title="Tipo de workflow: define os nós com que o fluxo já começa">
                {WORKFLOW_KINDS.map((k) => (
                  <option key={k} value={k}>{WORKFLOW_KIND_META[k].label}</option>
                ))}
              </select>
              <Button type="submit" variant="primary" icon="add">Novo fluxo</Button>
            </form>
          }
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workflows.map((w) => {
            const g = parseJson<WorkflowGraph>(w.graph, { nodes: [], edges: [] });
            return (
              <Link key={w.id} href={`/workflow/${w.id}`}>
                <Card className="h-full p-4 transition-colors hover:border-primary/50">
                  <div className="flex items-center justify-between"><Badge tone="violet">{WORKFLOW_KIND_META[w.kind as WorkflowKind]?.label ?? w.kind.replace("_", " ")}</Badge><Badge tone={w.status === "READY" ? "success" : w.status === "RUNNING" ? "cyan" : "neutral"} pill dot={w.status === "RUNNING"}>{({ READY: "Pronto", RUNNING: "Executando", DONE: "Concluído", DRAFT: "Rascunho", FAILED: "Falhou" } as Record<string, string>)[w.status] ?? w.status}</Badge></div>
                  <div className="mt-3 font-display text-lg font-semibold">{w.name}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {g.nodes.map((n) => <span key={n.id} className="inline-flex items-center gap-1 rounded-sm border border-line bg-void/60 px-1.5 py-0.5 font-mono text-[10px] text-fg-secondary"><Icon name={NODE_META[n.type].icon} className="text-[12px]" />{NODE_META[n.type].label.split(" ")[0]}</span>)}
                  </div>
                  <div className="mt-3 font-mono text-[11px] text-muted">{g.nodes.length} nós · {g.edges.length} conexões · {new Date(w.updatedAt).toLocaleString("pt-BR")}</div>
                </Card>
              </Link>
            );
          })}
        </div>
        <Card className="p-5">
          <h3 className="font-display font-semibold">Blocos disponíveis</h3>
          <p className="mt-1 text-xs text-muted">Dentro do fluxo, use o botão Nó ou os atalhos da barra inferior. Ligue a saída de um bloco na entrada do Prompt e do Renderizador.</p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {(Object.keys(NODE_META) as (keyof typeof NODE_META)[]).map((k) => <div key={k} className="rounded border border-line bg-void/40 p-3"><div className="flex items-center gap-2 font-display text-sm font-semibold"><Icon name={NODE_META[k].icon} className="text-primary-bright" />{NODE_META[k].label}</div><p className="mt-1 text-xs text-fg-secondary">{NODE_META[k].description}</p></div>)}
          </div>
        </Card>
      </main>
    </>
  );
}
