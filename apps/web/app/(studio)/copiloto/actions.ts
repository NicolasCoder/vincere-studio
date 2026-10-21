"use server";
// Ações do Copiloto: cada etapa do passo a passo chama o mesmo pipeline dos Projetos
// (jobs do worker), mas volta para o próprio Copiloto em vez de saltar para outra tela.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@vincere-studio/db";
import { EDGE_VOICES } from "@vincere-studio/providers";
import { FORMATS, type VideoFormat } from "@vincere-studio/core";
import { createRequest } from "@/lib/claude-inbox";
import { nichoPorId } from "@/lib/nichos";
import { saveBlock } from "../projects/[id]/script/actions";

/** Pasta dos projetos do HyperFrames; cada pessoa aponta a sua em HYPERFRAMES_PROJECTS_DIR. */
const HF_DIR = process.env.HYPERFRAMES_PROJECTS_DIR || "C:\\Users\\Igor\\Videos-HF";

const voltar = (projectId: string, etapa: number, job?: string): never =>
  redirect(`/copiloto?projeto=${projectId}&etapa=${etapa}${job ? `&job=${job}` : ""}`);

async function enfileirar(projectId: string, type: string, payload: Record<string, unknown> = {}) {
  const job = await prisma.job.create({ data: { type, projectId, payload: JSON.stringify({ projectId, ...payload }) } });
  return job.id;
}

const NovoVideo = z.object({
  nicho: z.string().max(40).optional(),
  tema: z.string().trim().min(3, "Escreva o tema do vídeo (mínimo 3 letras).").max(120),
  formato: z.enum(["LONG_16_9", "SHORT_9_16"]),
  duracao: z.coerce.number().int().min(15).max(3600).optional(),
  tom: z.string().max(120).optional(),
});

/** Etapa 1 — cria o projeto e já pede as ideias. */
export async function criarVideo(formData: FormData) {
  const d = NovoVideo.parse({
    nicho: formData.get("nicho") || undefined,
    tema: formData.get("tema"),
    formato: formData.get("formato"),
    duracao: formData.get("duracao") || undefined,
    tom: formData.get("tom") || undefined,
  });
  const nicho = d.nicho ? nichoPorId(d.nicho) : undefined;
  const fmt = FORMATS[d.formato as VideoFormat];
  const p = await prisma.project.create({
    data: {
      title: d.tema,
      niche: d.tema,
      format: d.formato,
      costMode: "FREE",
      tone: d.tom || nicho?.nome,
      targetDuration: d.duracao ?? fmt.duration.default,
      status: "IN_PROGRESS",
    },
  });
  const job = await enfileirar(p.id, "GENERATE_IDEAS", { count: 3, append: false, focus: "all" });
  voltar(p.id, 1, job);
}

/** Tema pronto (ex.: vindo de Tendências): cria o projeto já com a ideia escolhida e manda organizar os beats. */
export async function temaParaBeats(formData: FormData) {
  const d = NovoVideo.extend({ angulo: z.string().max(400).optional(), ganchos: z.string().max(800).optional() }).parse({
    nicho: formData.get("nicho") || undefined,
    tema: formData.get("tema"),
    formato: formData.get("formato"),
    duracao: formData.get("duracao") || undefined,
    tom: formData.get("tom") || undefined,
    angulo: formData.get("angulo") || undefined,
    ganchos: formData.get("ganchos") || undefined,
  });
  const nicho = d.nicho ? nichoPorId(d.nicho) : undefined;
  const fmt = FORMATS[d.formato as VideoFormat];
  const ganchos = (d.ganchos ?? "").split("|").map((g) => g.trim()).filter(Boolean).slice(0, 3);
  const p = await prisma.project.create({
    data: {
      title: d.tema,
      niche: d.tema,
      format: d.formato,
      costMode: "FREE",
      tone: d.tom || nicho?.nome,
      targetDuration: d.duracao ?? fmt.duration.default,
      status: "IN_PROGRESS",
      stage: "SCRIPT",
      ideas: {
        create: {
          title: d.tema,
          category: nicho?.nome ?? "Tema direto",
          synopsis: d.angulo || d.tema,
          hookLines: JSON.stringify(ganchos),
          recommended: true,
          selected: true,
        },
      },
    },
  });
  voltar(p.id, 2, await enfileirar(p.id, "GENERATE_SCRIPT"));
}

