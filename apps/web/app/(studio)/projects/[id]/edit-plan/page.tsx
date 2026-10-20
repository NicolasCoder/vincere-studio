import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@vincere-studio/db";
import {
  EDIT_PLAN_PROMPT_VERSION,
  INTENSIDADES,
  eixosDe,
  needsOpaquePlate,
  segundosPorInsercao,
  type EditPlanData,
  type Intensidade,
  type VideoFormat,
} from "@vincere-studio/core";
import { motoresDisponiveis } from "@vincere-studio/providers";
import { Button, Card, Chip, Icon } from "@vincere-studio/ui";
import { Topbar } from "@/components/Topbar";
import { PageHeader } from "@/components/PageHeader";
import { JobWatcher } from "@/components/JobWatcher";
import { OpenRemotionStudio } from "@/components/OpenRemotionStudio";
import { getUsageSummary, fmtMs } from "@/lib/data";
import { applyVisualLayer, editarInsercao, generateEditPlan, generateEvidences, setIntensidade } from "./actions";
import { EditarInsercao } from "./EditarInsercao";

const INTENSIDADE_LABEL: Record<Intensidade, string> = {
  calmo: "Calmo",
  equilibrado: "Equilibrado",
  dinamico: "Dinâmico",
  "muito-dinamico": "Muito dinâmico",
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
  const planoDesatualizado = !!plan && plan.promptVersion !== EDIT_PLAN_PROMPT_VERSION;

  // Todos os prompts que este plano pede: a evidência única do insert-arquivo e as 2-3 da mesa.
  const promptsEvidencia = [
    ...new Set(
      (data?.insertions ?? [])
        .flatMap((i) => [...(i.evidencePrompt ? [i.evidencePrompt] : []), ...(i.mesa ?? []).map((m) => m.prompt)])
        .map((p) => p.trim())
        .filter(Boolean),
    ),
  ];
  const [jaGeradas, imagensEmAndamento] = await Promise.all([
    promptsEvidencia.length
      ? prisma.generatedImage.findMany({ where: { projectId: id, prompt: { in: promptsEvidencia } }, select: { prompt: true } })
      : Promise.resolve([]),
    prisma.job.count({ where: { projectId: id, type: "GENERATE_IMAGES", status: { in: ["QUEUED", "RUNNING"] } } }),
  ]);
  const geradas = new Set(jaGeradas.map((g) => g.prompt.trim()));
  const evidenciasFaltando = promptsEvidencia.filter((p) => !geradas.has(p)).length;
  const overLight = (data?.insertions ?? []).filter(needsOpaquePlate).length;
  const comEvidencia = (data?.insertions ?? []).filter((i) => i.evidencePrompt).length;
  const byAct = new Map<number, EditPlanData["insertions"]>();
  for (const ins of data?.insertions ?? []) {
    if (!byAct.has(ins.act)) byAct.set(ins.act, []);
    byAct.get(ins.act)!.push(ins);
  }

  const intensidadeAtual = (project.intensidade ?? "equilibrado") as Intensidade;
  const eixosAtuais = eixosDe(null, project.format as VideoFormat, intensidadeAtual);

  return (
    <>
      <Topbar crumbs={["Projetos", project.title, "Plano de Edição"]} costUsd={usage.costUsd} />
      {job && <JobWatcher jobId={job} label="Gerando plano de edição" />}
      <main className="space-y-6 p-6">
        <PageHeader
          icon="auto_awesome_mosaic"
          title="Plano de Edição (camada visual DVP)"
          subtitle="O que entra POR CIMA do master já renderizado — lower thirds, destaques de dado, intertítulos. Nada é renderizado aqui: este é o plano para você revisar."
          right={<Link href={`/projects/${project.id}/render`}><Button variant="ghost" icon="arrow_back">Voltar para Render</Button></Link>}
        />

        <Card className="p-5">
          <h3 className="font-display font-semibold">
            <Icon name="tune" className="mr-1 align-middle text-primary-bright" />
            Intensidade da edição
          </h3>
          <p className="mt-1 text-[11px] text-fg-secondary">
            Um multiplicador sobre os eixos do perfil — quanto do vídeo recebe inserção visual e quanto dos cortes
            recebe transição marcada. Vale a partir do próximo plano gerado; não muda um plano já existente.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Chip icon="layers">{eixosAtuais.insercoes}% em inserção (1 a cada {segundosPorInsercao(eixosAtuais.insercoes)}s)</Chip>
            <Chip icon="switch_video">{eixosAtuais.transicoes}% dos cortes com transição marcada</Chip>
          </div>
          <form action={setIntensidade.bind(null, project.id)} className="mt-3 flex flex-wrap items-center gap-2">
            <select name="intensidade" defaultValue={intensidadeAtual} className="field px-3 py-2 text-sm">
              {INTENSIDADES.map((i) => (
                <option key={i} value={i} className="bg-surface-low">
                  {INTENSIDADE_LABEL[i]}
                </option>
              ))}
            </select>
            <Button type="submit" size="sm" icon="check">Aplicar intensidade</Button>
          </form>
        </Card>

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
            {/* Mostra as DUAS versões: o contador do projeto não diz nada sobre as regras usadas,
                e um plano antigo não conhece os layouts novos. Sem isso, "v5" parecia recente
                quando na verdade o plano tinha sido escrito três versões de prompt atrás. */}
            {plan && <Chip icon="history">plano {plan.version}</Chip>}
            {plan && (
              <Chip icon={planoDesatualizado ? "update" : "check"} active={planoDesatualizado}>
                {plan.promptVersion ?? "regras antigas"}
                {planoDesatualizado ? ` · atual é ${EDIT_PLAN_PROMPT_VERSION}` : ""}
              </Chip>
            )}
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
            <OpenRemotionStudio projectId={project.id} />
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
            {/* Sem isto, o único jeito de sair desta página depois de aplicar a camada era o botão
                voltar do navegador — não existe stepper aqui porque o Plano de Edição não é uma
                etapa fixa (repare que não está em STAGE_META), é um desvio entre Render e Publicação. */}
            <Link href={`/projects/${project.id}/published`} className="mt-3 block">
              <Button icon="send" variant="primary" iconRight="arrow_forward" className="w-full">
                Continuar para Publicação
              </Button>
            </Link>
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
              <strong>{promptsEvidencia.length}</strong> imagem(ns) de evidência são pedidas por este plano. O plano
              escreveu o prompt de cada uma a partir da narração — gerar é decisão sua, porque custa crédito no motor
              pago e tempo no grátis.
            </p>

            {/* Contagem lida do BANCO, não de um observador de job.
                Antes, a tela seguia só o primeiro dos N jobs e ficava muda enquanto os outros
                rodavam — parecia que nada estava acontecendo quando na verdade tudo já tinha
                terminado. Contar imagem existente responde a pergunta certa ("quantas faltam?") e
                sobrevive a recarregar a página. */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Chip icon={evidenciasFaltando === 0 ? "check_circle" : "hourglass_top"} active={evidenciasFaltando === 0}>
                {promptsEvidencia.length - evidenciasFaltando}/{promptsEvidencia.length} geradas
              </Chip>
              {evidenciasFaltando > 0 && <Chip icon="pending">{evidenciasFaltando} faltando</Chip>}
              {imagensEmAndamento > 0 && <Chip icon="autorenew" active>{imagensEmAndamento} na fila agora</Chip>}
            </div>
            {imagensEmAndamento > 0 && (
              <p className="mt-2 text-[11px] text-muted">
                Recarregue a página para atualizar a contagem — cada imagem leva alguns segundos.
              </p>
            )}
            <form action={generateEvidences.bind(null, project.id)} className="mt-3 flex flex-wrap items-center gap-2">
              {/* Lista os motores com chave presente, grátis primeiro. Estava fixo em Pollinations
                  e Gemini enquanto a tela de imagens já listava os sete — inconsistência que
                  escondia justamente os motores novos, que são os melhores. */}
              <select name="engine" defaultValue={motoresDisponiveis().find((m) => !m.pago)?.id ?? "POLLINATIONS"} className="field px-3 py-2 text-sm">
                {motoresDisponiveis()
                  .sort((a, b) => Number(a.pago) - Number(b.pago))
                  .map((m) => (
                    <option key={m.id} value={m.id} className="bg-surface-low">
                      {m.label} — {m.pago ? "pago" : "grátis"}
                    </option>
                  ))}
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
                  <EditarInsercao key={ins.id} insertion={ins} action={editarInsercao.bind(null, project.id, ins.id)} />
                ))}
              </div>
            </Card>
          ))
        )}
      </main>
    </>
  );
}
