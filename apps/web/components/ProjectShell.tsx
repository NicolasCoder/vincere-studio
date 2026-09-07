import { notFound } from "next/navigation";
import { STAGE_META, STAGES, type Stage } from "@docupulse/core";
import { Topbar } from "@/components/Topbar";
import { Stepper } from "@/components/Stepper";
import { Icon } from "@docupulse/ui";
import { getProject, getUsageSummary } from "@/lib/data";

export async function loadProjectShell(id: string, viewing: Stage, blocked?: string) {
  const [project, usage] = await Promise.all([getProject(id), getUsageSummary()]);
  if (!project) notFound();
  const current = project.stage as Stage;
  const idx = STAGES.indexOf(current);
  const progress = current === "PUBLISH" ? 100 : Math.round((idx / 4) * 100) + 25 * 0.5;
  const eta: Record<Stage, string> = {
    IDEATION: "ETA: ~12 min para roteiro preliminar",
    SCRIPT: "ETA da Fase 3: ~8 min para síntese vocal e curadoria",
    MEDIA: "ETA Final: ~4 min",
    RENDER: "Renderizando...",
    PUBLISH: "Publicado",
  };
  const header = (
    <>
      <Topbar crumbs={["Ideation", `Step ${STAGE_META[viewing].step}: ${STAGE_META[viewing].title}`]} costUsd={usage.costUsd} />
      <div className="px-6 pt-5">
        <Stepper projectId={id} current={current} progress={Math.round(progress)} eta={eta[current]} />
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
  return { project, usage, header };
}
