import path from "node:path";
import { rm } from "node:fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "@docupulse/db";
import { partirManchete, quadroDe, renderizarThumbnail } from "@docupulse/render";
import { absPath, projectDir, relPath } from "@docupulse/providers";

/**
 * Prévia de thumbnail ao vivo, três cenas de uma vez.
 *
 * Não passa pela fila: a composição é um ffmpeg sobre um quadro só, na casa do décimo de segundo.
 * Enfileirar um job para isso colocaria o poll do worker (1s) e a espera da página no caminho de
 * um ajuste que a pessoa quer ver enquanto mexe no controle.
 *
 * Três variações porque escolher entre opções é mais rápido e dá resultado melhor do que
 * regenerar até acertar — e para nós custa três ffmpeg em vez de um.
 */

const CENAS_NA_PREVIA = 3;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return NextResponse.json({ error: "projeto não encontrado" }, { status: 404 });

  const idea = await prisma.idea.findFirst({ where: { projectId: id, selected: true } });
  const manchete = partirManchete(String(body.title ?? idea?.title ?? project.title));
  const titulo = String(body.titulo ?? manchete.titulo).trim();
  const sub = String(body.sub ?? manchete.sub).trim();
  if (!titulo) return NextResponse.json({ error: "o título não pode ficar vazio" }, { status: 400 });

  const escuridao = Number(body.escuridao ?? 0.5);
  const halo = Number(body.halo ?? 0.8);

  const candidatas = await prisma.scene.findMany({
    where: { block: { script: { projectId: id } }, filePath: { not: null } },
    include: { block: true },
    orderBy: { order: "asc" },
  });
  if (!candidatas.length) {
    return NextResponse.json({ error: "nenhuma cena com mídia ainda — gere o b-roll no Passo 3" }, { status: 400 });
  }

  // Cenas pedidas explicitamente vencem; senão, as de gancho/clímax/revelação primeiro, que são
  // os momentos que o roteiro já marcou como os mais fortes do vídeo.
  const pedidas = Array.isArray(body.sceneIds) ? (body.sceneIds as unknown[]).map(String) : [];
  const fortes = candidatas.filter((s) => ["HOOK", "CLIMAX", "REVEAL"].includes(s.block.kind));
  const ordem = pedidas.length
    ? pedidas.map((sid) => candidatas.find((s) => s.id === sid)).filter((s) => !!s)
    : [...fortes, ...candidatas.filter((s) => !fortes.includes(s))];
  const escolhidas = ordem.slice(0, CENAS_NA_PREVIA);

  // Uma pasta por projeto, apagada a cada chamada: sem isso cada mexida no controle deixaria um
  // arquivo para trás e a pasta cresceria sem limite durante o ajuste.
  const dir = path.join(await projectDir(id, "thumbnails"), "previa");
  await rm(dir, { recursive: true, force: true }).catch(() => {});
  const outDir = await projectDir(id, "thumbnails/previa");

  const carimbo = Date.now();
  const variantes: { sceneId: string; src: string }[] = [];
  for (let i = 0; i < escolhidas.length; i++) {
    const cena = escolhidas[i];
    if (!cena.filePath) continue;
    try {
      const origem = await quadroDe(absPath(cena.filePath), outDir);
      const saida = path.join(outDir, `v${i}-${carimbo}.jpg`);
      await renderizarThumbnail(origem, saida, { titulo, sub, escuridao, halo });
      variantes.push({ sceneId: cena.id, src: `/api/media/${relPath(saida)}` });
    } catch {
      // Uma cena com arquivo corrompido não pode derrubar as outras duas.
    }
  }

  if (!variantes.length) return NextResponse.json({ error: "não consegui compor nenhuma variação" }, { status: 500 });
  return NextResponse.json({ variantes, titulo, sub });
}
