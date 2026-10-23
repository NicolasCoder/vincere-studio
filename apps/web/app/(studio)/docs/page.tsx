import Link from "next/link";
import { Badge, Card, Icon } from "@vincere-studio/ui";
import { Topbar } from "@/components/Topbar";
import { PageHeader } from "@/components/PageHeader";
import { getUsageSummary } from "@/lib/data";

const ENDPOINTS_V1 = [
  { method: "GET", path: "/api/v1/capabilities", desc: "Manifesto da instância: motores ativos (Worker, HyperFrames, GPU RTX 3060, Flow), agentes CLI detectados, ações e runbooks." },
  { method: "GET", path: "/api/v1/runbooks", desc: "Lista todos os Runbooks executáveis com passos, ferramentas e verificadores medidos." },
  { method: "POST", path: "/api/v1/runbooks/evaluate", desc: "Avalia o progresso real de um projeto contra um Runbook e devolve o próximo passo exato." },
  { method: "GET / POST", path: "/api/v1/projects", desc: "Lista projetos ou cria um novo projeto com formato, nicho, idioma e meta de duração." },
  { method: "GET / PATCH / DELETE", path: "/api/v1/projects/[id]", desc: "Inspeciona a árvore completa do projeto, atualiza configurações ou remove com confirmação." },
  { method: "GET", path: "/api/v1/projects/[id]/state", desc: "Diagnóstico completo de estado, pendências e próximas ações liberadas/bloqueadas." },
  { method: "POST", path: "/api/v1/projects/[id]/content", desc: "Injeta conteúdo autoral direto do agente (ideias, roteiro em atos, cenas, plano de edição visual, SEO)." },
  { method: "POST", path: "/api/v1/projects/[id]/actions", desc: "Dispara ações pesadas do pipeline (voz, legendas, B-roll, imagens, render, thumbnail, aprovação, publicação)." },
  { method: "GET", path: "/api/v1/jobs/[id]/wait", desc: "Long-polling inteligente que aguarda o término do job sem loop manual de requisições." },
  { method: "GET / POST / PUT", path: "/api/v1/workflows", desc: "Lista, cria, edita o grafo de nós validado e executa fluxos de comercial/UGC." },
  { method: "GET / POST", path: "/api/claude", desc: "Envia pedidos para execução direta no agente CLI vinculado (Antigravity agy, Claude Code, Codex, Hermes)." },
];

export default async function DocsPage() {
  const usage = await getUsageSummary();
  return (
    <>
      <Topbar crumbs={["Central de Agentes & API"]} costUsd={usage.costUsd} />
      <main className="mx-auto max-w-6xl space-y-6 p-6">
        <PageHeader
          icon="smart_toy"
          title="Central Agente-Primeiro & Documentação"
          subtitle="Vincere Studio como caixa de ferramentas, memória, verificador e motor de execução para o seu Agente de IA."
          right={
            <div className="flex items-center gap-2">
              <a
                href="/AGENTES.md"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary-bright hover:bg-primary/20"
              >
                <Icon name="description" className="text-[16px]" />
                Abrir /AGENTES.md bruto
              </a>
              <Link
                href="/settings"
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-low px-3 py-1.5 text-xs text-fg-secondary hover:text-fg"
              >
                <Icon name="settings" className="text-[16px]" />
                Vincular Agente
              </Link>
            </div>
          }
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card className="space-y-2 p-5">
            <div className="flex items-center justify-between">
              <span className="font-display text-sm font-bold text-fg">1. O Agente Conduz</span>
              <Badge tone="cyan" pill>Cérebro Livre</Badge>
            </div>
            <p className="text-xs leading-relaxed text-fg-secondary">
              O seu agente (Antigravity <code>agy</code>, Claude Code, Codex ou Hermes) pode criar ideias, escrever o roteiro, definir cenas e enviar tudo pronto em <code>POST /api/v1/projects/[id]/content</code>, ou acionar os geradores internos sob demanda.
            </p>
          </Card>

          <Card className="space-y-2 p-5">
            <div className="flex items-center justify-between">
              <span className="font-display text-sm font-bold text-fg">2. Runbooks Verificados</span>
              <Badge tone="success" pill>6 Fluxos</Badge>
            </div>
            <p className="text-xs leading-relaxed text-fg-secondary">
              Cada estilo de vídeo tem um Runbook estruturado em <code>/api/v1/runbooks</code> com verificadores medidos (duração da voz, alinhamento de palavras, cobertura de B-roll, pré-voo e revisão de render).
            </p>
          </Card>

          <Card className="space-y-2 p-5">
            <div className="flex items-center justify-between">
              <span className="font-display text-sm font-bold text-fg">3. Servidor MCP & Vince</span>
              <Badge tone="violet" pill>MCP + Terminal</Badge>
            </div>
            <p className="text-xs leading-relaxed text-fg-secondary">
              Conecte via protocolo MCP (<code>node scripts/vincere-mcp-server.mjs</code>) ou use o botão do <strong>Vince</strong> na tela para disparar execuções de terminal no seu agente local sem abrir o prompt.
            </p>
          </Card>
        </div>

        <Card className="overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <h3 className="font-display text-base font-semibold text-fg">Contrato REST para Agentes (<code>/api/v1/*</code>)</h3>
            <p className="text-xs text-muted">Todas as rotas retornam JSON estruturado com <code>ok</code>, dados e instruções de próximo passo.</p>
          </div>
          <div className="divide-y divide-line text-xs">
            {ENDPOINTS_V1.map((ep) => (
              <div key={ep.path} className="flex flex-col gap-1.5 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="rounded border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-primary-bright">
                    {ep.method}
                  </span>
                  <code className="font-mono text-fg">{ep.path}</code>
                </div>
                <span className="text-fg-secondary sm:text-right">{ep.desc}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="space-y-3 p-5">
          <h3 className="font-display text-base font-semibold text-fg">Como conectar o Servidor MCP no seu Agente</h3>
          <p className="text-xs text-fg-secondary">
            Adicione o servidor MCP do Vincere Studio na configuração do Antigravity (<code>agy</code>), Claude Code ou Cursor para que o agente enxergue todas as ferramentas nativamente:
          </p>
          <pre className="overflow-x-auto rounded-lg border border-line bg-void p-4 font-mono text-xs text-fg-secondary">
{`{
  "mcpServers": {
    "vincere-studio": {
      "command": "node",
      "args": ["scripts/vincere-mcp-server.mjs"],
      "env": {
        "VINCERE_URL": "http://localhost:3210"
      }
    }
  }
}`}
          </pre>
        </Card>
      </main>
    </>
  );
}
