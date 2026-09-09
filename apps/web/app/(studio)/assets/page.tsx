import Link from "next/link";
import { prisma } from "@docupulse/db";
import { Badge, Card, Icon } from "@docupulse/ui";
import { Topbar } from "@/components/Topbar";
import { PageHeader } from "@/components/PageHeader";
import { getUsageSummary } from "@/lib/data";

type Kind = "scene" | "thumbnail" | "render";

interface Asset {
  id: string;
  kind: Kind;
  mediaType: "image" | "video";
  src: string;
  poster?: string | null;
  label: string;
  projectId: string;
  projectTitle: string;
  niche: string;
}

const KIND_LABEL: Record<Kind, string> = { scene: "Cena", thumbnail: "Miniatura", render: "Render" };
const KIND_ICON: Record<Kind, string> = { scene: "image", thumbnail: "photo_size_select_actual", render: "movie" };

function buildHref(params: { q?: string; type?: string; niche?: string }) {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.type && params.type !== "all") sp.set("type", params.type);
  if (params.niche) sp.set("niche", params.niche);
  const qs = sp.toString();
  return qs ? `/assets?${qs}` : "/assets";
}

export default async function AssetsPage({ searchParams }: { searchParams: Promise<{ q?: string; type?: string; niche?: string }> }) {
  const { q, type, niche } = await searchParams;

  const [usage, scenes, thumbnails, renders] = await Promise.all([
    getUsageSummary(),
    prisma.scene.findMany({
      where: { filePath: { not: null } },
      select: {
        id: true,
        filePath: true,
        thumbPath: true,
        mediaType: true,
        source: true,
        provider: true,
        keywords: true,
        description: true,
        block: { select: { title: true, script: { select: { project: { select: { id: true, title: true, niche: true } } } } } },
      },
      orderBy: { id: "desc" },
      take: 400,
    }),
    prisma.project.findMany({
      where: { thumbnailPath: { not: null } },
      select: { id: true, title: true, niche: true, thumbnailPath: true },
      orderBy: { thumbnailUpdatedAt: "desc" },
    }),
    prisma.renderJob.findMany({
      where: { outputPath: { not: null } },
      select: { id: true, outputPath: true, profile: true, project: { select: { id: true, title: true, niche: true } } },
      orderBy: { finishedAt: "desc" },
    }),
  ]);

  const assets: Asset[] = [
    ...scenes
      .filter((s) => s.block?.script?.project)
      .map((s) => ({
        id: `scene-${s.id}`,
        kind: "scene" as const,
        mediaType: (s.mediaType === "video" ? "video" : "image") as "image" | "video",
        src: `/api/media/${s.filePath}`,
        poster: s.thumbPath ? `/api/media/${s.thumbPath}` : null,
        label: [s.block!.title, s.provider ?? s.source].filter(Boolean).join(" · "),
        projectId: s.block!.script!.project!.id,
        projectTitle: s.block!.script!.project!.title,
        niche: s.block!.script!.project!.niche,
      })),
    ...thumbnails.map((p) => ({
      id: `thumb-${p.id}`,
      kind: "thumbnail" as const,
      mediaType: "image" as const,
      src: `/api/media/${p.thumbnailPath}`,
      poster: null,
      label: "Miniatura de capa",
      projectId: p.id,
      projectTitle: p.title,
      niche: p.niche,
    })),
    ...renders
      .filter((r) => r.project)
      .map((r) => ({
        id: `render-${r.id}`,
        kind: "render" as const,
        mediaType: "video" as const,
        src: `/api/media/${r.outputPath}`,
        poster: null,
        label: r.profile,
        projectId: r.project!.id,
        projectTitle: r.project!.title,
        niche: r.project!.niche,
      })),
  ];

  const niches = Array.from(new Set(assets.map((a) => a.niche))).sort();
  const activeType = (type === "scene" || type === "thumbnail" || type === "render" ? type : "all") as Kind | "all";
  const qLower = q?.trim().toLowerCase();

  const filtered = assets.filter((a) => {
    if (activeType !== "all" && a.kind !== activeType) return false;
    if (niche && a.niche !== niche) return false;
    if (qLower && !`${a.projectTitle} ${a.niche} ${a.label}`.toLowerCase().includes(qLower)) return false;
    return true;
  });

  const counts: Record<Kind, number> = { scene: 0, thumbnail: 0, render: 0 };
  for (const a of assets) counts[a.kind]++;

  return (
    <>
      <Topbar crumbs={["Media Assets"]} costUsd={usage.costUsd} />
      <main className="space-y-6 p-6">
        <PageHeader
          icon="video_library"
          title="Media Assets"
          subtitle="Tudo que já foi gerado ou baixado (cenas, miniaturas, renders) numa biblioteca só, pra achar e reaproveitar entre projetos sem gerar de novo do zero."
        />

        <Card className="p-4">
          <form action="/assets" method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <input type="hidden" name="type" value={activeType} />
            <div className="flex-1">
              <label className="label-mono mb-1 block text-muted">Buscar</label>
              <input
                name="q"
                defaultValue={q ?? ""}
                placeholder="título do projeto, nicho, cena..."
                className="field w-full px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="label-mono mb-1 block text-muted">Nicho</label>
              <select name="niche" defaultValue={niche ?? ""} className="field px-3 py-2 text-sm">
                <option value="">Todos</option>
                {niches.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <button type="submit" className="field flex h-[38px] items-center justify-center gap-2 px-4 text-sm font-semibold text-primary-bright">
              <Icon name="search" className="text-[16px]" />Buscar
            </button>
          </form>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <Link
              href={buildHref({ q, niche, type: "all" })}
              className={`inline-flex h-6 items-center gap-1 rounded border px-2 font-mono text-[11px] font-medium tracking-wider transition-colors ${activeType === "all" ? "border-primary/60 bg-primary/10 text-primary-bright" : "border-line bg-void/60 text-fg-secondary hover:text-fg"}`}
            >
              Todos · {assets.length}
            </Link>
            {(["scene", "thumbnail", "render"] as Kind[]).map((k) => (
              <Link
                key={k}
                href={buildHref({ q, niche, type: k })}
                className={`inline-flex h-6 items-center gap-1 rounded border px-2 font-mono text-[11px] font-medium tracking-wider transition-colors ${activeType === k ? "border-primary/60 bg-primary/10 text-primary-bright" : "border-line bg-void/60 text-fg-secondary hover:text-fg"}`}
              >
                <Icon name={KIND_ICON[k]} className="text-[13px]" />{KIND_LABEL[k]} · {counts[k]}
              </Link>
            ))}
          </div>
        </Card>

        {assets.length === 0 ? (
          <Card className="grid place-items-center p-16 text-center text-sm text-muted">
            <Icon name="video_library" className="text-[40px]" />
            <p className="mt-3">Nada gerado ainda. Assim que um projeto passar pela Mídia, Render ou Publicação, os arquivos aparecem aqui.</p>
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="grid place-items-center p-16 text-center text-sm text-muted">
            <Icon name="search_off" className="text-[40px]" />
            <p className="mt-3">Nenhum resultado pra esse filtro.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {filtered.slice(0, 240).map((a) => (
              <Card key={a.id} className="group overflow-hidden p-0">
                <div className="relative aspect-video bg-void/60">
                  {a.mediaType === "video" ? (
                    <video src={a.src} poster={a.poster ?? undefined} muted preload="metadata" className="h-full w-full object-cover" />
                  ) : (
                    <img src={a.src} alt={a.label} loading="lazy" className="h-full w-full object-cover" />
                  )}
                  <span className="absolute left-1.5 top-1.5">
                    <Badge tone="neutral" className="!text-[9px]"><Icon name={KIND_ICON[a.kind]} className="text-[11px]" />{KIND_LABEL[a.kind]}</Badge>
                  </span>
                  <a
                    href={`${a.src}?download=1`}
                    className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded bg-void/80 text-fg-secondary opacity-0 transition-opacity hover:text-fg group-hover:opacity-100"
                    title="Baixar"
                  >
                    <Icon name="download" className="text-[14px]" />
                  </a>
                </div>
                <div className="p-2">
                  <Link href={`/projects/${a.projectId}/media`} className="block truncate text-[11px] font-semibold hover:text-primary-bright" title={a.projectTitle}>
                    {a.projectTitle}
                  </Link>
                  <div className="truncate text-[10px] text-fg-secondary" title={a.label}>{a.label || a.niche}</div>
                </div>
              </Card>
            ))}
          </div>
        )}
        {filtered.length > 240 && (
          <p className="text-center text-[11px] text-muted">Mostrando os 240 primeiros de {filtered.length} — refine a busca pra ver mais específico.</p>
        )}
      </main>
    </>
  );
}
