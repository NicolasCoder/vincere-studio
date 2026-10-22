"use client";
import { useState } from "react";
import { Badge, Button, Card, Icon } from "@vincere-studio/ui";

interface AgenteDetectado {
  id: string;
  nome: string;
  disponivel: boolean;
  detalhe: string;
}

/**
 * Vincular o agente de IA da própria pessoa (Claude Code, Antigravity, Hermes, Codex...). Quem prefere
 * trabalhar por fora, num terminal, só precisa colar a instrução abaixo: o guia /AGENTES.md explica a
 * ferramenta, as funções e as regras de conduta.
 */
export function VincularAgente({ agentes }: { agentes: AgenteDetectado[] }) {
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
          <Icon name="smart_toy" className="mr-1 align-middle text-primary-bright" />Vincular agente de IA
        </h3>
        <a href="/AGENTES.md" target="_blank" rel="noreferrer">
          <Button size="sm" variant="ghost" icon="description">Abrir o guia</Button>
        </a>
      </div>
      <p className="mt-1 text-xs text-fg-secondary">
        Use o agente que você já tem. Ele edita os arquivos do projeto e o Studio recarrega sozinho; não precisa &quot;ver o navegador&quot;.
        Para trabalhar por fora, num terminal, cole a instrução abaixo no seu agente.
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {agentes.map((a) => (
          <div key={a.id} className="rounded border border-line bg-void/40 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{a.nome}</span>
              <Badge tone={a.disponivel ? "success" : "neutral"} pill dot>{a.disponivel ? "detectado" : "não encontrado"}</Badge>
            </div>
            <div className="mt-1 break-words font-mono text-[10px] text-muted">{a.detalhe}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded border border-dashed border-line p-3">
        <div className="font-mono text-[10px] uppercase tracking-wide text-muted">Instrução para colar no seu agente</div>
        <p className="mt-1 text-xs text-fg-secondary">
          Leia <code className="font-mono">/AGENTES.md</code> desta instância e siga o guia (ferramenta, telas, pipeline, HyperFrames e regras de conduta).
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
