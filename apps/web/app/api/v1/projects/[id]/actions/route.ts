import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@vincere-studio/db";
import {
  checkAgentAuth,
  computeProjectAgentState,
  enqueueProjectJob,
  exportProjectToHyperFrames,
} from "@/lib/agent-api";

export const dynamic = "force-dynamic";

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("gerar_ideias"),
    count: z.number().int().min(1).max(10).default(3),
    append: z.boolean().default(false),
    focus: z.string().default("all"),
    force: z.boolean().default(false),
  }),
  z.object({
    action: z.literal("escolher_ideia"),
    ideaId: z.string().min(1),
  }),
  z.object({
    action: z.literal("gerar_roteiro"),
    force: z.boolean().default(false),
  }),
  z.object({
    action: z.literal("reescrever_bloco"),
    blockId: z.string().min(1),
    mode: z.string().default("tighten"),
    instruction: z.string().max(1000).optional(),
    force: z.boolean().default(false),
  }),
  z.object({
    action: z.literal("sugerir_melhorias"),
    scriptId: z.string().optional(),
    force: z.boolean().default(false),
  }),
  z.object({
    action: z.literal("sintetizar_voz"),
    blockIds: z.array(z.string()).optional(),
    force: z.boolean().default(false),
  }),
  z.object({
    action: z.literal("alinhar_legendas"),
    force: z.boolean().default(false),
  }),
  z.object({
    action: z.literal("planejar_cenas"),
    density: z.enum(["dense", "sparse"]).default("dense"),
    force: z.boolean().default(false),
  }),
  z.object({
    action: z.literal("buscar_broll"),
    onlyPreferVideo: z.boolean().default(false),
    force: z.boolean().default(false),
  }),
  z.object({
    action: z.literal("gerar_imagens"),
    prompts: z.array(z.string().min(3)).min(1).max(20),
    engine: z.enum(["GEMINI", "POLLINATIONS"]).default("POLLINATIONS"),
    aspect: z.enum(["16:9", "9:16", "1:1"]).optional(),
    force: z.boolean().default(false),
  }),
  z.object({
    action: z.literal("importar_inbox"),
    force: z.boolean().default(false),
  }),
  z.object({
    action: z.literal("gerar_plano_edicao"),
    force: z.boolean().default(false),
  }),
  z.object({
    action: z.literal("renderizar_video"),
    captions: z.boolean().default(true),
    music: z.boolean().default(true),
    preview: z.boolean().default(false),
    force: z.boolean().default(false),
  }),
  z.object({
    action: z.literal("gerar_thumbnail"),
    force: z.boolean().default(false),
  }),
  z.object({
    action: z.literal("aprovar_render"),
    renderJobId: z.string().optional(),
    note: z.string().max(500).optional(),
  }),
  z.object({
    action: z.literal("rejeitar_render"),
    renderJobId: z.string().optional(),
    note: z.string().min(2).max(500),
  }),
  z.object({
    action: z.literal("exportar_hyperframes"),
    dispatchAgent: z.boolean().default(false),
    instructions: z.string().max(1000).optional(),
  }),
  z.object({
    action: z.literal("publicar_youtube"),
    privacyStatus: z.enum(["private", "unlisted", "public"]).default("private"),
    force: z.boolean().default(false),
  }),
]);

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = checkAgentAuth(req);
  if (denied) return denied;

  const { id } = await params;
  const state = await computeProjectAgentState(id);
  if (!state) {
    return NextResponse.json(
      { ok: false, error: { codigo: "NAO_ENCONTRADO", mensagem: `Projeto ${id} não encontrado.` } },
      { status: 404 },
    );
  }

  const parsed = actionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          codigo: "ACAO_INVALIDA",
          mensagem: "Ação ou parâmetros inválidos.",
          detalhes: parsed.error.flatten(),
        },
      },
      { status: 400 },
    );
  }

  const d = parsed.data;

  switch (d.action) {
    case "gerar_ideias": {
      const { job, reused } = await enqueueProjectJob(
        id,
        "GENERATE_IDEAS",
        { count: d.count, append: d.append, focus: d.focus },
        { force: d.force },
      );
      return NextResponse.json({
        ok: true,
        action: d.action,
        reused,
        jobId: job.id,
        waitUrl: `/api/v1/jobs/${job.id}/wait`,
      });
    }

    case "escolher_ideia": {
      const idea = await prisma.idea.findFirst({ where: { id: d.ideaId, projectId: id } });
      if (!idea) {
        return NextResponse.json(
          { ok: false, error: { codigo: "IDEIA_NAO_ENCONTRADA", mensagem: "Ideia não pertence a este projeto." } },
          { status: 404 },
        );
      }
      await prisma.idea.updateMany({ where: { projectId: id }, data: { selected: false } });
      await prisma.idea.update({ where: { id: idea.id }, data: { selected: true } });
      await prisma.project.update({ where: { id }, data: { title: idea.title, stage: "SCRIPT" } });
      return NextResponse.json({
        ok: true,
        action: d.action,
        selectedIdea: idea,
        state: await computeProjectAgentState(id),
      });
    }

    case "gerar_roteiro": {
      if (!state.etapasConcluidas.ideation) {
        return NextResponse.json(
          {
            ok: false,
            error: {
              codigo: "PRE_CONDICAO_FALHOU",
              mensagem: "Não há ideia selecionada para gerar o roteiro.",
              comoResolver: "Chame escolher_ideia, gerar_ideias ou envie ideias/roteiro em POST /api/v1/projects/[id]/content.",
            },
          },
          { status: 422 },
        );
      }
      await prisma.project.update({ where: { id }, data: { stage: "SCRIPT" } });
      const { job, reused } = await enqueueProjectJob(id, "GENERATE_SCRIPT", {}, { force: d.force });
      return NextResponse.json({
        ok: true,
        action: d.action,
        reused,
        jobId: job.id,
        waitUrl: `/api/v1/jobs/${job.id}/wait`,
      });
    }

    case "reescrever_bloco": {
      const { job, reused } = await enqueueProjectJob(
        id,
        "REWRITE_BLOCK",
        { blockId: d.blockId, mode: d.mode, instruction: d.instruction },
        { force: d.force },
      );
      return NextResponse.json({ ok: true, action: d.action, reused, jobId: job.id, waitUrl: `/api/v1/jobs/${job.id}/wait` });
    }

    case "sugerir_melhorias": {
      const scriptId = d.scriptId ?? state.metricas.scriptId;
      if (!scriptId) {
        return NextResponse.json(
          { ok: false, error: { codigo: "PRE_CONDICAO_FALHOU", mensagem: "Projeto ainda não possui roteiro." } },
          { status: 422 },
        );
      }
      const { job, reused } = await enqueueProjectJob(id, "SCRIPT_SUGGESTIONS", { scriptId }, { force: d.force });
      return NextResponse.json({ ok: true, action: d.action, reused, jobId: job.id, waitUrl: `/api/v1/jobs/${job.id}/wait` });
    }

    case "sintetizar_voz": {
      if (!state.etapasConcluidas.script) {
        return NextResponse.json(
          {
            ok: false,
            error: {
              codigo: "PRE_CONDICAO_FALHOU",
              mensagem: "O projeto precisa ter blocos de roteiro antes de sintetizar voz.",
              comoResolver: "Envie o roteiro em POST /api/v1/projects/[id]/content (kind: 'script') ou rode gerar_roteiro.",
            },
          },
          { status: 422 },
        );
      }
      await prisma.project.update({ where: { id }, data: { stage: "MEDIA" } });
      const { job, reused } = await enqueueProjectJob(
        id,
        "SYNTHESIZE_VOICE",
        { ...(d.blockIds?.length ? { blockIds: d.blockIds } : {}), force: d.force },
        { force: d.force },
      );
      return NextResponse.json({ ok: true, action: d.action, reused, jobId: job.id, waitUrl: `/api/v1/jobs/${job.id}/wait` });
    }

    case "alinhar_legendas": {
      if (state.metricas.atosComVoz === 0) {
        return NextResponse.json(
          {
            ok: false,
            error: {
              codigo: "PRE_CONDICAO_FALHOU",
              mensagem: "Nenhuma faixa de voz sintetizada para alinhar legendas.",
              comoResolver: "Execute sintetizar_voz primeiro e aguarde finalizar.",
            },
          },
          { status: 422 },
        );
      }
      const { job, reused } = await enqueueProjectJob(id, "ALIGN_CAPTIONS", {}, { force: d.force });
      return NextResponse.json({ ok: true, action: d.action, reused, jobId: job.id, waitUrl: `/api/v1/jobs/${job.id}/wait` });
    }

    case "planejar_cenas": {
      if (!state.etapasConcluidas.script) {
        return NextResponse.json(
          {
            ok: false,
            error: {
              codigo: "PRE_CONDICAO_FALHOU",
              mensagem: "Crie o roteiro antes de planejar as cenas.",
            },
          },
          { status: 422 },
        );
      }
      await prisma.project.update({ where: { id }, data: { stage: "MEDIA" } });
      const { job, reused } = await enqueueProjectJob(
        id,
        "GENERATE_SCENE_PROMPTS",
        { density: d.density },
        { force: d.force },
      );
      return NextResponse.json({ ok: true, action: d.action, reused, jobId: job.id, waitUrl: `/api/v1/jobs/${job.id}/wait` });
    }

    case "buscar_broll": {
      if (!state.etapasConcluidas.scenes) {
        return NextResponse.json(
          {
            ok: false,
            error: {
              codigo: "PRE_CONDICAO_FALHOU",
              mensagem: "Planeje ou injete cenas antes de buscar B-roll.",
            },
          },
          { status: 422 },
        );
      }
      const { job, reused } = await enqueueProjectJob(
        id,
        "HUNT_BROLL",
        { onlyPreferVideo: d.onlyPreferVideo },
        { force: d.force },
      );
      return NextResponse.json({ ok: true, action: d.action, reused, jobId: job.id, waitUrl: `/api/v1/jobs/${job.id}/wait` });
    }

    case "gerar_imagens": {
      const { job, reused } = await enqueueProjectJob(
        id,
        "GENERATE_IMAGES",
        {
          prompts: d.prompts,
          engine: d.engine,
          aspect: d.aspect ?? (state.format === "SHORT_9_16" ? "9:16" : "16:9"),
        },
        { force: d.force },
      );
      return NextResponse.json({ ok: true, action: d.action, reused, jobId: job.id, waitUrl: `/api/v1/jobs/${job.id}/wait` });
    }

    case "importar_inbox": {
      const { job, reused } = await enqueueProjectJob(id, "IMPORT_INBOX", {}, { force: d.force });
      return NextResponse.json({ ok: true, action: d.action, reused, jobId: job.id, waitUrl: `/api/v1/jobs/${job.id}/wait` });
    }

    case "gerar_plano_edicao": {
      if (!state.etapasConcluidas.captions) {
        return NextResponse.json(
          {
            ok: false,
            error: {
              codigo: "PRE_CONDICAO_FALHOU",
              mensagem: "O plano de edição exige legendas alinhadas em todos os atos.",
              comoResolver: "Execute alinhar_legendas primeiro.",
            },
          },
          { status: 422 },
        );
      }
      const { job, reused } = await enqueueProjectJob(id, "GENERATE_EDIT_PLAN", {}, { force: d.force });
      return NextResponse.json({ ok: true, action: d.action, reused, jobId: job.id, waitUrl: `/api/v1/jobs/${job.id}/wait` });
    }

    case "renderizar_video": {
      if (!state.etapasConcluidas.voice || !state.etapasConcluidas.scenes) {
        return NextResponse.json(
          {
            ok: false,
            error: {
              codigo: "PRE_CONDICAO_FALHOU",
              mensagem: "Renderizar vídeo exige narração sintetizada e cenas definidas.",
            },
          },
          { status: 422 },
        );
      }
      const proj = await prisma.project.findUniqueOrThrow({
        where: { id },
        select: { captionPreset: true, captionStyle: true },
      });
      await prisma.project.update({ where: { id }, data: { stage: "RENDER" } });
      const { job, reused } = await enqueueProjectJob(
        id,
        "RENDER_VIDEO",
        {
          captions: d.captions,
          captionPreset: proj.captionPreset,
          captionStyle: proj.captionStyle,
          music: d.music,
          ...(d.preview ? { preview: true } : {}),
        },
        { force: d.force },
      );
      return NextResponse.json({ ok: true, action: d.action, reused, jobId: job.id, waitUrl: `/api/v1/jobs/${job.id}/wait` });
    }

    case "gerar_thumbnail": {
      const { job, reused } = await enqueueProjectJob(id, "GENERATE_THUMBNAIL", {}, { force: d.force });
      return NextResponse.json({ ok: true, action: d.action, reused, jobId: job.id, waitUrl: `/api/v1/jobs/${job.id}/wait` });
    }

    case "aprovar_render":
    case "rejeitar_render": {
      const targetRender = d.renderJobId
        ? await prisma.renderJob.findFirst({ where: { id: d.renderJobId, projectId: id } })
        : await prisma.renderJob.findFirst({ where: { projectId: id }, orderBy: [{ revision: "desc" }, { startedAt: "desc" }] });

      if (!targetRender) {
        return NextResponse.json(
          { ok: false, error: { codigo: "RENDER_NAO_ENCONTRADO", mensagem: "Nenhum render encontrado para este projeto." } },
          { status: 404 },
        );
      }

      const newStatus = d.action === "aprovar_render" ? "APPROVED" : "REJECTED";
      const updated = await prisma.renderJob.update({
        where: { id: targetRender.id },
        data: {
          reviewStatus: newStatus,
          reviewNote: d.note ?? null,
          reviewedAt: new Date(),
        },
      });
      if (newStatus === "APPROVED") {
        await prisma.project.update({ where: { id }, data: { stage: "PUBLISH" } });
      }
      return NextResponse.json({
        ok: true,
        action: d.action,
        renderJob: updated,
        state: await computeProjectAgentState(id),
      });
    }

    case "exportar_hyperframes": {
      if (!state.etapasConcluidas.script) {
        return NextResponse.json(
          { ok: false, error: { codigo: "PRE_CONDICAO_FALHOU", mensagem: "Crie o roteiro antes de exportar para o HyperFrames." } },
          { status: 422 },
        );
      }
      const exported = await exportProjectToHyperFrames(id, {
        dispatchAgent: d.dispatchAgent,
        instructions: d.instructions,
      });
      return NextResponse.json({
        ok: true,
        action: d.action,
        hyperframes: exported,
        state: await computeProjectAgentState(id),
      });
    }

    case "publicar_youtube": {
      // GATE HUMANO OBRIGATÓRIO NO SERVIDOR: só publica se o último render estiver APPROVED.
      if (!state.etapasConcluidas.renderApproved) {
        return NextResponse.json(
          {
            ok: false,
            error: {
              codigo: "GATE_APROVACAO_OBRIGATORIO",
              mensagem: "Publicação bloqueada: o último render ainda não foi aprovado.",
              comoResolver: "Inspecione o vídeo renderizado e chame aprovar_render antes de publicar_youtube.",
            },
          },
          { status: 403 },
        );
      }
      const { job, reused } = await enqueueProjectJob(
        id,
        "PUBLISH_YOUTUBE",
        { privacyStatus: d.privacyStatus },
        { force: d.force },
      );
      return NextResponse.json({ ok: true, action: d.action, reused, jobId: job.id, waitUrl: `/api/v1/jobs/${job.id}/wait` });
    }
  }
}