const SKILLS_HF: Record<string, string> = {
  "/get-brolls": "Busque B-roll real para o vídeo, gere as prévias para eu aprovar e entregue na pasta do projeto, com a origem registrada.",
  "/subtitles-studio": "Monte as legendas dinâmicas do vídeo a partir da narração do projeto.",
  "/flow-studio": "Gere imagens e vídeos no Google Flow para as cenas do projeto e salve em assets/.",
  "/hyperframes": "Monte a composição no HyperFrames a partir do roteiro e dos assets do projeto.",
};

/** Modo livre: começa direto no HyperFrames, sem passar pela esteira, usando as skills quando quiser. */
export async function iniciarNoHyperFrames(formData: FormData) {
  const nome = String(formData.get("nome") ?? "").trim().slice(0, 60);
  const skill = String(formData.get("skill") ?? "/hyperframes");
  const formato = formData.get("formato") === "LONG_16_9" ? "1920x1080" : "1080x1920";
  if (nome.length < 3) redirect("/copiloto?modo=hf&erro=nome");
  if (!(skill in SKILLS_HF)) redirect("/copiloto?modo=hf&erro=skill");
  const slug = nome.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "projeto";
  await createRequest({
    pedido: `Projeto livre no HyperFrames "${slug}" (${formato}) em ${HF_DIR}. Use a skill ${skill}: ${SKILLS_HF[skill]} Se a pasta ainda não existir, crie o projeto antes.`,
    pagina: "/copiloto",
    projetoHf: slug,
  });
  redirect(`/copiloto?modo=hf&ok=${encodeURIComponent(slug)}`);
}

export async function maisIdeias(projectId: string) {
  voltar(projectId, 1, await enfileirar(projectId, "GENERATE_IDEAS", { count: 3, append: true, focus: "all" }));
}

/** Escolhe a ideia, avança o projeto para o roteiro e já pede o roteiro. */
export async function escolherIdeia(projectId: string, ideaId: string) {
  await prisma.$transaction([
    prisma.idea.updateMany({ where: { projectId }, data: { selected: false } }),
    prisma.idea.update({ where: { id: ideaId }, data: { selected: true } }),
  ]);
  const idea = await prisma.idea.findUniqueOrThrow({ where: { id: ideaId } });
  await prisma.project.update({ where: { id: projectId }, data: { title: idea.title, stage: "SCRIPT" } });
  voltar(projectId, 2, await enfileirar(projectId, "GENERATE_SCRIPT"));
}

/** Etapa 2 — roteiro. */
export async function gerarRoteiro(projectId: string) {
  voltar(projectId, 2, await enfileirar(projectId, "GENERATE_SCRIPT"));
}

export async function salvarBeat(projectId: string, blockId: string, formData: FormData) {
  await saveBlock(projectId, blockId, formData);
  revalidatePath("/copiloto");
  voltar(projectId, 2);
}

/**
 * Etapa 3 — narração (um arquivo por bloco). O campo "voz" é `perfil:<id>` (perfis Edge/Gemini já
 * cadastrados) ou `vs:<idDaVoz>|<nome>` (voz do VoiceStudio, que vira um perfil com reserva Edge).
 */
