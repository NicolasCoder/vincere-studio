import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@vincere-studio/db";
import { checkAgentAuth, computeProjectAgentState } from "@/lib/agent-api";

export const dynamic = "force-dynamic";

const contentSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("ideas"),
    replaceExisting: z.boolean().default(false),
    selectIndex: z.number().int().min(0).optional(),
    ideas: z
      .array(
        z.object({
          title: z.string().trim().min(3).max(180),
          category: z.string().trim().default("Curiosidade / Dossiê"),
          synopsis: z.string().trim().min(5).max(1200),
          hookLines: z.array(z.string().trim()).min(1).max(5).default(["Gancho principal de abertura"]),
          ctrEstimate: z.number().min(0).max(100).optional(),
          score: z.number().int().min(0).max(100).default(88),
          retention30s: z.number().min(0).max(100).optional(),
          editingPace: z.string().optional(),
          recommended: z.boolean().default(false),
          selected: z.boolean().default(false),
          viralityReason: z.string().optional(),
        }),
      )
      .min(1)
      .max(20),
  }),
  z.object({
    kind: z.literal("script"),
    logline: z.string().trim().max(500).optional(),
    model: z.string().trim().default("external-agent"),
    blocks: z
      .array(
        z.object({
          act: z.number().int().min(1).max(30).optional(),
          kind: z
            .enum(["HOOK", "CONTEXT", "ESCALATION", "REVEAL", "CLIMAX", "RESOLUTION", "CTA"])
            .default("CONTEXT"),
          title: z.string().trim().min(1).max(160),
          narration: z.string().trim().min(3).max(10000),
          wpm: z.number().int().min(80).max(240).default(150),
          brollCue: z.string().trim().max(1000).optional(),
          soundCue: z.string().trim().max(500).optional(),
          retentionScore: z.number().int().min(0).max(100).optional(),
          note: z.string().trim().max(500).optional(),
        }),
      )
      .min(1)
      .max(40),
  }),
  z.object({
    kind: z.literal("scenes"),
    replaceExisting: z.boolean().default(true),
    scenes: z
      .array(
        z.object({
          act: z.number().int().min(1).optional(),
          scriptBlockId: z.string().optional(),
          order: z.number().int().min(0).optional(),
          source: z.enum(["GENERATED", "STOCK", "IMPORTED", "MOTION"]).default("STOCK"),
          provider: z.string().optional(),
          prompt: z.string().trim().min(2).max(2000),
          keywords: z.string().trim().max(300).optional(),
          description: z.string().trim().max(500).optional(),
          preferVideo: z.boolean().default(false),
          startMs: z.number().int().min(0).default(0),
          endMs: z.number().int().min(500).default(4000),
          motion: z.record(z.unknown()).optional(),
          filePath: z.string().optional(),
          mediaType: z.enum(["image", "video"]).default("image"),
          status: z.enum(["PENDING", "READY", "FAILED"]).optional(),
        }),
      )
      .min(1)
      .max(200),
  }),
  z.object({
    kind: z.literal("edit_plan"),
    model: z.string().default("external-agent"),
    insertions: z
      .array(
        z.object({
          id: z.string().optional(),
          act: z.number().int().min(1).default(1),
          layout: z
            .enum([
              "lower-third",
              "overlay-dado",
              "insert-arquivo",
              "split-evidencia",
              "intertitulo",
              "cronologia",
              "mesa-arquivo",
            ])
            .default("lower-third"),
          style: z.string().default("autoridade"),
          triggerPhrase: z.string().trim().min(2),
          headline: z.string().trim().min(1).max(140),
          subline: z.string().trim().max(240).optional(),
          startMs: z.number().int().min(0).optional(),
          durationMs: z.number().int().min(1000).max(20000).default(4000),
          note: z.string().optional(),
        }),
      )
      .min(1)
      .max(100),
  }),
  z.object({
    kind: z.literal("seo"),
    title: z.string().trim().min(3).max(120),
    description: z.string().trim().max(5000).default(""),
    tags: z.array(z.string().trim()).max(50).default([]),
    chapters: z
      .array(
        z.object({
          time: z.string().trim(),
          title: z.string().trim(),
        }),
      )
      .default([]),
    privacyStatus: z.enum(["private", "unlisted", "public"]).default("private"),
  }),
]);

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = checkAgentAuth(req);
  if (denied) return denied;

  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      scripts: {
        orderBy: { version: "desc" },
        take: 1,
        include: { blocks: { orderBy: { order: "asc" } } },
      },
    },
  });

  if (!project) {
    return NextResponse.json(
      { ok: false, error: { codigo: "NAO_ENCONTRADO", mensagem: `Projeto ${id} não encontrado.` } },
      { status: 404 },
    );
  }

  const parsed = contentSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          codigo: "CONTEUDO_INVALIDO",
          mensagem: "Payload de conteúdo inválido.",
          detalhes: parsed.error.flatten(),
        },
      },
      { status: 400 },
    );
  }

  const d = parsed.data;

  if (d.kind === "ideas") {
    if (d.replaceExisting) {
      await prisma.idea.deleteMany({ where: { projectId: id } });
    }
    const selectIdx = d.selectIndex ?? d.ideas.findIndex((i) => i.selected);
    const chosenIdx = selectIdx >= 0 ? selectIdx : 0;

    await prisma.idea.updateMany({ where: { projectId: id }, data: { selected: false } });

    const created = [];
    for (let idx = 0; idx < d.ideas.length; idx++) {
      const item = d.ideas[idx]!;
      const isSelected = idx === chosenIdx;
      const idea = await prisma.idea.create({
        data: {
          projectId: id,
          title: item.title,
          category: item.category,
          synopsis: item.synopsis,
          hookLines: JSON.stringify(item.hookLines),
          ctrEstimate: item.ctrEstimate ?? 8.5,
          score: item.score,
          retention30s: item.retention30s ?? 74,
          editingPace: item.editingPace ?? "equilibrado",
          recommended: item.recommended || isSelected,
          selected: isSelected,
          viralityReason: item.viralityReason,
          model: "external-agent",
        },
      });
      created.push(idea);
    }

    const selectedIdea = created[chosenIdx] ?? created[0]!;
    await prisma.project.update({
      where: { id },
      data: {
        title: selectedIdea.title,
        stage: project.stage === "IDEATION" ? "SCRIPT" : project.stage,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        kind: "ideas",
        ideas: created,
        selectedIdea,
        state: await computeProjectAgentState(id),
      },
      { status: 201 },
    );
  }

  if (d.kind === "script") {
    const selectedIdea = await prisma.idea.findFirst({
      where: { projectId: id },
      orderBy: [{ selected: "desc" }, { createdAt: "desc" }],
    });

    const latestVersion = project.scripts[0]?.version ?? 0;
    let totalWords = 0;
    let totalDurationSec = 0;
    let cursorMs = 0;

    const preparedBlocks = d.blocks.map((b, idx) => {
      const cleanText = b.narration.replace(/\[[^\]]+\]/g, " ").trim();
      const words = cleanText.split(/\s+/).filter(Boolean).length;
      const durSec = Math.max(2, Math.round((words / (b.wpm || 150)) * 60));
      const startMs = cursorMs;
      const endMs = cursorMs + durSec * 1000;
      cursorMs = endMs;
      totalWords += words;
      totalDurationSec += durSec;

      return {
        act: b.act ?? idx + 1,
        order: idx + 1,
        kind: idx === 0 && b.kind === "CONTEXT" ? "HOOK" : b.kind,
        title: b.title,
        narration: b.narration,
        wpm: b.wpm,
        startMs,
        endMs,
        brollCue: b.brollCue,
        soundCue: b.soundCue,
        retentionScore: b.retentionScore ?? 85,
        note: b.note,
      };
    });

    const script = await prisma.script.create({
      data: {
        projectId: id,
        ideaId: selectedIdea?.id ?? null,
        version: latestVersion + 1,
        wordCount: totalWords,
        estimatedDuration: totalDurationSec,
        logline: d.logline ?? project.title,
        model: d.model,
        promptVersion: "agent-direct-v1",
        blocks: {
          create: preparedBlocks,
        },
      },
      include: {
        blocks: { orderBy: { order: "asc" } },
      },
    });

    await prisma.project.update({
      where: { id },
      data: { stage: "MEDIA", status: "IN_PROGRESS" },
    });

    return NextResponse.json(
      {
        ok: true,
        kind: "script",
        script,
        state: await computeProjectAgentState(id),
      },
      { status: 201 },
    );
  }

  if (d.kind === "scenes") {
    const latestScript = project.scripts[0];
    if (!latestScript || latestScript.blocks.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            codigo: "PRE_CONDICAO_FALHOU",
            mensagem: "O projeto precisa ter um roteiro com blocos antes de injetar cenas.",
          },
        },
        { status: 422 },
      );
    }

    const blocks = latestScript.blocks;
    if (d.replaceExisting) {
      await prisma.scene.deleteMany({
        where: { scriptBlockId: { in: blocks.map((b) => b.id) } },
      });
    }

    const createdScenes = [];
    for (let i = 0; i < d.scenes.length; i++) {
      const sc = d.scenes[i]!;
      const targetBlock =
        (sc.scriptBlockId ? blocks.find((b) => b.id === sc.scriptBlockId) : undefined) ??
        (sc.act ? blocks.find((b) => b.act === sc.act) : undefined) ??
        blocks[Math.min(i, blocks.length - 1)]!;

      const scene = await prisma.scene.create({
        data: {
          scriptBlockId: targetBlock.id,
          order: sc.order ?? i + 1,
          source: sc.source,
          provider: sc.provider ?? "AGENT",
          prompt: sc.prompt,
          keywords: sc.keywords ?? sc.prompt.split(/\s+/).slice(0, 5).join(" "),
          description: sc.description ?? sc.prompt,
          preferVideo: sc.preferVideo,
          startMs: sc.startMs,
          endMs: sc.endMs,
          motion: JSON.stringify(sc.motion ?? { preset: "ken-burns-in" }),
          filePath: sc.filePath ?? null,
          mediaType: sc.mediaType,
          status: sc.status ?? (sc.filePath ? "READY" : "PENDING"),
        },
      });
      createdScenes.push(scene);
    }

    return NextResponse.json(
      {
        ok: true,
        kind: "scenes",
        scenesCount: createdScenes.length,
        scenes: createdScenes,
        state: await computeProjectAgentState(id),
      },
      { status: 201 },
    );
  }

  if (d.kind === "edit_plan") {
    const latestScript = project.scripts[0];
    if (!latestScript) {
      return NextResponse.json(
        { ok: false, error: { codigo: "PRE_CONDICAO_FALHOU", mensagem: "Projeto não possui roteiro para vincular o plano de edição." } },
        { status: 422 },
      );
    }

    const prevPlan = await prisma.editPlan.findFirst({
      where: { projectId: id },
      orderBy: { version: "desc" },
    });

    const items = d.insertions.map((ins, idx) => ({
      id: ins.id ?? `ins-${idx + 1}`,
      act: ins.act,
      layout: ins.layout,
      style: ins.style,
      triggerPhrase: ins.triggerPhrase,
      headline: ins.headline,
      subline: ins.subline ?? "",
      startMs: ins.startMs ?? idx * 12000 + 2000,
      durationMs: ins.durationMs,
      resolved: true,
      note: ins.note ?? "Inserido diretamente pelo agente",
    }));

    const plan = await prisma.editPlan.create({
      data: {
        projectId: id,
        scriptId: latestScript.id,
        version: (prevPlan?.version ?? 0) + 1,
        model: d.model,
        promptVersion: "agent-direct-v1",
        insertions: items.length,
        unresolved: 0,
        data: JSON.stringify({ items }),
      },
    });

    return NextResponse.json(
      {
        ok: true,
        kind: "edit_plan",
        editPlan: plan,
        state: await computeProjectAgentState(id),
      },
      { status: 201 },
    );
  }

  // kind === "seo"
  const existingPub = await prisma.publication.findFirst({
    where: { projectId: id },
    orderBy: { id: "desc" },
  });

  const publication = existingPub
    ? await prisma.publication.update({
        where: { id: existingPub.id },
        data: {
          title: d.title,
          description: d.description,
          tags: JSON.stringify(d.tags),
          chapters: JSON.stringify(d.chapters),
          privacyStatus: d.privacyStatus,
        },
      })
    : await prisma.publication.create({
        data: {
          projectId: id,
          title: d.title,
          description: d.description,
          tags: JSON.stringify(d.tags),
          chapters: JSON.stringify(d.chapters),
          privacyStatus: d.privacyStatus,
        },
      });

  return NextResponse.json(
    {
      ok: true,
      kind: "seo",
      publication,
      state: await computeProjectAgentState(id),
    },
    { status: 201 },
  );
}
