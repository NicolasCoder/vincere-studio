import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@docupulse/db";
import { ACT_GAP_MS } from "@docupulse/render";
import { Badge, Button, Card, Icon } from "@docupulse/ui";
import { Topbar } from "@/components/Topbar";
import { PageHeader } from "@/components/PageHeader";
import { getUsageSummary, fmtMs } from "@/lib/data";

const SHORT_WORTHY_KINDS = ["HOOK", "CLIMAX", "REVEAL"];

export default async function RepurposingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [usage, project] = await Promise.all([
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
              include: { voiceTracks: { orderBy: { createdAt: "asc" }, take: 1 } },
            },
          },
        },
      },
    }),
  ]);
  if (!project) notFound();

  const blocks = project.scripts[0]?.blocks ?? [];
  // Cada bloco vira um ato da Timeline no render, com ACT_GAP_MS de silêncio entre atos: sem somar
  // esse gap o erro acumula bloco a bloco e os cortes sugeridos saem adiantados em relação ao master.
  let cursor = 0;
  const timed = blocks.map((b, i) => {
    const durationMs = b.voiceTracks[0]?.durationMs ?? 0;
    const startMs = cursor + (i > 0 ? ACT_GAP_MS : 0);
    cursor = startMs + durationMs;
    return { ...b, computedStartMs: startMs, computedEndMs: cursor, durationMs };
  });

  const candidates = timed
    .filter((b) => b.durationMs > 0)
    .map((b) => ({
      ...b,
      cutScore: (b.retentionScore ?? 0) + (SHORT_WORTHY_KINDS.includes(b.kind) ? 20 : 0),
    }))
    .sort((a, b) => b.cutScore - a.cutScore)
    .slice(0, 5);

  const transcript = timed
    .map((b) => `[${fmtMs(b.computedStartMs)} – ${fmtMs(b.computedEndMs)}] (Ato ${b.act} · ${b.kind}) ${b.title}\n${b.narration.replace(/\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim()}`)
    .join("\n\n");

  return (
    <>
      <Topbar crumbs={["Projetos", project.title, "Repurposing"]} costUsd={usage.costUsd} />
      <main className="space-y-6 p-6">
        <PageHeader
          icon="content_cut"
          title="Repurposing & Cortes Sugeridos"
          subtitle="Transcrição completa do roteiro (com timestamps) e os trechos com maior potencial pra virar Shorts."
        />

        {blocks.length === 0 ? (
          <Card className="grid place-items-center p-16 text-center text-sm text-muted">
            <Icon name="content_cut" className="text-[40px]" />
            <p className="mt-3">Este projeto ainda não tem roteiro com locução gerada.</p>
          </Card>
        ) : (
          <>
            <Card className="p-5">
              <h3 className="font-display font-semibold"><Icon name="movie_filter" className="mr-1 align-middle text-primary-bright" />Sugestões de corte pra Shorts</h3>
              <p className="mt-1 text-[11px] text-fg-secondary">Ranqueado por retenção estimada do bloco + tipo (gancho, clímax, revelação). Duração ideal pra um Short: 15-60s.</p>
              <div className="mt-3 grid grid-cols-1 gap-3">
                {candidates.map((c) => {
                  const durSec = Math.round(c.durationMs / 1000);
                  const durTone = durSec >= 15 && durSec <= 60 ? "success" : "warning";
                  return (
                    <div key={c.id} className="rounded border border-line bg-void/40 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="cyan">{c.kind}</Badge>
                        <Badge tone={durTone}>{durSec}s</Badge>
                        <span className="font-mono text-[11px] text-muted">{fmtMs(c.computedStartMs)} – {fmtMs(c.computedEndMs)}</span>
                        {c.retentionScore != null && <span className="font-mono text-[11px] text-primary-bright">retenção {c.retentionScore}%</span>}
                      </div>
                      <div className="mt-1.5 font-display text-sm font-semibold">{c.title}</div>
                      <p className="mt-1 line-clamp-3 text-[11px] text-fg-secondary">{c.narration.replace(/\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim()}</p>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="font-display font-semibold"><Icon name="subject" className="mr-1 align-middle text-primary-bright" />Transcrição completa (com timestamps)</h3>
              <p className="mt-1 text-[11px] text-fg-secondary">Copie e use pra cortar manualmente no editor de vídeo, ou como base pra um vídeo curto novo.</p>
              <textarea readOnly value={transcript} rows={16} className="field mt-3 w-full whitespace-pre-wrap px-3 py-2 font-mono text-[11px]" />
            </Card>

            <Link href={`/projects/${project.id}/published`}><Button icon="arrow_back" variant="ghost">Voltar</Button></Link>
          </>
        )}
      </main>
    </>
  );
}
