import { Badge, Button, Card, Icon } from "@vincere-studio/ui";
import type { CanalMonitorado, Ponto } from "@/lib/canais-stats";
import { adicionarCanal, atualizarCanais, removerCanal } from "./actions";

const compacto = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const n = (v: number | null | undefined) => (v == null ? "—" : compacto.format(v));

/** Linha mínima: a tendência de uma série, sem eixos (o número ao lado conta o resto). */
function Linha({ valores }: { valores: number[] }) {
  if (valores.length < 2) return <p className="text-[11px] text-muted">O histórico começa hoje; atualize outros dias para ver a curva.</p>;
  const w = 220, h = 44, min = Math.min(...valores), max = Math.max(...valores), span = max - min || 1;
  const pts = valores.map((v, i) => `${((i / (valores.length - 1)) * w).toFixed(1)},${(h - 4 - ((v - min) / span) * (h - 8)).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-11 w-full" role="img" aria-label="Evolução de inscritos">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" className="text-primary-bright" />
    </svg>
  );
}

/** Barras dos últimos vídeos (do mais antigo ao mais novo), cada uma proporcional às views. */
function Barras({ valores, titulos }: { valores: number[]; titulos: string[] }) {
  if (!valores.length) return <p className="text-[11px] text-muted">Sem vídeos recentes para mostrar.</p>;
  const w = 220, h = 56, max = Math.max(...valores, 1), largura = w / valores.length;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-14 w-full" role="img" aria-label="Views dos últimos vídeos">
      {valores.map((v, i) => {
        const alt = Math.max(2, (v / max) * (h - 4));
        return (
          <rect key={i} x={i * largura + 2} y={h - alt} width={largura - 4} height={alt} rx="2" className="fill-primary/60">
            <title>{`${titulos[i]} — ${compacto.format(v)} views`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

function variacao(pontos: Ponto[]): string | null {
  const a = pontos.find((p) => p.inscritos != null);
  const b = [...pontos].reverse().find((p) => p.inscritos != null);
  if (!a || !b || a === b) return null;
  const d = (b.inscritos ?? 0) - (a.inscritos ?? 0);
  return `${d >= 0 ? "+" : ""}${compacto.format(d)} desde ${new Date(a.t).toLocaleDateString("pt-BR")}`;
}

export function CanaisDashboard({ canais, temChave, aviso }: { canais: CanalMonitorado[]; temChave: boolean; aviso?: string }) {
  const ordenados = canais.filter((c) => c.cache.stats?.inscritos != null).sort((a, b) => (b.cache.stats!.inscritos ?? 0) - (a.cache.stats!.inscritos ?? 0));
  const maior = ordenados[0]?.cache.stats?.inscritos ?? 1;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Canais</h2>
          <p className="text-xs text-muted">Seu canal e os concorrentes, lado a lado. Os números são públicos do YouTube.</p>
        </div>
        <form action={atualizarCanais}>
          <Button type="submit" icon="refresh" variant="outline" disabled={!temChave || canais.length === 0}>Atualizar dados</Button>
        </form>
      </div>

      {!temChave && (
        <div className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          Falta a chave <code className="font-mono">YOUTUBE_API_KEY</code> no servidor (gratuita: Google Cloud → YouTube Data API v3 → Credenciais → Chave de API).
        </div>
      )}
      {aviso && <div className="rounded border border-line bg-surface-low px-3 py-2 text-xs text-fg-secondary">{aviso}</div>}

      {ordenados.length > 1 && (
        <Card className="space-y-2 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Inscritos por canal</h3>
          {ordenados.map((c) => (
            <div key={c.ref} className="flex items-center gap-3 text-xs">
              <span className="w-36 shrink-0 truncate">{c.cache.stats!.nome}</span>
              <div className="h-2 flex-1 overflow-hidden rounded bg-surface-low">
                <div className={`h-full rounded ${c.proprio ? "bg-primary-bright" : "bg-primary/50"}`} style={{ width: `${Math.max(2, ((c.cache.stats!.inscritos ?? 0) / maior) * 100)}%` }} />
              </div>
              <span className="w-14 text-right font-mono">{n(c.cache.stats!.inscritos)}</span>
            </div>
          ))}
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {canais.map((c) => {
          const s = c.cache.stats;
          const delta = variacao(c.cache.pontos);
          return (
            <Card key={c.ref} className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {(s?.avatar ?? c.avatarSalvo) ? <img src={(s?.avatar ?? c.avatarSalvo)!} alt="" className="size-10 shrink-0 rounded-full object-cover" /> : <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-low"><Icon name="smart_display" /></span>}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{s?.nome ?? c.nomeSalvo ?? c.url}</p>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <Badge>{c.proprio ? "Meu canal" : (c.nicho ?? "Concorrente")}</Badge>
                    </div>
                  </div>
                </div>
                {c.refId && (
                  <form action={removerCanal.bind(null, c.refId)}>
                    <button type="submit" title="Parar de monitorar" className="text-muted hover:text-fg"><Icon name="close" className="text-[16px]" /></button>
                  </form>
                )}
              </div>
              {c.cache.erro && <p className="text-[11px] text-amber-300">{c.cache.erro}</p>}
              {s ? (
                <>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div><p className="font-mono text-lg font-semibold">{n(s.inscritos)}</p><p className="text-[10px] uppercase text-muted">inscritos</p></div>
                    <div><p className="font-mono text-lg font-semibold">{n(s.views)}</p><p className="text-[10px] uppercase text-muted">views</p></div>
                    <div><p className="font-mono text-lg font-semibold">{n(s.videos)}</p><p className="text-[10px] uppercase text-muted">vídeos</p></div>
                  </div>
                  <div>
                    <p className="mb-1 flex justify-between text-[10px] uppercase text-muted"><span>Inscritos ao longo do tempo</span><span className="normal-case">{delta}</span></p>
                    <Linha valores={c.cache.pontos.filter((p) => p.inscritos != null).map((p) => p.inscritos!)} />
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] uppercase text-muted">Views dos últimos {s.recentes.length} vídeos</p>
                    <Barras valores={[...s.recentes].reverse().map((v) => v.views)} titulos={[...s.recentes].reverse().map((v) => v.titulo)} />
                  </div>
                  <p className="text-[10px] text-muted">Atualizado em {new Date(s.atualizadoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</p>
                </>
              ) : (
                <p className="text-xs text-muted">Sem números ainda. {temChave ? "Clique em “Atualizar dados”." : "Configure a chave do YouTube."}</p>
              )}
            </Card>
          );
        })}
      </div>

      <Card className="p-4">
        <form action={adicionarCanal} className="grid gap-3 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
          <label className="block text-xs text-fg-secondary">Adicionar canal (concorrente ou inspiração)
            <input name="url" required placeholder="https://www.youtube.com/@canal" className="mt-1 w-full rounded border border-line bg-surface-low px-3 py-2 text-sm text-fg" />
          </label>
          <label className="block text-xs text-fg-secondary">Nicho
            <input name="nicho" placeholder="ex.: Mistério" className="mt-1 w-full rounded border border-line bg-surface-low px-3 py-2 text-sm text-fg" />
          </label>
          <Button type="submit" variant="primary" icon="add">Adicionar</Button>
        </form>
      </Card>
    </section>
  );
}
