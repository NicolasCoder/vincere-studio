"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Icon, Progress, cn } from "@docupulse/ui";

interface JobView { id: string; status: string; progress: number; message?: string | null; error?: string | null; logs?: string }

/**
 * Acompanha um job do worker por polling. Quando termina, remove ?job da URL e
 * recarrega os dados do servidor (router.refresh) para a tela refletir o resultado.
 */
export function JobWatcher({ jobId, label }: { jobId: string; label: string }) {
  const [job, setJob] = useState<JobView | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const r = (await fetch(`/api/jobs/${jobId}`).then((x) => x.json()).catch(() => null)) as JobView | null;
      if (!alive || !r) return;
      setJob(r);
      if (r.status === "DONE") {
        router.replace(pathname);
        router.refresh();
      }
      if (r.status === "FAILED") router.refresh(); // libera os botões (busy é calculado no servidor)
    };
    tick();
    const t = setInterval(() => {
      if (job?.status === "DONE" || job?.status === "FAILED") return;
      tick();
    }, 1500);
    return () => {
      alive = false;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const failed = job?.status === "FAILED";
  return (
    <div className={cn("glass flex items-center gap-4 rounded-lg px-4 py-3", failed ? "border-error/40" : "border-primary/40 shadow-glow-cyan")}>
      <Icon name={failed ? "error" : "auto_awesome"} className={cn("text-[22px]", failed ? "text-error" : "animate-pulse text-primary-bright")} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between text-sm">
          <span className="font-display font-semibold">{failed ? "Falha na geração" : label}</span>
          <span className="font-mono text-xs text-primary-bright">{job ? `${job.progress}%` : "conectando..."}</span>
        </div>
        {!failed && <Progress value={job?.progress ?? 0} className="mt-2" pulse />}
        <div className={cn("mt-1 truncate font-mono text-[11px]", failed ? "text-error" : "text-fg-secondary")}>
          {failed ? job?.error?.split("\n")[0] : job?.message ?? (job?.status === "QUEUED" ? "Na fila · o worker precisa estar rodando (pnpm dev)" : "")}
        </div>
      </div>
      {failed && (
        <button onClick={() => { router.replace(pathname); router.refresh(); }} className="font-mono text-[11px] text-fg-secondary hover:text-fg">fechar</button>
      )}
    </div>
  );
}
