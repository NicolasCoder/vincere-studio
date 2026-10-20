import Link from "next/link";
import { prisma } from "@vincere-studio/db";
import { FORMATS, type RetentionResult, type VideoFormat } from "@vincere-studio/core";
import { Badge, Button, Card, Chip, Icon, Stat } from "@vincere-studio/ui";
import { loadProjectShell } from "@/components/ProjectShell";
import { JobWatcher } from "@/components/JobWatcher";
import { BlockEditor } from "@/components/BlockEditor";
import { fmtDuration, fmtMs, parseJson } from "@/lib/data";
import { advanceStage } from "../../actions";
import { addBlock, deleteBlock, generateScript, moveBlock, requestSuggestions, restoreVersion, rewriteBlock, saveBlock, splitBlock } from "./actions";

const KIND_LABEL: Record<string, string> = { HOOK: "Hook de Retenção Máxima", CONTEXT: "Contexto & Tensão", ESCALATION: "Desenvolvimento & Escalada", REVEAL: "Revelação", CLIMAX: "Clímax", RESOLUTION: "Resolução", CTA: "Chamada para Ação" };
type Suggestion = { id: string; act: number; severity: "high" | "medium" | "low"; issue: string; fix: string; instruction: string; blockId: string | null };

export default async function ScriptPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ blocked?: string; job?: string; v?: string }> }) {
  const { id } = await params;
  const { blocked, job, v } = await searchParams;
  const { project, header, busy } = await loadProjectShell(id, "SCRIPT", blocked, job);
  const format = FORMATS[project.format as VideoFormat];
  const versions = await prisma.script.findMany({ where: { projectId: id }, orderBy: { version: "desc" }, select: { id: true, version: true, createdAt: true, wordCount: true } });
  const latest = versions[0];
  const viewingId = v ? versions.find((s) => s.id === v)?.id ?? latest?.id : latest?.id;
  const script = viewingId ? await prisma.script.findUnique({ where: { id: viewingId }, include: { blocks: { orderBy: { order: "asc" } } } }) : null;
  const isLatest = !!script && script.id === latest?.id;
  const curve = parseJson<number[]>(script?.retentionCurve, []);
  const metrics = parseJson<Partial<RetentionResult>>(script?.metrics, {});
  const suggestions = parseJson<Suggestion[]>(script?.suggestions, []);
  const idea = project.ideas.find((i) => i.selected);

  return (
    <>
      {header}
      <main className="p-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="cyan">{script ? `Ato 1 a ${script.blocks.length} montados` : "Sem roteiro"}</Badge>
              <Badge tone="violet">Dark Documentary Engine</Badge>
              <Badge tone="neutral">{format.label}</Badge>
              {script && <Badge tone="neutral">v{script.version}{isLatest ? " · atual" : " · histórico"}</Badge>}
            </div>
            <h1 className="mt-3 max-w-3xl font-display text-3xl font-semibold leading-tight"><span className="gradient-text">{project.title}</span></h1>
            {script?.logline && <p className="mt-1 max-w-3xl text-sm text-fg-secondary">{script.logline}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <Chip icon="timer">{fmtDuration(script?.estimatedDuration ?? project.targetDuration)}</Chip>
              <Chip icon="theater_comedy">Tom: {project.tone ?? "livre"}</Chip>
              <Chip icon="view_agenda">{script?.blocks.length ?? 0} Atos</Chip>
              <Chip icon="trending_up" active>Retenção Prevista: {metrics.predicted ?? "—"}/100</Chip>
              <Chip icon="notes">{(script?.wordCount ?? 0).toLocaleString("pt-BR")} Palavras</Chip>
              {script?.model && <Chip icon="memory">{script.model}</Chip>}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <form action={generateScript.bind(null, project.id)}>
                <Button type="submit" icon="auto_fix_high" disabled={busy || !idea} title={idea ? "Gera uma nova versão do roteiro" : "Selecione uma ideia no Passo 1"}>
                  {script ? "Regenerar IA (nova versão)" : "Gerar Roteiro com IA"}
                </Button>
              </form>
            </div>
            <form action={advanceStage.bind(null, project.id)}>
              <Button type="submit" variant="primary" iconRight="arrow_forward" className="w-full" disabled={busy || !script}>Avançar para Passo 3</Button>
            </form>
          </div>
        </div>

        {job && <div className="mt-4"><JobWatcher jobId={job} label="Motor de roteiro trabalhando" /></div>}

        <div className="mt-6 grid grid-cols-[1fr_22rem] gap-6">
          <div className="space-y-4">
            <Card className="flex items-center gap-2 p-3">
              {script && isLatest && <form action={addBlock.bind(null, project.id, script.id)}><Button type="submit" size="sm" variant="primary" icon="add" disabled={busy}>Adicionar Bloco</Button></form>}
              {script && isLatest && <form action={requestSuggestions.bind(null, project.id, script.id)}><Button type="submit" size="sm" icon="psychology" disabled={busy}>Analisar retenção (IA)</Button></form>}
              <Button size="sm" icon="subtitles" disabled>Teleprompter</Button>
              <div className="ml-auto flex items-center gap-1">
                <span className="label-mono mr-1 text-muted">Versões:</span>
                {versions.map((s) => (
                  <Link key={s.id} href={`?v=${s.id}`} className={`rounded-sm border px-2 py-0.5 font-mono text-[10px] ${s.id === script?.id ? "border-primary/50 bg-primary/10 text-primary-bright" : "border-line text-fg-secondary hover:text-fg"}`} title={`${s.wordCount} palavras · ${new Date(s.createdAt).toLocaleString("pt-BR")}`}>
                    v{s.version}
                  </Link>
                ))}
                {script && !isLatest && <form action={restoreVersion.bind(null, project.id, script.id)}><Button type="submit" size="sm" icon="history">Restaurar como nova versão</Button></form>}
              </div>
            </Card>

            {!script && !job && (
              <Card className="p-10 text-center text-sm text-muted">
                {idea ? <>Ideia selecionada: <span className="text-fg">“{idea.title}”</span>. Clique em <span className="text-primary-bright">Gerar Roteiro com IA</span> para escrever os {format.structure.acts} atos.</> : "Selecione uma ideia no Passo 1 para gerar o roteiro."}
              </Card>
            )}

            {script?.blocks.map((b, i) => {
              const sug = suggestions.filter((s) => s.blockId === b.id);
              return (
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
                      <span className="font-mono text-[11px] text-fg-secondary">{b.narration.replace(/\[[^\]]*\]/g, " ").trim().split(/\s+/).filter(Boolean).length} palavras</span>
                      <Badge tone="cyan">{b.wpm} WPM</Badge>
                      {b.retentionScore != null && <Badge tone={b.retentionScore >= 80 ? "success" : b.retentionScore >= 65 ? "cyan" : "warning"}>{b.retentionScore}% retenção</Badge>}
                    </div>
                  </div>
                  <div className="mt-4 rounded border border-line bg-void/60 p-4">
                    <div className="label-mono mb-2 flex items-center justify-between text-muted"><span><Icon name="graphic_eq" className="mr-1 text-[12px]" />Locução (Neural Vox)</span><span className="normal-case tracking-normal">{b.note ? `IA: ${b.note}` : `Modo de leitura: ${b.wpm} WPM`}</span></div>
                    <BlockEditor narration={b.narration} title={b.title} action={saveBlock.bind(null, project.id, b.id)} disabled={busy || !isLatest} />
                  </div>
                  {(b.brollCue || b.soundCue) && (
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {b.brollCue && <Cue icon="videocam" label="Visual / B-Roll Cue" text={b.brollCue} />}
                      {b.soundCue && <Cue icon="music_note" label="Sound Design Cue" text={b.soundCue} />}
                    </div>
                  )}
                  {sug.map((s) => (
                    <div key={s.id} className="mt-3 flex items-start gap-3 rounded border border-warning/40 bg-warning/10 p-3 text-xs">
                      <Icon name="warning" className="text-[16px] text-warning" />
                      <div className="flex-1"><div className="font-semibold text-warning">{s.issue}</div><div className="mt-0.5 text-fg-secondary">{s.fix}</div></div>
                      {isLatest && <form action={rewriteBlock.bind(null, project.id, b.id, "custom", s.instruction)}><Button type="submit" size="sm" variant="primary" disabled={busy}>Aplicar correção</Button></form>}
                    </div>
                  ))}
                  {isLatest && (
                    <div className="mt-3 flex items-center gap-2">
                      <form action={rewriteBlock.bind(null, project.id, b.id, "rewrite", "")}><Chip icon="auto_fix_high" type="submit" disabled={busy}>Reescrever com IA</Chip></form>
                      <form action={rewriteBlock.bind(null, project.id, b.id, "intense", "")}><Chip icon="whatshot" type="submit" disabled={busy}>Mais Intenso</Chip></form>
                      <form action={rewriteBlock.bind(null, project.id, b.id, "question", "")}><Chip icon="help" type="submit" disabled={busy}>Inserir Pergunta Retórica</Chip></form>
                      <form action={rewriteBlock.bind(null, project.id, b.id, "shorten", "")}><Chip icon="compress" type="submit" disabled={busy}>Encurtar</Chip></form>
                      <form action={splitBlock.bind(null, project.id, b.id)}><Chip icon="call_split" type="submit" disabled={busy}>Dividir Bloco</Chip></form>
                      <span className="ml-auto flex gap-1">
                        <form action={moveBlock.bind(null, project.id, b.id, -1)}><Button type="submit" variant="icon" icon="arrow_upward" disabled={busy || i === 0} /></form>
                        <form action={moveBlock.bind(null, project.id, b.id, 1)}><Button type="submit" variant="icon" icon="arrow_downward" disabled={busy || i === script.blocks.length - 1} /></form>
                        <form action={deleteBlock.bind(null, project.id, b.id)}><Button type="submit" variant="icon" icon="delete" disabled={busy} className="hover:text-error" /></form>
                      </span>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          <aside className="space-y-4">
            <Card className="p-4">
              <div className="flex items-center justify-between"><h3 className="font-display font-semibold"><Icon name="show_chart" className="mr-1 align-middle text-primary-bright" />Curva de Retenção</h3><Badge tone="cyan">Heurística v0</Badge></div>
              <p className="mt-1 text-xs text-fg-secondary">Pontua cada bloco por perguntas, pausas, concretude e tamanho de frase; decai ao longo do vídeo. Calibra com o YouTube Analytics na Sprint 6.</p>
              <div className="mt-3 flex h-24 items-end gap-1 rounded border border-line bg-void/60 p-2">
                {(curve.length ? curve : Array(12).fill(0)).map((v, i) => <div key={i} className="flex-1 rounded-sm bg-gradient-to-t from-primary/40 to-primary-bright" style={{ height: `${v}%` }} title={`${v}%`} />)}
              </div>
              <div className="mt-1 flex justify-between font-mono text-[10px] text-muted"><span>00:00 (Hook)</span><span>meio</span><span>fim</span></div>
            </Card>
            <Card className="p-4">
              <h3 className="font-display font-semibold">Métricas do Roteiro</h3>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Stat label="Ritmo (Pacing)" value={metrics.pacing ?? "—"} sub={metrics.avgSentence ? `${metrics.avgSentence} palavras/frase` : "—"} />
                <Stat label="Cortes B-Roll" value={`${format.cutPace.min}–${format.cutPace.max}s`} sub="Taxa ideal de troca" tone="fg" />
                <Stat label="Perguntas" value={metrics.questions ?? "—"} sub="retóricas no texto" tone="violet" />
                <Stat label="Clímax" value={metrics.climaxCount ?? "—"} sub="Hook + revelações" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between"><h3 className="font-display font-semibold">Sugestões IA</h3><Badge tone="cyan">{suggestions.length} {suggestions.length === 1 ? "pendente" : "pendentes"}</Badge></div>
              {suggestions.length === 0 ? (
                <p className="mt-2 text-xs text-fg-secondary">Clique em "Analisar retenção (IA)" para o editor sênior apontar quedas de ritmo e propor correções aplicáveis com um clique.</p>
              ) : (
                <ul className="mt-3 space-y-2 text-xs">
                  {suggestions.map((s) => <li key={s.id} className="rounded border border-line bg-void/60 p-2"><span className={`label-mono ${s.severity === "high" ? "text-error" : s.severity === "medium" ? "text-warning" : "text-fg-secondary"}`}>Ato {s.act} · {s.severity}</span><div className="mt-0.5">{s.issue}</div></li>)}
                </ul>
              )}
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between"><h3 className="font-display font-semibold">Voz do Canal</h3><span className="font-mono text-[10px] text-muted">Sprint 3</span></div>
              <div className="mt-3 flex items-center gap-3 rounded border border-line bg-void/60 p-3">
                <span className="grid size-10 place-items-center rounded bg-secondary/30 text-secondary-soft"><Icon name="record_voice_over" /></span>
                <div className="text-sm"><div className="font-semibold">Perfil de voz padrão</div><div className="font-mono text-[11px] text-muted">Gemini TTS → reserva Edge TTS</div></div>
              </div>
            </Card>
          </aside>
        </div>

        <Card className="mt-6 flex items-center gap-4 p-4">
          <Icon name="sync" className="text-primary-bright" />
          <div className="flex-1 text-sm"><div className="font-semibold">Edições salvas no SQLite a cada ação</div><div className="text-xs text-fg-secondary">Ao avançar, o pipeline sintetiza a voz por bloco e minera o B-roll a partir dos cues.</div></div>
          <form action={advanceStage.bind(null, project.id)}><Button type="submit" variant="primary" iconRight="arrow_forward" disabled={busy || !script}>Avançar para Passo 3: Voiceover & B-Roll</Button></form>
        </Card>
      </main>
    </>
  );
}

function Cue({ icon, label, text }: { icon: string; label: string; text: string }) {
  return (
    <div className="flex gap-3 rounded border border-line bg-void/40 p-3">
      <span className="grid size-10 shrink-0 place-items-center rounded bg-line/40 text-primary-bright"><Icon name={icon} /></span>
      <div className="min-w-0"><div className="label-mono text-primary-bright">{label}</div><div className="mt-0.5 text-xs text-fg-secondary">{text}</div></div>
    </div>
  );
}
