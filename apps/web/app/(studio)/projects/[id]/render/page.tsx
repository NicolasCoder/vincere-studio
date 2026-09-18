import Link from "next/link";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { prisma } from "@docupulse/db";
import { FORMATS, type VideoFormat } from "@docupulse/core";
import { absPath } from "@docupulse/providers";
import { MOTION_PRESETS, normalizeMotion, profileFor } from "@docupulse/render";
import { Badge, Button, Card, Chip, Icon } from "@docupulse/ui";
import { loadProjectShell } from "@/components/ProjectShell";
import { JobWatcher } from "@/components/JobWatcher";
import { fmtDuration } from "@/lib/data";
import { advanceStage } from "../../actions";
import { renderVideo, generateThumbnail, reviewRender, updateSceneReview } from "./actions";
import { CaptionStyleEditor } from "./CaptionStyleEditor";
import { RenderProgressOverlay } from "./RenderProgress";
import { RenderStagesLive } from "./RenderStagesLive";
import { RENDER_STAGES } from "./stages";

const REVIEW_META: Record<string, { label: string; tone: "neutral" | "success" | "warning" | "error"; icon: string }> = {
  PENDING: { label: "Aguardando revisão", tone: "neutral", icon: "rate_review" },
  APPROVED: { label: "Aprovado", tone: "success", icon: "verified" },
  CHANGES_REQUESTED: { label: "Alterações solicitadas", tone: "warning", icon: "edit_note" },
  REJECTED: { label: "Rejeitado", tone: "error", icon: "cancel" },
};

