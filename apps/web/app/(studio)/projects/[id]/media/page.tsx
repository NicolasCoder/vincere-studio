import { prisma } from "@vincere-studio/db";
import { FORMATS, getVisualStyle, sceneFileStem, visualStyleList, type VideoFormat } from "@vincere-studio/core";
import { EdgeVoiceProvider, storageRoot } from "@vincere-studio/providers";
import { Badge, Button, Card, Chip, Icon, Progress, Stat } from "@vincere-studio/ui";
import { loadProjectShell } from "@/components/ProjectShell";
import { JobWatcher } from "@/components/JobWatcher";
import { ensureDefaultVoiceProfiles, fmtDuration, fmtMs, parseJson } from "@/lib/data";
import { advanceStage } from "../../actions";
import { alignCaptions, clearScene, generateScenePrompts, huntBroll, importInbox, rerollScene, setCaptionStyle, setVisualStyle, setVoiceProfile, synthesizeVoice, uploadSceneMedia } from "./actions";
import { SceneUpload } from "./SceneUpload";
import { SceneFlowButton } from "./SceneFlowButton";
import { CaptionStyleEditor } from "../render/CaptionStyleEditor";
import path from "node:path";

const GEMINI_VOICES = ["Charon", "Fenrir", "Enceladus", "Orus", "Kore", "Aoede", "Leda", "Puck"];

