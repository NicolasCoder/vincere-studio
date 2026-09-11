import { prisma } from "@docupulse/db";
import {
  EDIT_PLAN_PROMPT_VERSION,
  EditPlanResponseSchema,
  FORMATS,
  LAYOUT_META,
  type VideoFormat,
  backdropFor,
  captionSafeZone,
  composeEvidencePrompt,
  editPlanPrompt,
  editPlanSystemPrompt,
  findPhrase,
  insertionRegion,
  needsOpaquePlate,
  resolveOverlaps,
  type EditInsertion,
  type EditPlanData,
} from "@docupulse/core";
import { ACT_GAP_MS, profileFor } from "@docupulse/render";
import { FFMPEG, absPath, getTextProvider, recordUsage, run } from "@docupulse/providers";
import type { JobContext } from "../queue";

interface Word {
  text: string;
  startMs: number;
  endMs: number;
}

/**
 * Média de luma de um retângulo do master num instante específico.
 *
 * O `run` do projeto devolve stdout como string, então ler pixel cru não funciona. O filtro
 * `signalstats` resolve imprimindo a estatística como texto no stderr, que o `run` captura.
 */
async function regionLuma(
  video: string,
  atMs: number,
  r: { x: number; y: number; w: number; h: number },
): Promise<number | null> {
  const out = await run(FFMPEG, [
    "-hide_banner",
    "-ss",
    (atMs / 1000).toFixed(3),
    "-i",
    video,
    "-frames:v",
    "1",
    "-vf",
    `crop=${r.w}:${r.h}:${r.x}:${r.y},signalstats,metadata=print:key=lavfi.signalstats.YAVG`,
    "-f",
    "null",
    "-",
  ]);
  const m = /lavfi\.signalstats\.YAVG=([\d.]+)/.exec(out);
  return m ? Number(m[1]) : null;
}

/**
 * GENERATE_EDIT_PLAN: propõe a camada visual (lower thirds, destaques, intertítulos) que entra
 * por cima do master, com timecode absoluto já resolvido contra as legendas alinhadas.
 *
 * Não renderiza nada — a saída é um plano para revisão. payload: { projectId }
 */