export default async function RenderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ blocked?: string; job?: string; saved?: string }> }) {
  const { id } = await params;
  const { blocked, job, saved } = await searchParams;
  const { project, header, busy } = await loadProjectShell(id, "RENDER", blocked, job);
  const format = FORMATS[project.format as VideoFormat];
  const renders = await prisma.renderJob.findMany({ where: { projectId: id }, orderBy: { startedAt: "desc" }, take: 5 });
  const current = renders[0];
  const progress = current?.progress ?? 0;
  const defaultProfile = profileFor(project.format);
  const script = await prisma.script.findFirst({ where: { projectId: id }, orderBy: { version: "desc" }, include: { blocks: { orderBy: [{ act: "asc" }, { order: "asc" }], include: { voiceTracks: { select: { durationMs: true, provider: true, voiceId: true, fallbackUsed: true, captions: { select: { id: true, words: true } } } }, scenes: { orderBy: { order: "asc" }, select: { id: true, order: true, filePath: true, thumbPath: true, width: true, height: true, mediaType: true, motion: true, reviewStatus: true, reviewNote: true, description: true } } } } } });
  const blocks = script?.blocks ?? [];
  const voiced = blocks.filter((b) => b.voiceTracks.length).length;
  const totalMs = blocks.reduce((s, b) => s + (b.voiceTracks[0]?.durationMs ?? 0), 0);
  const scenes = blocks.flatMap((b) => b.scenes);
  const ready = scenes.filter((s) => s.filePath).length;
  const captioned = blocks.filter((b) => {
    try {
      const words = JSON.parse(b.voiceTracks[0]?.captions[0]?.words ?? "[]");
      return Array.isArray(words) && words.length > 0;
    } catch {
      return false;
    }
  }).length;
  const mediaCounts = new Map<string, number>();
  for (const scene of scenes) if (scene.filePath) mediaCounts.set(scene.filePath, (mediaCounts.get(scene.filePath) ?? 0) + 1);
  const repeatedMedia = [...mediaCounts.values()].reduce((sum, count) => sum + Math.max(0, count - 1), 0);
  // Amostra só os primeiros 2MB (+ tamanho no hash) em vez do arquivo inteiro — com vídeos de
  // acervo de dezenas de MB cada, ler tudo em toda carga da página deixava o Passo 4 lentíssimo.
  const HASH_SAMPLE_BYTES = 2 * 1024 * 1024;
  const contentHashes = await Promise.all([...mediaCounts.keys()].map(async (filePath) => {
    try {
      const file = absPath(filePath);
      const { size } = await stat(file);
      const hash = createHash("sha256").update(String(size));
      await new Promise<void>((resolve, reject) => {
        const stream = createReadStream(file, { end: Math.max(0, Math.min(size, HASH_SAMPLE_BYTES) - 1) });
        stream.on("data", (chunk) => hash.update(chunk));
        stream.on("end", resolve);
        stream.on("error", reject);
      });
      return hash.digest("hex");
    } catch {
      return null;
    }
  }));
  const hashCounts = new Map<string, number>();
  for (const hash of contentHashes) if (hash) hashCounts.set(hash, (hashCounts.get(hash) ?? 0) + 1);
  const duplicateContent = [...hashCounts.values()].reduce((sum, count) => sum + Math.max(0, count - 1), 0);
  let predictedRetention: number | null = null;
  try {
    const metrics = JSON.parse(script?.metrics ?? "{}") as { predicted?: number };
    if (Number.isFinite(metrics.predicted)) predictedRetention = Number(metrics.predicted);
  } catch {}
  const lowResolution = scenes.filter((scene) => {
    if (!scene.filePath || !scene.width || !scene.height) return false;
    const requiredScale = Math.max(defaultProfile.width / scene.width, defaultProfile.height / scene.height);
    return requiredScale > 1.35;
  }).length;
  const unknownResolution = scenes.filter((scene) => scene.filePath && (!scene.width || !scene.height)).length;
  const canRender = voiced === blocks.length && blocks.length > 0;
  // A prova não vira RenderJob (senão viraria o master do projeto), então vem do resultado do job.
  const provaJob = await prisma.job.findFirst({
    where: { projectId: id, type: "RENDER_VIDEO", status: "DONE", result: { contains: '"preview":true' } },
    orderBy: { finishedAt: "desc" },
    select: { result: true, finishedAt: true },
  });
  const prova = provaJob?.result ? (JSON.parse(provaJob.result) as { outputPath?: string; durationMs?: number }) : null;

  const voiceSet = new Set(blocks.filter((b) => b.voiceTracks[0]).map((b) => `${b.voiceTracks[0].provider}/${b.voiceTracks[0].voiceId}`));
  const mixedVoices = voiceSet.size > 1;
  const review = current ? (REVIEW_META[current.reviewStatus] ?? REVIEW_META.PENDING) : REVIEW_META.PENDING;
  const approved = current?.reviewStatus === "APPROVED";

  return (
    <>
      {header}
      <main className="p-6">
        <div className="flex flex-col items-start justify-between gap-6 xl:flex-row">
          <div>
            <Badge tone="violet">Projeto #{project.id.slice(-6).toUpperCase()}</Badge>
            <h1 className="mt-2 max-w-3xl font-display text-3xl font-semibold leading-tight">{project.title}</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              <Chip icon="timer">{totalMs ? fmtDuration(Math.round(totalMs / 1000)) : "—"} de locução</Chip>
              <Chip icon="hd">{defaultProfile.width}×{defaultProfile.height} {defaultProfile.fps}fps · H.264</Chip>
              <Chip icon="movie" active={ready > 0}>{ready}/{scenes.length} cenas com mídia</Chip>
              <Chip icon="subtitles" active={captioned > 0}>{captioned}/{blocks.length} com legendas</Chip>
            </div>
          </div>
          <form action={renderVideo.bind(null, project.id)} className="flex w-full flex-col gap-2 xl:w-96">
            <label className="flex items-center gap-2 text-xs text-fg-secondary"><input type="checkbox" name="music" defaultChecked className="accent-primary" /> Trilha ambiente (sua em storage/music ou gerada pelo app)</label>
            {/* Longo não queima legenda: os canais de referência não queimam, e o rodapé livre é
                onde a camada visual DVP posiciona os lower thirds. O CC do YouTube cobre acessibilidade.
                Short queima, porque é assistido sem som. */}
            <label className="flex items-center gap-2 text-xs text-fg-secondary"><input type="checkbox" name="captions" defaultChecked={format.captions.required} className="accent-primary" /> Queimar legendas ({format.captions.style === "bold-center-animated" ? "karaokê central" : "rodapé discreto"}){!format.captions.required && <span className="text-muted"> — desligado no longo</span>}</label>
            <CaptionStyleEditor format={project.format as VideoFormat} savedPreset={project.captionPreset} savedStyleJson={project.captionStyle} />
            {/* Dois botões em vez de um seletor de perfil: 720p tem 44% dos pixels de 1080p, então o
                render de revisão sai em ~metade do tempo. Para decidir se a qualidade serve, a
                resolução é irrelevante — só o corte aprovado precisa ir em 1080p. */}
            {/* Prova antes de qualquer render longo: janelas curtas de atos diferentes, pelo mesmo
                caminho do render final. Fica em primeiro porque é o que deveria ser clicado primeiro. */}
            <Button type="submit" name="preview" value="1" variant="primary" icon="science" disabled={busy || !canRender} title={canRender ? "" : "Sintetize a locução de todos os atos no Passo 3"}>
              Render de prova · ~20s
            </Button>
            <span className="text-[10px] text-muted">Três janelas de 7s, do começo, meio e fim. Mostra legenda, enquadramento e trilha em menos de um minuto.</span>
            {format.ratio === "16:9" ? (
              <>
                <Button type="submit" name="profile" value="WEB_720" icon="bolt" disabled={busy || !canRender} title={canRender ? "" : "Sintetize a locução de todos os atos no Passo 3"}>
                  Render de revisão · 720p
                </Button>
                <Button type="submit" name="profile" value={defaultProfile.id} variant="ghost" icon="movie" disabled={busy || !canRender} title={canRender ? "" : "Sintetize a locução de todos os atos no Passo 3"}>
                  Render final · {defaultProfile.height}p
                </Button>
                <span className="text-[10px] text-muted">A revisão sai em cerca da metade do tempo. Use o final só depois de aprovar.</span>
              </>
            ) : (
              <Button type="submit" name="profile" value={defaultProfile.id} variant="primary" icon="movie" disabled={busy || !canRender} title={canRender ? "" : "Sintetize a locução de todos os atos no Passo 3"}>
                Iniciar Render (FFmpeg)
              </Button>
            )}
            {!canRender && <span className="font-mono text-[10px] text-warning">{voiced}/{blocks.length} atos com locução — complete o Passo 3</span>}
          </form>
        </div>

        {job && <div className="mt-4"><JobWatcher jobId={job} label="Renderizando com FFmpeg" /></div>}
        {saved === "caption" && (
          <Card className="mt-4 flex flex-wrap items-center gap-3 p-3 text-sm text-success">
            <Icon name="check_circle" className="align-middle" />
            <span className="flex-1">
              Modelo de legenda salvo. A legenda é gravada no vídeo durante o render — este ajuste só aparece a partir da
              {current?.outputPath ? " próxima versão renderizada." : " primeira renderização."}
            </span>
            {current?.outputPath && (
              <form action={renderVideo.bind(null, project.id)}>
                <input type="hidden" name="profile" value={current.profile} />
                <input type="hidden" name="music" value="1" />
                {format.captions.required && <input type="hidden" name="captions" value="1" />}
                <Button type="submit" size="sm" variant="primary" icon="refresh" disabled={busy}>Gerar nova versão agora</Button>
              </form>
            )}
          </Card>
        )}

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-4">
            {prova?.outputPath && (
              <Card className="p-4" accent="violet">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-display font-semibold">
                    <Icon name="science" className="mr-1 align-middle text-primary-bright" />
                    Render de prova
                  </h3>
                  <span className="font-mono text-[11px] text-muted">
                    {prova.durationMs ? `${Math.round(prova.durationMs / 1000)}s` : ""}
                    {provaJob?.finishedAt ? ` · ${new Date(provaJob.finishedAt).toLocaleString("pt-BR")}` : ""}
                  </span>
                </div>
                <p className="mt-1 text-xs text-fg-secondary">
                  Janelas curtas de atos diferentes, pelo mesmo caminho do render final. Se a legenda, o enquadramento ou a
                  trilha estiverem errados aqui, estarão errados no vídeo inteiro.
                </p>
                <video
                  controls
                  preload="metadata"
                  src={`/api/media/${prova.outputPath}`}
                  className={`mt-3 max-h-[420px] bg-black ${format.ratio === "9:16" ? "h-[420px]" : "w-full"}`}
                />
              </Card>
            )}
            <Card className="overflow-hidden" accent="dual">
              <div className={`relative grid place-items-center bg-gradient-to-br from-void via-surface-low to-secondary/20 ${format.ratio === "9:16" ? "aspect-[9/16] h-[520px] mx-auto" : "aspect-video"}`}>
                {current?.outputPath ? (
                  <video controls preload="metadata" src={`/api/media/${current.outputPath}`} className={`${format.ratio === "9:16" ? "h-full" : "w-full"} max-h-[520px] bg-black`} />
                ) : (
                  <div className="text-center"><Icon name="movie" className="text-[48px] text-muted" /><div className="mt-2 font-mono text-xs text-muted">{busy ? "Renderizando… o preview aparece ao terminar" : "O preview do render aparece aqui"}</div></div>
                )}
                {!current?.outputPath && current && (
                  <RenderProgressOverlay renderJobId={current.id} initialProgress={progress} initialProfile={current.profile} />
                )}
              </div>
              {current?.outputPath && (
                <div className="flex items-center gap-3 border-t border-line p-3 text-xs">
                  <Badge tone="success">Pronto</Badge>
                  <span className="font-mono text-muted">{current.profile} · {current.finishedAt ? new Date(current.finishedAt).toLocaleString("pt-BR") : ""}</span>
                  <a className="ml-auto" href={`/api/media/${current.outputPath}?download=1`}><Button size="sm" icon="download">Baixar MP4</Button></a>
                </div>
              )}
            </Card>

            {current?.outputPath && (
              <Card className="p-5" accent={approved ? "dual" : "violet"}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-lg font-semibold">
                      <Icon name="fact_check" className="mr-1 align-middle text-primary-bright" />
                      Revisão da versão {current.revision}
                    </h3>
                    <p className="mt-1 text-xs text-fg-secondary">A decisão fica vinculada a este MP4. Rejeitar não apaga o arquivo e uma nova renderização cria outra versão.</p>
                  </div>
                  <Badge tone={review.tone}><Icon name={review.icon} className="mr-1 align-middle text-[14px]" />{review.label}</Badge>
                </div>
                <form action={reviewRender.bind(null, project.id, current.id)} className="mt-4 space-y-3">
                  <textarea name="reviewNote" defaultValue={current.reviewNote ?? ""} rows={3} placeholder="Observações gerais: trecho, timecode e alteração desejada…" className="field w-full px-3 py-2 text-sm" />
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" name="status" value="APPROVED" variant="primary" icon="verified">Aprovar versão</Button>
                    <Button type="submit" name="status" value="CHANGES_REQUESTED" icon="edit_note">Solicitar alterações</Button>
                    <Button type="submit" name="status" value="REJECTED" variant="ghost" icon="cancel">Rejeitar</Button>
                  </div>
                </form>
                {current.reviewedAt && <div className="mt-2 font-mono text-[10px] text-muted">Revisado em {new Date(current.reviewedAt).toLocaleString("pt-BR")}</div>}
              </Card>
            )}

            <Card className="p-5">
              <div className="flex items-center justify-between"><h3 className="font-display text-lg font-semibold"><Icon name="memory" className="mr-1 align-middle text-primary-bright" />Etapas do Render</h3><span className="font-mono text-xs text-fg-secondary">Local · FFmpeg · {current?.finishedAt ? "Concluído" : busy ? "Em execução" : "Aguardando"}</span></div>
              {current && !current.outputPath ? (
                <RenderStagesLive renderJobId={current.id} initialProgress={progress} initialProfile={current.profile} />
              ) : (
                <>
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {RENDER_STAGES.map(([n, d, at]) => (
                      <div key={n} className="rounded border border-line bg-void/40 p-3">
                        <div className="flex items-center justify-between"><span className="flex items-center gap-2 font-mono text-xs"><Icon name={current?.outputPath ? "check_circle" : "radio_button_unchecked"} className={`text-[16px] ${current?.outputPath ? "text-success" : "text-muted"}`} />{n}</span><Badge tone={current?.outputPath ? "success" : "neutral"}>{current?.outputPath ? "OK" : "pendente"}</Badge></div>
                        <p className="mt-2 text-xs text-fg-secondary">{d}</p>
                      </div>
                    ))}
                  </div>
                  {current?.log && <pre className="mt-4 max-h-40 overflow-auto whitespace-pre-wrap rounded border border-line bg-void/70 p-3 font-mono text-[10px] leading-relaxed text-fg-secondary">{current.log}</pre>}
                </>
              )}
            </Card>

            {current?.outputPath && scenes.length > 0 && (
              <Card className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-lg font-semibold"><Icon name="movie_edit" className="mr-1 align-middle text-primary-bright" />Editor e revisão por cena</h3>
                    <p className="mt-1 text-xs text-fg-secondary">Ajuste o movimento e registre a decisão de cada trecho. As mudanças entram na próxima versão; cenas e atos sem alteração são reaproveitados pelo cache incremental.</p>
                  </div>
                  <form action={renderVideo.bind(null, project.id)}>
                    <input type="hidden" name="profile" value={current.profile} />
                    <input type="hidden" name="music" value="1" />
                    {format.captions.required && <input type="hidden" name="captions" value="1" />}
                    <Button type="submit" variant="primary" icon="refresh" disabled={busy}>Gerar nova versão</Button>
                  </form>
                </div>
                <div className="mt-4 space-y-4">
                  {blocks.map((block) => (
                    <div key={block.id} className="rounded border border-line bg-void/30 p-3">
                      <div className="mb-3 flex items-center gap-2"><Badge tone="violet">Ato {block.act}</Badge><span className="text-xs font-medium">{block.title}</span></div>
                      <div className="space-y-2">
                        {block.scenes.map((scene) => {
                          let motion = "static";
                          try { motion = normalizeMotion(JSON.parse(scene.motion || "{}").kind, "static"); } catch {}
                          const sceneReview = REVIEW_META[scene.reviewStatus] ?? REVIEW_META.PENDING;
                          return (
                            <form key={scene.id} action={updateSceneReview.bind(null, project.id, scene.id)} className="grid grid-cols-1 items-end gap-2 rounded border border-line/70 bg-surface-low/50 p-3 md:grid-cols-[minmax(9rem,1fr)_minmax(10rem,1.2fr)_minmax(10rem,1fr)_auto]">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2"><span className="font-mono text-[10px] text-muted">Cena {scene.order}</span><Badge tone={sceneReview.tone}>{sceneReview.label}</Badge></div>
                                <div className="mt-1 truncate text-xs text-fg-secondary" title={scene.description ?? scene.filePath ?? ""}>{scene.description || scene.filePath || "Cartão de título"}</div>
                              </div>
                              <label className="text-[10px] text-muted">Motion
                                <select name="motion" defaultValue={motion} className="field mt-1 w-full px-2 py-1.5 text-xs">
                                  {MOTION_PRESETS.map((preset) => <option key={preset.id} value={preset.id} className="bg-surface-low">{preset.label} — {preset.description}</option>)}
                                </select>
                              </label>
                              <label className="text-[10px] text-muted">Decisão e observação
                                <div className="mt-1 flex gap-1">
                                  <select name="reviewStatus" defaultValue={scene.reviewStatus} className="field w-36 px-2 py-1.5 text-xs">
                                    <option value="PENDING">Pendente</option><option value="APPROVED">Aprovar</option><option value="CHANGES_REQUESTED">Alterar</option><option value="REJECTED">Rejeitar</option>
                                  </select>
                                  <input name="reviewNote" defaultValue={scene.reviewNote ?? ""} placeholder="Nota ou timecode" className="field min-w-0 flex-1 px-2 py-1.5 text-xs" />
                                </div>
                              </label>
                              <Button type="submit" size="sm" icon="save">Salvar cena</Button>
                            </form>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          <aside className="space-y-4">
            <Card className="p-4">
              <h3 className="font-display font-semibold"><Icon name="history" className="mr-1 align-middle text-primary-bright" />Renders</h3>
              <div className="mt-3 space-y-2">
                {renders.length === 0 && <div className="text-xs text-muted">Nenhum render ainda.</div>}
                {renders.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 rounded border border-line bg-void/40 p-2 text-xs">
                    <Icon name={r.outputPath ? (REVIEW_META[r.reviewStatus]?.icon ?? "check_circle") : "sync"} className={`text-[16px] ${r.reviewStatus === "APPROVED" ? "text-success" : r.reviewStatus === "REJECTED" ? "text-error" : "text-primary-bright"}`} />
                    <div className="flex-1"><div className="font-mono">v{r.revision} · {r.profile}</div><div className="text-[10px] text-muted">{r.outputPath ? (REVIEW_META[r.reviewStatus]?.label ?? "Aguardando revisão") : `${r.progress}%`} · {r.startedAt ? new Date(r.startedAt).toLocaleString("pt-BR") : ""}</div></div>
                    {r.outputPath ? <a href={`/api/media/${r.outputPath}?download=1`} className="text-primary-bright"><Icon name="download" className="text-[16px]" /></a> : <span className="font-mono text-[10px]">{r.progress}%</span>}
                  </div>
                ))}
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-semibold"><Icon name="image" className="mr-1 align-middle text-primary-bright" />Thumbnail</h3>
                <form action={generateThumbnail.bind(null, project.id)}>
                  <Button type="submit" size="sm" icon="auto_awesome" disabled={busy || ready === 0}>{project.thumbnailPath ? "Gerar de novo" : "Gerar (grátis)"}</Button>
                </form>
              </div>
              {project.thumbnailPath ? (
                <div className="mt-3">
                  <img src={`/api/media/${project.thumbnailPath}`} alt="Thumbnail gerada" className="w-full rounded border border-line" />
                  <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-muted">
                    <span>{project.thumbnailUpdatedAt ? new Date(project.thumbnailUpdatedAt).toLocaleString("pt-BR") : ""}</span>
                    <a href={`/api/media/${project.thumbnailPath}?download=1`} className="text-primary-bright"><Icon name="download" className="text-[16px]" /></a>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-xs text-fg-secondary">Composição gratuita via FFmpeg (cover-crop da melhor cena + grade punchy + título). Qualidade tipo IA (Nano Banana Pro) fica pra quando entrarmos com API paga.</p>
              )}
            </Card>
            <Card className="p-4">
              <h3 className="font-display font-semibold"><Icon name="music_note" className="mr-1 align-middle text-primary-bright" />Trilha sonora</h3>
              <p className="mt-2 text-xs text-fg-secondary">Coloque um arquivo em <code className="font-mono text-[10px]">storage/music/default.mp3</code> (ou <code className="font-mono text-[10px]">storage/music/{project.id}.mp3</code>) e o render mistura com ducking automático sob a voz. Fontes livres: Pixabay Music, YouTube Audio Library.</p>
            </Card>
            <Card className="p-4">
              <h3 className="font-display font-semibold"><Icon name="auto_awesome_mosaic" className="mr-1 align-middle text-primary-bright" />Camada visual (DVP)</h3>
              <p className="mt-2 text-xs text-fg-secondary">Plano do que entra por cima do master já renderizado: lower thirds, destaques de dado e intertítulos, posicionados pelo tempo real de cada palavra.</p>
              <Link href={`/projects/${project.id}/edit-plan`} className="mt-3 block"><Button icon="auto_awesome_mosaic" variant="ghost" className="w-full">Ver plano de edição</Button></Link>
            </Card>
            <Card className="p-4">
              <h3 className="font-display font-semibold"><Icon name="verified_user" className="mr-1 align-middle text-primary-bright" />Verificação Pré-Voo</h3>
              <ul className="mt-3 space-y-2 text-xs text-fg-secondary">
                <li className="flex gap-2"><Icon name={canRender ? "check_circle" : "radio_button_unchecked"} className={`text-[16px] ${canRender ? "text-success" : "text-muted"}`} />Locução completa ({voiced}/{blocks.length} atos)</li>
                <li className="flex gap-2"><Icon name={mixedVoices ? "warning" : "check_circle"} className={`text-[16px] ${mixedVoices ? "text-warning" : "text-success"}`} />{mixedVoices ? `Vozes misturadas (${[...voiceSet].join(", ")}) — regrave no Passo 3` : "Voz consistente em todos os atos"}</li>
                <li className="flex gap-2"><Icon name={captioned === blocks.length && blocks.length ? "check_circle" : "radio_button_unchecked"} className={`text-[16px] ${captioned === blocks.length && blocks.length ? "text-success" : "text-muted"}`} />Legendas alinhadas ({captioned}/{blocks.length})</li>
                <li className="flex gap-2"><Icon name={ready === scenes.length && scenes.length ? "check_circle" : "warning"} className={`text-[16px] ${ready === scenes.length && scenes.length ? "text-success" : "text-warning"}`} />Cenas com mídia ({ready}/{scenes.length}); as demais viram cartão de título</li>
                <li className="flex gap-2"><Icon name={lowResolution === 0 ? "check_circle" : "warning"} className={`text-[16px] ${lowResolution === 0 ? "text-success" : "text-warning"}`} />{lowResolution === 0 ? "Resolução conhecida adequada" : `${lowResolution} cena(s) podem perder nitidez no enquadramento`}</li>
                <li className="flex gap-2"><Icon name={repeatedMedia === 0 ? "check_circle" : "warning"} className={`text-[16px] ${repeatedMedia === 0 ? "text-success" : "text-warning"}`} />{repeatedMedia === 0 ? "Sem mídia repetida entre cenas" : `${repeatedMedia} repetição(ões) de mídia — revise a variedade visual`}</li>
                <li className="flex gap-2"><Icon name={duplicateContent === 0 ? "check_circle" : "warning"} className={`text-[16px] ${duplicateContent === 0 ? "text-success" : "text-warning"}`} />{duplicateContent === 0 ? "Sem arquivos idênticos com nomes diferentes" : `${duplicateContent} arquivo(s) duplicado(s) por conteúdo`}</li>
                {predictedRetention != null && <li className="flex gap-2"><Icon name={predictedRetention >= 75 ? "trending_up" : "warning"} className={`text-[16px] ${predictedRetention >= 75 ? "text-success" : "text-warning"}`} />Retenção prevista do roteiro: {predictedRetention}/100</li>}
                {unknownResolution > 0 && <li className="flex gap-2"><Icon name="info" className="text-[16px] text-muted" />{unknownResolution} mídia(s) sem dimensão registrada; confira no render de prova</li>}
              </ul>
            </Card>
          </aside>
        </div>

        <Card className="mt-6 flex items-center gap-4 p-4">
          <Icon name="rocket_launch" className="text-primary-bright" />
          <div className="flex-1 text-sm"><div className="font-semibold">Render local via FFmpeg</div><div className="text-xs text-fg-secondary">Ao terminar, o MP4 fica em storage/projects/…/renders e o Passo 5 (publicação) usa o último render concluído.</div></div>
          <form action={advanceStage.bind(null, project.id)}><Button type="submit" variant="primary" iconRight="arrow_forward" disabled={busy || !current?.outputPath || !approved} title={current?.outputPath && !approved ? "Aprove a versão atual antes de publicar" : ""}>Avançar para Publicação</Button></form>
        </Card>
      </main>
    </>
  );
}
