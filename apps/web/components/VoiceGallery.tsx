import { existsSync } from "node:fs";
import path from "node:path";
import { EdgeVoiceProvider, GeminiVoiceProvider, storageRoot } from "@docupulse/providers";
import { Badge, Button, Card, Icon } from "@docupulse/ui";
import { previewVoice } from "@/app/(studio)/settings/preview-actions";

const STYLE_DEFAULT = "Narre em português do Brasil, tom grave, ritmo lento e misterioso, como um documentário investigativo de alta produção.";

/** Galeria de vozes com prévia: lista Gemini, Edge e ElevenLabs (perfis cadastrados). */
export function VoiceGallery({ back, busy, elevenProfiles = [] }: { back: string; busy?: boolean; elevenProfiles?: { voiceId: string; name: string; style: string }[] }) {
  const root = storageRoot();
  const gemini = new GeminiVoiceProvider(process.env.GEMINI_API_KEY || "x").voices();
  const edge = new EdgeVoiceProvider().voices();
  const groups: { provider: string; title: string; note: string; voices: { id: string; label: string; description?: string; gender?: string; style?: string }[] }[] = [
    { provider: "GEMINI_TTS", title: "Gemini TTS", note: "free tier · controlado por instrução de estilo", voices: gemini },
    { provider: "EDGE_TTS", title: "Edge TTS", note: "grátis, sem chave, sem estilo por instrução", voices: edge },
    { provider: "ELEVENLABS", title: "ElevenLabs", note: process.env.ELEVENLABS_API_KEY ? "premium · 10k créditos/mês grátis" : "configure ELEVENLABS_API_KEY", voices: elevenProfiles.map((p) => ({ id: p.voiceId, label: p.name, description: p.voiceId, style: p.style })) },
  ];
  return (
    <Card className="p-5" id="vozes">
      <div className="flex items-center justify-between"><h3 className="font-display text-lg font-semibold"><Icon name="graphic_eq" className="mr-1 align-middle text-primary-bright" />Galeria de vozes</h3><span className="font-mono text-[10px] text-muted">Prévia: frase de teste do nicho (~12s)</span></div>
      {groups.map((g) => (
        <div key={g.provider} className="mt-4">
          <div className="flex items-center gap-2"><Badge tone={g.provider === "GEMINI_TTS" ? "cyan" : g.provider === "EDGE_TTS" ? "neutral" : "violet"}>{g.title}</Badge><span className="font-mono text-[10px] text-muted">{g.note}</span></div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {g.voices.length === 0 && <div className="col-span-3 rounded border border-dashed border-line p-3 text-xs text-muted">Cadastre um perfil ElevenLabs (com o Voice ID) para ele aparecer aqui.</div>}
            {g.voices.map((v) => {
              const file = path.join(root, "previews", `${g.provider}__${v.id.replace(/[^\w.-]/g, "_")}.wav`);
              const mp3 = file.replace(/\.wav$/, ".mp3");
              const has = existsSync(file) ? file : existsSync(mp3) ? mp3 : null;
              const rel = has ? `previews/${path.basename(has)}` : null;
              return (
                <div key={v.id} className="rounded border border-line bg-void/40 p-2">
                  <div className="flex items-center justify-between"><span className="truncate text-sm font-semibold">{v.label}</span>{v.gender && <span className="font-mono text-[9px] text-muted">{v.gender === "f" ? "fem" : "masc"}</span>}</div>
                  {v.description && <div className="truncate text-[11px] text-fg-secondary">{v.description}</div>}
                  <div className="mt-2 flex items-center gap-2">
                    {rel ? <audio controls preload="none" src={`/api/media/${rel}`} className="h-8 flex-1" /> : <span className="flex-1 font-mono text-[10px] text-muted">sem prévia</span>}
                    <form action={previewVoice.bind(null, g.provider, v.id, v.style ?? (g.provider === "GEMINI_TTS" ? STYLE_DEFAULT : ""), back)}>
                      <Button type="submit" size="sm" variant="icon" icon={rel ? "refresh" : "play_circle"} title={rel ? "Regerar prévia" : "Gerar prévia"} disabled={busy} />
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </Card>
  );
}
