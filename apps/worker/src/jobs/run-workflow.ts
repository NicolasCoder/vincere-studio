import { prisma } from "@docupulse/db";
import { WorkflowGraph, NODE_META, type NodeKind } from "@docupulse/core";
import type { JobContext } from "../queue";

/**
 * Executor do grafo (v0 · dry-run): valida o grafo com o schema do core,
 * ordena topologicamente e "executa" cada nó registrando progresso.
 * Nas próximas sprints cada tipo de nó chama seu provedor real.
 */
export async function runWorkflow(ctx: JobContext) {
  const workflowId = String(ctx.payload.workflowId ?? "");
  const wf = await prisma.workflow.findUnique({ where: { id: workflowId } });
  if (!wf) throw new Error(`Workflow ${workflowId} não encontrado`);

  try {
    const graph = WorkflowGraph.parse(JSON.parse(wf.graph));
    const render = graph.nodes.find((n) => n.type === "RENDER");
    if (!render) throw new Error("O fluxo precisa de um nó Renderizador (alvo).");

    // Ordenação topológica (Kahn)
    const indeg = new Map(graph.nodes.map((n) => [n.id, 0]));
    for (const e of graph.edges) indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
    const queue = graph.nodes.filter((n) => (indeg.get(n.id) ?? 0) === 0).map((n) => n.id);
    const order: string[] = [];
    while (queue.length) {
      const id = queue.shift()!;
      order.push(id);
      for (const e of graph.edges.filter((e) => e.source === id)) {
        indeg.set(e.target, (indeg.get(e.target) ?? 1) - 1);
        if (indeg.get(e.target) === 0) queue.push(e.target);
      }
    }
    if (order.length !== graph.nodes.length) throw new Error("O grafo tem um ciclo; remova a conexão circular.");

    const feeding = graph.edges.filter((e) => e.target === render.id).length;
    if (feeding === 0) throw new Error("Nada está conectado ao Renderizador.");

    await ctx.log(`Grafo válido: ${graph.nodes.length} nós, ${graph.edges.length} conexões. Ordem: ${order.join(" → ")}`);
    for (let i = 0; i < order.length; i++) {
      if (await ctx.isCancelled()) return { cancelled: true };
      const node = graph.nodes.find((n) => n.id === order[i])!;
      const meta = NODE_META[node.type as NodeKind];
      await ctx.progress({ percent: ((i + 0.5) / order.length) * 100, message: `${meta.label} (${node.id})` });
      await ctx.log(`[${node.type}] ${meta.label}: simulado (provedor real chega na sprint do Workflow Runner)`);
      await new Promise((r) => setTimeout(r, 600));
    }

    await prisma.workflow.update({ where: { id: wf.id }, data: { status: "DONE" } });
    await ctx.log("Fluxo concluído (dry-run).");
    return { order, dryRun: true };
  } catch (err) {
    await prisma.workflow.update({ where: { id: wf.id }, data: { status: "READY" } });
    throw err;
  }
}
