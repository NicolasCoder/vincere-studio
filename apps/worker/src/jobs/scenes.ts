import path from "node:path";
import { readdir, rename, stat, writeFile } from "node:fs/promises";
import { prisma } from "@docupulse/db";
import { FORMATS, SCENES_PROMPT_VERSION, ScenesResponseSchema, composeImagePrompt, getVisualStyle, parseSceneFileStem, sceneFileStem, scenesPrompt, type VideoFormat } from "@docupulse/core";
import { downloadTo, getStockProviders, getTextProvider, probeDurationMs, probeMediaInfo, projectDir, recordUsage, relPath } from "@docupulse/providers";
import type { JobContext } from "../queue";

/**
 * GENERATE_SCENE_PROMPTS: divide cada ato em cenas com descrição, keywords e prompt de imagem
 * no estilo visual do projeto; grava Scene e exporta o pacote de prompts (Modo Flow).
 * payload: { projectId }
 */
export async function generateScenePrompts(ctx: JobContext) {
  const projectId = String(ctx.payload.projectId ?? ctx.job.projectId ?? "");
  const density = (ctx.payload.density as "dense" | "sparse") ?? "dense";
  const project = await prisma.project.findUnique({ where: { id: projectId }, include: { scripts: { orderBy: { version: "desc" }, take: 1, include: { blocks: { orderBy: { order: "asc" }, include: { voiceTracks: true } } } } } });
  if (!project) throw new Error("Projeto não encontrado");
  const script = project.scripts[0];
  if (!script) throw new Error("Gere o roteiro antes.");
  const style = getVisualStyle(project.visualStyle);
  const format = FORMATS[project.format as VideoFormat];
  const provider = getTextProvider();
  const pack: string[] = [`# Pacote de prompts — ${project.title}`, ``, `Estilo: ${style.label}. Proporção: ${format.ratio}.`, `Gere cada imagem e salve na pasta inbox do projeto com o nome indicado (ex.: a01-s03.png). O app casa os arquivos com as cenas automaticamente.`, ``];
  let total = 0;

  for (let i = 0; i < script.blocks.length; i++) {
    const b = script.blocks[i];
    if (await ctx.isCancelled()) return { cancelled: true };
    await ctx.progress({ percent: (i / script.blocks.length) * 90, message: `Ato ${b.act}: planejando cenas` });
    const durationSec = Math.round((b.voiceTracks[0]?.durationMs ?? ((b.endMs ?? 0) - (b.startMs ?? 0))) / 1000) || 30;
    const res = await provider.generateJson(scenesPrompt({ format: project.format as VideoFormat, style, title: project.title, act: b.act, actTitle: b.title, narration: b.narration, brollCue: b.brollCue, durationSec, density }), ScenesResponseSchema, { temperature: 0.7 });
    await recordUsage(projectId, res.usage);

    // Normaliza durações para somarem o ato e distribui tempos
    const scenes = res.data.scenes.sort((a, c) => a.order - c.order);
    const sum = scenes.reduce((s, x) => s + Math.max(1, x.durationSec), 0) || 1;
    let cursor = 0;
    await prisma.scene.deleteMany({ where: { scriptBlockId: b.id, status: "PENDING", filePath: null } });
    const existing = await prisma.scene.findMany({ where: { scriptBlockId: b.id } });
    pack.push(`## Ato ${b.act} — ${b.title}`, ``);
    for (let k = 0; k < scenes.length; k++) {
      const sc = scenes[k];
      const ms = Math.round((Math.max(1, sc.durationSec) / sum) * durationSec * 1000);
      const order = k + 1;
      const prompt = composeImagePrompt(style, sc.description, format.ratio);
      const keep = existing.find((e) => e.order === order && e.filePath);
      if (!keep) {
        await prisma.scene.create({ data: { scriptBlockId: b.id, order, source: "GENERATED", provider: "FLOW_MANUAL", prompt, description: sc.description, keywords: sc.keywords, preferVideo: sc.preferVideo, startMs: cursor, endMs: cursor + ms, motion: JSON.stringify({ kind: style.motion }), status: "PENDING" } });
      } else {
        await prisma.scene.update({ where: { id: keep.id }, data: { startMs: cursor, endMs: cursor + ms, prompt, description: sc.description, keywords: sc.keywords } });
      }
      pack.push(`### ${sceneFileStem(b.act, order)}  (${(ms / 1000).toFixed(1)}s${sc.preferVideo ? " · prefere vídeo de acervo" : ""})`, ``, prompt, ``);
      cursor += ms;
      total++;
    }
  }
  const dir = await projectDir(projectId, "prompts");
  const file = path.join(dir, "flow-pack.md");
  await writeFile(file, pack.join("\n"), "utf8");
  await projectDir(projectId, "inbox");
  const refDir = await projectDir(projectId, "referencias");
  await ctx.log(`${total} cenas planejadas (${density === "sparse" ? "esparso · Modo Flow" : "denso · acervo/API"}) · pacote em ${relPath(file)} · versão ${SCENES_PROMPT_VERSION}`);
  await ctx.log(`Pasta de referências de estilo disponível em ${relPath(refDir)} (opcional — coloque imagens de referência visual do canal ali)`);
  return { scenes: total, pack: relPath(file) };
}

