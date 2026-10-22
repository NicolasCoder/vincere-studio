import Link from "next/link";
import { prisma } from "@vincere-studio/db";
import { Badge, Card, Icon, Stat } from "@vincere-studio/ui";
import { Topbar } from "@/components/Topbar";
import { PageHeader } from "@/components/PageHeader";
import { getUsageSummary } from "@/lib/data";
import { getYoutubeChannelManagerData, youtubeCredentialsConfigured } from "@vincere-studio/providers";

function formatCount(n?: number) {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default async function ChannelsPage() {
  const [usage, channel, publications] = await Promise.all([
    getUsageSummary(),
    getYoutubeChannelManagerData(),
    prisma.publication.findMany({
      where: { videoId: { not: null } },
      select: { videoId: true, projectId: true, project: { select: { title: true } } },
    }),
  ]);

  const byVideoId = new Map(publications.map((p) => [p.videoId as string, p]));

  return (
    <>
      <Topbar crumbs={["Channel Manager"]} costUsd={usage.costUsd} />
      <main className="space-y-6 p-6">
        <PageHeader
          icon="smart_display"
          title="Channel Manager"
          subtitle="Canal do YouTube conectado via OAuth, com estatísticas e uploads recentes de verdade — sem custo de API (cota gratuita da YouTube Data API v3)."
        />

        {!channel ? (
          <Card className="grid place-items-center p-16 text-center text-sm text-muted">
            <Icon name="link" className="text-[40px]" />
            <p className="mt-3">Nenhum canal conectado ainda.</p>
            {youtubeCredentialsConfigured() ? (
              // Credenciais prontas: vai direto ao login do Google, sem passar pelas Configurações.
              <a href="/api/auth/youtube/start" className="mt-4">
                <span className="inline-flex items-center gap-2 rounded border border-primary/40 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary-bright hover:bg-primary/20">
                  <Icon name="link" className="text-[16px]" />Conectar canal do YouTube
                </span>
              </a>
            ) : (
              <>
                <p className="mt-2 max-w-md text-xs text-warning">
                  Falta configurar <code className="font-mono">YOUTUBE_CLIENT_ID</code> e <code className="font-mono">YOUTUBE_CLIENT_SECRET</code> no .env antes de conectar.
                </p>
                <Link href="/settings#youtube" className="mt-4">
                  <span className="inline-flex items-center gap-2 rounded border border-primary/40 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary-bright hover:bg-primary/20">
                    <Icon name="link" className="text-[16px]" />Ver como configurar
                  </span>
                </Link>
              </>
            )}
          </Card>
        ) : (
          <>
            <Card className="p-5">
              <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                {channel.channelThumbnail ? (
                  <img src={channel.channelThumbnail} alt="" className="size-14 shrink-0 rounded-full border border-line" />
                ) : (
                  <div className="grid size-14 shrink-0 place-items-center rounded-full border border-line bg-void/60 text-muted"><Icon name="smart_display" className="text-[22px]" /></div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate font-display text-lg font-semibold">{channel.channelTitle}</h2>
                    <Badge tone="success" pill dot>Conectado</Badge>
                  </div>
                  <a
                    href={`https://www.youtube.com/channel/${channel.channelId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-0.5 flex items-center gap-1 text-[11px] text-primary-bright hover:underline"
                  >
                    <Icon name="open_in_new" className="text-[12px]" />Ver canal no YouTube
                  </a>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                <Stat label="Inscritos" value={channel.hiddenSubscriberCount ? "Oculto" : formatCount(channel.subscriberCount)} />
                <Stat label="Visualizações" value={formatCount(channel.viewCount)} tone="violet" />
                <Stat label="Vídeos" value={formatCount(channel.videoCount)} tone="fg" />
              </div>
            </Card>

            <div>
              <h3 className="mb-3 font-display font-semibold"><Icon name="upload" className="mr-1 align-middle text-primary-bright" />Uploads recentes</h3>
              {channel.recentUploads.length === 0 ? (
                <Card className="grid place-items-center p-10 text-center text-sm text-muted">
                  <Icon name="video_library" className="text-[32px]" />
                  <p className="mt-2">Nenhum vídeo publicado nesse canal ainda.</p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {channel.recentUploads.map((v) => {
                    const pub = byVideoId.get(v.videoId);
                    return (
                      <Card key={v.videoId} className="overflow-hidden p-0">
                        <a href={`https://www.youtube.com/watch?v=${v.videoId}`} target="_blank" rel="noreferrer" className="block">
                          {v.thumbnail ? (
                            <img src={v.thumbnail} alt={v.title} className="aspect-video w-full object-cover" />
                          ) : (
                            <div className="grid aspect-video w-full place-items-center bg-void/60 text-muted"><Icon name="movie" className="text-[28px]" /></div>
                          )}
                        </a>
                        <div className="p-3">
                          <a href={`https://www.youtube.com/watch?v=${v.videoId}`} target="_blank" rel="noreferrer" className="line-clamp-2 text-sm font-semibold hover:text-primary-bright">
                            {v.title}
                          </a>
                          <div className="mt-2 flex items-center justify-between">
                            {v.publishedAt && <span className="text-[11px] text-fg-secondary">{new Date(v.publishedAt).toLocaleDateString("pt-BR")}</span>}
                            {pub ? (
                              <Link href={`/projects/${pub.projectId}/published`}>
                                <Badge tone="cyan">Feito no Vincere Studio</Badge>
                              </Link>
                            ) : (
                              <Badge tone="neutral">Externo</Badge>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </>
  );
}
