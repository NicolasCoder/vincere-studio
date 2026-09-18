"use client";
import { Badge, Icon } from "@docupulse/ui";
import { RENDER_STAGES } from "./stages";
import { useRenderJobPoll } from "./useRenderJobPoll";

/** Mesmo grid de "Etapas do Render" de sempre, só que os ícones e badges reagem ao progress ao vivo. */
export function RenderStagesLive({ renderJobId, initialProgress, initialProfile }: { renderJobId: string; initialProgress: number; initialProfile: string }) {
  const job = useRenderJobPoll(renderJobId, initialProgress, initialProfile);
  const progress = job.progress;
  return (
    <>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {RENDER_STAGES.map(([n, d, at], i) => {
          const done = progress >= at;
          const active = !done && progress > (RENDER_STAGES[i - 1]?.[2] ?? 0) - 1;
          return (
            <div key={n} className="rounded border border-line bg-void/40 p-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-mono text-xs">
                  <Icon name={done ? "check_circle" : active ? "sync" : "radio_button_unchecked"} className={`text-[16px] ${done ? "text-success" : active ? "animate-spin text-primary-bright" : "text-muted"}`} />
                  Etapa {String(i + 1).padStart(2, "0")}: {n}
                </span>
                <Badge tone={done ? "success" : active ? "cyan" : "neutral"}>{done ? "OK" : active ? "em curso" : "pendente"}</Badge>
              </div>
              <p className="mt-2 text-xs text-fg-secondary">{d}</p>
            </div>
          );
        })}
      </div>
      {job.log && <pre className="mt-4 max-h-40 overflow-auto whitespace-pre-wrap rounded border border-line bg-void/70 p-3 font-mono text-[10px] leading-relaxed text-fg-secondary">{job.log}</pre>}
    </>
  );
}
