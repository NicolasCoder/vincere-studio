import Link from "next/link";
import { Badge, Button, Card, Chip, Icon, Stat } from "@docupulse/ui";
import { loadProjectShell } from "@/components/ProjectShell";
import { JobWatcher } from "@/components/JobWatcher";
import { fmtDuration, parseJson } from "@/lib/data";
import { getYoutubeConnection } from "@docupulse/providers";
import { generateSeoMetadata, publishToYoutube } from "./actions";

export default async function PublishedPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ blocked?: string; job?: string }> }) {
  const { id } = await params;
  const { blocked, job } = await searchParams;
  const [{ project, header, busy }, youtubeConnection] = await Promise.all([loadProjectShell(id, "PUBLISH", blocked, job), getYoutubeConnection()]);
  const pub = project.publications[0];
  const master = project.renderJobs[0];
  const stats = parseJson<{ views?: number; ctr?: number; avgViewDuration?: number }>(pub?.stats, {});
  const tags = parseJson<string[]>(pub?.tags, []);
  const chapters = parseJson<{ time: string; label: string }[]>(pub?.chapters, []);
  const canPublish = !!pub && !!master?.outputPath;

  return (
    <>
      {header}
      <main className="p-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-2">
              {pub?.publishedAt ? (
                <Badge tone="success" pill dot>Publicado com sucesso</Badge>
              ) : pub ? (
                <Badge tone="warning" pill dot>Metadados prontos · aguardando publicação manual</Badge>
              ) : (
                <Badge tone="neutral" pill dot>Ainda sem metadados de SEO</Badge>
              )}
              <span className="font-mono text-[11px] text-muted">custo total US$ {project.costUsd.toFixed(2)}</span>
            </div>
            <h1 className="mt-2 max-w-3xl font-display text-3xl font-semibold leading-tight">{pub?.title ?? project.title}</h1>
            <div className="mt-3 flex flex-wrap gap-2"><Chip icon="timer">{fmtDuration(project.targetDuration)}</Chip><Chip icon="hd">1080p H.264</Chip><Chip icon="subtitles">Legendas sincronizadas</Chip></div>
          </div>
          <div className="flex flex-col gap-2">
            {pub?.url && <a href={pub.url} target="_blank" rel="noreferrer"><Button icon="smart_display" className="w-full">Assistir no YouTube ↗</Button></a>}
            {master?.outputPath ? (
              <a href={`/api/media/${master.outputPath}?download=1`}><Button icon="download" className="w-full">Baixar Master</Button></a>
            ) : (
              <Button icon="download" disabled title="Renderize o vídeo no Passo 4 primeiro">Baixar Master</Button>
            )}
            {pub?.publishedAt ? (
              <Button variant="primary" icon="check_circle" disabled>Publicado no YouTube</Button>
            ) : youtubeConnection ? (
              <form action={publishToYoutube.bind(null, project.id)} className="flex flex-col gap-1.5">
                <select name="privacyStatus" defaultValue="private" className="field px-2 py-1.5 text-xs">
                  <option value="private" className="bg-surface-low">Privado</option>
                  <option value="unlisted" className="bg-surface-low">Não listado</option>
                  <option value="public" className="bg-surface-low">Público</option>
                </select>
                <Button type="submit" variant="primary" icon="cloud_upload" className="w-full" disabled={busy || !canPublish} title={canPublish ? "" : "Gere os metadados de SEO e finalize o render no Passo 4 antes"}>
                  Publicar no YouTube
                </Button>
              </form>
            ) : (
              <Link href="/settings"><Button icon="link" variant="ghost" className="w-full">Conectar canal (Settings)</Button></Link>
            )}
          </div>
        </div>

        {job && <div className="mt-4"><JobWatcher jobId={job} label="Publicando no YouTube" /></div>}

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_22rem]">
          <div className="space-y-4">
            <Card className="overflow-hidden" accent="dual">
              <div className="relative grid aspect-video place-items-center overflow-hidden bg-gradient-to-br from-void via-surface-low to-primary/20">
                {project.thumbnailPath ? (
                  <>
                    <img src={`/api/media/${project.thumbnailPath}`} alt={pub?.title ?? project.title} className="absolute inset-0 h-full w-full object-cover" />
                    <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-void/80 to-transparent p-3">
                      <div className="flex justify-center gap-2">{pub?.url && <a href={pub.url} target="_blank" rel="noreferrer"><Button variant="primary" icon="play_arrow">Assistir no YouTube</Button></a>}<Button icon="content_copy">Copiar Link</Button></div>
                    </div>
                  </>
                ) : (
                  <div className="text-center"><div className="font-display text-3xl font-bold">{pub?.title ?? project.title}</div><div className="mt-2 font-mono text-xs text-fg-secondary">Gere a thumbnail no Passo 4 (Render) pra ela aparecer aqui</div><div className="mt-4 flex justify-center gap-2">{pub?.url && <a href={pub.url} target="_blank" rel="noreferrer"><Button variant="primary" icon="play_arrow">Assistir no YouTube</Button></a>}<Button icon="content_copy">Copiar Link</Button></div></div>
                )}
              </div>
              <div className="grid grid-cols-1 divide-y divide-line border-t border-line text-xs sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                <div className="p-3"><div className="label-mono text-muted">URL oficial</div><div className="mt-1 truncate font-mono text-primary-bright">{pub?.url ?? "—"}</div></div>
                <div className="p-3"><div className="label-mono text-muted">Video ID</div><div className="mt-1 font-mono">{pub?.videoId ?? "—"}</div></div>
                <div className="p-3"><div className="label-mono text-muted">Publicado em</div><div className="mt-1 font-mono">{pub?.publishedAt ? new Date(pub.publishedAt).toLocaleString("pt-BR") : "—"}</div></div>
              </div>
            </Card>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Stat label="Views" value={(stats.views ?? 0).toLocaleString("pt-BR")} sub="YouTube Analytics" />
              <Stat label="CTR" value={`${stats.ctr ?? 0}%`} sub="thumbnail ativa" tone="violet" />
              <Stat label="Duração média" value={fmtDuration(stats.avgViewDuration)} sub="retenção real" tone="fg" />
            </div>
          </div>
          <aside className="space-y-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-semibold"><Icon name="auto_awesome" className="mr-1 align-middle text-primary-bright" />SEO & Metadados</h3>
                <form action={generateSeoMetadata.bind(null, project.id)}>
                  <Button type="submit" size="sm" variant={pub ? "ghost" : "primary"} icon="auto_awesome">
                    {pub ? "Regerar com IA" : "Gerar com IA"}
                  </Button>
                </form>
              </div>
              <div className="mt-3 text-xs"><div className="label-mono text-muted">Descrição</div><p className="mt-1 whitespace-pre-wrap text-fg-secondary">{pub?.description || "Gere título, descrição, tags e capítulos automaticamente a partir do roteiro."}</p></div>
              <div className="mt-3 flex flex-wrap gap-1">{tags.map((t) => <Chip key={t}>#{t}</Chip>)}</div>
              {chapters.length > 0 && (
                <div className="mt-3 text-xs">
                  <div className="label-mono text-muted">Capítulos</div>
                  <div className="mt-1 space-y-0.5 font-mono text-[11px] text-fg-secondary">
                    {chapters.map((c, i) => <div key={i}>{c.time} · {c.label}</div>)}
                  </div>
                </div>
              )}
            </Card>
            <Card className="p-4">
              <h3 className="font-display font-semibold">Próximos passos</h3>
              <div className="mt-3 flex flex-col gap-2">
                <Link href="/projects"><Button icon="add" className="w-full">Criar Novo Documentário</Button></Link>
                <Link href={`/projects/${project.id}/repurposing`}><Button icon="content_cut" variant="ghost" className="w-full">Ver cortes sugeridos & transcrição</Button></Link>
              </div>
            </Card>
          </aside>
        </div>
      </main>
    </>
  );
}
