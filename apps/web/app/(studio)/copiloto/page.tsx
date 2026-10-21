import Link from "next/link";
import { prisma } from "@vincere-studio/db";
import { Topbar } from "@/components/Topbar";
import { PageHeader } from "@/components/PageHeader";
import { Badge, Button, Card, Icon } from "@vincere-studio/ui";
import { NICHOS } from "@/lib/nichos";
import { chamarFerramenta, lerResposta } from "@/lib/voicestudio";
import { getPcGpuStatus } from "@/lib/pc-gpu-engine";
import { AutoRefresh } from "./AutoRefresh";
import {
  alinharLegendas, buscarBroll, chamarSkill, criarVideo, enviarAoHyperFrames, escolherIdeia, gerarRoteiro,
  importarCaixaDeEntrada, iniciarNoHyperFrames, maisIdeias, narrarRoteiro, planejarCenas, renderizar, salvarBeat, temaParaBeats,
} from "./actions";

export const dynamic = "force-dynamic";

const ETAPAS = [
  { n: 1, label: "Ideia", icon: "lightbulb" },
  { n: 2, label: "Roteiro", icon: "description" },
  { n: 3, label: "Narração", icon: "record_voice_over" },
  { n: 4, label: "Cenas & B-roll", icon: "perm_media" },
  { n: 5, label: "Bruto → HyperFrames", icon: "movie_filter" },
] as const;

/** Skills que a esteira oferece em cada etapa (rodam no Claude do PC pela caixa de pedidos). */
const SKILLS: Record<number, { skill: string; rotulo: string; instrucao: string }[]> = {
  1: [
    { skill: "/vincere-tendencias", rotulo: "Pesquisar tendências", instrucao: "Pesquise temas em alta para este nicho, com evidência e links, e sugira 5 ângulos." },
  ],
  2: [
    { skill: "/humanizer", rotulo: "Humanizar a narração", instrucao: "Reescreva as falas do roteiro para soarem naturais, sem tom de IA, mantendo fatos e fontes." },
  ],
  3: [
    { skill: "/editar-igor", rotulo: "Cortar silêncios", instrucao: "Corte silêncios e pausas longas da narração (mantendo as pausas dramáticas marcadas) e devolva o áudio ajustado." },
    { skill: "/subtitles-studio", rotulo: "Legendas dinâmicas", instrucao: "Monte as legendas dinâmicas a partir das palavras alinhadas." },
  ],
  4: [
    { skill: "/get-brolls", rotulo: "B-roll com curadoria", instrucao: "Busque B-roll real para as cenas sem mídia, gere as prévias para eu aprovar e entregue na pasta inbox do projeto, com a origem registrada." },
    { skill: "/flow-studio", rotulo: "Cenas no Flow", instrucao: "Gere as cenas conceituais no Google Flow a partir dos prompts do projeto." },
  ],
  5: [
    { skill: "/anthropic-skills:edicao-profissional", rotulo: "Edição profissional", instrucao: "Aplique a edição final (tipografia, zooms, light leaks, sound design) sobre o bruto." },
  ],
};

const NOME_DO_JOB: Record<string, string> = {
  GENERATE_IDEAS: "Gerando ideias", GENERATE_SCRIPT: "Escrevendo o roteiro", SYNTHESIZE_VOICE: "Narrando",
  ALIGN_CAPTIONS: "Alinhando legendas", GENERATE_SCENE_PROMPTS: "Planejando cenas", HUNT_BROLL: "Buscando B-roll",
  IMPORT_INBOX: "Importando a caixa de entrada", RENDER_VIDEO: "Montando o bruto",
};

type SP = {
  projeto?: string; etapa?: string; job?: string; modo?: string; ok?: string; erro?: string;
  tema?: string; nicho?: string; formato?: string; angulo?: string; ganchos?: string;
};

interface VozVs { id: string; nome: string; origem: string }

