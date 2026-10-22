import { Badge, Button, Card, Icon } from "@vincere-studio/ui";
import type { AlvoHyperframes } from "@/lib/hyperframes-config";
import { salvarHyperframesAction, testarHyperframesAction } from "@/app/(studio)/settings/hf-actions";

/**
 * Escolha de onde o HyperFrames roda: neste computador ou num servidor da própria pessoa. Vale só para
 * esta instância; quem roda o Vincere escolhe o que for melhor para a máquina dela.
 */
export function HyperframesOnde({ alvo, aviso }: { alvo: AlvoHyperframes; aviso?: { tipo: "ok" | "erro"; texto: string } }) {
  const remoto = alvo.modo === "remoto";
  return (
    <Card className="p-5" id="hyperframes">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold">
          <Icon name="movie_filter" className="mr-1 align-middle text-primary-bright" />Onde o HyperFrames roda
        </h3>
        <Badge tone="cyan" pill dot>{remoto ? "no meu servidor" : "neste computador"}</Badge>
      </div>
      <p className="mt-1 text-xs text-fg-secondary">
        Escolha o que for melhor para a sua máquina. Computador forte: rode aqui. Computador fraco: use um servidor seu.
        Você também pode usar o HyperFrames fora do Vincere; aqui é só onde o Vincere o encontra.
      </p>
      {aviso && (
        <div className={`mt-3 rounded border px-3 py-2 text-xs ${aviso.tipo === "ok" ? "border-success/40 bg-success/10 text-success" : "border-warning/40 bg-warning/10 text-warning"}`}>
          {aviso.texto}
        </div>
      )}

      <form action={salvarHyperframesAction} className="mt-3 space-y-3">
        <label className="flex cursor-pointer items-start gap-2 rounded border border-line bg-void/40 p-3">
          <input type="radio" name="modo" value="local" defaultChecked={!remoto} className="mt-1" />
          <span>
            <span className="block text-sm font-semibold">Neste computador</span>
            <span className="block text-[11px] text-fg-secondary">O Vincere inicia o preview sozinho ao abrir o Studio (porta {alvo.modo === "local" ? alvo.port : 3010}).</span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2 rounded border border-line bg-void/40 p-3">
          <input type="radio" name="modo" value="remoto" defaultChecked={remoto} className="mt-1" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">No meu servidor</span>
            <span className="block text-[11px] text-fg-secondary">Você instala o HyperFrames no seu servidor e informa o endereço dele abaixo.</span>
            <input
              name="url"
              type="text"
              autoComplete="off"
              spellCheck={false}
              defaultValue={alvo.url ?? ""}
              placeholder="http://127.0.0.1:3010"
              className="field mt-2 h-8 w-full px-2 text-xs"
            />
          </span>
        </label>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" variant="primary" icon="save">Salvar</Button>
          <Button type="submit" size="sm" variant="ghost" icon="bolt" formAction={testarHyperframesAction}>Testar conexão</Button>
        </div>
      </form>

      <details className="mt-3 rounded border border-dashed border-line p-3 text-xs text-fg-secondary">
        <summary className="cursor-pointer font-semibold text-fg">Como ligar o HyperFrames do meu servidor</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-4">
          <li>No servidor, instale e deixe o preview rodando na pasta dos seus projetos: <code className="font-mono">npm i -g hyperframes</code> e <code className="font-mono">hyperframes preview --foreground --port 3010 --no-open</code> (use o <code className="font-mono">pm2</code> para mantê-lo ligado).</li>
          <li>O preview <strong>não tem senha</strong>: não abra a porta na internet. Neste computador, abra um túnel: <code className="font-mono">ssh -N -L 3010:127.0.0.1:3010 usuario@seu-servidor</code>.</li>
          <li>Informe o endereço <code className="font-mono">http://127.0.0.1:3010</code> acima, salve e clique em <strong>Testar conexão</strong>.</li>
        </ol>
      </details>
    </Card>
  );
}
