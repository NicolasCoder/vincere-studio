import path from "node:path";
import { prisma } from "@vincere-studio/db";
import { pauseMs } from "@vincere-studio/core";
import { concatWithSilences, ehCobravel, getVoiceProvider, projectDir, relPath, trimLongSilences, type VoiceProvider } from "@vincere-studio/providers";
import type { JobContext } from "../queue";

/**
 * SYNTHESIZE_VOICE: sintetiza a locução de cada bloco com o perfil de voz do projeto.
 * Pausas [Pausa 1.5s] viram silêncio real (segmenta o texto, sintetiza cada trecho, concatena).
 * Se o provedor principal falhar (cota/erro), usa a voz equivalente de reserva e marca fallbackUsed.
 * payload: { projectId, blockIds?: string[] }
 */
export async function synthesizeVoice(ctx: JobContext) {
  const projectId = String(ctx.payload.projectId ?? ctx.job.projectId ?? "");
  const only = Array.isArray(ctx.payload.blockIds) ? (ctx.payload.blockIds as string[]) : null;
  const project = await prisma.project.findUnique({ where: { id: projectId }, include: { voiceProfile: true, scripts: { orderBy: { version: "desc" }, take: 1, include: { blocks: { orderBy: { order: "asc" } } } } } });
  if (!project) throw new Error("Projeto não encontrado");
  const script = project.scripts[0];
  if (!script) throw new Error("Gere o roteiro antes de sintetizar a voz.");
  const profile = project.voiceProfile ?? (await prisma.voiceProfile.findFirst({ where: { isDefault: true } }));
  if (!profile) throw new Error("Nenhum perfil de voz. Crie um em Settings.");
  const fallbacks = JSON.parse(profile.fallbacks || "[]") as { provider: string; voiceId: string }[];
  const chain = [{ provider: profile.provider, voiceId: profile.voiceId }, ...fallbacks];
  const force = Boolean(ctx.payload.force ?? false) || !!only; // regravar tudo / atos específicos
  const done = new Set((Array.isArray(ctx.payload.doneBlockIds) ? (ctx.payload.doneBlockIds as string[]) : []));
  const withTracks = new Set((await prisma.voiceTrack.findMany({ where: { block: { scriptId: script.id } }, select: { scriptBlockId: true } })).map((t) => t.scriptBlockId));
  const blocks = script.blocks.filter((b) => (!only || only.includes(b.id)) && b.narration.trim().length > 0 && !done.has(b.id) && (force || !withTracks.has(b.id)));
  if (!blocks.length) {
    await ctx.log("Todos os atos já têm locução (use Regravar para refazer).");
    return { totalMs: 0, fallbackCount: 0, skipped: true };
  }
  const dir = await projectDir(projectId, "voice");
  let totalMs = 0;
  let fallbackCount = 0;
  let primaryDownUntil = 0; // após falha da principal, evita tentar de novo por alguns minutos (mantém o job fluindo)

  for (let i = 0; i < blocks.length; i++) {
    if (await ctx.isCancelled()) return { cancelled: true };
    const b = blocks[i];
    await ctx.progress({ percent: (i / blocks.length) * 95, message: `Ato ${b.act}: sintetizando com ${chain[0].provider}` });

    // Modo padrão (rápido): uma chamada por ato; pausas viram reticências + quebra de linha, que o TTS respeita.
    // VOICE_SPLIT_PAUSES=1: divide nas pausas e insere silêncio exato (mais lento: uma chamada por trecho).
    const segments: { text: string; silenceAfterMs: number }[] = [];
    if (process.env.VOICE_SPLIT_PAUSES === "1") {
      const parts = b.narration.split(/(\[[^\]]*\])/).filter((p) => p.trim());
      for (const p of parts) {
        if (/^\[/.test(p)) {
          const ms = pauseMs(p) || 1000;
          if (segments.length) segments[segments.length - 1].silenceAfterMs += ms;
        } else {
          segments.push({ text: p.replace(/\s+/g, " ").trim(), silenceAfterMs: 0 });
        }
      }
    } else {
      const text = b.narration.replace(/\[[^\]]*\]/g, "…\n").replace(/[ \t]+/g, " ").trim();
      if (text) segments.push({ text, silenceAfterMs: 0 });
    }
    if (!segments.length) continue;

    let used: { provider: string; voiceId: string } | null = null;
    let provider: VoiceProvider | null = null;
    let files: { file: string; silenceAfterMs: number }[] = [];
    let lastErr: unknown;
    let units = 0;
    let cost = 0;
    for (let c = 0; c < chain.length && !used; c++) {
      if (c === 0 && primaryDownUntil > Date.now()) {
        await ctx.log(`Ato ${b.act}: principal ${chain[0].provider} em pausa após falha; usando reserva`);
        continue;
      }
      try {
        provider = getVoiceProvider(chain[c].provider);
        files = [];
        for (let s = 0; s < segments.length; s++) {
          const seg = segments[s];
          const out = path.join(dir, `tmp-a${String(b.act).padStart(2, "0")}-${s}.wav`);
          const r = await provider.synthesize({ text: seg.text, voiceId: chain[c].voiceId, style: profile.style || undefined, rate: profile.rate, language: profile.language }, out);
          units += r.units;
          cost += r.costUsd;
          files.push({ file: r.file, silenceAfterMs: seg.silenceAfterMs });
        }
        used = chain[c];
        if (c > 0) {
          fallbackCount++;
          await ctx.log(`Ato ${b.act}: provedor principal falhou (${String(lastErr).split("\n")[0]}); usando reserva ${used.provider}/${used.voiceId}`);
        }
      } catch (err) {
        lastErr = err;
        if (c === 0) primaryDownUntil = Date.now() + Number(process.env.VOICE_PRIMARY_COOLDOWN_MS ?? 8 * 60_000);
        await ctx.log(`Ato ${b.act}: ${chain[c].provider} falhou — ${String(err).split("\n")[0].slice(0, 160)}`);
      }
    }
    if (!used || !provider) throw new Error(`Ato ${b.act}: nenhum provedor de voz conseguiu sintetizar. Último erro: ${String(lastErr).slice(0, 200)}`);

    const finalFile = path.join(dir, `a${String(b.act).padStart(2, "0")}.wav`);
    const rawFile = path.join(dir, `tmp-a${String(b.act).padStart(2, "0")}-raw.wav`);
    await concatWithSilences(files, rawFile, { normalize: true });
    // Apara silêncios longos do TTS (pausas viram ~0.9s; o resto fica natural)
    const trim = await trimLongSilences(rawFile, finalFile, { maxSilenceMs: Number(process.env.VOICE_MAX_SILENCE_MS ?? 1200), keepMs: Number(process.env.VOICE_KEEP_SILENCE_MS ?? 900) });
    if (trim.count) await ctx.log(`Ato ${b.act}: ${trim.count} silêncio(s) longo(s) aparado(s), -${(trim.removedMs / 1000).toFixed(1)}s`);
    const { probeDurationMs } = await import("@vincere-studio/providers");
    const durationMs = await probeDurationMs(finalFile);
    totalMs += durationMs;
    await prisma.voiceTrack.deleteMany({ where: { scriptBlockId: b.id } });
    await prisma.voiceTrack.create({
      data: { scriptBlockId: b.id, provider: used.provider, voiceId: used.voiceId, filePath: relPath(finalFile), durationMs, fallbackUsed: used !== chain[0], params: JSON.stringify({ style: profile.style, rate: profile.rate, units, costUsd: cost }) },
    });
    await prisma.usage.create({ data: { projectId, provider: used.provider, unit: "AUDIO_SECONDS", quantity: durationMs / 1000, costUsd: cost, billable: ehCobravel(used.provider) } });
    await prisma.project.update({ where: { id: projectId }, data: { costUsd: { increment: cost } } });
    await ctx.log(`Ato ${b.act}: ${(durationMs / 1000).toFixed(1)}s · ${used.provider} ${used.voiceId}${used !== chain[0] ? " (reserva)" : ""}`);
    // Marca o bloco como concluído no payload: se o worker reiniciar, o job retoma de onde parou.
    done.add(b.id);
    await prisma.job.update({ where: { id: ctx.job.id }, data: { payload: JSON.stringify({ ...ctx.payload, doneBlockIds: [...done] }) } }).catch(() => {});
  }

  // Limpa temporários
  const { readdir, rm } = await import("node:fs/promises");
  for (const f of await readdir(dir)) if (f.startsWith("tmp-")) await rm(path.join(dir, f)).catch(() => {});

  await ctx.log(`Locução total: ${(totalMs / 1000 / 60).toFixed(1)} min${fallbackCount ? ` · ${fallbackCount} ato(s) com voz de reserva` : ""}`);
  return { totalMs, fallbackCount };
}