/** Vozes do VoiceStudio: clonadas/RVC do PC com GPU e da nuvem. Se estiver fora do ar, a lista vem vazia. */
async function vozesDoVoiceStudio(): Promise<VozVs[]> {
  const out: VozVs[] = [];
  try {
    const pc = await getPcGpuStatus();
    for (const v of pc?.localVoices ?? []) out.push({ id: v.id, nome: v.name, origem: "PC com GPU" });
    for (const r of pc?.rvcModels ?? []) out.push({ id: r.id, nome: r.name, origem: "PC com GPU · RVC" });
  } catch {}
  try {
    const lista = lerResposta<{ id: string; name: string }[]>(await chamarFerramenta("list_voices", {}, 3500));
    for (const v of lista) out.push({ id: v.id, nome: v.name, origem: "Nuvem" });
  } catch {}
  return out;
}

export default async function CopilotoPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const etapaPedida = Number(sp.etapa) || 0;
  const projetos = await prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    take: 12,
    select: { id: true, title: true, stage: true, format: true },
  });
  const p = sp.projeto
    ? await prisma.project.findUnique({
        where: { id: sp.projeto },
        include: {
          ideas: { orderBy: { createdAt: "desc" } },
          scripts: {
            orderBy: { version: "desc" },
            take: 1,
            include: { blocks: { orderBy: { order: "asc" }, include: { voiceTracks: true, scenes: { orderBy: { order: "asc" } } } } },
          },
          renderJobs: { orderBy: { startedAt: "desc" }, take: 3 },
        },
      })
    : null;

  const perfis = (await prisma.voiceProfile.findMany({ orderBy: { name: "asc" } })).filter((v) => v.provider !== "ELEVENLABS");
  const vozesVs = etapaPedida === 3 || (sp.projeto && !sp.etapa) ? await vozesDoVoiceStudio() : [];
  const jobsAtivos = p ? await prisma.job.findMany({ where: { projectId: p.id, status: { in: ["QUEUED", "RUNNING"] } }, orderBy: { createdAt: "desc" } }) : [];
  const ultimoErro = p
    ? await prisma.job.findFirst({ where: { projectId: p.id, status: "FAILED" }, orderBy: { createdAt: "desc" }, select: { type: true, error: true, createdAt: true } })
    : null;

  const blocos = p?.scripts[0]?.blocks ?? [];
  const cenas = blocos.flatMap((b) => b.scenes);
  const render = p?.renderJobs[0];
  const feito: Record<number, boolean> = {
    1: !!p?.ideas.some((i) => i.selected),
    2: blocos.length > 0,
    3: blocos.length > 0 && blocos.every((b) => b.voiceTracks.length > 0),
    4: cenas.length > 0 && cenas.every((c) => c.status === "READY"),
    5: !!render?.outputPath,
  };
  const primeiraPendente = ETAPAS.find((e) => !feito[e.n])?.n ?? 5;
  const etapa = Math.min(5, Math.max(1, Number(sp.etapa) || (p ? primeiraPendente : 1)));
  const qs = (e: number) => `/copiloto?projeto=${p?.id}&etapa=${e}`;
  const ocupado = jobsAtivos.length > 0;
  const skillsDaEtapa = SKILLS[etapa] ?? [];
  const nicho = p ? NICHOS.find((n) => n.nome === p.tone) : undefined;

  return (
    <>
      <Topbar crumbs={["Criar", "Copiloto"]} />
      <main className="space-y-6 p-4 sm:p-6">
        <AutoRefresh ativo={ocupado} />
        <PageHeader
          icon="psychology"
          title="Copiloto — esteira de criação"
          subtitle="Da ideia ao vídeo bruto em um lugar só: roteiro, narração, cenas e B-roll. Quando o bruto fica pronto, ele segue para o HyperFrames para a edição final."
          right={
            <Link href="/copiloto" className="inline-flex h-10 items-center gap-2 rounded border border-line bg-surface/60 px-4 text-sm font-semibold text-fg-secondary hover:border-primary-bright hover:text-fg">
              <Icon name="add" className="text-[18px]" /> Novo vídeo
            </Link>
          }
        />

        {projetos.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {projetos.map((x) => (
              <Link
                key={x.id}
                href={`/copiloto?projeto=${x.id}`}
                className={`shrink-0 rounded border px-3 py-2 text-xs transition-colors ${
                  p?.id === x.id ? "border-primary bg-primary/10 text-primary-bright" : "border-line bg-surface-low text-fg-secondary hover:border-primary-bright"
                }`}
              >
                <span className="font-medium">{x.title.length > 34 ? `${x.title.slice(0, 34)}…` : x.title}</span>
                <span className="ml-2 font-mono text-[10px] text-muted">{x.format === "SHORT_9_16" ? "9:16" : "16:9"}</span>
              </Link>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {ETAPAS.map((e) => {
            const ativa = etapa === e.n;
            const corpo = (
              <>
                <Icon name={feito[e.n] ? "check_circle" : e.icon} className={`text-[18px] ${feito[e.n] ? "text-emerald-400" : ""}`} />
                <span>{e.n}. {e.label}</span>
              </>
            );
            const cls = `flex items-center gap-2 rounded border p-3 text-left text-sm transition-all ${
              ativa ? "border-primary bg-primary/10 font-medium text-primary-bright" : feito[e.n] ? "border-line bg-surface-low text-fg" : "border-line bg-surface-low/50 text-muted"
            }`;
            return p ? <Link key={e.n} href={qs(e.n)} className={cls}>{corpo}</Link> : <div key={e.n} className={cls}>{corpo}</div>;
          })}
        </div>

        {p && ocupado && (
          <div className="flex items-center gap-2 rounded border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary-bright">
            <Icon name="progress_activity" className="animate-spin text-[18px]" />
            {jobsAtivos.map((j) => NOME_DO_JOB[j.type] ?? j.type).join(" · ")}… {jobsAtivos[0]?.message ? `(${jobsAtivos[0].message})` : ""}
          </div>
        )}
        {p && !ocupado && ultimoErro && ultimoErro.createdAt > p.updatedAt && (
          <div className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            Último erro ({NOME_DO_JOB[ultimoErro.type] ?? ultimoErro.type}): {ultimoErro.error?.slice(0, 240) ?? "sem detalhe"}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            {/* ETAPA 1 — IDEIA */}
            {etapa === 1 && !p && (
              <Card className="space-y-4 p-5">
                <h2 className="font-display text-base font-semibold">1. Qual vídeo vamos criar?</h2>
                <form action={criarVideo} className="space-y-4">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {NICHOS.map((n, i) => (
                      <label key={n.id} className="flex cursor-pointer items-start gap-3 rounded border border-line bg-surface-low p-3 text-xs has-[:checked]:border-primary has-[:checked]:bg-primary/10">
                        <input type="radio" name="nicho" value={n.id} defaultChecked={sp.nicho ? sp.nicho === n.id : i === 0} className="mt-1 accent-primary" />
                        <span>
                          <span className="flex items-center gap-1.5 text-sm font-medium"><Icon name={n.icone} className="text-[16px] text-primary-bright" />{n.nome}</span>
                          <span className="mt-1 block text-muted">{n.resumo}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <label className="block text-xs text-fg-secondary">
                    Tema do vídeo
                    <input name="tema" required minLength={3} maxLength={120} defaultValue={sp.tema ?? NICHOS[0].exemploTema} className="mt-1 w-full rounded border border-line bg-surface-low px-3 py-2 text-sm text-fg" />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="block text-xs text-fg-secondary">
                      Formato
                      <select name="formato" defaultValue={sp.formato ?? "SHORT_9_16"} className="mt-1 w-full rounded border border-line bg-surface-low px-3 py-2 text-sm text-fg">
                        <option value="SHORT_9_16">Vertical 9:16 (Reels/Shorts)</option>
                        <option value="LONG_16_9">Horizontal 16:9 (YouTube)</option>
                      </select>
                    </label>
                    <label className="block text-xs text-fg-secondary">
                      Duração (segundos)
                      <input name="duracao" type="number" min={15} max={3600} placeholder="automático" className="mt-1 w-full rounded border border-line bg-surface-low px-3 py-2 text-sm text-fg" />
                    </label>
                    <label className="block text-xs text-fg-secondary">
                      Tom
                      <input name="tom" maxLength={120} placeholder="ex.: investigativo, sério" className="mt-1 w-full rounded border border-line bg-surface-low px-3 py-2 text-sm text-fg" />
                    </label>
                  </div>
                  {sp.angulo && <input type="hidden" name="angulo" value={sp.angulo} />}
                  {sp.ganchos && <input type="hidden" name="ganchos" value={sp.ganchos} />}
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" formAction={temaParaBeats} variant="primary" icon="auto_awesome">Tema pronto: organizar os beats</Button>
                    <Button type="submit" variant="outline" icon="lightbulb">Gerar ideias primeiro</Button>
                  </div>
                  <p className="text-[11px] text-muted">
                    {sp.tema ? "Tema vindo de Tendências. " : ""}“Organizar os beats” cria o projeto com este tema e já escreve o roteiro em blocos, pronto para a narração. “Gerar ideias” propõe 3 ângulos para você escolher.
                  </p>
                </form>
              </Card>
            )}
            {etapa === 1 && !p && (
              <Card className="space-y-3 p-5">
                <h2 className="flex items-center gap-2 font-display text-base font-semibold"><Icon name="movie_filter" className="text-[18px] text-primary-bright" /> Prefere começar direto pelo HyperFrames?</h2>
                <p className="text-xs text-muted">Sem a esteira: você monta o vídeo no HyperFrames e usa as ferramentas do Vincere quando quiser (imagens e vídeos do Flow, B-roll, legendas).</p>
                {sp.ok && <p className="rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">Pedido enviado para o projeto “{sp.ok}”. Acompanhe em “Pedidos ao Claude” (Vince) e abra o HyperFrames Studio.</p>}
                {sp.erro && <p className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">{sp.erro === "nome" ? "Dê um nome ao projeto (mínimo 3 letras)." : "Skill inválida."}</p>}
                <form action={iniciarNoHyperFrames} className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-xs text-fg-secondary">Nome do projeto
                      <input name="nome" minLength={3} maxLength={60} placeholder="ex.: reel-oferta-serum" className="mt-1 w-full rounded border border-line bg-surface-low px-3 py-2 text-sm text-fg" />
                    </label>
                    <label className="block text-xs text-fg-secondary">Formato
                      <select name="formato" className="mt-1 w-full rounded border border-line bg-surface-low px-3 py-2 text-sm text-fg">
                        <option value="SHORT_9_16">Vertical 9:16</option>
                        <option value="LONG_16_9">Horizontal 16:9</option>
                      </select>
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" name="skill" value="/hyperframes" variant="primary" icon="movie_filter">Criar projeto vazio</Button>
                    <Button type="submit" name="skill" value="/get-brolls" variant="outline" icon="perm_media">Criar + B-roll</Button>
                    <Button type="submit" name="skill" value="/subtitles-studio" variant="outline" icon="subtitles">Criar + legendas</Button>
                    <Button type="submit" name="skill" value="/flow-studio" variant="outline" icon="auto_awesome">Criar + imagens/vídeo do Flow</Button>
                  </div>
                </form>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Link href="/studio" className="rounded border border-line bg-surface-low px-3 py-2 hover:border-primary-bright">Abrir HyperFrames Studio</Link>
                  <Link href="/flow-studio" className="rounded border border-line bg-surface-low px-3 py-2 hover:border-primary-bright">Imagem e vídeo (Flow)</Link>
                </div>
              </Card>
            )}
            {etapa === 1 && p && (
              <Card className="space-y-3 p-5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-display text-base font-semibold">1. Ideia — escolha o ângulo</h2>
                  <form action={maisIdeias.bind(null, p.id)}><Button size="sm" variant="outline" icon="refresh" type="submit" disabled={ocupado}>Mais ideias</Button></form>
                </div>
                {p.ideas.length === 0 && <p className="text-sm text-muted">{ocupado ? "Gerando as ideias…" : "Nenhuma ideia ainda. Clique em “Mais ideias”."}</p>}
                {p.ideas.map((i) => (
                  <div key={i.id} className={`rounded border p-3 ${i.selected ? "border-primary bg-primary/10" : "border-line bg-surface-low"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{i.title}</p>
                        <p className="mt-1 text-xs text-fg-secondary">{i.synopsis}</p>
                        {i.recommended && <Badge className="mt-2">Recomendada</Badge>}
                      </div>
                      <form action={escolherIdeia.bind(null, p.id, i.id)}>
                        <Button size="sm" type="submit" variant={i.selected ? "secondary" : "primary"} disabled={ocupado}>{i.selected ? "Refazer roteiro" : "Usar esta"}</Button>
                      </form>
                    </div>
                  </div>
                ))}
              </Card>
            )}

            {/* ETAPA 2 — ROTEIRO */}
            {etapa === 2 && p && (
              <Card className="space-y-3 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-display text-base font-semibold">2. Roteiro em beats</h2>
                  <div className="flex gap-2">
                    <form action={gerarRoteiro.bind(null, p.id)}><Button size="sm" variant="outline" icon="refresh" type="submit" disabled={ocupado || !feito[1]}>{blocos.length ? "Gerar de novo" : "Gerar roteiro"}</Button></form>
                    <Link href={`/projects/${p.id}/script`} className="inline-flex h-8 items-center gap-1 rounded border border-line px-3 text-xs text-fg-secondary hover:border-primary-bright">Editor completo</Link>
                  </div>
                </div>
                {!feito[1] && <p className="text-sm text-muted">Escolha uma ideia na etapa 1 para gerar o roteiro.</p>}
                {blocos.map((b) => (
                  <form key={b.id} action={salvarBeat.bind(null, p.id, b.id)} className="space-y-2 rounded border border-line bg-surface-low p-3">
                    <div className="flex items-center justify-between gap-2 text-[11px] text-muted">
                      <span className="font-mono">#{b.order} · {b.kind}</span>
                      {b.retentionScore != null && <span>retenção {b.retentionScore}</span>}
                    </div>
                    <input name="title" defaultValue={b.title} className="w-full rounded border border-line bg-surface px-2 py-1 text-sm font-medium text-fg" />
                    <textarea name="narration" defaultValue={b.narration} rows={3} className="w-full rounded border border-line bg-surface px-2 py-1 text-sm text-fg" />
                    {b.brollCue && <p className="text-[11px] text-muted">B-roll: {b.brollCue}</p>}
                    <Button size="sm" type="submit" variant="outline" icon="save">Salvar beat</Button>
                  </form>
                ))}
              </Card>
            )}

            {/* ETAPA 3 — NARRAÇÃO */}
            {etapa === 3 && p && (
              <Card className="space-y-4 p-5">
                <h2 className="font-display text-base font-semibold">3. Narração</h2>
                {!feito[2] ? (
                  <p className="text-sm text-muted">Gere o roteiro na etapa 2 antes de narrar.</p>
                ) : (
                  <>
                    <form action={narrarRoteiro.bind(null, p.id)} className="space-y-3">
                      <label className="block text-xs text-fg-secondary">
                        Voz da narração
                        <select name="voz" defaultValue={p.voiceProfileId ? `perfil:${p.voiceProfileId}` : ""} className="mt-1 w-full rounded border border-line bg-surface-low px-3 py-2 text-sm text-fg">
                          <option value="">Padrão do sistema</option>
                          <optgroup label="Vozes grátis (Edge / Gemini)">
                            {perfis.filter((v) => v.provider !== "VOICESTUDIO").map((v) => <option key={v.id} value={`perfil:${v.id}`}>{v.name} · {v.provider}</option>)}
                          </optgroup>
                          <optgroup label="VoiceStudio (voz clonada)">
                            {vozesVs.length === 0 && <option disabled>VoiceStudio fora do ar (ligue a ponte ou o túnel)</option>}
                            {vozesVs.map((v) => <option key={`${v.origem}${v.id}`} value={`vs:${v.id}|${v.nome}`}>{v.nome} · {v.origem}</option>)}
                          </optgroup>
                        </select>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-fg-secondary"><input type="checkbox" name="refazer" className="accent-primary" /> Refazer blocos que já têm áudio</label>
                      <Button type="submit" variant="primary" icon="record_voice_over" disabled={ocupado}>Narrar o roteiro</Button>
                    </form>
                    <ul className="space-y-1 text-xs">
                      {blocos.map((b) => (
                        <li key={b.id} className="flex items-center justify-between gap-2 rounded border border-line bg-surface-low px-3 py-1.5">
                          <span className="truncate">#{b.order} {b.title}</span>
                          {b.voiceTracks[0] ? (
                            <span className="flex shrink-0 items-center gap-2">
                              <audio controls preload="none" src={`/api/media/${b.voiceTracks[0].filePath}`} className="h-7" />
                              <span className="font-mono text-muted">{(b.voiceTracks[0].durationMs / 1000).toFixed(1)}s</span>
                            </span>
                          ) : <span className="text-muted">sem áudio</span>}
                        </li>
                      ))}
                    </ul>
                    <form action={alinharLegendas.bind(null, p.id)}>
                      <Button size="sm" variant="outline" icon="subtitles" type="submit" disabled={ocupado || !feito[3]}>Alinhar legendas (palavra por palavra)</Button>
                    </form>
                    <p className="text-[11px] text-muted">
                      Quer a sua voz clonada (PC com GPU ou nuvem)? Use a <Link href="/voice-studio" className="text-primary-bright underline">Central de Vozes</Link>, que escolhe entre o PC e a VPS.
                    </p>
                  </>
                )}
              </Card>
            )}

            {/* ETAPA 4 — CENAS E B-ROLL */}
            {etapa === 4 && p && (
              <Card className="space-y-4 p-5">
                <h2 className="font-display text-base font-semibold">4. Cenas & B-roll</h2>
                {!feito[3] ? (
                  <p className="text-sm text-muted">Narre o roteiro na etapa 3: a duração da voz define o tempo de cada cena.</p>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <form action={planejarCenas.bind(null, p.id, "dense")}><Button size="sm" variant="primary" icon="grid_view" type="submit" disabled={ocupado}>Planejar cenas</Button></form>
                      <form action={buscarBroll.bind(null, p.id)}><Button size="sm" variant="outline" icon="search" type="submit" disabled={ocupado || cenas.length === 0}>Buscar B-roll grátis</Button></form>
                      <form action={importarCaixaDeEntrada.bind(null, p.id)}><Button size="sm" variant="outline" icon="inbox" type="submit" disabled={ocupado}>Importar caixa de entrada</Button></form>
                      <Link href={`/projects/${p.id}/media`} className="inline-flex h-8 items-center gap-1 rounded border border-line px-3 text-xs text-fg-secondary hover:border-primary-bright">Editor de cenas</Link>
                    </div>
                    <p className="text-xs text-muted">
                      {cenas.length} cenas · {cenas.filter((c) => c.status === "READY").length} com mídia · {cenas.filter((c) => c.status !== "READY").length} pendentes
                    </p>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                      {cenas.slice(0, 40).map((c) => (
                        <div key={c.id} className={`aspect-video overflow-hidden rounded border ${c.status === "READY" ? "border-line" : "border-amber-500/50"} bg-surface-low`}>
                          {c.filePath && c.status === "READY" ? (
                            c.mediaType === "video" ? (
                              <video src={`/api/media/${c.filePath}`} muted preload="metadata" className="h-full w-full object-cover" />
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={`/api/media/${c.thumbPath ?? c.filePath}`} alt="" className="h-full w-full object-cover" />
                            )
                          ) : <div className="grid h-full place-items-center text-[10px] text-muted">sem mídia</div>}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </Card>
            )}

            {/* ETAPA 5 — BRUTO → HYPERFRAMES */}
            {etapa === 5 && p && (
              <Card className="space-y-4 p-5">
                <h2 className="font-display text-base font-semibold">5. Bruto → HyperFrames</h2>
                {!feito[4] ? (
                  <p className="text-sm text-muted">Complete as cenas na etapa 4 (todas com mídia) para montar o bruto.</p>
                ) : (
                  <>
                    <form action={renderizar.bind(null, p.id)} className="space-y-3">
                      <label className="flex items-center gap-2 text-xs text-fg-secondary"><input type="checkbox" name="musica" defaultChecked className="accent-primary" /> Com trilha musical</label>
                      <div className="flex flex-wrap gap-2">
                        <Button type="submit" name="prova" value="1" variant="outline" icon="visibility" disabled={ocupado}>Prova rápida</Button>
                        <Button type="submit" variant="primary" icon="movie" disabled={ocupado}>Montar o bruto</Button>
                      </div>
                    </form>
                    {render?.outputPath ? (
                      <div className="space-y-2">
                        <video controls preload="metadata" src={`/api/media/${render.outputPath}`} className={`rounded border border-line ${p.format === "SHORT_9_16" ? "max-h-[420px]" : "w-full"}`} />
                        <div className="flex flex-wrap gap-2">
                          <form action={enviarAoHyperFrames.bind(null, p.id)}><Button type="submit" variant="primary" icon="send">Enviar o bruto ao HyperFrames</Button></form>
                          <Link href="/studio" className="inline-flex h-10 items-center gap-2 rounded border border-line px-4 text-sm text-fg-secondary hover:border-primary-bright">Abrir HyperFrames Studio</Link>
                          <Link href={`/projects/${p.id}/render`} className="inline-flex h-10 items-center gap-2 rounded border border-line px-4 text-sm text-fg-secondary hover:border-primary-bright">Legendas e versões</Link>
                        </div>
                      </div>
                    ) : <p className="text-xs text-muted">O bruto ainda não foi montado.</p>}
                  </>
                )}
              </Card>
            )}
          </div>

          <div className="space-y-4">
            {p && skillsDaEtapa.length > 0 && (
              <Card className="space-y-2 p-4">
                <h3 className="flex items-center gap-2 font-display text-sm font-semibold"><Icon name="bolt" className="text-[18px] text-primary-bright" /> Skills desta etapa</h3>
                <p className="text-[11px] text-muted">Pedem ao Claude do seu PC (a ponte precisa estar ligada). A resposta aparece em “Pedidos ao Claude”, no Vince.</p>
                {skillsDaEtapa.map((s) => (
                  <form key={s.skill} action={chamarSkill.bind(null, p.id, etapa, s.skill, s.instrucao)}>
                    <button type="submit" className="flex w-full items-center justify-between rounded border border-line bg-surface-low px-3 py-2 text-left text-xs hover:border-primary-bright">
                      <span><span className="font-medium">{s.rotulo}</span><span className="block font-mono text-[10px] text-muted">{s.skill}</span></span>
                      <Icon name="arrow_forward" className="text-[14px] text-muted" />
                    </button>
                  </form>
                ))}
              </Card>
            )}
            <Card className="space-y-2 p-4">
              <h3 className="flex items-center gap-2 font-display text-sm font-semibold"><Icon name="route" className="text-[18px] text-primary-bright" /> Atalhos</h3>
              <div className="flex flex-col gap-2 text-xs">
                {p && <Link href={`/projects/${p.id}/ideation`} className="rounded border border-line bg-surface-low px-3 py-2 hover:border-primary-bright">Abrir este vídeo em Projetos</Link>}
                <Link href="/studio" className="rounded border border-line bg-surface-low px-3 py-2 hover:border-primary-bright">HyperFrames Studio</Link>
                <Link href="/voice-studio" className="rounded border border-line bg-surface-low px-3 py-2 hover:border-primary-bright">Central de Vozes</Link>
                <Link href="/projects" className="rounded border border-line bg-surface-low px-3 py-2 hover:border-primary-bright">Biblioteca de projetos</Link>
              </div>
            </Card>
            {nicho && (
              <Card className="space-y-1 p-4 text-xs text-muted">
                <h3 className="font-display text-sm font-semibold text-fg">Receita do nicho</h3>
                <ol className="list-decimal space-y-1 pl-4">{nicho.passos.map((x) => <li key={x}>{x}</li>)}</ol>
              </Card>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
