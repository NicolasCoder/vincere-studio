"use server";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@docupulse/db";
import { absPath, getTextProvider, projectDir, recordUsage, relPath } from "@docupulse/providers";
import { quadroDe, renderizarThumbnail } from "@docupulse/render";
import { z } from "zod";

/** Enfileira o upload real pro YouTube (job PUBLISH_YOUTUBE) — nasce no privacyStatus
 * escolhido no formulário (padrão: privado, pra sempre dar chance de revisão antes de
 * tornar público). Ação com efeito real e irreversível-ish: só dispara com clique explícito. */
export async function publishToYoutube(projectId: string, formData: FormData) {
  const privacyStatus = String(formData.get("privacyStatus") ?? "private");
  const job = await prisma.job.create({
    data: { type: "PUBLISH_YOUTUBE", projectId, payload: JSON.stringify({ projectId, privacyStatus }) },
  });
  redirect(`/projects/${projectId}/published?job=${job.id}`);
}

/**
 * Faz o upload agora como privado e entrega o horário ao agendador nativo do YouTube.
 * Assim a publicação acontece mesmo se o Pulse Studio estiver fechado no horário marcado.
 */
export async function scheduleYoutubePublication(projectId: string, formData: FormData) {
  const raw = String(formData.get("publishAt") ?? "").trim();
  const publishAt = new Date(raw);
  if (!raw || Number.isNaN(publishAt.getTime())) throw new Error("Informe uma data e hora válidas para a publicação.");
  if (publishAt.getTime() < Date.now() + 15 * 60_000) {
    throw new Error("Programe a postagem com pelo menos 15 minutos de antecedência para dar tempo de enviar e processar o vídeo.");
  }
  const active = await prisma.job.findFirst({
    where: { projectId, type: "PUBLISH_YOUTUBE", status: { in: ["QUEUED", "RUNNING"] } },
    select: { id: true },
  });
  if (active) redirect(`/projects/${projectId}/published?job=${active.id}`);

  const job = await prisma.job.create({
    data: {
      type: "PUBLISH_YOUTUBE",
      projectId,
      message: `Programando para ${publishAt.toLocaleString("pt-BR")}`,
      payload: JSON.stringify({ projectId, privacyStatus: "private", publishAt: publishAt.toISOString() }),
    },
  });
  redirect(`/projects/${projectId}/published?job=${job.id}`);
}

/**
 * Grava a variação escolhida como a thumbnail do projeto.
 *
 * Recompõe em vez de copiar o arquivo da prévia. A prévia é descartável — some na próxima
 * chamada da rota — e uma thumbnail publicada apontando para um caminho que vai ser apagado é
 * um link quebrado esperando para acontecer.
 */
export async function aplicarThumbnail(
  projectId: string,
  escolha: { sceneId: string; titulo: string; sub: string; escuridao: number; halo: number },
) {
  const cena = await prisma.scene.findUnique({ where: { id: escolha.sceneId } });
  if (!cena?.filePath) throw new Error("Cena não encontrada ou sem arquivo.");

  const outDir = await projectDir(projectId, "thumbnails");
  const origem = await quadroDe(absPath(cena.filePath), outDir);
  const saida = path.join(outDir, `thumb-${Date.now()}.jpg`);
  await renderizarThumbnail(origem, saida, {
    titulo: escolha.titulo,
    sub: escolha.sub,
    escuridao: escolha.escuridao,
    halo: escolha.halo,
  });

  await prisma.project.update({
    where: { id: projectId },
    data: { thumbnailPath: relPath(saida), thumbnailUpdatedAt: new Date() },
  });
  revalidatePath(`/projects/${projectId}/published`);
}

const SeoResponseSchema = z.object({
  title: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
  chapters: z.array(z.object({ time: z.string(), label: z.string() })),
});

function seoSystemPrompt(short: boolean) {
  const base = `Você é um especialista em SEO e copywriting para YouTube, focado em canais de documentário/mistério em português do Brasil (estilo "Fatos Desconhecidos"). Escreva título, descrição e tags otimizados para CTR e retenção, sem clickbait enganoso — a curiosidade prometida no título tem que ser genuína e entregue no vídeo.`;
  if (!short) return base;
  // Short e vídeo longo não competem pela mesma atenção: um é descoberto no feed vertical,
  // com o texto quase invisível; o outro é escolhido na busca e na home, onde a descrição
  // ainda pesa. Pedir a mesma peça para os dois entrega uma errada nas duas pontas.
  return `${base}

Este vídeo é um SHORT vertical de menos de 3 minutos, descoberto no feed, não na busca. Isso muda tudo:
- O título é lido em meio segundo, com o polegar já em movimento. Curto e concreto vence elaborado.
- Quase ninguém abre a descrição. Ela existe para contexto e palavras-chave, não para estrutura.
- Short NÃO tem capítulos. Timestamps aqui não servem para nada.`;
}

