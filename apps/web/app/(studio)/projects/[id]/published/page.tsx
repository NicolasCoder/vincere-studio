import Link from "next/link";
import { Badge, Button, Card, Chip, Icon, Stat } from "@docupulse/ui";
import { loadProjectShell } from "@/components/ProjectShell";
import { fmtDuration, parseJson } from "@/lib/data";

export default async function PublishedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { project, header } = await loadProjectShell(id, "PUBLISH");
  const pub = project.publications[0];
  const stats = parseJson<{ views?: number; ctr?: number; avgViewDuration?: number }>(pub?.stats, {});
  const tags = parseJson<string[]>(pub?.tags, []);

  return (
    <>
      {header}
      <main className="p-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-2"><Badge tone="success" pill dot>Publicado com sucesso</Badge><span className="font-mono text-[11px] text-muted">custo total US$ {project.costUsd.toFixed(2)}</span></div>
            <h1 className="mt-2 max-w-3xl font-display text-3xl font-semibold leading-tight">{pub?.title ?? project.title}</h1>
            <div className="mt-3 flex flex-wrap gap-2"><Chip icon="timer">{fmtDuration(project.targetDuration)}</Chip><Chip icon="hd">1080p H.264</Chip><Chip icon="subtitles">Legendas sincronizadas</Chip></div>
          </div>
          <div className="flex flex-col gap-2">
            {pub?.url && <a href={pub.url} target="_blank" rel="noreferrer"><Button icon="smart_display" className="w-full">Assistir no YouTube ↗</Button></a>}
            <Button icon="download" disabled>Baixar Master</Button>
            <Button variant="primary" icon="check_circle" disabled>Publicado no YouTube</Button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-[1fr_22rem] gap-6">
          <div className="space-y-4">
            <Card className="overflow-hidden" accent="dual">
              <div className="relative grid aspect-video place-items-center bg-gradient-to-br from-void via-surface-low to-primary/20">
                <div className="text-center"><div className="font-display text-3xl font-bold">{pub?.title ?? project.title}</div><div className="mt-2 font-mono text-xs text-fg-secondary">Thumbnail gerada com IA aparece aqui (Sprint 5)</div><div className="mt-4 flex justify-center gap-2">{pub?.url && <a href={pub.url} target="_blank" rel="noreferrer"><Button variant="primary" icon="play_arrow">Assistir no YouTube</Button></a>}<Button icon="content_copy">Copiar Link</Button></div></div>
              </div>
              <div className="grid grid-cols-3 divide-x divide-line border-t border-line text-xs">
                <div className="p-3"><div className="label-mono text-muted">URL oficial</div><div className="mt-1 truncate font-mono text-primary-bright">{pub?.url ?? "—"}</div></div>
                <div className="p-3"><div className="label-mono text-muted">Video ID</div><div className="mt-1 font-mono">{pub?.videoId ?? "—"}</div></div>
                <div className="p-3"><div className="label-mono text-muted">Publicado em</div><div className="mt-1 font-mono">{pub?.publishedAt ? new Date(pub.publishedAt).toLocaleString("pt-BR") : "—"}</div></div>
              </div>
            </Card>
            <div className="grid grid-cols-3 gap-4">
              <Stat label="Views" value={(stats.views ?? 0).toLocaleString("pt-BR")} sub="YouTube Analytics" />
              <Stat label="CTR" value={`${stats.ctr ?? 0}%`} sub="thumbnail ativa" tone="violet" />
              <Stat label="Duração média" value={fmtDuration(stats.avgViewDuration)} sub="retenção real" tone="fg" />
            </div>
          </div>
          <aside className="space-y-4">
            <Card className="p-4">
              <h3 className="font-display font-semibold"><Icon name="auto_awesome" className="mr-1 align-middle text-primary-bright" />SEO & Metadados</h3>
              <div className="mt-3 text-xs"><div className="label-mono text-muted">Descrição</div><p className="mt-1 line-clamp-5 text-fg-secondary">{pub?.description || "—"}</p></div>
              <div className="mt-3 flex flex-wrap gap-1">{tags.map((t) => <Chip key={t}>#{t}</Chip>)}</div>
            </Card>
            <Card className="p-4">
              <h3 className="font-display font-semibold">Próximos passos</h3>
              <div className="mt-3 flex flex-col gap-2">
                <Link href="/projects"><Button icon="add" className="w-full">Criar Novo Documentário</Button></Link>
                <Button icon="content_cut" disabled>Gerar Shorts a partir deste (Sprint 7)</Button>
              </div>
            </Card>
          </aside>
        </div>
      </main>
    </>
  );
}
