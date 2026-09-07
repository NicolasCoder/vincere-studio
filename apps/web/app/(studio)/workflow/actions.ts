"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@docupulse/db";
import { WorkflowGraph, defaultNodeData } from "@docupulse/core";

export async function createWorkflow(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim() || "Novo fluxo vertical";
  // Começa com um nó de render (alvo) para o usuário encadear os demais.
  const graph: WorkflowGraph = {
    nodes: [{ id: "render-1", type: "RENDER", position: { x: 900, y: 200 }, data: defaultNodeData("RENDER") }],
    edges: [],
  };
  const wf = await prisma.workflow.create({ data: { name, graph: JSON.stringify(graph) } });
  redirect(`/workflow/${wf.id}`);
}

export async function saveWorkflow(id: string, graphJson: string) {
  const graph = WorkflowGraph.parse(JSON.parse(graphJson));
  const hasRender = graph.nodes.some((n) => n.type === "RENDER");
  await prisma.workflow.update({
    where: { id },
    data: { graph: JSON.stringify(graph), status: hasRender && graph.edges.length > 0 ? "READY" : "DRAFT" },
  });
  revalidatePath(`/workflow/${id}`);
  return { ok: true, savedAt: new Date().toISOString() };
}

export async function runWorkflow(id: string) {
  const job = await prisma.job.create({ data: { type: "RUN_WORKFLOW", payload: JSON.stringify({ workflowId: id }) } });
  await prisma.workflow.update({ where: { id }, data: { status: "RUNNING" } });
  revalidatePath(`/workflow/${id}`);
  return job.id;
}

export async function deleteWorkflow(id: string) {
  await prisma.workflow.delete({ where: { id } });
  revalidatePath("/workflow");
}