export async function narrarRoteiro(projectId: string, formData: FormData) {
  const voz = String(formData.get("voz") ?? "");
  let perfilId: string | null | undefined;
  if (voz.startsWith("perfil:")) {
    perfilId = voz.slice(7) || null;
  } else if (voz.startsWith("vs:")) {
    const [voiceId, ...resto] = voz.slice(3).split("|");
    const nome = resto.join("|") || voiceId;
    if (!/^[\w.:-]{2,80}$/.test(voiceId)) throw new Error("Voz inválida.");
    const existente = await prisma.voiceProfile.findFirst({ where: { provider: "VOICESTUDIO", voiceId } });
    const reserva = EDGE_VOICES.find((v) => v.id.startsWith("pt-BR"))?.id ?? "pt-BR-AntonioNeural";
    perfilId = (
      existente ??
      (await prisma.voiceProfile.create({
        data: { name: `VoiceStudio · ${nome}`.slice(0, 80), provider: "VOICESTUDIO", voiceId, language: "pt-BR", fallbacks: JSON.stringify([{ provider: "EDGE_TTS", voiceId: reserva }]) },
      }))
    ).id;
  }
  if (perfilId !== undefined) await prisma.project.update({ where: { id: projectId }, data: { voiceProfileId: perfilId } });
  voltar(projectId, 3, await enfileirar(projectId, "SYNTHESIZE_VOICE", { force: formData.get("refazer") !== null }));
}

export async function alinharLegendas(projectId: string) {
  voltar(projectId, 3, await enfileirar(projectId, "ALIGN_CAPTIONS"));
}

/** Etapa 4 — cenas e mídia. */
export async function planejarCenas(projectId: string, densidade: "dense" | "sparse") {
  await prisma.project.update({ where: { id: projectId }, data: { stage: "MEDIA" } });
  voltar(projectId, 4, await enfileirar(projectId, "GENERATE_SCENE_PROMPTS", { density: densidade }));
}

export async function buscarBroll(projectId: string) {
  voltar(projectId, 4, await enfileirar(projectId, "HUNT_BROLL", { onlyPreferVideo: false }));
}

export async function importarCaixaDeEntrada(projectId: string) {
  voltar(projectId, 4, await enfileirar(projectId, "IMPORT_INBOX"));
}

/** Chama uma skill do Claude do PC (get-brolls, editar-igor, subtitles-studio…) para o projeto, com contexto da etapa. */
export async function chamarSkill(projectId: string, etapa: number, skill: string, instrucao: string) {
  const p = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, select: { title: true, format: true } });
  await createRequest({
    pedido:
      `Use a skill ${skill} no projeto "${p.title}" (${p.format === "SHORT_9_16" ? "9:16" : "16:9"}), etapa ${etapa} da esteira do Copiloto. ` +
      `${instrucao} O projeto está em /projects/${projectId} (pasta storage/projects/${projectId}). ` +
      `Entregue o resultado na pasta do projeto e responda aqui com o que foi feito.`,
    pagina: "/copiloto",
    projetoId: projectId,
  });
  voltar(projectId, etapa);
}

/** Etapa 5 — monta o BRUTO (vídeo base com narração, cenas e legendas). */
export async function renderizar(projectId: string, formData: FormData) {
  const prova = formData.get("prova") !== null;
  const proj = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, select: { captionPreset: true, captionStyle: true } });
  const job = await enfileirar(projectId, "RENDER_VIDEO", {
    captions: true,
    captionPreset: proj.captionPreset,
    captionStyle: proj.captionStyle,
    music: formData.get("musica") !== null,
    ...(prova ? { preview: true } : {}),
  });
  await prisma.project.update({ where: { id: projectId }, data: { stage: "RENDER" } });
  voltar(projectId, 5, job);
}

/** Envia o BRUTO ao HyperFrames Studio, onde ficam a edição final e a lapidação: o Claude do PC cria a pasta em Videos-HF e monta a composição. */
export async function enviarAoHyperFrames(projectId: string) {
  const p = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, select: { title: true, format: true, tone: true } });
  const slug = p.title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "projeto";
  await createRequest({
    pedido:
      `Crie o projeto HyperFrames "${slug}" em ${HF_DIR} (${p.format === "SHORT_9_16" ? "1080x1920" : "1920x1080"}) ` +
      `a partir do projeto "${p.title}" do Vincere Studio: use a narração e as legendas alinhadas de /projects/${projectId}, ` +
      `as cenas de /projects/${projectId}/media e a skill do nicho${p.tone ? ` ("${p.tone}")` : ""}. ` +
      `Quando a prévia estiver pronta, deixe no painel "Prévias para aprovar" do /studio.`,
    pagina: "/copiloto",
    projetoId: projectId,
    projetoHf: slug,
  });
  voltar(projectId, 5);
}
