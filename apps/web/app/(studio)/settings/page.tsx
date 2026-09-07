import { COST_MODES } from "@docupulse/core";
import { Badge, Button, Card, Icon } from "@docupulse/ui";
import { Topbar } from "@/components/Topbar";
import { PageHeader } from "@/components/PageHeader";
import { getSettings, getUsageSummary, listJobs } from "@/lib/data";
import { enqueueDemoJob } from "./actions";

const PROVIDERS = [
  ["GEMINI_API_KEY", "Gemini API (texto, imagem, TTS)", "aistudio.google.com — free tier"],
  ["PEXELS_API_KEY", "Pexels (fotos e vídeos de acervo)", "pexels.com/api — gratuito"],
  ["PIXABAY_API_KEY", "Pixabay (fotos, vídeos, música)", "pixabay.com/api — gratuito"],
  ["CLOUDFLARE_API_TOKEN", "Cloudflare Workers AI (FLUX, imagens grátis)", "cota diária gratuita"],
];

export default async function SettingsPage() {
  const [usage, settings, jobs] = await Promise.all([getUsageSummary(), getSettings(), listJobs(8)]);
  return (
    <>
      <Topbar crumbs={["Settings"]} costUsd={usage.costUsd} />
      <main className="space-y-6 p-6">
        <PageHeader icon="settings" title="Configurações" subtitle="Provedores, padrões do estúdio e teste do worker." />
        <div className="grid grid-cols-2 gap-6">
          <Card className="p-5">
            <h3 className="font-display text-lg font-semibold">Provedores (chaves no .env)</h3>
            <p className="mt-1 text-xs text-fg-secondary">As chaves ficam no arquivo <code>.env</code> na raiz. Esta tela mostra se cada uma está presente.</p>
            <div className="mt-4 space-y-2">
              {PROVIDERS.map(([k, n, h]) => {
                const set = !!process.env[k];
                return <div key={k} className="flex items-center gap-3 rounded border border-line bg-void/40 p-3 text-sm"><Icon name={set ? "check_circle" : "radio_button_unchecked"} className={set ? "text-success" : "text-muted"} /><div className="flex-1"><div className="font-medium">{n}</div><div className="font-mono text-[11px] text-muted">{k} · {h}</div></div><Badge tone={set ? "success" : "neutral"}>{set ? "OK" : "vazio"}</Badge></div>;
              })}
            </div>
          </Card>
          <div className="space-y-6">
            <Card className="p-5">
              <h3 className="font-display text-lg font-semibold">Padrões do estúdio</h3>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between rounded border border-line bg-void/40 p-3"><span>Modo de custo padrão</span><span className="font-mono text-primary-bright">{COST_MODES[(settings.defaultCostMode as keyof typeof COST_MODES) ?? "FREE"]?.label ?? "Gratuito"}</span></div>
                <div className="flex justify-between rounded border border-line bg-void/40 p-3"><span>Voz padrão</span><span className="font-mono text-primary-bright">{settings.defaultVoice ?? "gemini:Charon"}</span></div>
                <div className="flex justify-between rounded border border-line bg-void/40 p-3"><span>Pasta de mídia</span><span className="font-mono text-primary-bright">{process.env.STORAGE_DIR ?? "./storage"}</span></div>
              </div>
            </Card>
            <Card className="p-5">
              <div className="flex items-center justify-between"><h3 className="font-display text-lg font-semibold">Worker & fila de jobs</h3><form action={enqueueDemoJob}><Button type="submit" variant="primary" size="sm" icon="play_arrow">Enfileirar job de teste</Button></form></div>
              <p className="mt-1 text-xs text-fg-secondary">O worker (<code>apps/worker</code>) precisa estar rodando (<code>pnpm dev</code> sobe os dois). Recarregue para ver o progresso.</p>
              <div className="mt-3 divide-y divide-line rounded border border-line bg-void/40">
                {jobs.length === 0 && <div className="p-3 text-xs text-muted">Nenhum job.</div>}
                {jobs.map((j) => <div key={j.id} className="flex items-center gap-3 p-3 font-mono text-xs"><Badge tone={j.status === "DONE" ? "success" : j.status === "FAILED" ? "error" : j.status === "RUNNING" ? "cyan" : "neutral"}>{j.status}</Badge><span className="flex-1">{j.type} · {j.message ?? "—"}</span><span className="text-primary-bright">{j.progress}%</span></div>)}
              </div>
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}
