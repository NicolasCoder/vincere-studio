import Link from "next/link";
import { prisma } from "@vincere-studio/db";
import { unstable_noStore as noStore } from "next/cache";
import { NODE_META, WORKFLOW_KIND_META, WorkflowGraph, type WorkflowKind } from "@vincere-studio/core";
import { Badge, Icon } from "@vincere-studio/ui";
import { Topbar } from "@/components/Topbar";
import { getUsageSummary, parseJson } from "@/lib/data";
import { createWorkflow, createWorkflowWithAi } from "./actions";
import { BotaoApagarWorkflow } from "./BotaoApagarWorkflow";

const FLUXOS_PRONTOS = [
  {
    id: "cortes",
    title: "Corte Dinâmico & Legenda Lockup",
    desc: "Remoção de silêncios, reenquadramento 9:16, B-roll nos ganchos e legenda anti-pisca.",
    icon: "content_cut",
    format: "9:16",
    goal: "Vídeo vertical de corte dinâmico com remoção de silêncios, punch-in nos ganchos, B-roll de apoio e legenda Lockup com brilho.",
  },
  {
    id: "motion",
    title: "Motion Graphics & Sharingan",
    desc: "Coreografia estilo Apple/macOS com câmera contínua, cards animados e batida sincronizada.",
    icon: "auto_awesome_motion",
    format: "9:16",
    goal: "Motion Graphics de alta retenção com câmera contínua, transições elásticas GSAP e tipografia cinética sincronizada na batida.",
  },
  {
    id: "ugc",
    title: "UGC / Comercial com Voz GPU",
    desc: "Apresentador consistente, demonstração de produto, locução na RTX 3060 e CTA.",
    icon: "shopping_bag",
    format: "9:16",
    goal: "Comercial UGC vertical de 25 segundos com gancho nos primeiros 2 segundos, demonstração de produto, voz neural e chamada para ação.",
  },
  {
    id: "dossie",
    title: "Documentário / Dossiê Investigativo",
    desc: "Narrativa investigativa com textura de arquivo, documentos reais, carimbos e trilha.",
    icon: "folder_open",
    format: "16:9",
    goal: "Documentário investigativo com estética de dossiê confidencial, fotos históricas emolduradas, recortes de jornal e locução densa.",
  },
];

const STATUS_LABEL: Record<string, string> = {
  READY: "Pronto",
  RUNNING: "Rodando",
  DONE: "Concluído",
  DRAFT: "Rascunho",
  FAILED: "Falhou",
};