export default async function MediaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ blocked?: string; job?: string; saved?: string }> }) {
  const { id } = await params;
  const { blocked, job, saved } = await searchParams;
  const { project, header, busy } = await loadProjectShell(id, "MEDIA", blocked, job);
  const format = FORMATS[project.format as VideoFormat];
  const style = getVisualStyle(project.visualStyle);
  await ensureDefaultVoiceProfiles();
  const [script, profiles] = await Promise.all([
    prisma.script.findFirst({ where: { projectId: id }, orderBy: { version: "desc" }, include: { blocks: { orderBy: { order: "asc" }, include: { voiceTracks: { include: { captions: true } }, scenes: { orderBy: { order: "asc" } } } } } }),
    prisma.voiceProfile.findMany({ orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] }),
  ]);
  const blocks = script?.blocks ?? [];
  const profile = profiles.find((p) => p.id === project.voiceProfileId) ?? profiles.find((p) => p.isDefault) ?? profiles[0];
  const voiced = blocks.filter((b) => b.voiceTracks.length).length;
  const captioned = blocks.filter((b) => b.voiceTracks[0]?.captions.length).length;
  const scenes = blocks.flatMap((b) => b.scenes.map((s) => ({ ...s, act: b.act })));
  const ready = scenes.filter((s) => s.filePath).length;
  const totalMs = blocks.reduce((s, b) => s + (b.voiceTracks[0]?.durationMs ?? 0), 0);
  const fallbackCount = blocks.filter((b) => b.voiceTracks[0]?.fallbackUsed).length;
  const fallbackIds = blocks.filter((b) => b.voiceTracks[0]?.fallbackUsed).map((b) => b.id);
  const voiceSet = new Set(blocks.filter((b) => b.voiceTracks[0]).map((b) => `${b.voiceTracks[0].provider}/${b.voiceTracks[0].voiceId}`));
  const mixedVoices = voiceSet.size > 1;
  const bySource = { STOCK: scenes.filter((s) => s.source === "STOCK").length, IMPORTED: scenes.filter((s) => s.source === "IMPORTED").length, GENERATED: scenes.filter((s) => s.source === "GENERATED" && s.filePath).length };
  const inboxPath = path.join(storageRoot(), "projects", id, "inbox");
  const refPath = path.join(storageRoot(), "projects", id, "referencias");
  const hasStock = !!(process.env.PEXELS_API_KEY || process.env.PIXABAY_API_KEY);
  const edgeVoices = new EdgeVoiceProvider().voices();

  return (
    <>
      {header}
      <main className="p-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-2"><Badge tone="violet">Projeto #{project.id.slice(-6).toUpperCase()}</Badge><Badge tone="neutral">modo {project.costMode}</Badge><Badge tone="cyan">{style.label}</Badge></div>
            <h1 className="mt-2 max-w-3xl font-display text-3xl font-semibold leading-tight"><span className="gradient-text">{project.title}</span></h1>
            <div className="mt-3 flex flex-wrap gap-2">
              <Chip icon="timer">{totalMs ? fmtDuration(Math.round(totalMs / 1000)) : fmtDuration(project.targetDuration)} {totalMs ? "de locução" : "previsto"}</Chip>
              <Chip icon="view_agenda">{voiced}/{blocks.length} atos com voz</Chip>
              <Chip icon="subtitles">{captioned}/{blocks.length} com legendas</Chip>
              <Chip icon="movie" active={ready > 0}>{ready}/{scenes.length} cenas com mídia</Chip>
              {profile && <Chip icon="record_voice_over" active tone="violet">{profile.name}</Chip>}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <form action={synthesizeVoice.bind(null, project.id, [], voiced === blocks.length && blocks.length > 0)}><Button type="submit" variant={voiced === blocks.length && blocks.length ? "ghost" : "primary"} icon="mic" className="w-full" disabled={busy || !blocks.length || !profile}>{voiced === blocks.length && blocks.length ? "Regravar toda a locução" : voiced ? `Sintetizar atos restantes (${blocks.length - voiced})` : "Sintetizar locução"}</Button></form>
            <form action={alignCaptions.bind(null, project.id)}><Button type="submit" icon="subtitles" className="w-full" disabled={busy || !voiced}>Alinhar legendas (Whisper)</Button></form>
            <div className="flex gap-2">
              <form action={generateScenePrompts.bind(null, project.id, "sparse")} className="flex-1"><Button type="submit" variant={voiced && !scenes.length ? "primary" : "ghost"} icon="auto_awesome" className="w-full" disabled={busy || !blocks.length} title="Cenas longas (8–12s): menos imagens para gerar à mão no Flow">{scenes.length ? "Replanejar (Flow)" : "Planejar cenas (Flow)"}</Button></form>
              <form action={generateScenePrompts.bind(null, project.id, "dense")} className="flex-1"><Button type="submit" icon="burst_mode" className="w-full" disabled={busy || !blocks.length} title="Cenas a cada 2–4s no Short para mais mudanças visuais e retenção">{scenes.length ? "Replanejar (alta retenção)" : "Planejar alta retenção"}</Button></form>
            </div>
          </div>
        </div>

        {job && <div className="mt-4"><JobWatcher jobId={job} label="Estúdio de mídia trabalhando" /></div>}
        {saved === "caption" && <Card className="mt-4 p-3 text-sm text-success"><Icon name="check_circle" className="mr-1 align-middle" />Modelo de legenda salvo — o próximo render no Passo 4 já sai com ele.</Card>}
        {(mixedVoices || fallbackCount > 0) && !job && (
          <div className="mt-4 flex items-center gap-3 rounded border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
            <Icon name="warning" className="text-[18px] text-warning" />
            <div className="flex-1 text-warning">
              <span className="font-semibold">Vozes misturadas:</span> {fallbackCount} ato(s) foram gravados com a voz de reserva ({[...voiceSet].join(" · ")}). Regrave-os com a principal antes de publicar.
            </div>
            <form action={synthesizeVoice.bind(null, project.id, fallbackIds, true)}><Button type="submit" size="sm" variant="primary" icon="mic" disabled={busy}>Regravar os {fallbackCount} ato(s) de reserva</Button></form>
          </div>
        )}

        <div className="mt-6 grid grid-cols-[1fr_22rem] gap-6">
          <div className="space-y-4">
            {!blocks.length && <Card className="p-10 text-center text-sm text-muted">Sem roteiro. Volte ao Passo 2.</Card>}
            {blocks.map((b) => {
              const t = b.voiceTracks[0];
              const words = parseJson<{ text: string; startMs: number; endMs: number }[]>(t?.captions[0]?.words, []);
              return (
                <Card key={b.id} className="p-5" accent={t ? (t.fallbackUsed ? "slate" : "cyan") : "none"}>
                  <div className="flex items-center gap-3">
                    <span className="grid size-8 place-items-center rounded bg-line/40 font-mono text-xs text-primary-bright">{String(b.act).padStart(2, "0")}</span>
                    <div className="min-w-0 flex-1"><div className="font-display font-semibold">Ato {b.act}: {b.title}</div><div className="truncate text-xs text-fg-secondary">{b.brollCue ?? "—"}</div></div>
                    <Badge tone="cyan">{t ? fmtMs(t.durationMs) : `${fmtMs(b.startMs)} – ${fmtMs(b.endMs)}`}</Badge>
                    <Badge tone={b.scenes.filter((s) => s.filePath).length === b.scenes.length && b.scenes.length ? "success" : "neutral"}>{b.scenes.filter((s) => s.filePath).length}/{b.scenes.length} cenas</Badge>
                  </div>

                  <div className="mt-4 rounded border border-line bg-void/60 p-4">
                    {t ? (
                      <>
                        <div className="flex items-center gap-3">
                          <audio controls preload="none" src={`/api/media/${t.filePath}`} className="h-9 flex-1" />
                          <div className="text-right font-mono text-[10px] text-muted">{t.provider} · {t.voiceId}{t.fallbackUsed && <span className="ml-1 text-warning">(reserva)</span>}</div>
                          <form action={synthesizeVoice.bind(null, project.id, [b.id], true)}><Button type="submit" variant="icon" icon="refresh" title="Regravar este ato" disabled={busy} /></form>
                        </div>
                        {words.length > 0 && (
                          <div className="mt-3 max-h-16 overflow-hidden font-mono text-[10px] leading-relaxed text-fg-secondary">
                            {words.slice(0, 40).map((w, i) => <span key={i} className="mr-1 inline-block rounded-sm bg-line/30 px-1" title={`${fmtMs(w.startMs)}`}>{w.text}</span>)}
                            {words.length > 40 && <span className="text-muted">… +{words.length - 40} palavras alinhadas</span>}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center justify-between text-xs text-muted"><span><Icon name="mic_off" className="mr-1 align-middle text-[16px]" />Sem locução ainda</span><form action={synthesizeVoice.bind(null, project.id, [b.id], true)}><Button type="submit" size="sm" icon="mic" disabled={busy || !profile}>Sintetizar só este ato</Button></form></div>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between"><span className="label-mono text-muted">Cenas & B-roll mapeados no Ato {b.act}</span><span className="font-mono text-[10px] text-muted">ritmo {format.cutPace.min}–{format.cutPace.max}s</span></div>
                  {b.scenes.length === 0 ? (
                    <div className="mt-2 rounded border border-dashed border-line p-3 text-center text-xs text-muted">Clique em "Planejar cenas & prompts" para dividir o ato em cenas no estilo {style.label}.</div>
                  ) : (
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {b.scenes.map((s) => (
                        <div key={s.id} className="flex gap-3 rounded border border-line bg-void/40 p-2">
                          <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded border border-line bg-surface-low">
                            {s.filePath ? (
                              s.mediaType === "video" ? <video src={`/api/media/${s.filePath}`} muted preload="metadata" className="h-full w-full object-cover" /> : <img src={`/api/media/${s.filePath}`} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="grid h-full w-full place-items-center text-muted"><Icon name={s.preferVideo ? "videocam" : "image"} className="text-[20px]" /></div>
                            )}
                            <span className="absolute bottom-0.5 left-0.5 rounded-sm bg-void/80 px-1 font-mono text-[9px] text-primary-bright">{sceneFileStem(b.act, s.order)}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between"><span className="font-mono text-[10px] text-fg-secondary">{fmtMs(s.startMs)}–{fmtMs(s.endMs)}</span><Badge tone={s.filePath ? (s.source === "STOCK" ? "cyan" : "violet") : "neutral"}>{s.filePath ? (s.source === "STOCK" ? s.provider : "Flow/Import") : "pendente"}</Badge></div>
                            <p className="mt-1 line-clamp-2 text-[11px] text-fg-secondary" title={s.prompt ?? ""}>{s.description ?? s.prompt}</p>
                            <div className="mt-1 flex items-center justify-between gap-2">
                              <span className="truncate font-mono text-[9px] text-muted">{s.keywords}</span>
                              <div className="flex shrink-0 items-center gap-2">
                                <SceneFlowButton
                                  projectId={project.id}
                                  sceneId={s.id}
                                  prompt={s.prompt}
                                  preferVideo={s.preferVideo}
                                  format={project.format}
                                />
                                <SceneUpload action={uploadSceneMedia.bind(null, project.id, s.id)} />
                                {s.filePath && <form action={clearScene.bind(null, project.id, s.id)}><button className="font-mono text-[9px] text-muted hover:text-error">limpar</button></form>}
                              </div>
                            </div>
                            {hasStock && (
                              <form action={rerollScene.bind(null, project.id, s.id)} className="mt-1 flex items-center gap-1">
                                <input name="keywords" placeholder="outro termo de busca (opcional)" className="field h-6 flex-1 px-1.5 text-[9px]" />
                                <button type="submit" title="Trocar por outra opção do acervo (fora de contexto?)" className="grid h-6 w-6 shrink-0 place-items-center rounded border border-line text-muted hover:border-primary-bright hover:text-primary-bright" disabled={busy}>
                                  <Icon name="sync" className="text-[13px]" />
                                </button>
                              </form>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          <aside className="space-y-4">
            <Card className="p-4">
              <div className="flex items-center justify-between"><h3 className="font-display font-semibold"><Icon name="mic" className="mr-1 align-middle text-primary-bright" />Voz do Canal</h3><Badge tone="cyan">{profile?.provider ?? "—"}</Badge></div>
              <form action={setVoiceProfile.bind(null, project.id)} className="mt-3">
                <select name="voiceProfileId" defaultValue={profile?.id ?? ""} className="field w-full px-3 py-2 text-sm">
                  {profiles.map((p) => <option key={p.id} value={p.id} className="bg-surface-low">{p.name} · {p.provider === "GEMINI_TTS" ? "Gemini" : "Edge"} {p.voiceId}{p.isDefault ? " (padrão)" : ""}</option>)}
                </select>
                <Button type="submit" size="sm" className="mt-2 w-full" icon="check">Usar neste projeto</Button>
              </form>
              {profile && (
                <div className="mt-3 rounded border border-line bg-void/60 p-3 text-xs">
                  <div className="font-semibold">{profile.name}</div>
                  <div className="mt-1 font-mono text-[10px] text-muted">{profile.provider} / {profile.voiceId} · {profile.rate}x</div>
                  {profile.style && <div className="mt-1 italic text-fg-secondary">“{profile.style}”</div>}
                  <div className="mt-2 font-mono text-[10px] text-muted">Reserva: {parseJson<{ provider: string; voiceId: string }[]>(profile.fallbacks, []).map((f) => `${f.provider}/${f.voiceId}`).join(", ") || "—"}</div>
                  {fallbackCount > 0 && <div className="mt-2 text-warning"><Icon name="warning" className="mr-1 align-middle text-[14px]" />{fallbackCount} ato(s) gravados com a voz de reserva. Regrave quando a principal voltar.</div>}
                </div>
              )}
              <p className="mt-2 text-[11px] text-muted">Vozes Gemini: {GEMINI_VOICES.join(", ")}. Edge (grátis, sem chave): {edgeVoices.map((v) => v.label.split(" ·")[0]).join(", ")}. Crie perfis em Settings.</p>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between"><h3 className="font-display font-semibold"><Icon name="subtitles" className="mr-1 align-middle text-primary-bright" />Modelo de legenda</h3></div>
              <p className="mt-1 text-[11px] text-fg-secondary">Escolha aqui, antes de renderizar — o Passo 4 já sai com este modelo, sem precisar gerar 2 renders.</p>
              <form action={setCaptionStyle.bind(null, project.id)} className="mt-3">
                <CaptionStyleEditor format={project.format as VideoFormat} savedPreset={project.captionPreset} savedStyleJson={project.captionStyle} />
              </form>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between"><h3 className="font-display font-semibold"><Icon name="palette" className="mr-1 align-middle text-primary-bright" />Estilo Visual</h3><Badge tone="violet">{format.ratio}</Badge></div>
              <form action={setVisualStyle.bind(null, project.id)} className="mt-3">
                <select name="visualStyle" defaultValue={project.visualStyle} className="field w-full px-3 py-2 text-sm">
                  {visualStyleList.map((s) => <option key={s.id} value={s.id} className="bg-surface-low">{s.label}</option>)}
                </select>
                <Button type="submit" size="sm" className="mt-2 w-full" icon="check">Aplicar estilo</Button>
              </form>
              <p className="mt-2 text-[11px] text-fg-secondary">{style.description}</p>
            </Card>

            <Card className="p-4">
              <h3 className="font-display font-semibold"><Icon name="auto_awesome" className="mr-1 align-middle text-primary-bright" />Banco de Imagens</h3>
              <p className="mt-2 text-xs text-fg-secondary">Descreva e gere imagens em lote para este projeto — capa, inserção de arquivo ou referência de estilo. O motor grátis funciona sem orçamento.</p>
              <a href={`/projects/${project.id}/imagens`} className="mt-3 block"><Button icon="auto_awesome" variant="ghost" size="sm" className="w-full">Abrir banco de imagens</Button></a>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between"><h3 className="font-display font-semibold"><Icon name="movie_filter" className="mr-1 align-middle text-primary-bright" />Curadoria & B-Roll</h3><Badge tone="violet">Flow + GPT</Badge></div>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2"><Stat label="Cenas com mídia" value={`${ready} / ${scenes.length}`} sub={scenes.length ? `${Math.round((ready / scenes.length) * 100)}% cobertura` : "planeje as cenas"} /><Stat label="Fontes" value={`${bySource.STOCK}·${bySource.IMPORTED}`} sub="acervo · Flow/import" tone="fg" /></div>
              {scenes.length > 0 && <Progress value={scenes.length ? (ready / scenes.length) * 100 : 0} className="mt-3" />}
              <div className="mt-3 space-y-2">
                {scenes.length > 0 && <a href={`/api/projects/${project.id}/gpt-image-pack`}><Button icon="smart_toy" variant="primary" size="sm" className="w-full">Gerar com GPT</Button></a>}
                {scenes.length > 0 && <a href={`/api/media/projects/${project.id}/prompts/flow-pack.md?download=1`}><Button icon="download" size="sm" className="w-full">Baixar pacote de prompts (Flow)</Button></a>}
                <form action={importInbox.bind(null, project.id)}><Button type="submit" icon="folder_open" size="sm" className="w-full" disabled={busy || !scenes.length}>Importar da pasta inbox</Button></form>
                <form action={huntBroll.bind(null, project.id, false)}><Button type="submit" icon="travel_explore" size="sm" className="w-full" disabled={busy || !scenes.length || !hasStock} title={hasStock ? "Pexels/Pixabay" : "Configure PEXELS_API_KEY / PIXABAY_API_KEY"}>Buscar B-roll no acervo{!hasStock && " (sem chave)"}</Button></form>
              </div>
              <div className="mt-3 rounded border border-line bg-void/60 p-2 font-mono text-[10px] text-muted break-all"><Icon name="folder" className="mr-1 align-middle text-[12px]" />{inboxPath}</div>
              <p className="mt-2 text-[11px] text-fg-secondary">No GPT, baixe o .txt, cole o conteúdo nesta conversa e peça a geração completa. Salve as imagens nesta pasta com os nomes indicados (a01-s03.png) e clique em Importar. O fluxo do Flow continua disponível.</p>
              <div className="mt-3 rounded border border-dashed border-line bg-void/40 p-2 font-mono text-[10px] text-muted break-all"><Icon name="collections_bookmark" className="mr-1 align-middle text-[12px]" />{refPath}</div>
              <p className="mt-1 text-[11px] text-fg-secondary">Pasta de referências (opcional): coloque ali imagens de estilo/paleta do canal para manter consistência visual entre as cenas.</p>
            </Card>
          </aside>
        </div>

        <Card className="mt-6 flex items-center gap-4 p-4">
          <Icon name="task_alt" className="text-primary-bright" />
          <div className="flex-1 text-sm"><div className="font-semibold">{voiced === blocks.length && blocks.length ? "Locução completa" : "Locução pendente"} · {ready}/{scenes.length} cenas com mídia</div><div className="text-xs text-fg-secondary">O render (Passo 4) usa a locução, as legendas alinhadas e as cenas prontas; cenas sem mídia recebem um cartão de título no estilo do projeto.</div></div>
          <form action={advanceStage.bind(null, project.id)}><Button type="submit" variant="primary" iconRight="arrow_forward" disabled={busy}>Avançar para Passo 4: Render & Export</Button></form>
        </Card>
      </main>
    </>
  );
}
