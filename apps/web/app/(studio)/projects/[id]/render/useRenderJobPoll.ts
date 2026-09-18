"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export interface RenderJobView { id: string; progress: number; outputPath: string | null; log: string; finishedAt: string | null; profile: string }

/** Compartilhado pelo overlay do preview e pelo grid de etapas: ambos precisam do mesmo progress ao vivo. */
export function useRenderJobPoll(renderJobId: string, initialProgress: number, initialProfile: string) {
  const [job, setJob] = useState<RenderJobView>({ id: renderJobId, progress: initialProgress, outputPath: null, log: "", finishedAt: null, profile: initialProfile });
  const router = useRouter();

  useEffect(() => {
    let alive = true;
    let done = false;
    const tick = async () => {
      const r = (await fetch(`/api/render-jobs/${renderJobId}`).then((x) => x.json()).catch(() => null)) as RenderJobView | null;
      if (!alive || !r) return;
      setJob(r);
      if (r.outputPath && !done) {
        done = true;
        router.refresh();
      }
    };
    tick();
    const t = setInterval(() => {
      if (!done) tick();
    }, 1500);
    return () => {
      alive = false;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderJobId]);

  return job;
}