/**
 * IMPORT_INBOX: casa arquivos em storage/projects/<id>/inbox com as cenas (a01-s03.*)
 * ou, se os nomes não seguirem o padrão, por ordem alfabética nas cenas pendentes.
 */
export async function importInbox(ctx: JobContext) {
  const projectId = String(ctx.payload.projectId ?? ctx.job.projectId ?? "");
  const inbox = await projectDir(projectId, "inbox");
  const scenesDir = await projectDir(projectId, "scenes");
  const files = (await readdir(inbox)).filter((f) => /\.(png|jpe?g|webp|mp4|mov|webm)$/i.test(f)).sort();
  if (!files.length) {
    await ctx.log("Inbox vazia");
    return { imported: 0 };
  }
  const script = await prisma.script.findFirst({ where: { projectId }, orderBy: { version: "desc" }, include: { blocks: { orderBy: { order: "asc" }, include: { scenes: { orderBy: { order: "asc" } } } } } });
  if (!script) throw new Error("Sem roteiro");
  const all = script.blocks.flatMap((b) => b.scenes.map((s) => ({ s, act: b.act })));
  const pending = all.filter((x) => !x.s.filePath);
  let imported = 0;
  for (const f of files) {
    const stem = parseSceneFileStem(f);
    const target = stem ? all.find((x) => x.act === stem.act && x.s.order === stem.order) : pending.shift();
    if (!target) continue;
    const ext = path.extname(f).toLowerCase();
    const dest = path.join(scenesDir, `${sceneFileStem(target.act, target.s.order)}${ext}`);
    await rename(path.join(inbox, f), dest);
    const isVideo = /\.(mp4|mov|webm)$/i.test(ext);
    const info = await probeMediaInfo(dest).catch(() => ({ durationMs: null, width: null, height: null }));
    const durationMs = isVideo ? info.durationMs : null;
    const size = (await stat(dest)).size;
    await prisma.scene.update({ where: { id: target.s.id }, data: { filePath: relPath(dest), mediaType: isVideo ? "video" : "image", source: "IMPORTED", provider: "FLOW_MANUAL", status: "READY", durationMs, width: info.width, height: info.height, license: "Gerado pelo usuário (GPT/Flow/Gemini)" } });
    imported++;
    await ctx.log(`${f} → ${sceneFileStem(target.act, target.s.order)}${ext} (${Math.round(size / 1024)} KB)`);
  }
  return { imported };
}

const STOPWORDS = new Set(["the", "a", "an", "of", "in", "on", "at", "to", "for", "and", "or", "with", "from", "by", "is", "are", "this", "that", "scene", "shot", "footage", "video", "image", "close", "up", "wide", "view"]);

/** Extrai termos relevantes de keywords + descrição para pontuar candidatos do acervo. */
function relevanceTerms(keywords: string | null, description: string | null): string[] {
  const raw = `${keywords ?? ""} ${description ?? ""}`.toLowerCase();
  const words = raw.split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOPWORDS.has(w));
  return Array.from(new Set(words));
}

/**
 * Pontua um candidato pela sobreposição com os termos da cena e com os termos-âncora do projeto
 * inteiro. Âncora vale o dobro: uma keyword isolada e literal de uma cena (ex.: "disco girando"
 * numa frase que só usava "girar" como figura de linguagem) não pode validar a si mesma — o
 * candidato também precisa bater com o tema geral do vídeo pra não sair do assunto.
 */
