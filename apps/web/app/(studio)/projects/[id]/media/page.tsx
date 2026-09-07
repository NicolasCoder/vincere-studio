import { FORMATS, type VideoFormat } from "@docupulse/core";
import { Badge, Button, Card, Chip, Icon, Progress, Stat } from "@docupulse/ui";
import { loadProjectShell } from "@/components/ProjectShell";
import { fmtDuration, fmtMs } from "@/lib/data";
import { advanceStage } from "../../actions";

export default async function MediaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ blocked?: string }> }) {
  const { id } = await params;
  const { blocked } = await searchParams;
  const { project, header } = await loadProjectShell(id, "MEDIA", blocked);
  const format = FORMATS[project.format as VideoFormat];
  const blocks = project.scripts[0]?.blocks ?? [];

  return (
    <>
      {header}
      <main className="p-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-2"><Badge tone="violet">Projeto ativo #{project.id.slice(-6).toUpperCase()}</Badge><span className="font-mono text-[11px] text-muted">· modo {project.costMode}</span></div>
            <h1 className="mt-2 max-w-3xl font-display text-3xl font-semibold leading-tight"><span className="gradient-text">{project.title}</span></h1>
            <div className="mt-3 flex flex-wrap gap-2">
              <Chip icon="timer">{fmtDuration(project.targetDuration)} total</Chip>
              <Chip icon="view_agenda">{blocks.length} Atos</Chip>
              <Chip icon="movie">B-roll: Pexels · Pixabay · {project.costMode === "FREE" ? "FLUX (CF)" : "Nano Banana"}</Chip>
              <Chip icon="record_voice_over" active tone="violet">Voz IA: Gemini TTS (Charon)</Chip>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Button icon="play_circle" disabled>Ouvir Prévia Completa</Button>
            <Button icon="autorenew" disabled>Regenerar B-Roll em Massa</Button>
            <Button variant="primary" icon="sync" disabled title="Sprint 3">Auto-Sincronizar Timeline</Button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-[1fr_22rem] gap-6">
          <div className="space-y-4">
            {blocks.length === 0 && <Card className="p-10 text-center text-sm text-muted">Sem blocos de roteiro. Volte ao Passo 2.</Card>}
            {blocks.map((b, i) => (
              <Card key={b.id} className="p-5" accent={i === 0 ? "dual" : "none"}>
                <div className="flex items-center gap-3">
                  <span className="grid size-8 place-items-center rounded bg-line/40 font-mono text-xs text-primary-bright">{String(b.act).padStart(2, "0")}</span>
                  <div className="flex-1"><div className="font-display font-semibold">Ato {b.act}: {b.title}</div><div className="text-xs text-fg-secondary">{b.brollCue ?? "—"}</div></div>
                  <Badge tone="cyan">{fmtMs(b.startMs)} – {fmtMs(b.endMs)}</Badge>
                  <Badge tone="neutral">0 cenas mapeadas</Badge>
                </div>
                {i === 0 && (
                  <div className="mt-4 rounded border border-line bg-void/60 p-4">
                    <div className="flex items-center gap-3">
                      <button className="grid size-9 place-items-center rounded-full bg-primary/20 text-primary-bright"><Icon name="play_arrow" /></button>
                      <div className="flex-1"><div className="font-mono text-xs">Track_Act{String(b.act).padStart(2, "0")}.wav</div><div className="font-mono text-[10px] text-muted">48kHz · 24-bit · aguardando síntese (Sprint 3)</div></div>
                      <span className="font-mono text-xs text-primary-bright">00:00 / {fmtMs((b.endMs ?? 0) - (b.startMs ?? 0))}</span>
                    </div>
                    <div className="mt-3 flex h-16 items-center gap-[2px] px-1">
                      {Array.from({ length: 96 }).map((_, k) => <div key={k} className="flex-1 rounded-sm bg-primary/40" style={{ height: `${20 + Math.abs(Math.sin(k * 0.6) * 70)}%` }} />)}
                    </div>
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between"><span className="label-mono text-muted">Cenas & B-rolls mapeados no Ato {b.act}</span><button className="font-mono text-[11px] text-primary-bright">+ Adicionar Ponto de Corte</button></div>
                <div className="mt-2 rounded border border-dashed border-line p-4 text-center text-xs text-muted">Sprint 3: o Auto-Hunter divide o ato em cenas de {format.cutPace.min}–{format.cutPace.max}s e busca mídia em Pexels/Pixabay ou gera com IA.</div>
              </Card>
            ))}
          </div>

          <aside className="space-y-4">
            <Card className="p-4">
              <div className="flex items-center justify-between"><h3 className="font-display font-semibold"><Icon name="mic" className="mr-1 align-middle text-primary-bright" />Locução (Voiceover Engine)</h3><Badge tone="cyan">Gemini TTS</Badge></div>
              <div className="mt-3 rounded border border-line bg-void/60 p-3">
                <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded bg-secondary/30 text-secondary-soft"><Icon name="record_voice_over" /></span><div className="text-sm"><div className="font-semibold">Charon · Sombrio & Investigativo</div><div className="font-mono text-[11px] text-muted">gemini-tts · pt-BR</div></div></div>
                {[["Estabilidade Neural", 85], ["Clareza & Similaridade", 90], ["Exagero Emocional", 15]].map(([l, v]) => (
                  <div key={String(l)} className="mt-3"><div className="flex justify-between font-mono text-[11px]"><span className="text-fg-secondary">{l}</span><span className="text-primary-bright">{v}%</span></div><Progress value={Number(v)} className="mt-1" /></div>
                ))}
              </div>
              <div className="label-mono mt-4 text-muted">Vozes alternativas</div>
              {["Kore · Narradora Misteriosa", "Fenrir · Documentarista Profundo", "Edge TTS · Antônio (fallback grátis)"].map((v) => <div key={v} className="mt-1.5 flex items-center justify-between rounded border border-line bg-void/40 px-3 py-2 text-xs"><span>{v}</span><span className="font-mono text-[10px] text-muted">Trocar</span></div>)}
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between"><h3 className="font-display font-semibold"><Icon name="movie_filter" className="mr-1 align-middle text-primary-bright" />Curadoria & B-Roll IA</h3><Badge tone="violet">Auto-Hunter</Badge></div>
              <div className="mt-3 grid grid-cols-2 gap-2"><Stat label="Clipes atribuídos" value="0 / 0" sub="0% cobertura" /><Stat label="Cache de mídia" value="0 MB" sub="pasta storage/" tone="fg" /></div>
              <div className="label-mono mt-4 text-muted">Distribuição das fontes</div>
              <div className="mt-2 flex h-2 overflow-hidden rounded-full"><div className="w-2/3 bg-primary" /><div className="w-1/3 bg-secondary" /></div>
              <div className="mt-1 flex justify-between font-mono text-[10px] text-muted"><span>67% Acervo (Pexels/Pixabay)</span><span>33% IA</span></div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between"><h3 className="font-display font-semibold"><Icon name="verified" className="mr-1 align-middle text-primary-bright" />Quality & Retention Check</h3><span className="font-mono text-xs text-primary-bright">—/100</span></div>
              <ul className="mt-3 space-y-2 text-xs text-fg-secondary">
                <li className="flex gap-2"><Icon name="check_circle" className="text-[16px] text-success" />Licenças das fontes verificadas (atribuição registrada)</li>
                <li className="flex gap-2"><Icon name="check_circle" className="text-[16px] text-success" />Legendas sincronizadas via Whisper (FFmpeg)</li>
                <li className="flex gap-2"><Icon name="check_circle" className="text-[16px] text-success" />Loudness normalizado a -14 LUFS</li>
              </ul>
            </Card>
          </aside>
        </div>

        <Card className="mt-6 flex items-center gap-4 p-4">
          <Icon name="task_alt" className="text-primary-bright" />
          <div className="flex-1 text-sm"><div className="font-semibold">Cenas e áudio prontos para composição</div><div className="text-xs text-fg-secondary">Tudo pronto para a composição final no motor de renderização (FFmpeg).</div></div>
          <Button icon="save" disabled>Salvar Configuração</Button>
          <form action={advanceStage.bind(null, project.id)}><Button type="submit" variant="primary" iconRight="arrow_forward">Avançar para Passo 4: Render & Export</Button></form>
        </Card>
      </main>
    </>
  );
}
