import { prisma } from "@docupulse/db";
import { buildGptImagePack, FORMATS, getVisualStyle, type VideoFormat } from "@docupulse/core";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      scripts: {
        orderBy: { version: "desc" },
        take: 1,
        include: { blocks: { orderBy: { order: "asc" }, include: { scenes: { orderBy: { order: "asc" } } } } },
      },
    },
  });
  if (!project) return new Response("Projeto não encontrado.", { status: 404 });

  const blocks = project.scripts[0]?.blocks ?? [];
  const scenes = blocks.flatMap((block) => block.scenes.map((scene) => ({
    act: block.act,
    actTitle: block.title,
    order: scene.order,
    startMs: scene.startMs,
    endMs: scene.endMs,
    description: scene.description,
    prompt: scene.prompt,
    preferVideo: scene.preferVideo,
  })));
  if (!scenes.length) {
    return new Response("Planeje as cenas antes de gerar o pacote GPT.", { status: 409 });
  }

  const format = FORMATS[project.format as VideoFormat];
  const text = buildGptImagePack({
    projectId: project.id,
    title: project.title,
    niche: project.niche,
    tone: project.tone,
    audience: project.audience,
    ratio: format.ratio,
    style: getVisualStyle(project.visualStyle),
    scenes,
  });

  return new Response(text, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "content-disposition": `attachment; filename="gpt-image-pack-${project.id.slice(-8)}.txt"`,
      "cache-control": "no-store",
    },
  });
}
