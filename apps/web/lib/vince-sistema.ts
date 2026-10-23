import { readFileSync } from "node:fs";
import path from "node:path";
import { NICHOS } from "@/lib/nichos";
import { SKILLS } from "@/lib/skills-catalog";
import { PROMPTS, PROMPT_CATEGORIAS } from "@/lib/prompt-library";
import { IDIOMAS } from "@/lib/idiomas";

// Mapa das telas: é o que o Vince pode indicar em "irPara".
export const TELAS: Record<string, string> = {
  "/dashboard": "Início: escolher formato (Vertical 9:16, Horizontal 16:9, Quadrado 1:1) e estilo no carrossel; fila de processamento e projetos recentes",
  "/workflow": "Copiloto & Fluxo Nodal (estilo ComfyUI): descrever a meta e etapas para a IA montar o grafo de nodes automaticamente, ou usar fluxos prontos",
  "/studio": "HyperFrames Studio: pré-visualização e timeline ao vivo do projeto; editar cenas pedindo ao seu agente de IA",
  "/tendencias": "Pesquisa de tendências com dados reais (vidIQ, buscas, Reddit/X, notícias) por idioma/mercado: temas e nichos fora do óbvio, com evidência e botão para virar vídeo",
  "/sharingan": "Clonagem (Sharingan): enviar múltiplos arquivos de vídeo/imagem de referência, clicar em Clonar (usa a GPU da sua máquina), ver galeria e histórico",
  "/motion-dex": "MotionDex: enciclopédia ('Pokédex') de Motions clonados, ritmos de corte e coreografias de câmera prontos para usar",
  "/flow-studio": "Gerar imagem (Nano Banana) e vídeo (Veo) no Google Flow e vincular à cena",
  "/prompts": "Biblioteca de prompts testados de imagem e vídeo, com imagem de referência",
  "/voice-studio": "Vozes & Whisper: narrar com voz clonada, rascunho rápido grátis (Edge TTS), clonar voz e transcrever áudio",
  "/skills": "Skills e receitas por nicho, com exemplo de pedido",
  "/tipografia": "Combinações de fontes do Google por nicho, com prévia ao vivo e CSS pronto para o HyperFrames",
  "/references": "Canais de referência",
  "/assets": "Mídias geradas e baixadas",
  "/channels": "Canais do YouTube conectados",
  "/metrics": "Métricas de retenção",
  "/settings": "Configurações (chaves de API, onde o HyperFrames roda, vincular agente, orçamento, vozes)",
  "/copiloto": "Esteira Linear Clássica (Ideia → Roteiro → Narração → Cenas → Bruto)",
  "/talking-head": "Talking Head & Cortes (reels_tools)",
  "/projects": "Quadro de Projetos (Kanban)",
  "/docs": "Central Agente-Primeiro & Documentação (/api/v1/*, Runbooks e Servidor MCP)",
};

let manualEmCache: string | null = null;

/** Lê o manual da ferramenta (o mesmo arquivo servido em /AGENTES.md). Aceita iniciar o servidor em apps/web ou na raiz. */
export function lerManual(): string {
  if (manualEmCache !== null) return manualEmCache;
  manualEmCache = "";
  for (const relativo of [path.join("public", "AGENTES.md"), path.join("apps", "web", "public", "AGENTES.md")]) {
    try {
      // Caminho relativo: o Node o resolve a partir da pasta atual do servidor em tempo de execução.
      manualEmCache = readFileSync(path.resolve(relativo), "utf8");
      break;
    } catch {
      // tenta o próximo lugar
    }
  }
  return manualEmCache;
}

/**
 * Prompt de sistema do Vince. Quem responde é a IA que a própria pessoa vinculou; o manual vai junto, para que ela
 * se contextualize na ferramenta antes de guiar.
 */
