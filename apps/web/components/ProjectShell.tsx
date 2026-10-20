import { notFound } from "next/navigation";
import { prisma } from "@vincere-studio/db";
import { STAGE_META, type Stage } from "@vincere-studio/core";
import { Icon } from "@vincere-studio/ui";
import { Topbar } from "@/components/Topbar";
import { Stepper } from "@/components/Stepper";
import { getProject, getUsageSummary } from "@/lib/data";

/** Progresso real do projeto (0–100) a partir do que já existe em cada etapa. */
async function realProgress(projectId: string, stage: Stage) {
  const p = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: {
      ideas: { select: { selected: true } },
      scripts: { orderBy: { version: "desc" }, take: 1, include: { blocks: { include: { voiceTracks: { select: { id: true } }, scenes: { select: { filePath: true } } } } } },
      renderJobs: { orderBy: { startedAt: "desc" }, take: 1 },
    },
  });
  const blocks = p.scripts[0]?.blocks ?? [];
  const written = blocks.filter((b) => b.narration.trim().length > 40).length;
  const voiced = blocks.filter((b) => b.voiceTracks.length).length;
  const scenes = blocks.flatMap((b) => b.scenes);
  const ready = scenes.filter((s) => s.filePath).length;
  const frac = (a: number, b: number) => (b ? a / b : 0);
  switch (stage) {
    case "IDEATION": return p.ideas.length ? (p.ideas.some((i) => i.selected) ? 25 : 15) : 5;
    case "SCRIPT": return 25 + Math.round(25 * frac(written, Math.max(blocks.length, 1)));
    case "MEDIA": return 50 + Math.round(12 * frac(voiced, Math.max(blocks.length, 1)) + 13 * frac(ready, Math.max(scenes.length, 1)));
    case "RENDER": return 75 + Math.round(25 * ((p.renderJobs[0]?.progress ?? 0) / 100));
    case "PUBLISH": return 100;
  }
}

export async function loadProjectShell(id: string, viewing: Stage, blocked?: string, jobId?: string) {
  const [project, usage] = await Promise.all([getProject(id), getUsageSummary()]);
  if (!project) notFound();
  const current = project.stage as Stage;
  const progress = await realProgress(id, current);
  const job = jobId ? await prisma.job.findUnique({ where: { id: jobId }, select: { status: true } }) : null;
  const busy = !!job && (job.status === "QUEUED" || job.status === "RUNNING");
  const eta: Record<Stage, string> = {
    IDEATION: "Próximo: escolher uma ideia e gerar o roteiro",
    SCRIPT: "Próximo: locução, legendas e cenas",
    MEDIA: "Próximo: render 1080p com FFmpeg",
    RENDER: "Renderizando...",
    PUBLISH: "Publicado",
  };
  const header = (
    <>
      <Topbar crumbs={["Ideation", `Step ${STAGE_META[viewing].step}: ${STAGE_META[viewing].title}`]} costUsd={usage.costUsd} />
      <div className="px-6 pt-5">
        <Stepper projectId={id} current={current} progress={progress} eta={eta[current]} />
        {blocked && (
          <div className="mt-4 flex items-center gap-3 rounded border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
            <Icon name="warning" className="text-[18px]" />
            <span className="flex-1">{blocked}</span>
            <span className="font-mono text-[10px] text-warning/70">validação da etapa</span>
          </div>
        )}
      </div>
    </>
  );
  return { project, usage, header, busy };
}
