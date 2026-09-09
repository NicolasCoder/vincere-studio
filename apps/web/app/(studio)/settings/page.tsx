import { COST_MODES } from "@docupulse/core";
import { Badge, Button, Card, Icon } from "@docupulse/ui";
import { Topbar } from "@/components/Topbar";
import { PageHeader } from "@/components/PageHeader";
import { ensureDefaultVoiceProfiles, getSettings, getUsageSummary, listJobs } from "@/lib/data";
import { enqueueDemoJob } from "./actions";
import { createVoiceProfile, deleteVoiceProfile, setDefaultVoiceProfile } from "./voice-actions";
import { prisma } from "@docupulse/db";
import { EdgeVoiceProvider } from "@docupulse/providers";
import { VoiceGallery } from "@/components/VoiceGallery";
import { JobWatcher } from "@/components/JobWatcher";

const PROVIDERS = [
  ["GEMINI_API_KEY", "Gemini API — texto e voz", "aistudio.google.com — nível gratuito, sem cobrança"],
  ["GEMINI_IMAGE_API_KEY", "Gemini API — imagens (Nano Banana)", "projeto com faturamento; usada só nos modos Híbrido/Premium"],
  ["PEXELS_API_KEY", "Pexels (fotos e vídeos de acervo)", "pexels.com/api — gratuito"],
  ["PIXABAY_API_KEY", "Pixabay (fotos, vídeos, música)", "pixabay.com/api — gratuito"],
  ["ELEVENLABS_API_KEY", "ElevenLabs (voz premium)", "elevenlabs.io → perfil → API Keys · 10k créditos/mês grátis"],
  ["CLOUDFLARE_API_TOKEN", "Cloudflare Workers AI (FLUX, imagens grátis)", "cota diária gratuita"],
];

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ job?: string }> }) {
  const { job } = await searchParams;
  await ensureDefaultVoiceProfiles();
  const [usage, settings, jobs, profiles] = await Promise.all([getUsageSummary(), getSettings(), listJobs(8), prisma.voiceProfile.findMany({ orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] })]);
  const edgeVoices = new EdgeVoiceProvider().voices();
  return (
    <>
      <Topbar crumbs={["Settings"]} costUsd={usage.costUsd} />
      <main className="space-y-6 p-6">
        <PageHeader icon="settings" title="Configurações" subtitle="Provedores, padrões do estúdio e teste do worker." />
        {job && <JobWatcher jobId={job} label="Gerando prévia de voz" />}
        <VoiceGallery back="/settings" busy={!!job} elevenProfiles={profiles.filter((p) => p.provider === "ELEVENLABS").map((p) => ({ voiceId: p.voiceId, name: p.name, style: p.style }))} />
        <Card className="p-5">
          <div className="flex items-center justify-between"><h3 className="font-display text-lg font-semibold"><Icon name="record_voice_over" className="mr-1 align-middle text-primary-bright" />Perfis de voz do canal</h3><Badge tone="cyan">{profiles.length} perfil(is)</Badge></div>
          <p className="mt-1 text-xs text-fg-secondary">A identidade de voz de um canal. O provedor principal grava; a reserva só entra se a principal falhar (cota/erro), e o app avisa para regravar depois.</p>
          <div className="mt-4 grid grid-cols-[1fr_22rem] gap-6">
            <div className="space-y-2">
              {profiles.map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded border border-line bg-void/40 p-3 text-sm">
                  <Icon name={p.isDefault ? "star" : "star_outline"} className={p.isDefault ? "text-warning" : "text-muted"} filled={p.isDefault} />
                  <div className="flex-1"><div className="font-semibold">{p.name}</div><div className="font-mono text-[11px] text-muted">{p.provider} / {p.voiceId} · {p.rate}x{p.style ? ` · “${p.style.slice(0, 60)}”` : ""}</div></div>
                  {!p.isDefault && <form action={setDefaultVoiceProfile.bind(null, p.id)}><Button type="submit" size="sm">Tornar padrão</Button></form>}
                  <form action={deleteVoiceProfile.bind(null, p.id)}><Button type="submit" variant="icon" icon="delete" className="hover:text-error" /></form>
                </div>
              ))}
              {!profiles.length && <div className="rounded border border-dashed border-line p-4 text-xs text-muted">Nenhum perfil. Crie um ao lado.</div>}
            </div>
            <form action={createVoiceProfile} className="space-y-2 rounded border border-line bg-void/40 p-3 text-sm">
              <div className="label-mono text-muted">Novo perfil</div>
              <input name="name" required placeholder="Nome (ex.: Narrador Dark)" className="field w-full px-3 py-2" />
              <select name="provider" className="field w-full px-3 py-2"><option value="GEMINI_TTS" className="bg-surface-low">Gemini TTS (free tier)</option><option value="EDGE_TTS" className="bg-surface-low">Edge TTS (grátis, sem chave)</option><option value="ELEVENLABS" className="bg-surface-low">ElevenLabs (premium · 10k créditos grátis/mês)</option></select>
              <input name="voiceId" list="voice-ids" placeholder="Voz: Charon · pt-BR-AntonioNeural · ou Voice ID do ElevenLabs" defaultValue="Charon" className="field w-full px-3 py-2" />
              <input name="fallbackVoiceId" placeholder="Voz de reserva equivalente (opcional)" className="field w-full px-3 py-2 text-xs" />
              <datalist id="voice-ids">{["Charon", "Fenrir", "Enceladus", "Orus", "Kore", "Aoede", "Leda", "Puck", ...edgeVoices.map((v) => v.id)].map((v) => <option key={v} value={v} />)}</datalist>
              <textarea name="style" rows={2} placeholder="Estilo (Gemini): ex. 'Narre em tom grave, lento e misterioso, como um documentário investigativo'" className="field w-full px-3 py-2 text-xs" />
              <div className="flex items-center gap-3"><label className="flex items-center gap-1 text-xs"><span className="label-mono text-muted">Velocidade</span><input name="rate" type="number" step="0.05" min="0.7" max="1.4" defaultValue="1" className="field w-16 px-2 py-1 text-xs" /></label><label className="flex items-center gap-1 text-xs"><input type="checkbox" name="isDefault" className="accent-primary" /> padrão</label></div>
              <Button type="submit" size="sm" variant="primary" icon="add" className="w-full">Criar perfil</Button>
            </form>
          </div>
        </Card>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
