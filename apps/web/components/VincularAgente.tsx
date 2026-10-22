"use client";
import { useState } from "react";
import { Button, Card, Icon } from "@vincere-studio/ui";
import { PainelVincularCerebro } from "./PainelVincularCerebro";

/**
 * Vincular a IA da própria pessoa (Claude Code, Antigravity, Codex, Hermes ou uma LLM por chave). Ela vira o cérebro do
 * Vince e executa as edições. Quem prefere trabalhar por fora, num terminal, só precisa colar a instrução abaixo:
 * o guia /AGENTES.md explica a ferramenta, as funções e as regras de conduta.
 */
export function VincularAgente() {
  const [copiado, setCopiado] = useState(false);
  const instrucao = () =>
    `Leia ${window.location.origin}/AGENTES.md e siga o guia: ele explica o Vincere Studio, as telas, o pipeline, ` +
    `como editar projetos no HyperFrames e as regras de conduta. Depois me pergunte o que vamos criar.`;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(instrucao());
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Sem permissão da área de transferência: o texto continua visível para copiar à mão.
    }
  };

  return (
    <Card className="p-5" id="agente">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold">
          <Icon name="smart_toy" className="mr-1 align-middle text-primary-bright" />Vincular a sua IA ao Vince
        </h3>
        <a href="/AGENTES.md" target="_blank" rel="noreferrer">
          <Button size="sm" variant="ghost" icon="description">Abrir o manual</Button>
        </a>
      </div>
      <p className="mt-1 text-xs text-fg-secondary">
        A IA que você vincular lê o manual da ferramenta e passa a ser o cérebro do Vince, que guia você, sugere skills e prompts e ajuda a editar.
        Ela edita os arquivos do projeto e o Studio recarrega sozinho; não precisa &quot;ver o navegador&quot;.
      </p>
      <div className="mt-3">
        <PainelVincularCerebro />
      </div>

      <div className="mt-4 rounded border border-dashed border-line p-3">
        <div className="font-mono text-[10px] uppercase tracking-wide text-muted">Prefere trabalhar por fora, no terminal?</div>
        <p className="mt-1 text-xs text-fg-secondary">
          Cole esta instrução no seu agente: ele lê o manual <code className="font-mono">/AGENTES.md</code> desta instância e sabe como usar a ferramenta.
        </p>
        <div className="mt-2">
          <Button size="sm" variant="primary" icon={copiado ? "check" : "content_copy"} onClick={copiar}>
            {copiado ? "Copiado!" : "Copiar instrução"}
          </Button>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-muted">
        Hermes: configure <code className="font-mono">HERMES_SSH_HOST</code> ou <code className="font-mono">HERMES_BIN</code> no <code className="font-mono">.env</code>;
        use um perfil dedicado ao Vincere, nunca o seu pessoal.
      </p>
    </Card>
  );
}
