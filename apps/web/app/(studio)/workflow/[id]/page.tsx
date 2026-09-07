import { notFound } from "next/navigation";
import { prisma } from "@docupulse/db";
import { unstable_noStore as noStore } from "next/cache";
import { WorkflowGraph } from "@docupulse/core";
import { Topbar } from "@/components/Topbar";
import { WorkflowCanvas } from "@/components/canvas/WorkflowCanvas";
import { getUsageSummary } from "@/lib/data";

export default async function WorkflowPage({ params }: { params: Promise<{ id: string }> }) {
  noStore();
  const { id } = await params;
  const [wf, usage] = await Promise.all([prisma.workflow.findUnique({ where: { id } }), getUsageSummary()]);
  if (!wf) notFound();
  const graph = WorkflowGraph.parse(JSON.parse(wf.graph));
  return (
    <div className="flex h-screen flex-col">
      <Topbar crumbs={["Video Canvas", "Workflow Studio", wf.name]} costUsd={usage.costUsd} />
      <div className="min-h-0 flex-1">
        <WorkflowCanvas id={wf.id} name={wf.name} status={wf.status} initialGraph={graph} />
      </div>
    </div>
  );
}