export default async function WorkflowListPage({
  searchParams,
}: {
  searchParams: Promise<{ formato?: string; estilo?: string; motion?: string }>;
}) {
  noStore();
  const sp = await searchParams;
  const defaultFormat = sp.formato === "16:9" || sp.formato === "1:1" ? sp.formato : "9:16";
  const defaultStyle = sp.estilo || "motion";

  const [workflows, usage] = await Promise.all([
    prisma.workflow.findMany({ orderBy: { updatedAt: "desc" } }),
    getUsageSummary(),
  ]);

  return (
    <div className="flex min-h-[calc(100dvh-3rem)] flex-col lg:min-h-screen">
      <Topbar crumbs={["Criar", "Copiloto & Fluxo"]} costUsd={usage.costUsd} />

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 sm:p-6 lg:flex-row lg:items-start lg:gap-8">
        {/* Coluna Central (Estilo ChatGPT / n8n AI Builder): Chat no centro + Fluxos Prontos embaixo */}
        <div className="flex flex-1 flex-col justify-center space-y-8 py-2 lg:py-6">
          {/* Hero + Caixa de Chat centralizada */}
          <div className="mx-auto w-full max-w-2xl space-y-5">
            <div className="space-y-1.5 text-center">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[11px] font-medium text-fg-secondary">
                <Icon name="auto_awesome" className="text-[14px] text-primary-bright" />
                <span>Copiloto & Arquitetura de Nodes</span>
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-fg">
                Qual fluxo de vídeo vamos montar?
              </h1>
              <p className="text-xs sm:text-sm text-muted max-w-lg mx-auto">
                Descreva o objetivo e as etapas desejadas. A IA constrói e conecta os nodes automaticamente para você aprovar.
              </p>
            </div>

            {/* Composer estilo ChatGPT / n8n */}
            <form
              action={createWorkflowWithAi}
              className="rounded-2xl border border-white/[0.09] bg-surface-low/80 backdrop-blur-2xl p-3.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),0_18px_40px_-15px_rgba(0,0,0,0.65)] transition-colors focus-within:border-primary/60"
            >
              <textarea
                name="goal"
                rows={3}
                required
                defaultValue={
                  sp.motion
                    ? `Criar vídeo usando o Motion "${sp.motion}" da MotionDex com narração na GPU, cortes sincronizados na batida e legenda Lockup.`
                    : ""
                }
                placeholder="Descreva seu fluxo... Ex.: Quero um Reel 9:16 sobre a fundação da Nike com corte dinâmico, voz na GPU, B-roll de arquivo e legenda Lockup."
                className="w-full resize-none bg-transparent px-1.5 py-1 text-sm text-fg placeholder:text-muted/70 focus:outline-none"
              />

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    name="format"
                    defaultValue={defaultFormat}
                    className="h-8 rounded-lg border border-white/[0.08] bg-void/60 px-2.5 text-xs text-fg-secondary focus:border-primary focus:outline-none"
                    title="Proporção do vídeo"
                  >
                    <option value="9:16">9:16 Vertical</option>
                    <option value="16:9">16:9 Horizontal</option>
                    <option value="1:1">1:1 Quadrado</option>
                  </select>

                  <select
                    name="stylePreset"
                    defaultValue={defaultStyle}
                    className="h-8 rounded-lg border border-white/[0.08] bg-void/60 px-2.5 text-xs text-fg-secondary focus:border-primary focus:outline-none"
                    title="Base de nodes"
                  >
                    <option value="motion">Base: Motion & Sharingan</option>
                    <option value="cortes">Base: Corte Dinâmico</option>
                    <option value="ugc">Base: UGC & Comercial</option>
                    <option value="dossie">Base: Documentário / Dossiê</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="apple-press inline-flex h-9 items-center gap-1.5 rounded-xl gradient-cta px-4 text-xs font-semibold text-fg shadow-glow-cta hover:brightness-110"
                >
                  <span>Enviar e Gerar Nodes</span>
                  <Icon name="arrow_upward" className="text-[16px]" />
                </button>
              </div>
            </form>
          </div>

          {/* Embaixo do Chat: Fluxos Prontos (Começar com 1 Clique) */}
          <div className="mx-auto w-full max-w-2xl space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-medium text-fg-secondary">
                Fluxos prontos (começar com 1 clique)
              </span>
              <span className="text-[11px] text-muted">Templates pré-conectados</span>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {FLUXOS_PRONTOS.map((fp) => (
                <form key={fp.id} action={createWorkflowWithAi}>
                  <input type="hidden" name="goal" value={fp.goal} />
                  <input type="hidden" name="format" value={fp.format} />
                  <input type="hidden" name="stylePreset" value={fp.id} />
                  <button
                    type="submit"
                    className="apple-press group flex h-full w-full items-start gap-3 rounded-xl border border-white/[0.07] bg-surface-low/55 p-3.5 text-left hover:border-white/[0.16] hover:bg-surface-low/90"
                  >
                    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary-bright">
                      <Icon name={fp.icon} className="text-[17px]" />
                    </span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display text-[13px] font-semibold text-fg group-hover:text-primary-bright transition-colors truncate">
                          {fp.title}
                        </span>
                        <span className="shrink-0 rounded-full bg-white/[0.05] px-1.5 py-0.5 font-mono text-[9px] text-muted">
                          {fp.format}
                        </span>
                      </div>
                      <p className="line-clamp-2 text-[11px] leading-relaxed text-muted">
                        {fp.desc}
                      </p>
                    </div>
                  </button>
                </form>
              ))}
            </div>
          </div>
        </div>

        {/* Coluna da Direita: Últimos Fluxos Salvos (Que já foram feitos) */}
        <aside className="w-full lg:w-80 xl:w-88 shrink-0 rounded-2xl border border-white/[0.07] bg-surface-low/60 backdrop-blur-xl p-4 space-y-3.5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-sm font-semibold text-fg">Fluxos Salvos</h2>
              <p className="text-[11px] text-muted">Clique para abrir no editor de nodes</p>
            </div>
            <Badge tone="neutral">{workflows.length}</Badge>
          </div>

          <div className="space-y-2 max-h-[56vh] overflow-y-auto pr-0.5">
            {workflows.length === 0 ? (
              <div className="rounded-xl border border-white/[0.05] bg-void/40 p-5 text-center text-xs text-muted">
                Nenhum fluxo salvo ainda. Use o chat ao lado ou escolha um template de 1 clique.
              </div>
            ) : (
              workflows.map((w, idx) => {
                const g = parseJson<WorkflowGraph>(w.graph, { nodes: [], edges: [] });
                return (
                  <Link
                    key={w.id}
                    href={`/workflow/${w.id}`}
                    className="apple-press block rounded-xl border border-white/[0.06] bg-void/45 p-3 hover:border-white/[0.15] hover:bg-void/75"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-display text-xs font-semibold text-fg">
                        {w.name}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[9px] font-medium text-fg-secondary">
                          { idx === 0 ? "Último editado" : STATUS_LABEL[w.status] ?? w.status }
                        </span>
                        <BotaoApagarWorkflow workflowId={w.id} workflowName={w.name} />
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1">
                      {g.nodes.slice(0, 4).map((n) => (
                        <span
                          key={n.id}
                          className="inline-flex items-center gap-1 rounded-md border border-white/[0.05] bg-surface-low/80 px-1.5 py-0.5 font-mono text-[9px] text-muted"
                        >
                          <Icon name={NODE_META[n.type].icon} className="text-[11px] text-primary-bright" />
                          {NODE_META[n.type].label.split(" ")[0]}
                        </span>
                      ))}
                      {g.nodes.length > 4 && (
                        <span className="rounded-md bg-white/[0.04] px-1.5 py-0.5 font-mono text-[9px] text-muted">
                          +{g.nodes.length - 4}
                        </span>
                      )}
                    </div>

                    <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-muted">
                      <span>
                        {WORKFLOW_KIND_META[w.kind as WorkflowKind]?.label ?? w.kind} · {g.nodes.length} nodes
                      </span>
                      <span>{new Date(w.updatedAt).toLocaleDateString("pt-BR")}</span>
                    </div>
                  </Link>
                );
              })
            )}
          </div>

          {/* Criar em Branco Manual */}
          <form action={createWorkflow} className="pt-2 border-t border-white/[0.06] flex items-center gap-2">
            <input type="hidden" name="kind" value="CUSTOM" />
            <input
              name="name"
              placeholder="Ou criar canvas em branco..."
              className="field h-8 flex-1 px-2.5 text-xs"
            />
            <button
              type="submit"
              className="apple-press inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-white/[0.09] bg-white/[0.04] px-2.5 text-xs font-medium text-fg-secondary hover:border-white/[0.18] hover:text-fg"
              title="Criar fluxo em branco"
            >
              <Icon name="add" className="text-[15px]" />
              <span>Em branco</span>
            </button>
          </form>
        </aside>
      </main>
    </div>
  );
}
