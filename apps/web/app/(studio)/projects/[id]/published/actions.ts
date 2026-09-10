"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@docupulse/db";
import { getTextProvider, recordUsage } from "@docupulse/providers";
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

const SeoResponseSchema = z.object({
  title: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
  chapters: z.array(z.object({ time: z.string(), label: z.string() })),
});

function seoSystemPrompt() {
  return `Você é um especialista em SEO e copywriting para YouTube, focado em canais de documentário/mistério em português do Brasil (estilo "Fatos Desconhecidos"). Escreva título, descrição e tags otimizados para CTR e retenção, sem clickbait enganoso — a curiosidade prometida no título tem que ser genuína e entregue no vídeo.`;
}

function seoUserPrompt(input: {
  projectTitle: string;
  niche: string;
  tone?: string | null;
  targetDuration?: number | null;
  logline?: string | null;
  hookLines: string[];
  chapters: { act: number; title: string; startMs?: number | null }[];
}) {
  const durMin = input.targetDuration ? Math.round(input.targetDuration / 60) : null;
  const fmtTime = (ms?: number | null) => {
    if (ms == null) return null;
    const totalSec = Math.floor(ms / 1000);
    return `${Math.floor(totalSec / 60)}:${String(totalSec % 60).padStart(2, "0")}`;
  };
  return `Gere metadados de publicação para este vídeo de YouTube:

Título de trabalho: "${input.projectTitle}"
Nicho: ${input.niche}
Tom: ${input.tone ?? "documentário sério, dark"}
Duração aproximada: ${durMin ? `${durMin} min` : "desconhecida"}
Sinopse/gancho: ${input.logline ?? "—"}
Frases de gancho do roteiro: ${input.hookLines.join(" · ") || "—"}
Blocos do roteiro (use para montar os capítulos):
${input.chapters.map((c) => `- Ato ${c.act}: ${c.title}${fmtTime(c.startMs) ? ` (${fmtTime(c.startMs)})` : ""}`).join("\n")}

Retorne:
- title: título final para o YouTube, até 100 caracteres, forte em curiosidade e palavras-chave, sem exagero de emojis.
- description: descrição em 3-4 parágrafos — (1) gancho reafirmando a curiosidade central, (2) contexto do que o espectador vai descobrir, com 2-3 palavras-chave relevantes incluídas naturalmente, (3) chamada para se inscrever e ativar o sino, (4) aviso de que os capítulos estão logo abaixo. Não invente links nem nomes de produtos.
- tags: 15 a 20 tags/palavras-chave relevantes (sem #, minúsculas, sem repetir o título inteiro).
- chapters: lista de capítulos no formato {time: "MM:SS", label: "..."} baseada nos blocos fornecidos, sempre começando com 00:00 · Introdução.`;
}

/** Gera (ou regenera) título/descrição/tags/capítulos otimizados pra publicação, a partir do roteiro já gerado. */
export async function generateSeoMetadata(projectId: string, _formData?: FormData) {
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
    }),
    SeoResponseSchema,
    { system: seoSystemPrompt(), temperature: 0.8 },
  );
  await recordUsage(projectId, usage);

  const payload = {
    title: data.title.slice(0, 100),
    description: data.description,
    tags: JSON.stringify(data.tags.slice(0, 25)),
    chapters: JSON.stringify(data.chapters),
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
