import { prisma } from "@docupulse/db";
import { FORMATS, type VideoFormat } from "@docupulse/core";
import { PROFILES, profileFor } from "@docupulse/render";
import { Badge, Button, Card, Chip, Icon, Progress } from "@docupulse/ui";
import { loadProjectShell } from "@/components/ProjectShell";
import { JobWatcher } from "@/components/JobWatcher";
import { fmtDuration } from "@/lib/data";
import { advanceStage } from "../../actions";
import { renderVideo } from "./actions";

const STAGES = [
  ["Áudio & Ducking", "Concatenação das locuções, trilha com ducking e normalização -14 LUFS", 68],
  ["Composição", "Ken Burns nas imagens, vídeos de acervo em loop, cartões de título e dissolves", 65],
  ["Legendas", "ASS gerado a partir das palavras alinhadas (rodapé no 16:9, karaokê no 9:16)", 80],
  ["Codificação", "H.264 via Intel QuickSync quando disponível, senão libx264 · MP4 faststart", 100],
] as const;

export default async function RenderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ blocked?: string; job?: string }> }) {
  const { id } = await params;
  const { blocked, job } = await searchParams;
  const { project, header, busy } = await loadProjectShell(id, "RENDER", blocked, job);
  const format = FORMATS[project.format as VideoFormat];
  const renders = await prisma.renderJob.findMany({ where: { projectId: id }, orderBy: { startedAt: "desc" }, take: 5 });
  const current = renders[0];
  const progress = current?.progress ?? 0;
  const defaultProfile = profileFor(project.format);
  const script = await prisma.script.findFirst({ where: { projectId: id }, orderBy: { version: "desc" }, include: { blocks: { include: { voiceTracks: { select: { durationMs: true, captions: { select: { id: true } } } }, scenes: { select: { filePath: true } } } } } });
  const blocks = script?.blocks ?? [];
  const voiced = blocks.filter((b) => b.voiceTracks.length).length;
  const totalMs = blocks.reduce((s, b) => s + (b.voiceTracks[0]?.durationMs ?? 0), 0);
  const scenes = blocks.flatMap((b) => b.scenes);
  const ready = scenes.filter((s) => s.filePath).length;
  const captioned = blocks.filter((b) => b.voiceTracks[0]?.captions.length).length;
  const canRender = voiced === blocks.length && blocks.length > 0;

  return (
    <>
      {header}
      <main className="p-6">
        <div className="flex items-start justify-between gap-6">
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
          <form action={renderVideo.bind(null, project.id)} className="flex w-72 flex-col gap-2">
            <select name="profile" defaultValue={defaultProfile.id} className="field w-full px-3 py-2 text-sm">
              {Object.values(PROFILES).map((p) => <option key={p.id} value={p.id} className="bg-surface-low">{p.label} — {p.description}</option>)}
            </select>
            <label className="flex items-center gap-2 text-xs text-fg-secondary"><input type="checkbox" name="captions" defaultChecked className="accent-primary" /> Queimar legendas ({format.captions.style === "bold-center-animated" ? "karaokê central" : "rodapé discreto"})</label>
            <Button type="submit" variant="primary" icon="movie" disabled={busy || !canRender} title={canRender ? "" : "Sintetize a locução de todos os atos no Passo 3"}>Iniciar Render (FFmpeg)</Button>
            {!canRender && <span className="font-mono text-[10px] text-warning">{voiced}/{blocks.length} atos com locução — complete o Passo 3</span>}
          </form>
        </div>

        {job && <div className="mt-4"><JobWatcher jobId={job} label="Renderizando com FFmpeg" /></div>}

        <div className="mt-6 grid grid-cols-[1fr_22rem] gap-6">
          <div className="space-y-4">
            <Card className="overflow-hidden" accent="dual">
              <div className={`relative grid place-items-center bg-gradient-to-br from-void via-surface-low to-secondary/20 ${format.ratio === "9:16" ? "aspect-video" : "aspect-video"}`}>
                {current?.outputPath ? (
                  <video controls preload="metadata" src={`/api/media/${current.outputPath}`} className={`${format.ratio === "9:16" ? "h-full" : "w-full"} max-h-[520px] bg-black`} />
                ) : (
                  <div className="text-center"><Icon name="movie" className="text-[48px] text-muted" /><div className="mt-2 font-mono text-xs text-muted">{busy ? "Renderizando… o preview aparece ao terminar" : "O preview do render aparece aqui"}</div></div>
                )}
                {!current?.outputPath && (
                  <div className="absolute inset-x-4 bottom-4 rounded border border-line bg-void/80 p-3 backdrop-blur">
                    <div className="flex items-center justify-between font-mono text-[11px]"><span className="text-primary-bright">{progress}%</span><span className="text-muted">{current ? `perfil ${current.profile}` : "nenhum render ainda"}</span></div>
                    <Progress value={progress} className="mt-2" pulse />
                  </div>
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

            <Card className="p-5">
              <div className="flex items-center justify-between"><h3 className="font-display text-lg font-semibold"><Icon name="memory" className="mr-1 align-middle text-primary-bright" />Etapas do Render</h3><span className="font-mono text-xs text-fg-secondary">Local · FFmpeg · {current?.finishedAt ? "Concluído" : busy ? "Em execução" : "Aguardando"}</span></div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {STAGES.map(([n, d, at], i) => {
                  const done = progress >= at;
                  const active = !done && progress > (STAGES[i - 1]?.[2] ?? 0) - 1 && busy;
                  return (
                    <div key={n} className="rounded border border-line bg-void/40 p-3">
                      <div className="flex items-center justify-between"><span className="flex items-center gap-2 font-mono text-xs"><Icon name={done ? "check_circle" : active ? "sync" : "radio_button_unchecked"} className={`text-[16px] ${done ? "text-success" : active ? "animate-spin text-primary-bright" : "text-muted"}`} />Etapa {String(i + 1).padStart(2, "0")}: {n}</span><Badge tone={done ? "success" : active ? "cyan" : "neutral"}>{done ? "OK" : active ? "em curso" : "pendente"}</Badge></div>
                      <p className="mt-2 text-xs text-fg-secondary">{d}</p>
                    </div>
                  );
                })}
              </div>
              {current?.log && <pre className="mt-4 max-h-40 overflow-auto whitespace-pre-wrap rounded border border-line bg-void/70 p-3 font-mono text-[10px] leading-relaxed text-fg-secondary">{current.log}</pre>}
            </Card>
          </div>

          <aside className="space-y-4">
            <Card className="p-4">
              <h3 className="font-display font-semibold"><Icon name="history" className="mr-1 align-middle text-primary-bright" />Renders</h3>
              <div className="mt-3 space-y-2">
                {renders.length === 0 && <div className="text-xs text-muted">Nenhum render ainda.</div>}
                {renders.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 rounded border border-line bg-void/40 p-2 text-xs">
                    <Icon name={r.outputPath ? "check_circle" : "sync"} className={`text-[16px] ${r.outputPath ? "text-success" : "text-primary-bright"}`} />
                    <div className="flex-1"><div className="font-mono">{r.profile}</div><div className="text-[10px] text-muted">{r.startedAt ? new Date(r.startedAt).toLocaleString("pt-BR") : ""}</div></div>
                    {r.outputPath ? <a href={`/api/media/${r.outputPath}?download=1`} className="text-primary-bright"><Icon name="download" className="text-[16px]" /></a> : <span className="font-mono text-[10px]">{r.progress}%</span>}
                  </div>
                ))}
              </div>
            </Card>
            <Card className="p-4">
              <h3 className="font-display font-semibold"><Icon name="music_note" className="mr-1 align-middle text-primary-bright" />Trilha sonora</h3>
              <p className="mt-2 text-xs text-fg-secondary">Coloque um arquivo em <code className="font-mono text-[10px]">storage/music/default.mp3</code> (ou <code className="font-mono text-[10px]">storage/music/{project.id}.mp3</code>) e o render mistura com ducking automático sob a voz. Fontes livres: Pixabay Music, YouTube Audio Library.</p>
            </Card>
            <Card className="p-4">
              <h3 className="font-display font-semibold"><Icon name="verified_user" className="mr-1 align-middle text-primary-bright" />Verificação Pré-Voo</h3>
              <ul className="mt-3 space-y-2 text-xs text-fg-secondary">
                <li className="flex gap-2"><Icon name={canRender ? "check_circle" : "radio_button_unchecked"} className={`text-[16px] ${canRender ? "text-success" : "text-muted"}`} />Locução completa ({voiced}/{blocks.length} atos)</li>
                <li className="flex gap-2"><Icon name={captioned === blocks.length && blocks.length ? "check_circle" : "radio_button_unchecked"} className={`text-[16px] ${captioned === blocks.length && blocks.length ? "text-success" : "text-muted"}`} />Legendas alinhadas ({captioned}/{blocks.length})</li>
                <li className="flex gap-2"><Icon name={ready === scenes.length && scenes.length ? "check_circle" : "warning"} className={`text-[16px] ${ready === scenes.length && scenes.length ? "text-success" : "text-warning"}`} />Cenas com mídia ({ready}/{scenes.length}); as demais viram cartão de título</li>
              </ul>
            </Card>
          </aside>
        </div>

        <Card className="mt-6 flex items-center gap-4 p-4">
          <Icon name="rocket_launch" className="text-primary-bright" />
          <div className="flex-1 text-sm"><div className="font-semibold">Render local via FFmpeg</div><div className="text-xs text-fg-secondary">Ao terminar, o MP4 fica em storage/projects/…/renders e o Passo 5 (publicação) usa o último render concluído.</div></div>
          <form action={advanceStage.bind(null, project.id)}><Button type="submit" variant="primary" iconRight="arrow_forward" disabled={busy || !current?.outputPath}>Avançar para Publicação</Button></form>
        </Card>
      </main>
    </>
  );
}
