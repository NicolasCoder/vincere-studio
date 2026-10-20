"use client";
import { Icon, Progress } from "@vincere-studio/ui";
import { useRenderJobPoll } from "./useRenderJobPoll";

/** Overlay do card de preview: substitui a barra estática por uma que se atualiza sozinha por polling. */
export function RenderProgressOverlay({ renderJobId, initialProgress, initialProfile }: { renderJobId: string; initialProgress: number; initialProfile: string }) {
  const job = useRenderJobPoll(renderJobId, initialProgress, initialProfile);
  return (
    <div className="absolute inset-x-4 bottom-4 rounded border border-line bg-void/80 p-3 backdrop-blur">
      <div className="flex items-center justify-between font-mono text-[11px]">
        <span className="flex items-center gap-1.5 text-primary-bright"><Icon name="autorenew" className="animate-spin text-[14px]" />{job.progress}%</span>
        <span className="text-muted">perfil {job.profile}</span>
      </div>
      <Progress value={job.progress} className="mt-2" pulse />
    </div>
  );
}