function scoreAsset(asset: { tags?: string; pageUrl?: string }, terms: string[], anchorTerms: string[]): { score: number; anchorHits: number; sceneHits: number } {
  const haystack = `${asset.tags ?? ""} ${asset.pageUrl ?? ""}`.toLowerCase();
  if (!haystack.trim()) return { score: 0, anchorHits: 0, sceneHits: 0 };
  const anchorHits = anchorTerms.reduce((s, t) => (haystack.includes(t) ? s + 1 : s), 0);
  const sceneHits = terms.reduce((s, t) => (haystack.includes(t) ? s + 1 : s), 0);
  return { score: anchorHits * 2 + sceneHits, anchorHits, sceneHits };
}

/**
 * Termos-âncora do tema do projeto: os termos mais recorrentes entre as keywords de TODAS as cenas
 * do roteiro (não só as pendentes). Somados à busca de cada cena, evitam que uma keyword fraca ou
 * abstrata de um trecho específico deriva para um resultado bonito mas fora do assunto do documentário.
 */
function themeAnchor(allKeywords: (string | null)[], minCount = 2, take = 3): string[] {
  const counts = new Map<string, number>();
  for (const kw of allKeywords) {
    for (const t of relevanceTerms(kw, null)) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, c]) => c >= minCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, take)
    .map(([t]) => t);
}

/**
 * HUNT_BROLL: para cenas sem mídia, busca no Pexels/Pixabay pelas keywords e baixa o resultado mais relevante
 * (pontuado por sobreposição de palavras-chave/descrição com as tags do candidato, quando disponíveis).
 * payload: { projectId, onlyPreferVideo?: boolean }
 */
