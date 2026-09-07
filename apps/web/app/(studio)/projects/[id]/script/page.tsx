import { FORMATS, type VideoFormat } from "@docupulse/core";
import { Badge, Button, Card, Chip, Icon, Stat } from "@docupulse/ui";
import { loadProjectShell } from "@/components/ProjectShell";
import { fmtDuration, fmtMs, parseJson } from "@/lib/data";
import { advanceStage } from "../../actions";

const KIND_LABEL: Record<string, string> = { HOOK: "Hook de Retenção Máxima", CONTEXT: "Contexto Histórico & Tensão", ESCALATION: "Desenvolvimento & Escalada", CLIMAX: "Clímax", RESOLUTION: "Resolução", REVEAL: "Revelação", CTA: "Chamada para Ação" };

export default async function ScriptPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ blocked?: string }> }) {
  const { id } = await params;
  const { blocked } = await searchParams;
  const { project, header } = await loadProjectShell(id, "SCRIPT", blocked);
  const format = FORMATS[project.format as VideoFormat];
  const script = project.scripts[0];
  const curve = parseJson<number[]>(script?.retentionCurve, []);
  const words = script?.wordCount ?? 0;

  return (
    <>
      {header}
      <main className="p-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="cyan">Ato 1 a {format.structure.acts} montados</Badge>
              <Badge tone="violet">Dark Documentary Engine</Badge>
              <Badge tone="neutral">{format.label}</Badge>
            </div>
            <h1 className="mt-3 max-w-3xl font-display text-3xl font-semibold leading-tight">
              <span className="gradient-text">{project.title}</span>
            </h1>
            <div className="mt-3 flex flex-wrap gap-2">
              <Chip icon="timer">{fmtDuration(script?.estimatedDuration ?? project.targetDuration)}</Chip>
              <Chip icon="theater_comedy">Tom: {project.tone}</Chip>
              <Chip icon="view_agenda">{script?.blocks.length ?? 0} Atos</Chip>
              <Chip icon="trending_up" active>Retenção Prevista: {curve.length ? Math.round(curve.reduce((a, b) => a + b, 0) / curve.length) : "—"}/100</Chip>
              <Chip icon="notes">{words.toLocaleString("pt-BR")} Palavras</Chip>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Button icon="auto_fix_high" disabled title="Sprint 2">Regenerar IA</Button>
              <Button variant="icon" icon="history" />
              <Button variant="icon" icon="download" />
            </div>
            <form action={advanceStage.bind(null, project.id)}>
              <Button type="submit" variant="primary" iconRight="arrow_forward" className="w-full">Avançar para Passo 3</Button>
            </form>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-[1fr_22rem] gap-6">
          <div className="space-y-4">
            <Card className="flex items-center gap-2 p-3">
              <Button size="sm" variant="primary" icon="add" disabled>Adicionar Bloco</Button>
              <Button size="sm" icon="tune" disabled>Auto-Ajustar Ritmo</Button>
              <Button size="sm" icon="subtitles" disabled>Teleprompter</Button>
              <span className="ml-auto label-mono text-muted">Exibir: Todos os Atos (1 ao {format.structure.acts})</span>
            </Card>

            {!script && <Card className="p-10 text-center text-sm text-muted">Sem roteiro ainda. Na Sprint 2 o motor gera os {format.structure.acts} atos a partir da ideia selecionada.</Card>}

            {script?.blocks.map((b) => (
              <Card key={b.id} accent={b.kind === "HOOK" ? "cyan" : "violet"} className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <Badge tone={b.kind === "HOOK" ? "cyan" : "violet"}>[{KIND_LABEL[b.kind] ?? b.kind}]</Badge>
                    <div className="mt-2 flex items-center gap-3">
                      <span className="font-display font-semibold">Ato {b.act}: {b.title}</span>
                      <span className="font-mono text-[11px] text-muted">{fmtMs(b.startMs)} → {fmtMs(b.endMs)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-right">
                    <span className="font-mono text-[11px] text-fg-secondary">{b.narration.split(/\s+/).length} palavras</span>
                    <Badge tone="cyan">{b.wpm} WPM</Badge>
                  </div>
                </div>
                <div className="mt-4 rounded border border-line bg-void/60 p-4">
                  <div className="label-mono mb-2 flex items-center justify-between text-muted"><span><Icon name="graphic_eq" className="mr-1 text-[12px]" />Locução (Neural Vox)</span><span className="normal-case tracking-normal">Modo de leitura: {b.wpm} WPM</span></div>
                  <p className="text-[15px] leading-relaxed text-fg">
                    {b.narration.split(/(\[[^\]]+\])/).map((part, i) =>
                      part.startsWith("[") ? <span key={i} className="mx-1 rounded-sm bg-secondary/20 px-1.5 font-mono text-[11px] text-secondary-soft">{part}</span> : <span key={i}>{part}</span>,
                    )}
                  </p>
                </div>
                {(b.brollCue || b.soundCue) && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    {b.brollCue && <Cue icon="videocam" label="Visual / B-Roll Cue" text={b.brollCue} />}
                    {b.soundCue && <Cue icon="music_note" label="Sound Design Cue" text={b.soundCue} />}
                  </div>
                )}
                <div className="mt-3 flex items-center gap-2">
                  <Chip icon="auto_fix_high">Reescrever com IA</Chip>
                  <Chip icon="whatshot">Mais Intenso</Chip>
                  <Chip icon="call_split">Dividir Bloco</Chip>
                  <span className="ml-auto flex gap-1 text-muted"><Icon name="arrow_upward" className="text-[16px]" /><Icon name="arrow_downward" className="text-[16px]" /><Icon name="delete" className="text-[16px]" /></span>
                </div>
              </Card>
            ))}
            {script && <button className="w-full rounded border border-dashed border-line py-3 text-sm text-fg-secondary hover:border-line-glow hover:text-fg"><Icon name="add_circle" className="mr-2 align-middle text-[18px]" />Adicionar Novo Bloco de Roteiro <kbd className="ml-2 font-mono text-[10px] text-muted">Shift + Enter</kbd></button>}
          </div>

          <aside className="space-y-4">
            <Card className="p-4">
              <div className="flex items-center justify-between"><h3 className="font-display font-semibold"><Icon name="show_chart" className="mr-1 align-middle text-primary-bright" />Curva de Retenção IA</h3><Badge tone="cyan">Heurística v0</Badge></div>
              <p className="mt-1 text-xs text-fg-secondary">Sprint 2: estimativa por posição dos hooks, densidade de perguntas e tamanho de frase; calibrada depois com as métricas reais do canal.</p>
              <div className="mt-3 flex h-24 items-end gap-1 rounded border border-line bg-void/60 p-2">
                {(curve.length ? curve : Array(12).fill(40)).map((v, i) => <div key={i} className="flex-1 rounded-sm bg-gradient-to-t from-primary/40 to-primary-bright" style={{ height: `${v}%` }} />)}
              </div>
              <div className="mt-1 flex justify-between font-mono text-[10px] text-muted"><span>00:00 (Hook)</span><span>Clímax</span><span>Fim</span></div>
            </Card>
            <Card className="p-4">
              <h3 className="font-display font-semibold">Métricas do Roteiro</h3>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Stat label="Ritmo (Pacing)" value={script ? 94 : "—"} sub="Ótimo p/ Dark Niche" />
                <Stat label="Cortes B-Roll" value={`${format.cutPace.min}–${format.cutPace.max}s`} sub="Taxa ideal de troca" tone="fg" />
                <Stat label="Vocabulário" value="Hipnótico" sub="Alta fluidez neural" tone="violet" />
                <Stat label="Clímax" value={script?.blocks.filter((b) => b.kind === "CLIMAX" || b.kind === "HOOK").length ?? 0} sub="Distribuídos" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between"><h3 className="font-display font-semibold">Sugestões IA</h3><Badge tone="cyan">Sprint 2</Badge></div>
              <div className="mt-3 rounded border border-line bg-void/60 p-3 text-xs">
                <div className="label-mono text-warning"><Icon name="warning" className="mr-1 text-[12px]" />Evitar queda de retenção</div>
                <p className="mt-1 text-fg-secondary">Adicionar micro-pergunta retórica no Ato 2 (aos 02:10) para evitar evasão de 7% prevista da audiência.</p>
                <Button size="sm" className="mt-2" disabled>Aplicar Correção</Button>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between"><h3 className="font-display font-semibold">Voz IA Sugerida</h3><span className="font-mono text-[10px] text-muted">Gemini TTS</span></div>
              <div className="mt-3 flex items-center gap-3 rounded border border-line bg-void/60 p-3">
                <span className="grid size-10 place-items-center rounded bg-secondary/30 text-secondary-soft"><Icon name="record_voice_over" /></span>
                <div className="text-sm"><div className="font-semibold">Charon · Sombrio & Profundo</div><div className="font-mono text-[11px] text-muted">Português BR (Investigativo)</div></div>
              </div>
            </Card>
          </aside>
        </div>

        <Card className="mt-6 flex items-center gap-4 p-4">
          <Icon name="sync" className="text-primary-bright" />
          <div className="flex-1 text-sm"><div className="font-semibold">Passo 2 Ativo: Alterações salvas localmente no SQLite</div><div className="text-xs text-fg-secondary">Ao confirmar, o pipeline disparará a síntese de voz e a mineração de B-roll.</div></div>
          <Button icon="save" disabled>Salvar Rascunho</Button>
          <form action={advanceStage.bind(null, project.id)}><Button type="submit" variant="primary" iconRight="arrow_forward">Avançar para Passo 3: Voiceover & B-Roll</Button></form>
        </Card>
      </main>
    </>
  );
}

function Cue({ icon, label, text }: { icon: string; label: string; text: string }) {
  return (
    <div className="flex gap-3 rounded border border-line bg-void/40 p-3">
      <span className="grid size-10 shrink-0 place-items-center rounded bg-line/40 text-primary-bright"><Icon name={icon} /></span>
      <div className="min-w-0"><div className="label-mono text-primary-bright">{label}</div><div className="mt-0.5 truncate text-xs text-fg-secondary">{text}</div></div>
    </div>
  );
}