export async function generateEditPlan(ctx: JobContext) {
  const projectId = String(ctx.payload.projectId ?? ctx.job.projectId ?? "");
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error("Projeto não encontrado");

  const script = await prisma.script.findFirst({
    where: { projectId },
    orderBy: { version: "desc" },
    include: {
      blocks: {
        orderBy: { order: "asc" },
        include: { voiceTracks: { include: { captions: true } } },
      },
    },
  });
  if (!script) throw new Error("Sem roteiro");

  const missingVoice = script.blocks.filter((b) => !b.voiceTracks.length);
  if (missingVoice.length)
    throw new Error(`Sintetize a locução dos atos ${missingVoice.map((b) => b.act).join(", ")} antes de gerar o plano.`);

  // O plano depende do timecode real por palavra: sem legendas alinhadas não há como
  // posicionar inserção com precisão, e estimar pelo texto é justamente o que queremos evitar.
  const missingCaptions = script.blocks.filter((b) => !b.voiceTracks[0]?.captions[0]);
  if (missingCaptions.length)
    throw new Error(
      `Alinhe as legendas (Passo 3) antes de gerar o plano — faltam os atos ${missingCaptions.map((b) => b.act).join(", ")}.`,
    );

  // Timecode absoluto: mesma acumulação que o buildAss e o renderTimeline fazem.
  let offset = 0;
  const acts = script.blocks.map((b) => {
    const track = b.voiceTracks[0];
    const words = JSON.parse(track.captions[0]?.words ?? "[]") as Word[];
    const actOffset = offset;
    offset += track.durationMs + ACT_GAP_MS;
    return { block: b, words, actOffset, durationMs: track.durationMs };
  });
  const totalMs = Math.max(0, offset - ACT_GAP_MS);

  const profile = profileFor(project.format, null);
  // No longo a legenda não é queimada (o CC do YouTube cobre acessibilidade), então o rodapé fica
  // livre para o lower third. Se alguém marcar o checkbox manualmente no render, o plano fica
  // conservador demais, não errado — a inserção sobe em vez de invadir.
  const burnedCaptions = FORMATS[project.format as VideoFormat].captions.required;
  const provider = getTextProvider();
  const system = editPlanSystemPrompt();
  const insertions: EditInsertion[] = [];
  let cost = 0;
  let unresolved = 0;
  let modelUsed = "";

  for (let i = 0; i < acts.length; i++) {
    if (await ctx.isCancelled()) return { cancelled: true };
    const { block, words, actOffset, durationMs } = acts[i];
    await ctx.progress({ percent: (i / acts.length) * 90, message: `Ato ${block.act}: planejando inserções` });

    // Marcação determinística: virada de ato entra como intertítulo, sem gastar chamada de IA.
    if (i > 0) {
      insertions.push({
        id: `a${block.act}-intertitulo`,
        act: block.act,
        layout: "graphic-fullscreen",
        trigger: "(virada de ato)",
        startMs: Math.max(0, actOffset - 300),
        endMs: Math.max(0, actOffset - 300) + LAYOUT_META["graphic-fullscreen"].defaultMs,
        primary: block.title,
        note: "Intertítulo de virada de ato (marcação automática, não vem da IA).",
        resolved: true,
      });
    }

    const res = await provider.generateJson(
      editPlanPrompt({
        title: project.title,
        niche: project.niche,
        act: block.act,
        actTitle: block.title,
        actKind: block.kind,
        durationSec: durationMs / 1000,
        narration: block.narration,
        brollCue: block.brollCue,
        isFirstAct: i === 0,
        isLastAct: i === acts.length - 1,
        usedSoFar: insertions.filter((x) => x.trigger !== "(virada de ato)").map((x) => x.primary),
      }),
      EditPlanResponseSchema,
      { system, temperature: 0.6 },
    );
    await recordUsage(projectId, res.usage);
    cost += res.usage.costUsd;
    modelUsed = `${res.usage.provider}/${res.usage.model}`;

    let matched = 0;
    res.data.insertions.forEach((raw, n) => {
      const at = findPhrase(words, raw.trigger);
      const ok = at >= 0;
      if (ok) matched++;
      else unresolved++;

      // Sem casamento, o tempo é um chute proporcional — fica marcado para revisão manual.
      const relStart = ok ? words[at].startMs : Math.round(((n + 1) / (res.data.insertions.length + 1)) * durationMs);
      const start = actOffset + relStart;
      const dur = LAYOUT_META[raw.layout].defaultMs;

      insertions.push({
        id: `a${block.act}-i${n + 1}`,
        act: block.act,
        layout: raw.layout,
        lowerThirdStyle: raw.layout === "lower-third" ? (raw.lowerThirdStyle ?? "DATADO") : undefined,
        trigger: raw.trigger,
        startMs: start,
        endMs: Math.min(totalMs, start + dur),
        primary: raw.primary,
        secondary: raw.secondary ?? undefined,
        note: raw.note,
        // Só faz sentido nos layouts que mostram evidência; nos demais o modelo às vezes preenche
        // por hábito, e guardar isso confundiria a revisão.
        // Os campos viram a frase final aqui, com estilo e cláusula negativa fixos. O que vai pro
        // banco continua sendo o prompt pronto — é por ele que o job de imagens casa a evidência.
        evidencePrompt:
          (raw.layout === "insert-arquivo" || raw.layout === "split-evidencia") && raw.evidence
            ? composeEvidencePrompt(raw.evidence)
            : undefined,
        resolved: ok,
      });
    });
    await ctx.log(
      `Ato ${block.act}: ${res.data.insertions.length} inserção(ões) propostas · ${matched} com tempo confirmado no áudio`,
    );
  }

  insertions.sort((a, b) => a.startMs - b.startMs);
  const before = insertions.length;
  const finalList = resolveOverlaps(insertions);
  if (before !== finalList.length) await ctx.log(`${before - finalList.length} inserção(ões) descartadas por sobreposição`);

  // Legibilidade: mede o brilho real do master onde cada inserção vai cair. Sem isso, um lower
  // third de texto claro pode aterrissar sobre um B-roll claro e sumir.
  const render = await prisma.renderJob.findFirst({
    where: { projectId, outputPath: { not: null } },
    orderBy: { finishedAt: "desc" },
  });
  if (!render?.outputPath) {
    await ctx.log("Sem render concluído: pulei a checagem de legibilidade (o plano segue válido).");
  } else {
    const master = absPath(render.outputPath);
    const probes = finalList.filter((i) => insertionRegion(i.layout, profile.width, profile.height, burnedCaptions));
    let measured = 0;
    let risky = 0;
    let promoted = 0;
    for (let i = 0; i < probes.length; i++) {
      const ins = probes[i];
      const region = insertionRegion(ins.layout, profile.width, profile.height, burnedCaptions)!;
      await ctx.progress({ percent: 90 + (i / Math.max(1, probes.length)) * 9, message: "Medindo legibilidade" });
      try {
        // Mede no meio da inserção, não na entrada — é onde ela fica mais tempo na tela.
        const luma = await regionLuma(master, (ins.startMs + ins.endMs) / 2, region);
        if (luma == null) continue;
        ins.backdropLuma = Math.round(luma);
        ins.backdrop = backdropFor(luma);
        measured++;
        if (needsOpaquePlate(ins)) {
          risky++;
          // Emocional é o único estilo sem placa (texto claro sobre transparência). Sobre fundo
          // claro ele desaparece, então promove para Autoridade, que tem placa opaca.
          if (ins.layout === "lower-third" && ins.lowerThirdStyle === "EMOCIONAL") {
            ins.lowerThirdStyle = "AUTORIDADE";
            ins.note = `${ins.note ?? ""} Estilo trocado de Emocional para Autoridade: o master aqui é claro (luma ${ins.backdropLuma}) e o estilo transparente sumiria.`.trim();
            promoted++;
          }
        }
      } catch (err) {
        await ctx.log(`Legibilidade da inserção ${ins.id} falhou (não crítico): ${(err as Error).message.slice(0, 90)}`);
      }
    }
    await ctx.log(
      `Legibilidade: ${measured}/${probes.length} inserções medidas no master · ${risky} sobre fundo claro · ${promoted} promovidas de Emocional para Autoridade`,
    );
  }

  const data: EditPlanData = {
    promptVersion: EDIT_PLAN_PROMPT_VERSION,
    totalMs,
    actCount: acts.length,
    safeZone: captionSafeZone(profile.width, profile.height, burnedCaptions),
    insertions: finalList,
  };

  const last = await prisma.editPlan.findFirst({ where: { projectId }, orderBy: { version: "desc" } });
  const plan = await prisma.editPlan.create({
    data: {
      projectId,
      scriptId: script.id,
      version: (last?.version ?? 0) + 1,
      promptVersion: EDIT_PLAN_PROMPT_VERSION,
      model: modelUsed,
      data: JSON.stringify(data),
      insertions: finalList.length,
      unresolved,
    },
  });

  await ctx.progress({ percent: 100, message: "Plano pronto" });
  await ctx.log(
    `Plano v${plan.version}: ${finalList.length} inserções em ${acts.length} atos · ${unresolved} sem tempo confirmado · US$ ${cost.toFixed(4)} equiv.`,
  );
  return { editPlanId: plan.id, version: plan.version, insertions: finalList.length, unresolved };
}
