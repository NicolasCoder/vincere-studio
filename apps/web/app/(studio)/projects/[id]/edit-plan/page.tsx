import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@docupulse/db";
import { LAYOUT_META, needsOpaquePlate, type EditLayout, type EditPlanData } from "@docupulse/core";
import { Badge, Button, Card, Chip, Icon } from "@docupulse/ui";
import { Topbar } from "@/components/Topbar";
import { PageHeader } from "@/components/PageHeader";
import { JobWatcher } from "@/components/JobWatcher";
import { getUsageSummary, fmtMs } from "@/lib/data";
import { applyVisualLayer, generateEditPlan, generateEvidences } from "./actions";

const LAYOUT_TONE: Record<EditLayout, "cyan" | "violet" | "success" | "warning" | "neutral"> = {
  "lower-third": "cyan",
  "overlay-dado": "violet",
  "insert-arquivo": "success",
  "split-evidencia": "warning",
  "graphic-fullscreen": "neutral",
  cronologia: "violet",
};

export default async function EditPlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ job?: string; erro?: string }>;
}) {
  const { id } = await params;
  const { job, erro } = await searchParams;
  const [usage, project, plan] = await Promise.all([
    getUsageSummary(),
    prisma.project.findUnique({
      where: { id },
      include: {
        scripts: {
          orderBy: { version: "desc" },
          take: 1,
          include: {
            blocks: {
              orderBy: [{ act: "asc" }, { order: "asc" }],
              include: { voiceTracks: { take: 1, include: { captions: { select: { id: true } } } } },
            },
          },
        },
      },
    }),
    prisma.editPlan.findFirst({ where: { projectId: id }, orderBy: { version: "desc" } }),
  ]);
  if (!project) notFound();

  // Aplicar a camada exige um master pronto; e o resultado da última aplicação vem do job,
  // porque a camada não cria RenderJob (o master tem que continuar sendo o master).
  const [temRender, camadaJob] = await Promise.all([
    prisma.renderJob.findFirst({ where: { projectId: id, outputPath: { not: null } }, select: { id: true } }),
    prisma.job.findFirst({
      where: { projectId: id, type: "APPLY_VISUAL_LAYER", status: "DONE" },
      orderBy: { finishedAt: "desc" },
      select: { result: true, finishedAt: true },
    }),
  ]);
  const camada = camadaJob?.result ? (JSON.parse(camadaJob.result) as { output?: string }) : null;

  const blocks = project.scripts[0]?.blocks ?? [];
  const captioned = blocks.filter((b) => b.voiceTracks[0]?.captions.length).length;
  const ready = blocks.length > 0 && captioned === blocks.length;
  const data: EditPlanData | null = plan ? (JSON.parse(plan.data) as EditPlanData) : null;
  const overLight = (data?.insertions ?? []).filter(needsOpaquePlate).length;
  const comEvidencia = (data?.insertions ?? []).filter((i) => i.evidencePrompt).length;
  const byAct = new Map<number, EditPlanData["insertions"]>();
  for (const ins of data?.insertions ?? []) {
    if (!byAct.has(ins.act)) byAct.set(ins.act, []);
    byAct.get(ins.act)!.push(ins);
  }

  return (
    <>
      <Topbar crumbs={["Projetos", project.title, "Plano de Edição"]} costUsd={usage.costUsd} />
      {job && <JobWatcher jobId={job} label="Gerando plano de edição" />}
      <main className="space-y-6 p-6">
        <PageHeader
          icon="auto_awesome_mosaic"
          title="Plano de Edição (camada visual DVP)"
          subtitle="O que entra POR CIMA do master já renderizado — lower thirds, destaques de dado, intertítulos. Nada é renderizado aqui: este é o plano para você revisar."
        />

        <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex flex-wrap gap-2">
            <Chip icon="subtitles" active={ready}>
              {captioned}/{blocks.length} atos com legendas alinhadas
            </Chip>
            {data && <Chip icon="layers">{data.insertions.length} inserções</Chip>}
            {data && <Chip icon="timer">{fmtMs(data.totalMs)} de master</Chip>}
            {data && overLight > 0 && (
              <Chip icon="contrast" active>
                {overLight} sobre fundo claro
              </Chip>
            )}
            {plan && <Chip icon="history">v{plan.version}</Chip>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <form action={generateEditPlan.bind(null, project.id)}>
              <Button
                type="submit"
                icon="auto_awesome"
                disabled={!ready}
                title={ready ? "" : "Alinhe as legendas de todos os atos no Passo 3"}
              >
                {plan ? "Gerar novo plano" : "Gerar plano com IA"}
              </Button>
            </form>
            {/* O passo que faltava na interface: gerar o plano não desenha nada. É este botão que
                aplica as inserções sobre o master e produz o vídeo editado. */}
            <form action={applyVisualLayer.bind(null, project.id)}>
              <Button
                type="submit"
                variant="primary"
                icon="movie_filter"
                disabled={!data || !temRender}
                title={!data ? "Gere o plano primeiro" : !temRender ? "Renderize o vídeo no Passo 4 primeiro" : ""}
              >
                Aplicar camada no vídeo
              </Button>
            </form>
          </div>
        </Card>

        {erro === "sem-plano" && <Card className="p-4 text-sm text-warning">Gere o plano de edição antes de aplicar a camada.</Card>}
        {erro === "sem-render" && <Card className="p-4 text-sm text-warning">É preciso um render concluído no Passo 4 antes de aplicar a camada.</Card>}

        {camada?.output && (
          <Card className="p-5" accent="violet">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display font-semibold">
                <Icon name="movie_filter" className="mr-1 align-middle text-primary-bright" />
                Vídeo com a camada aplicada
              </h3>
              <span className="font-mono text-[11px] text-muted">
                {camadaJob?.finishedAt ? new Date(camadaJob.finishedAt).toLocaleString("pt-BR") : ""}
              </span>
            </div>
            <p className="mt-1 text-xs text-fg-secondary">
              É esta versão que o Passo 5 publica quando é mais nova que o master. O master continua intocado.
            </p>
            <video controls preload="metadata" src={`/api/media/${camada.output}`} className="mt-3 w-full max-h-[420px] bg-black" />
          </Card>
        )}

        {!ready && (
          <Card className="p-5 text-sm text-warning">
            <Icon name="warning" className="mr-1 align-middle" />
            O plano depende do tempo real de cada palavra. Rode o alinhamento de legendas no{" "}
            <Link href={`/projects/${id}/media`} className="underline">
              Passo 3 (Mídia)
            </Link>{" "}
            antes de gerar.
          </Card>
        )}

        {plan && data && plan.unresolved > 0 && (
          <Card className="p-5 text-sm text-warning">
            <Icon name="error_outline" className="mr-1 align-middle" />
            <strong>{plan.unresolved}</strong> inserção(ões) sem tempo confirmado: a frase-gatilho proposta pela IA não
            foi encontrada palavra por palavra no áudio alinhado, então o tempo dessas caiu num chute proporcional.
            Elas aparecem marcadas abaixo e não devem ser renderizadas sem revisão.
          </Card>
        )}

        {data && comEvidencia > 0 && (
          <Card className="p-5">
            <h3 className="font-display font-semibold">
              <Icon name="image_search" className="mr-1 align-middle text-primary-bright" />
              Evidências propostas
            </h3>
            <p className="mt-1 text-[11px] text-fg-secondary">
              <strong>{comEvidencia}</strong> inserção(ões) de arquivo pedem uma imagem de evidência que ainda não
              existe. O plano escreveu o prompt de cada uma a partir da narração — gerar é decisão sua, porque custa
              crédito no motor pago e tempo no grátis.
            </p>
            <form action={generateEvidences.bind(null, project.id)} className="mt-3 flex flex-wrap items-center gap-2">
              <select name="engine" defaultValue="POLLINATIONS" className="field px-3 py-2 text-sm">
                <option value="POLLINATIONS" className="bg-surface-low">
                  Pollinations — grátis
                </option>
                <option value="GEMINI" className="bg-surface-low">
                  Gemini / Nano Banana — pago
                </option>
              </select>
              <Button type="submit" icon="auto_awesome" variant="primary">
                Gerar {comEvidencia} evidência(s)
              </Button>
            </form>
          </Card>
        )}

        {data && overLight > 0 && (
          <Card className="p-5 text-sm text-warning">
            <Icon name="contrast" className="mr-1 align-middle" />
            <strong>{overLight}</strong> inserção(ões) caem sobre um trecho claro do master (luma medida
            acima de 110 no frame real). Nelas, o estilo transparente (Emocional) some — precisam de
            placa opaca (Autoridade, sobre metal escovado) ou texto escuro.
          </Card>
        )}

        {data && (
          <Card className="p-5">
            <h3 className="font-display font-semibold">
              <Icon name="crop_free" className="mr-1 align-middle text-primary-bright" />
              Zona segura
            </h3>
            <p className="mt-1 text-[11px] text-fg-secondary">
              As legendas do master são queimadas no vídeo — não dá para movê-las. Faixa proibida para qualquer
              inserção: <strong className="font-mono">{data.safeZone.fromPct}%–{data.safeZone.toPct}%</strong> da altura
              do quadro. {data.safeZone.note}
            </p>
          </Card>
        )}

        {!data ? (
          <Card className="grid place-items-center p-16 text-center text-sm text-muted">
            <Icon name="auto_awesome_mosaic" className="text-[40px]" />
            <p className="mt-3">Nenhum plano gerado ainda.</p>
          </Card>
        ) : (
          [...byAct.entries()].map(([act, list]) => (
            <Card key={act} className="p-5">
              <h3 className="font-display font-semibold">
                Ato {act}
                <span className="ml-2 font-mono text-[11px] font-normal text-muted">{list.length} inserção(ões)</span>
              </h3>
              <div className="mt-3 grid grid-cols-1 gap-3">
                {list.map((ins) => (
                  <div
                    key={ins.id}
                    className={`rounded border p-3 ${ins.resolved ? "border-line bg-void/40" : "border-warning/40 bg-warning/5"}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={LAYOUT_TONE[ins.layout]}>{LAYOUT_META[ins.layout].label}</Badge>
                      {ins.lowerThirdStyle && <Badge tone="neutral">{ins.lowerThirdStyle}</Badge>}
                      <span className="font-mono text-[11px] text-muted">
                        {fmtMs(ins.startMs)} – {fmtMs(ins.endMs)}
                      </span>
                      {!ins.resolved && (
                        <Badge tone="warning">
                          <Icon name="error_outline" className="mr-1 align-middle text-[13px]" />
                          tempo não confirmado
                        </Badge>
                      )}
                      {ins.backdrop && (
                        <Badge tone={ins.backdrop === "light" ? "warning" : "neutral"}>
                          <Icon name="contrast" className="mr-1 align-middle text-[13px]" />
                          fundo {ins.backdrop === "light" ? "claro" : "escuro"} · luma {ins.backdropLuma}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1.5 font-display text-sm font-semibold">{ins.primary}</div>
                    {ins.secondary && <div className="text-[12px] text-fg-secondary">{ins.secondary}</div>}
                    <p className="mt-2 text-[11px] text-muted">
                      <span className="text-fg-secondary">gatilho:</span> “{ins.trigger}”
                    </p>
                    {ins.note && <p className="mt-1 text-[11px] italic text-muted">{ins.note}</p>}
                    {ins.evidencePrompt && (
                      <p className="mt-2 rounded border border-line bg-void/40 p-2 text-[10px] text-fg-secondary">
                        <span className="text-primary-bright">evidência a gerar:</span> {ins.evidencePrompt}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          ))
        )}
      </main>
    </>
  );
}
