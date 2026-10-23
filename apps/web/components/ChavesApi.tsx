import { Badge, Button, Card, Icon } from "@vincere-studio/ui";
import type { StatusChave } from "@vincere-studio/providers";
import { removerChaveAction, salvarChaveAction, testarChaveAction } from "@/app/(studio)/settings/keys-actions";

const GRUPOS: { id: StatusChave["grupo"]; titulo: string; icone: string }[] = [
  { id: "texto", titulo: "Texto: ideias e roteiro", icone: "edit_note" },
  { id: "midia", titulo: "Imagens e B-roll", icone: "photo_library" },
  { id: "voz", titulo: "Voz", icone: "record_voice_over" },
  { id: "youtube", titulo: "YouTube", icone: "smart_display" },
];

/**
 * Chaves de API da própria pessoa. Ao clicar em "Salvar", a chave é sincronizada em 3 lugares locais:
 *   1. No banco SQLite local (Setting)
 *   2. No ambiente em tempo real (Web e Worker passam a usar no mesmo segundo, sem reiniciar)
 *   3. Direto no arquivo .env local da máquina (ignorado pelo Git para blindagem Open Source)
 */
export function ChavesApi({ chaves, aviso }: { chaves: StatusChave[]; aviso?: { tipo: "ok" | "erro"; texto: string } }) {
  return (
    <Card className="p-5" id="chaves">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold">
            <Icon name="key" className="mr-1 align-middle text-primary-bright" />Chaves de API
          </h3>
          <p className="mt-1 max-w-2xl text-xs text-fg-secondary">
            Cada pessoa usa as próprias chaves localmente. Ao salvar, a chave é gravada no banco SQLite (<code className="font-mono text-[10px]">Setting</code>),
            ativada em tempo real na Web/Worker sem reiniciar e sincronizada direto no seu arquivo <code className="font-mono text-[10px]">.env</code> local (protegido pelo <code className="font-mono text-[10px]">.gitignore</code>).
          </p>
        </div>
        <a
          href="/api/settings/download-env-example"
          download=".env.example"
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded border border-line bg-void/60 px-3 text-xs font-semibold text-fg-secondary transition-colors hover:border-primary/50 hover:text-fg"
          title="Baixar cópia limpa e zerada do .env.example"
        >
          <Icon name="download" className="text-[15px] text-primary-bright" />
          Baixar .env zerado
        </a>
      </div>

      {aviso && (
        <div className={`mt-3 rounded border px-3 py-2 text-xs ${aviso.tipo === "ok" ? "border-success/40 bg-success/10 text-success" : "border-warning/40 bg-warning/10 text-warning"}`}>
          {aviso.texto}
        </div>
      )}
      {GRUPOS.map((g) => {
        const itens = chaves.filter((c) => c.grupo === g.id);
        if (itens.length === 0) return null;
        return (
          <div key={g.id} className="mt-4">
            <div className="flex items-center gap-1 text-sm font-semibold"><Icon name={g.icone} className="text-[16px] text-primary-bright" />{g.titulo}</div>
            <div className="mt-2 space-y-2">
              {itens.map((c) => (
                <div key={c.name} id={`chave-${c.name}`} className="rounded border border-line bg-void/40 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">{c.label}</div>
                      <div className="font-mono text-[10px] text-muted">{c.name} · {c.ajuda}</div>
                    </div>
                    <Badge tone={c.configurada ? "success" : "neutral"} pill dot>
                      {c.configurada ? (c.origem === "app" ? "salva (Banco + .env)" : "ativa no .env") : "não configurada"}
                    </Badge>
                  </div>
                  {c.configurada && <div className="mt-1 break-all font-mono text-[11px] text-fg-secondary">{c.exibicao}</div>}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <form action={salvarChaveAction} className="flex min-w-0 flex-1 items-center gap-2">
                      <input type="hidden" name="name" value={c.name} />
                      <input
                        name="value"
                        type={c.segredo ? "password" : "text"}
                        autoComplete="off"
                        spellCheck={false}
                        placeholder={c.configurada ? "Colar um novo valor para substituir" : "Colar aqui"}
                        className="field h-8 min-w-0 flex-1 px-2 text-xs"
                      />
                      <Button type="submit" size="sm" variant="primary" icon="save">Salvar</Button>
                    </form>
                    {c.name === "GEMINI_API_KEY" && c.configurada && (
                      <form action={testarChaveAction}>
                        <input type="hidden" name="name" value={c.name} />
                        <Button type="submit" size="sm" variant="ghost" icon="bolt">Testar</Button>
                      </form>
                    )}
                    {c.configurada && (
                      <form action={removerChaveAction}>
                        <input type="hidden" name="name" value={c.name} />
                        <Button type="submit" size="sm" variant="ghost" icon="delete">Remover</Button>
                      </form>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </Card>
  );
}