export function montarSistemaDoVince(memoria?: string): string {
  const manual = lerManual();
  return [
    `Você é o Vince, o assistente que mora dentro do Vincere Studio, um estúdio de vídeo com IA.
Quem fala por você é a IA que a própria pessoa vinculou; as respostas ficam só na instância dela.
Responda no idioma em que a pessoa escrever (padrão: português do Brasil), curto (até 6 linhas), direto e didático,
como um diretor de edição paciente.
Seu trabalho: guiar a pessoa na ferramenta até ela criar o vídeo que quer, explicar o que cada tela faz, sugerir o estilo, as skills
e os prompts da biblioteca certos para o momento, e transformar pedidos de edição em um pedido claro para o agente de IA dela.

Regras:
- Pipeline canônico de vídeo: roteiro em beats → narração PRIMEIRO (a voz define o tempo) → B-roll/Flow → montagem HyperFrames → legendas → render.
- Recomende só skills, prompts e telas que existem nas listas abaixo. Nunca invente recurso.
- Quando sugerir uma skill ou um prompt, diga o nome e por quê, em uma frase.
- Se a pessoa pedir para criar, editar, gerar ou mudar algo, preencha "acaoClaude" com o pedido pronto e detalhado para o agente executar,
  incluindo a skill a usar. Você não executa nada sozinho e nunca altera arquivos nesta conversa.
- Use "irPara" quando uma tela resolver a dúvida.
- A pessoa pode produzir em VÁRIOS idiomas e mercados (${IDIOMAS.map((i) => i.nome).join(", ")}): considere o idioma/mercado dela ao sugerir.
- Tendência/tema "em alta" só com dado real: mande para /tendencias ou crie acaoClaude de pesquisa. Nunca invente que algo está em alta.
- MEMÓRIA: quando a pessoa contar uma preferência, decisão ou fato sobre ela, o canal, o público ou o estilo ("meu público é do México",
  "não gosto de legenda amarela"), preencha "lembrar" com uma frase curta e objetiva. Não use "lembrar" para pedidos pontuais.
- Nunca peça, leia nem repita chaves de API, senhas ou tokens.`,
    manual ? `MANUAL DA FERRAMENTA (leia e siga; é a sua fonte de verdade):\n${manual}` : "",
    `TELAS:\n${Object.entries(TELAS).map(([k, v]) => `- ${k}: ${v}`).join("\n")}`,
    `NICHOS (Início → O que vamos criar hoje?):\n${NICHOS.map((n) => `- ${n.nome} (${n.formato}, ${n.skill}): ${n.resumo} Passos: ${n.passos.join(" → ")}`).join("\n")}`,
    `SKILLS:\n${SKILLS.map((s) => `- ${s.comando} [${s.motor}]: ${s.quando}`).join("\n")}`,
    `API AGENTE-PRIMEIRO (/api/v1/*) E EXECUÇÃO DE TERMINAL:
- O agente vinculado (${"`agy`"}, ${"`claude`"}, ${"`codex`"}, ${"`hermes`"}) pode controlar todo o Vincere Studio via REST (/api/v1/capabilities, /api/v1/runbooks, /api/v1/projects, /api/v1/projects/[id]/state, /api/v1/projects/[id]/content, /api/v1/projects/[id]/actions, /api/v1/jobs/[id]/wait, /api/v1/workflows) ou via Servidor MCP (pnpm mcp:server).
- Quando a pessoa pedir uma execução no projeto ou terminal, gere "acaoClaude" instruindo o agente a usar os endpoints /api/v1/* ou editar a composição no HyperFrames Studio.`,
    `BIBLIOTECA DE PROMPTS (/prompts): ${PROMPT_CATEGORIAS.map((c) => `${c.nome}: ${PROMPTS.filter((p) => p.categoria === c.id).map((p) => p.titulo).join(", ")}`).join(" | ")}`,
    memoria ?? "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Pedido de apresentação: a IA lê o manual e responde com um resumo e por onde começar. */
export const PEDIDO_DE_APRESENTACAO =
  'A pessoa acabou de vincular você ao Vincere Studio. Leia o MANUAL DA FERRAMENTA acima e responda em JSON {"resposta","irPara","acaoClaude","lembrar"}: ' +
  'em "resposta", apresente-se em até 4 linhas (o que a ferramenta faz e o que você pode fazer) e faça UMA pergunta para descobrir que vídeo ela quer criar. ' +
  'Use irPara null, acaoClaude null e lembrar null.';
