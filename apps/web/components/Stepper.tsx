import Link from "next/link";
import { STAGES, STAGE_META, stepStates, type Stage } from "@vincere-studio/core";
import { Icon, Progress, cn } from "@vincere-studio/ui";

export function Stepper({ projectId, current, progress, eta }: { projectId: string; current: Stage; progress: number; eta?: string }) {
  const states = stepStates(current);
  const steps = STAGES.filter((s) => s !== "PUBLISH");
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-3">
        {steps.map((s) => {
          const meta = STAGE_META[s];
          const st = states[s];
          const inner = (
            <div
              className={cn(
                "flex items-center gap-3 rounded border p-3 transition-colors",
                st === "active" && "border-primary/50 bg-primary/10 shadow-glow-cyan",
                st === "done" && "border-line bg-surface-low",
                st === "locked" && "border-line/60 bg-surface-low/40 opacity-60",
              )}
            >
              <span
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded font-mono text-xs",
                  st === "active" && "gradient-cta text-fg",
                  st === "done" && "bg-line/50 text-primary-bright",
                  st === "locked" && "bg-line/30 text-muted",
                )}
              >
                {st === "done" ? <Icon name="check_circle" className="text-[18px]" /> : st === "locked" ? <Icon name="lock" className="text-[16px]" /> : String(meta.step).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <div className="label-mono flex items-center gap-2 text-muted">
                  Passo {String(meta.step).padStart(2, "0")}
                  {st === "active" && <span className="rounded-sm bg-primary/20 px-1 normal-case tracking-normal text-primary-bright">Em progresso</span>}
                  {st === "done" && <span className="normal-case tracking-normal text-primary-bright">· Concluído</span>}
                  {st === "locked" && <span className="normal-case tracking-normal">· Bloqueado</span>}
                </div>
                <div className={cn("truncate font-display text-sm font-semibold", st === "locked" ? "text-fg-secondary" : "text-fg")}>{meta.title}</div>
              </div>
            </div>
          );
          return st === "locked" ? (
            <div key={s}>{inner}</div>
          ) : (
            <Link key={s} href={`/projects/${projectId}/${meta.href}`}>
              {inner}
            </Link>
          );
        })}
      </div>
      <div className="flex items-center gap-4">
        <Progress value={progress} className="flex-1" pulse />
        <span className="font-mono text-xs text-primary-bright">{progress}% Concluído</span>
        {eta && (
          <span className="flex items-center gap-1 font-mono text-xs text-fg-secondary">
            <Icon name="schedule" className="text-[14px]" /> {eta}
          </span>
        )}
      </div>
    </div>
  );
}