function seoUserPrompt(input: {
  projectTitle: string;
  niche: string;
  tone?: string | null;
  targetDuration?: number | null;
  logline?: string | null;
  hookLines: string[];
  chapters: { act: number; title: string; startMs?: number | null }[];
  short: boolean;
}) {
  const durMin = input.targetDuration ? Math.round(input.targetDuration / 60) : null;
  const fmtTime = (ms?: number | null) => {
    if (ms == null) return null;
    const totalSec = Math.floor(ms / 1000);
    return `${Math.floor(totalSec / 60)}:${String(totalSec % 60).padStart(2, "0")}`;
  };
  const cabecalho = `Gere metadados de publicação para este vídeo de YouTube:

Título de trabalho: "${input.projectTitle}"
Nicho: ${input.niche}
Tom: ${input.tone ?? "documentário sério, dark"}
Duração aproximada: ${durMin ? `${durMin} min` : "desconhecida"}
Sinopse/gancho: ${input.logline ?? "—"}
Frases de gancho do roteiro: ${input.hookLines.join(" · ") || "—"}`;

  if (input.short) {
    return `${cabecalho}

Retorne:
- title: até 70 caracteres, de preferência bem menos. Uma pergunta ou afirmação concreta que alguém entenda rolando o feed. Sem dois-pontos separando conceito e subtítulo — isso é linguagem de vídeo longo.
- description: 1 a 2 frases de contexto, mais as palavras-chave centrais. Termine com "#Shorts". Nada de chamada para inscrever-se (não funciona em Short), nada de timestamps, nada de links inventados.
- tags: 10 a 15 tags relevantes (sem #, minúsculas).
- chapters: array VAZIO. Short não tem capítulos.`;
  }

  return `${cabecalho}
Blocos do roteiro (use para montar os capítulos):
${input.chapters.map((c) => `- Ato ${c.act}: ${c.title}${fmtTime(c.startMs) ? ` (${fmtTime(c.startMs)})` : ""}`).join("\n")}

Retorne:
- title: título final para o YouTube, até 100 caracteres, forte em curiosidade e palavras-chave, sem exagero de emojis.
- description: descrição em 3-4 parágrafos — (1) gancho reafirmando a curiosidade central, (2) contexto do que o espectador vai descobrir, com 2-3 palavras-chave relevantes incluídas naturalmente, (3) chamada para se inscrever e ativar o sino, (4) aviso de que os capítulos estão logo abaixo. Não invente links nem nomes de produtos.
- tags: 15 a 20 tags/palavras-chave relevantes (sem #, minúsculas, sem repetir o título inteiro).
- chapters: lista de capítulos no formato {time: "MM:SS", label: "..."} baseada nos blocos fornecidos, sempre começando com 00:00 · Introdução.`;
}

/** Gera (ou regenera) título/descrição/tags/capítulos otimizados pra publicação, a partir do roteiro já gerado. */
export async function generateSeoMetadata(projectId: string, _formData?: FormData): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      ideas: { where: { selected: true }, take: 1 },
      scripts: {
        orderBy: { version: "desc" },
        take: 1,
        include: { blocks: { orderBy: [{ act: "asc" }, { order: "asc" }] } },
      },
    },
  });
  if (!project) throw new Error(`Projeto ${projectId} não encontrado`);

  const idea = project.ideas[0];
  const script = project.scripts[0];
  const hookLines = idea ? (JSON.parse(idea.hookLines || "[]") as string[]) : [];

  // um bloco representativo por ato, pra não estourar o prompt com o roteiro inteiro
  const seenActs = new Set<number>();
  const chapterBlocks = (script?.blocks ?? []).filter((b) => {
    if (seenActs.has(b.act)) return false;
    seenActs.add(b.act);
    return true;
  });

  const short = project.format === "SHORT_9_16";

  const provider = getTextProvider();
  const { data, usage } = await provider.generateJson(
    seoUserPrompt({
      projectTitle: project.title,
      niche: project.niche,
      tone: project.tone,
      targetDuration: project.targetDuration,
      logline: script?.logline ?? idea?.synopsis ?? null,
      hookLines,
      chapters: chapterBlocks.map((b) => ({ act: b.act, title: b.title, startMs: b.startMs })),
      short,
    }),
    SeoResponseSchema,
    { system: seoSystemPrompt(short), temperature: 0.8 },
  );
  await recordUsage(projectId, usage);

  // A instrução no prompt cobre o caso normal; estas duas linhas cobrem o modelo desobedecendo.
  // Capítulo em Short é ruído e a #Shorts é o único sinal de formato que a API nos deixa mandar.
  const description = short && !/#shorts\b/i.test(data.description)
    ? `${data.description.trimEnd()}\n\n#Shorts`
    : data.description;

  const payload = {
    title: data.title.slice(0, 100),
    description,
    tags: JSON.stringify(data.tags.slice(0, 25)),
    chapters: JSON.stringify(short ? [] : data.chapters),
  };

  const existing = await prisma.publication.findFirst({ where: { projectId } });
  if (existing) {
    await prisma.publication.update({ where: { id: existing.id }, data: payload });
  } else {
    await prisma.publication.create({ data: { projectId, ...payload } });
  }

  // Sem retorno: isto é usado como `action` de <form>, que exige void. O consumo já foi
  // registrado no medidor pelo recordUsage acima.
  revalidatePath(`/projects/${projectId}/published`);
}
