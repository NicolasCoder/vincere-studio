import { FORMATS, type VideoFormat } from "@docupulse/core";
import { Badge, Button, Card, Chip, Icon, Progress } from "@docupulse/ui";
import { loadProjectShell } from "@/components/ProjectShell";
import { fmtDuration } from "@/lib/data";
import { advanceStage } from "../../actions";

const NODES = [
  ["Áudio & Ducking", "Concatenação das locuções, mix com trilha e normalização -14 LUFS"],
  ["Composição", "Ken Burns (zoompan), transições (xfade) e montagem das cenas"],
  ["Color Grading", "LUT Obsidian Teal & Orange aplicada no filtergraph"],
  ["Legendas & Capítulos", ".ass estilizado a partir dos timestamps do Whisper"],
];

const PROFILES = [
  ["YOUTUBE_1080", "YouTube 1080p", "H.264 (QSV) · 12 Mbps · Estéreo -14 LUFS", true],
  ["SHORTS_1080x1920", "Shorts 1080×1920", "H.264 · vertical · legendas animadas", false],
  ["WEB_720", "Web 720p", "Rascunho rápido para revisão", false],
] as const;

export default async function RenderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ blocked?: string }> }) {
  const { id } = await params;
  const { blocked } = await searchParams;
  const { project, header } = await loadProjectShell(id, "RENDER", blocked);
  const format = FORMATS[project.format as VideoFormat];
  const job = project.renderJobs[0];
  const progress = job?.progress ?? 0;

  return (
    <>
      {header}
      <main className="p-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <Badge tone="violet">Projeto ativo #{project.id.slice(-6).toUpperCase()}</Badge>
            <h1 className="mt-2 max-w-3xl font-display text-3xl font-semibold leading-tight">{project.title}</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              <Chip icon="timer">{fmtDuration(project.targetDuration)} total</Chip>
              <Chip icon="hd">{format.width}×{format.height} {format.fps}fps · H.264</Chip>
              <Chip icon="surround_sound">Áudio estéreo -14 LUFS</Chip>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Button icon="download" disabled>Baixar Master</Button>
            <Button icon="play_circle" disabled>Prévia em Streaming</Button>
            <Button variant="primary" icon="movie" disabled title="Sprint 4">Iniciar Render (FFmpeg)</Button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-[1fr_22rem] gap-6">
          <div className="space-y-4">
            <Card className="overflow-hidden" accent="dual">
              <div className="relative grid aspect-video place-items-center bg-gradient-to-br from-void via-surface-low to-secondary/20">
                <div className="text-center"><Icon name="movie" className="text-[48px] text-muted" /><div className="mt-2 font-mono text-xs text-muted">Preview do render aparece aqui</div></div>
                <div className="absolute inset-x-4 bottom-4 rounded border border-line bg-void/80 p-3 backdrop-blur">
                  <div className="flex items-center justify-between font-mono text-[11px]"><span className="text-primary-bright">{progress}% renderizando...</span><span className="text-muted">{job ? `perfil ${job.profile}` : "nenhum job"}</span></div>
                  <Progress value={progress} className="mt-2" pulse />
                </div>
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between"><h3 className="font-display text-lg font-semibold"><Icon name="memory" className="mr-1 align-middle text-primary-bright" />Status das Etapas de Render</h3><span className="font-mono text-xs text-fg-secondary">Local · Intel QSV · {job?.finishedAt ? "Concluído" : "Aguardando"}</span></div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {NODES.map(([n, d], i) => {
                  const done = progress >= ((i + 1) / NODES.length) * 100;
                  return (
                    <div key={n} className="rounded border border-line bg-void/40 p-3">
                      <div className="flex items-center justify-between"><span className="flex items-center gap-2 font-mono text-xs"><Icon name={done ? "check_circle" : "radio_button_unchecked"} className={`text-[16px] ${done ? "text-success" : "text-muted"}`} />Etapa {String(i + 1).padStart(2, "0")}: {n}</span><Badge tone={done ? "success" : "neutral"}>{done ? "100% OK" : "Pendente"}</Badge></div>
                      <p className="mt-2 text-xs text-fg-secondary">{d}</p>
                      <Progress value={done ? 100 : 0} className="mt-3" />
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between"><h3 className="font-display text-lg font-semibold"><Icon name="tune" className="mr-1 align-middle text-primary-bright" />Configurações de Exportação Master</h3><span className="label-mono text-muted">Perfil padrão Studio</span></div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {PROFILES.map(([id, name, desc, rec]) => (
                  <div key={id} className={`rounded border p-3 ${rec ? "border-primary/50 bg-primary/10" : "border-line bg-void/40"}`}>
                    <div className="flex items-center justify-between"><span className="font-display text-sm font-semibold">{name}</span><Icon name={rec ? "check_circle" : "radio_button_unchecked"} className={`text-[18px] ${rec ? "text-primary-bright" : "text-muted"}`} /></div>
                    {rec && <div className="label-mono text-primary-bright">Recomendado</div>}
                    <p className="mt-2 text-xs text-fg-secondary">{desc}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex gap-6 text-xs">
                {[["Burn-in Legendas", "Estilo dinâmico / estético"], ["Capítulos YouTube", "Timestamps automáticos"], ["Norm. YouTube Audio", "Calibrado a -14 LUFS"]].map(([a, b]) => (
                  <label key={a} className="flex items-start gap-2"><input type="checkbox" defaultChecked className="mt-0.5 accent-primary" /><span><span className="font-semibold">{a}</span><br /><span className="text-fg-secondary">{b}</span></span></label>
                ))}
              </div>
            </Card>
          </div>

          <aside className="space-y-4">
            <Card className="p-4">
              <div className="flex items-center justify-between"><h3 className="font-display font-semibold"><Icon name="cloud_upload" className="mr-1 align-middle text-primary-bright" />Canal de destino</h3><Badge tone="neutral">Sprint 5</Badge></div>
              <p className="mt-2 text-xs text-fg-secondary">Conecte o YouTube em Settings para publicar direto do render, com título, descrição, tags, capítulos e thumbnail.</p>
              <div className="mt-3 rounded border border-line bg-void/60 p-3 text-xs"><div className="font-mono text-muted">Cota diária da API</div><div className="mt-1 font-mono text-primary-bright">0 de 6 uploads usados</div></div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between"><h3 className="font-display font-semibold"><Icon name="auto_awesome" className="mr-1 align-middle text-primary-bright" />SEO & Metadados por IA</h3><Badge tone="cyan">Sprint 5</Badge></div>
              <div className="mt-3 space-y-2 text-xs">
                <div><div className="label-mono text-muted">Título oficial</div><div className="field mt-1 truncate px-3 py-2">{project.title}</div></div>
                <div><div className="label-mono text-muted">Tags recomendadas</div><div className="mt-1 flex flex-wrap gap-1">{["#documentario", "#misterio", project.niche.split(" ")[0]].map((t) => <Chip key={t}>{t.toLowerCase()}</Chip>)}</div></div>
              </div>
            </Card>
            <Card className="p-4">
              <h3 className="font-display font-semibold"><Icon name="verified_user" className="mr-1 align-middle text-primary-bright" />Verificação Pré-Voo</h3>
              <ul className="mt-3 space-y-2 text-xs text-fg-secondary">
                <li className="flex gap-2"><Icon name="check_circle" className="text-[16px] text-success" />Licenças e atribuições das fontes de B-roll</li>
                <li className="flex gap-2"><Icon name="check_circle" className="text-[16px] text-success" />Duração, resolução e loudness dentro do perfil</li>
                <li className="flex gap-2"><Icon name="check_circle" className="text-[16px] text-success" />Declaração de conteúdo gerado por IA (YouTube)</li>
              </ul>
            </Card>
          </aside>
        </div>

        <Card className="mt-6 flex items-center gap-4 p-4">
          <Icon name="rocket_launch" className="text-primary-bright" />
          <div className="flex-1 text-sm"><div className="font-semibold">Render local via FFmpeg</div><div className="text-xs text-fg-secondary">Sprint 4 liga este botão ao worker; o progresso desta tela vem da tabela de jobs.</div></div>
          <Button icon="terminal" disabled>Ver Log</Button>
          <form action={advanceStage.bind(null, project.id)}><Button type="submit" variant="primary" iconRight="arrow_forward">Marcar como Publicado (demo)</Button></form>
        </Card>
      </main>
    </>
  );
}
