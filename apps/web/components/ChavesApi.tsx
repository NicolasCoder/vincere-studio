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
 * Chaves de API da própria pessoa. Ficam guardadas só no banco desta instância e passam a valer na hora
 * (web e worker), sem editar o .env e sem reiniciar. O valor nunca volta inteiro para a tela.
 */
export function ChavesApi({ chaves, aviso }: { chaves: StatusChave[]; aviso?: { tipo: "ok" | "erro"; texto: string } }) {
  return (
    <Card className="p-5" id="chaves">
      <h3 className="font-display text-lg font-semibold">
        <Icon name="key" className="mr-1 align-middle text-primary-bright" />Chaves de API
      </h3>
      <p className="mt-1 text-xs text-fg-secondary">
        Cada pessoa usa as próprias chaves. Elas ficam guardadas só no banco desta instância e valem na hora.
        Salvar a chave do Gemini já habilita ideias, roteiro e voz.
      </p>
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
                <div key={c.name} className="rounded border border-line bg-void/40 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">{c.label}</div>
                      <div className="font-mono text-[10px] text-muted">{c.name} · {c.ajuda}</div>
                    </div>
                    <Badge tone={c.configurada ? "success" : "neutral"} pill dot>
                      {c.configurada ? (c.origem === "app" ? "salva aqui" : "vem do .env") : "não configurada"}
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
                    {c.origem === "app" && (
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
