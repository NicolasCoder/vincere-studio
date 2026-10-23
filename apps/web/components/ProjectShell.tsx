import { existsSync } from "node:fs";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@vincere-studio/db";
import { STAGE_META, type Stage } from "@vincere-studio/core";
import { Icon, cn } from "@vincere-studio/ui";
import { absPath } from "@vincere-studio/providers";
import { Topbar } from "@/components/Topbar";
import { Stepper } from "@/components/Stepper";
import { BotaoApagarProjeto } from "@/components/BotaoApagarProjeto";
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

interface ItemSaude {
  label: string;
  detalhe: string;
  ok: boolean;
  alerta?: boolean;
  href: string;
}

/** Checklist do projeto: o que já está pronto e onde resolver o que falta. */
async function saudeDoProjeto(projectId: string): Promise<ItemSaude[]> {
  const p = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: {
      ideas: { select: { selected: true } },
      publications: { select: { id: true }, take: 1 },
      renderJobs: { orderBy: { startedAt: "desc" }, take: 1, select: { startedAt: true, finishedAt: true, outputPath: true } },
      scripts: {
        orderBy: { version: "desc" },
        take: 1,
        include: { blocks: { include: { voiceTracks: { select: { id: true, captions: { select: { id: true }, take: 1 } } }, scenes: { select: { filePath: true } } } } },
      },
    },
  });
  const base = `/projects/${projectId}`;
  const blocks = p.scripts[0]?.blocks ?? [];
  const n = blocks.length;
  const escritos = blocks.filter((b) => b.narration.trim().length > 40).length;
  const narrados = blocks.filter((b) => b.voiceTracks.length).length;
  const legendados = blocks.filter((b) => b.voiceTracks[0]?.captions.length).length;
  const cenas = blocks.flatMap((b) => b.scenes);
  const comArquivo = cenas.filter((c) => c.filePath);
  const sumidas = comArquivo.filter((c) => !existsSync(absPath(c.filePath!))).length;
  const prontas = comArquivo.length - sumidas;
  // RenderJob não tem status: deduz pelo que existe (saída gravada, fim registrado).
  const rj = p.renderJobs[0];
  const render = !rj ? undefined : rj.finishedAt ? (rj.outputPath ? "DONE" : "FAILED") : rj.startedAt ? "RUNNING" : undefined;
  return [
    { label: "Ideia escolhida", detalhe: p.ideas.some((i) => i.selected) ? "ok" : "escolha uma ideia", ok: p.ideas.some((i) => i.selected), href: `${base}/ideation` },
    { label: "Roteiro", detalhe: n ? `${escritos}/${n} atos escritos` : "sem roteiro", ok: n > 0 && escritos === n, href: `${base}/script` },
    { label: "Locução", detalhe: n ? `${narrados}/${n} atos` : "—", ok: n > 0 && narrados === n, href: `${base}/media` },
    { label: "Legendas", detalhe: n ? `${legendados}/${n} alinhadas` : "—", ok: n > 0 && legendados === n, href: `${base}/media` },
    { label: "Cenas planejadas", detalhe: cenas.length ? `${cenas.length} cenas` : "planeje as cenas", ok: cenas.length > 0, href: `${base}/media` },
    {
      label: "Mídia das cenas",
      detalhe: cenas.length ? `${prontas}/${cenas.length}${sumidas ? ` · ${sumidas} sumiram` : ""}` : "—",
      ok: cenas.length > 0 && prontas === cenas.length,
      alerta: sumidas > 0,
      href: `${base}/media`,
    },
    { label: "Render", detalhe: render === "DONE" ? "concluído" : render === "RUNNING" ? "renderizando" : render === "FAILED" ? "falhou" : "não feito", ok: render === "DONE", alerta: render === "FAILED", href: `${base}/render` },
    { label: "Publicado", detalhe: p.publications.length ? "no ar" : "não publicado", ok: p.publications.length > 0, href: `${base}/published` },
  ];
}

export async function loadProjectShell(id: string, viewing: Stage, blocked?: string, jobId?: string) {
  const [project, usage] = await Promise.all([getProject(id), getUsageSummary()]);
  if (!project) notFound();
  const current = project.stage as Stage;
  const [progress, saude] = await Promise.all([realProgress(id, current), saudeDoProjeto(id)]);
  const proximo = saude.find((i) => !i.ok);
  const okCount = saude.filter((i) => i.ok).length;
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
      <Topbar crumbs={[project.title, `Passo ${STAGE_META[viewing].step}: ${STAGE_META[viewing].title}`]} costUsd={usage.costUsd} />
      <div className="px-4 pt-5 sm:px-6">
        <Stepper projectId={id} current={current} progress={progress} eta={eta[current]} />
        <details className="group mt-3 rounded-lg border border-line bg-surface-low">
          <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-4 py-2.5 text-sm">
            <Icon name="health_and_safety" className="text-[18px] text-primary-bright" />
            <span className="font-display font-semibold text-fg">Saúde do projeto</span>
            <span className="font-mono text-xs text-muted">{okCount}/{saude.length}</span>
            {proximo && (
              <span className="text-xs text-fg-secondary">
                · próximo passo: <span className={cn(proximo.alerta ? "text-warning" : "text-primary-bright")}>{proximo.label}</span>
              </span>
            )}
            <Icon name="expand_more" className="ml-auto text-[18px] text-muted transition-transform group-open:rotate-180" />
          </summary>
          <ul className="grid gap-1.5 px-4 pb-3 sm:grid-cols-2 lg:grid-cols-4">
            {saude.map((i) => (
              <li key={i.label}>
                <Link href={i.href} className="flex items-center gap-2 rounded border border-line bg-void/40 px-2.5 py-2 text-xs hover:border-primary/50">
                  <Icon
                    name={i.ok ? "check_circle" : i.alerta ? "error" : "radio_button_unchecked"}
                    className={cn("text-[16px]", i.ok ? "text-success" : i.alerta ? "text-warning" : "text-muted")}
                    filled={i.ok}
                  />
                  <span className="text-fg">{i.label}</span>
                  <span className="ml-auto truncate text-[11px] text-muted">{i.detalhe}</span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between border-t border-line/40 px-4 py-2 bg-void/20">
            <span className="text-muted text-[11px]">Gerenciar projeto:</span>
            <BotaoApagarProjeto projectId={id} projectTitle={project.title} compacto={false} redirecionarPara="/projects" />
          </div>
        </details>
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
