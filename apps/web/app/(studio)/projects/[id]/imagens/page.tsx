import { notFound } from "next/navigation";
import { prisma } from "@docupulse/db";
import { getBudgetStatus } from "@docupulse/providers";
import { Badge, Button, Card, Chip, Icon } from "@docupulse/ui";
import { Topbar } from "@/components/Topbar";
import { PageHeader } from "@/components/PageHeader";
import { JobWatcher } from "@/components/JobWatcher";
import { getUsageSummary } from "@/lib/data";
import { generateImages } from "./actions";

const ASPECTS = ["16:9", "9:16", "1:1", "4:3"] as const;

export default async function ImagensPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ job?: string; erro?: string }>;
}) {
  const { id } = await params;
  const { job, erro } = await searchParams;
  const [usage, project, images, budget] = await Promise.all([
    getUsageSummary(),
    prisma.project.findUnique({ where: { id } }),
    prisma.generatedImage.findMany({ where: { projectId: id }, orderBy: { createdAt: "desc" }, take: 120 }),
    getBudgetStatus(),
  ]);
  if (!project) notFound();

  const semOrcamento = budget.remainingUsd <= 0;

  return (
    <>
      <Topbar crumbs={["Projetos", project.title, "Imagens"]} costUsd={usage.costUsd} />
      {job && <JobWatcher jobId={job} label="Gerando imagens" />}
      <main className="space-y-6 p-6">
        <PageHeader
          icon="auto_awesome"
          title="Banco de Imagens do Projeto"
          subtitle="Descreva e gere em lote. As imagens ficam nesta galeria para usar como capa, inserção de arquivo ou referência de estilo."
        />

        <Card className="flex flex-wrap items-center gap-2 p-4">
          <Chip icon="image">{images.length} imagem(ns)</Chip>
          <Chip icon="savings" active={!semOrcamento}>
            Orçamento: US$ {budget.remainingUsd.toFixed(2)} disponível
          </Chip>
          {semOrcamento && (
            <span className="text-[11px] text-warning">
              Sem orçamento pago — o motor Gemini fica bloqueado, o Pollinations continua livre.
            </span>
          )}
        </Card>

        {erro === "vazio" && (
          <Card className="p-4 text-sm text-warning">
            <Icon name="warning" className="mr-1 align-middle" />
            Escreva uma descrição antes de gerar.
          </Card>
        )}

        {/* Barra de geração: descrever, escolher motor/proporção/quantidade e enfileirar. */}
        <Card className="p-4">
          <form action={generateImages.bind(null, project.id)} className="space-y-3">
            <textarea
              name="prompt"
              rows={3}
              placeholder="Descreva o que deseja criar…"
              className="field w-full px-3 py-2 text-sm"
            />
            <div className="flex flex-wrap items-center gap-2">
              <select name="engine" defaultValue="POLLINATIONS" className="field px-3 py-2 text-sm">
                <option value="POLLINATIONS" className="bg-surface-low">
                  Pollinations — grátis
                </option>
                <option value="GEMINI" className="bg-surface-low">
                  Gemini / Nano Banana — pago
                </option>
              </select>
              <select name="aspect" defaultValue="16:9" className="field px-3 py-2 text-sm">
                {ASPECTS.map((a) => (
                  <option key={a} value={a} className="bg-surface-low">
                    {a}
                  </option>
                ))}
              </select>
              <select name="count" defaultValue="1" className="field px-3 py-2 text-sm">
                {[1, 2, 4, 6, 8].map((n) => (
                  <option key={n} value={n} className="bg-surface-low">
                    x{n}
                  </option>
                ))}
              </select>
              <Button type="submit" variant="primary" icon="auto_awesome" className="ml-auto">
                Gerar
              </Button>
            </div>
          </form>
        </Card>

        {images.length === 0 ? (
          <Card className="grid place-items-center p-16 text-center text-sm text-muted">
            <Icon name="image" className="text-[40px]" />
            <p className="mt-3">Nenhuma imagem gerada ainda neste projeto.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {images.map((img) => (
              <Card key={img.id} className="overflow-hidden p-0">
                <a href={`/api/media/${img.filePath}`} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/media/${img.filePath}`}
                    alt={img.prompt.slice(0, 80)}
                    className="aspect-video w-full bg-void object-cover"
                  />
                </a>
                <div className="p-2">
                  <div className="flex items-center gap-1">
                    <Badge tone={img.engine === "GEMINI" ? "violet" : "success"}>
                      {img.engine === "GEMINI" ? "Gemini" : "Pollinations"}
                    </Badge>
                    <span className="font-mono text-[10px] text-muted">{img.aspect}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[11px] text-fg-secondary">{img.prompt}</p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