export async function huntBroll(ctx: JobContext) {
  const projectId = String(ctx.payload.projectId ?? ctx.job.projectId ?? "");
  const onlyPreferVideo = Boolean(ctx.payload.onlyPreferVideo ?? false);
  const limit = Number(ctx.payload.limit ?? 0) || Infinity;
  const providers = getStockProviders();
  if (!providers.length) throw new Error("Nenhuma chave de acervo: configure PEXELS_API_KEY e/ou PIXABAY_API_KEY no .env");
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const format = FORMATS[project.format as VideoFormat];
  const script = await prisma.script.findFirst({ where: { projectId }, orderBy: { version: "desc" }, include: { blocks: { orderBy: { order: "asc" }, include: { scenes: { orderBy: { order: "asc" } }, voiceTracks: { take: 1, include: { captions: { take: 1, select: { words: true } } } } } } } });
  if (!script) throw new Error("Sem roteiro");
  const targets = script.blocks.flatMap((b) => b.scenes.filter((s) => !s.filePath && (!onlyPreferVideo || s.preferVideo)).map((s) => ({ s, act: b.act }))).slice(0, limit === Infinity ? undefined : limit);
  if (!targets.length) {
    await ctx.log("Nenhuma cena pendente");
    return { found: 0 };
  }
  const anchor = themeAnchor(script.blocks.flatMap((b) => b.scenes.map((s) => s.keywords)));
  if (anchor.length) await ctx.log(`Âncora de tema do projeto: ${anchor.join(", ")}`);
  const dir = await projectDir(projectId, "scenes");
  const used = new Set<string>();
  let found = 0;
  let done = 0;
  let cancelled = false;

  // Buscar e baixar acervo é quase todo espera de rede, não CPU — então roda em paralelo mesmo em
  // máquina de poucos núcleos. O render de clipes, esse sim é CPU puro, e continua em série.
  const concurrency = Math.max(1, Math.min(8, Number(process.env.BROLL_CONCURRENCY ?? 4)));
  await ctx.log(`Buscando acervo para ${targets.length} cena(s) com ${concurrency} downloads simultâneos`);

  const hunt = async (target: (typeof targets)[number]) => {
    const { s, act } = target;
    if (cancelled) return;
    if (await ctx.isCancelled()) {
      cancelled = true;
      return;
    }
    await ctx.progress({ percent: (done / targets.length) * 95, message: `Cena ${sceneFileStem(act, s.order)}: buscando "${s.keywords}"` });
    const minDur = Math.ceil((s.endMs - s.startMs) / 1000);
    const terms = relevanceTerms(s.keywords, s.description);
    const baseKeywords = s.keywords ?? s.description ?? "";
    const query = anchor.length ? `${baseKeywords}, ${anchor.join(", ")}` : baseKeywords;
    type Asset = Awaited<ReturnType<(typeof providers)[number]["search"]>>[number];
    let hit: Asset | null = null;
    for (const type of s.preferVideo ? (["video", "image"] as const) : (["image", "video"] as const)) {
      const pool: Asset[] = [];
      for (const p of providers) {
        try {
          const results = await p.search({ keywords: query, orientation: format.broll.imageOrientation, type, minDurationSec: type === "video" ? minDur : undefined }, 10);
          pool.push(...results.filter((r) => !used.has(`${r.provider}:${r.id}`)));
        } catch (err) {
          await ctx.log(`${p.name}: ${String(err).slice(0, 100)}`);
        }
      }
      if (!pool.length) continue;
      // Pixabay traz tags mais ricas que o Pexels (que não retorna tags pra vídeo); em caso de empate
      // na pontuação de relevância para vídeo, prefere o candidato do Pixabay.
      const scored = pool.map((r, i) => {
        const { score, anchorHits, sceneHits } = scoreAsset(r, terms, anchor);
        return { r, score: score + (type === "video" && r.provider === "PIXABAY" ? 0.25 : 0), anchorHits, sceneHits, i };
      });
      scored.sort((a, b) => b.score - a.score || a.i - b.i);
      // Com âncora de tema definida, exige bater com o tema do vídeo inteiro OU com pelo menos 2
      // termos próprios da cena — uma cena de paisagem genérica e legítima ("terreno ártico
      // rochoso") não precisa também mencionar "dark/vintage/ocean" pra ser válida; só a palavra
      // isolada e literal (ex.: "spinning" sozinho) que não pode validar a si mesma.
      const offTheme = (c: (typeof scored)[number]) => (anchor.length > 0 ? c.anchorHits === 0 && c.sceneHits < 2 : terms.length > 0 && c.score === 0);
      if (offTheme(scored[0])) continue;
      // Em paralelo, duas cenas podem ter passado pelo mesmo candidato antes de qualquer uma marcar
      // como usado. A reserva acontece aqui, sem await no meio, então é atômica entre as tarefas.
      const pick = scored.find((c) => !used.has(`${c.r.provider}:${c.r.id}`) && !offTheme(c));
      if (!pick) continue;
      used.add(`${pick.r.provider}:${pick.r.id}`);
      hit = pick.r;
      break;
    }
    if (!hit) {
      await ctx.log(`Cena ${sceneFileStem(act, s.order)}: nenhuma opção relevante para "${s.keywords}" — cena fica pendente (herda mídia da vizinha no render)`);
      return;
    }
    const ext = hit.type === "video" ? ".mp4" : ".jpg";
    const dest = path.join(dir, `${sceneFileStem(act, s.order)}${ext}`);
    try {
      await downloadTo(hit.url, dest);
      const durationMs = hit.type === "video" ? await probeDurationMs(dest).catch(() => null) : null;
      await prisma.scene.update({ where: { id: s.id }, data: { filePath: relPath(dest), mediaType: hit.type, source: "STOCK", provider: hit.provider, providerRef: hit.id, sourceUrl: hit.pageUrl, width: hit.width, height: hit.height, durationMs, status: "READY", license: `${hit.license}${hit.author ? ` · ${hit.author}` : ""}` } });
      await prisma.usage.create({ data: { projectId, provider: hit.provider, unit: "REQUESTS", quantity: 1, costUsd: 0, billable: false } });
      found++;
    } catch (err) {
      await ctx.log(`Cena ${sceneFileStem(act, s.order)}: download falhou (${String(err).slice(0, 100)})`);
    }
  };

  // Pool de tarefas: `concurrency` consumidores puxando da mesma fila até esvaziar.
  const queue = [...targets];
  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      for (;;) {
        const next = queue.shift();
        if (!next || cancelled) return;
        await hunt(next);
        done++;
      }
    }),
  );
  if (cancelled) return { cancelled: true };

  await ctx.log(`${found}/${targets.length} cenas preenchidas com acervo`);
  return { found, total: targets.length };
}
