"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@vincere-studio/db";
import { WORKFLOW_KINDS, WorkflowGraph, templateGraph, type WorkflowKind } from "@vincere-studio/core";

export async function createWorkflow(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim() || "Novo fluxo vertical";
  const kindRaw = String(formData.get("kind") ?? "");
  const kind: WorkflowKind = (WORKFLOW_KINDS as readonly string[]).includes(kindRaw) ? (kindRaw as WorkflowKind) : "CUSTOM";
  // Cada tipo já entra com um template de nós encadeado (ver templateGraph em @vincere-studio/core),
  // em vez de sempre a mesma tela em branco.
  const graph = templateGraph(kind);
  const hasRender = graph.nodes.some((n) => n.type === "RENDER");
  const wf = await prisma.workflow.create({
    data: { name, kind, graph: JSON.stringify(graph), status: hasRender && graph.edges.length > 0 ? "READY" : "DRAFT" },
  });
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
