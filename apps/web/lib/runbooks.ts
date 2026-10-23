import { computeProjectAgentState, type ProjectAgentState } from "./agent-api";

export interface RunbookStepSpec {
  id: string;
  ordem: number;
  titulo: string;
  executor: "agente" | "worker" | "hibrido" | "humano";
  endpoint: string;
  metodo: "POST" | "GET" | "PUT";
  descricao: string;
  criterioSucesso: string;
  exemploPayload?: Record<string, unknown>;
}

export interface RunbookSpec {
  id: string;
  nome: string;
  nicho: string;
  formato: "SHORT_9_16" | "LONG_16_9" | "QUALQUER";
  motorVisual: "HyperFrames" | "FFmpeg+HyperFrames" | "Sharingan+HyperFrames" | "Workflow";
  resumo: string;
  entradas: string[];
  gatesHumanos: string[];
  passos: RunbookStepSpec[];
}

export interface RunbookStepEvaluation {
  id: string;
  ordem: number;
  titulo: string;
  executor: string;
  passou: boolean;
  evidencia: string;
  comoExecutar: {
    metodo: string;
    endpoint: string;
    payload?: Record<string, unknown>;
  };
}

export interface RunbookEvaluationResult {
  runbookId: string;
  runbookNome: string;
  projectId: string;
  projectTitle: string;
  concluido: boolean;
  progressoPercent: number;
  passosConcluidos: number;
  totalPassos: number;
  proximoPasso: RunbookStepEvaluation | null;
  passos: RunbookStepEvaluation[];
}

export const RUNBOOKS: RunbookSpec[] = [
  {
    id: "curiosidades-short-9x16",
    nome: "Short de Curiosidades / Alta Retenção (9:16 · 45–60s)",
    nicho: "curiosidades",
    formato: "SHORT_9_16",
    motorVisual: "FFmpeg+HyperFrames",
    resumo:
      "Fluxo rápido para Shorts verticais com gancho forte nos primeiros 3s, 4 a 6 atos curtos, narração sincronizada, legendas alinhadas por palavra, B-roll dinâmico e composição HyperFrames.",
    entradas: ["tema", "tom", "duracaoAlvoSeg"],
    gatesHumanos: ["aprovar_render", "publicar_youtube"],
    passos: [
      {
        id: "ideia",
        ordem: 1,
        titulo: "Definir ou selecionar ideia com gancho de 3s",
        executor: "hibrido",
        metodo: "POST",
        endpoint: "/api/v1/projects/:id/content",
        descricao: "O agente envia a ideia escolhida (kind: 'ideas') ou dispara gerar_ideias.",
        criterioSucesso: "Pelo menos 1 ideia selecionada no projeto.",
        exemploPayload: {
          kind: "ideas",
          ideas: [
            {
              title: "Por que o Oceano Pacífico tem um ponto onde ninguém vive?",
              synopsis: "O Ponto Nemo está mais perto da Estação Espacial Internacional do que de qualquer continente.",
              hookLines: ["Você está mais perto de astronautas no espaço do que de qualquer ser humano na Terra."],
              selected: true,
            },
          ],
        },
      },
      {
        id: "roteiro",
        ordem: 2,
        titulo: "Escrever roteiro enxuto em 4–6 atos (HOOK → CONTEXT → REVEAL → CTA)",
        executor: "hibrido",
        metodo: "POST",
        endpoint: "/api/v1/projects/:id/content",
        descricao: "O agente entrega os blocos de narração e pistas de B-roll (kind: 'script') ou chama gerar_roteiro.",
        criterioSucesso: "Roteiro salvo com >= 3 blocos e duração estimada entre 25s e 110s.",
        exemploPayload: {
          kind: "script",
          blocks: [
            { act: 1, kind: "HOOK", title: "O lugar mais solitário", narration: "Existe um ponto no oceano onde os humanos mais próximos estão no espaço." },
            { act: 2, kind: "CONTEXT", title: "Ponto Nemo", narration: "A 2.688 quilômetros de qualquer costa, o Ponto Nemo é o polo oceânico de inacessibilidade." },
            { act: 3, kind: "REVEAL", title: "Cemitério Espacial", narration: "É lá que as agências espaciais derrubam satélites e estações desativadas." },
          ],
        },
      },
      {
        id: "voz",
        ordem: 3,
        titulo: "Sintetizar narração para todos os atos",
        executor: "worker",
        metodo: "POST",
        endpoint: "/api/v1/projects/:id/actions",
        descricao: "Sintetiza a voz (Edge TTS gratuito, Gemini TTS ou VoiceStudio GPU) para cada bloco.",
        criterioSucesso: "Todos os atos possuem faixa de áudio (VoiceTrack) com duração > 0ms.",
        exemploPayload: { action: "sintetizar_voz", force: false },
      },
      {
        id: "legendas",
        ordem: 4,
        titulo: "Alinhar timestamps palavra por palavra",
        executor: "worker",
        metodo: "POST",
        endpoint: "/api/v1/projects/:id/actions",
        descricao: "Roda Faster-Whisper na GPU (ou alinhamento acústico) para gerar Caption.words.",
        criterioSucesso: "Todos os atos narrados possuem palavras alinhadas com startMs/endMs.",
        exemploPayload: { action: "alinhar_legendas" },
      },
      {
        id: "cenas",
        ordem: 5,
        titulo: "Planejar cenas visuais e buscar B-roll",
        executor: "hibrido",
        metodo: "POST",
        endpoint: "/api/v1/projects/:id/content",
        descricao: "O agente injeta cenas (kind: 'scenes') ou chama planejar_cenas + buscar_broll.",
        criterioSucesso: "Pelo menos 1 cena criada para o roteiro.",
        exemploPayload: { action: "planejar_cenas", density: "dense" },
      },
      {
        id: "composicao_ou_render",
        ordem: 6,
        titulo: "Exportar composição para o HyperFrames Studio ou renderizar MP4",
        executor: "worker",
        metodo: "POST",
        endpoint: "/api/v1/projects/:id/actions",
        descricao: "Gera o projeto HTML5/GSAP no HyperFrames Studio (exportar_hyperframes) ou o master MP4 (renderizar_video).",
        criterioSucesso: "Projeto HyperFrames gerado em Videos-HF ou RenderJob concluído com arquivo de saída.",
        exemploPayload: { action: "exportar_hyperframes", dispatchAgent: false },
      },
    ],
  },
  {
    id: "dossie-documentario-16x9",
    nome: "Documentário Investigativo / Dossiê Dark (16:9 · 6 Atos)",
    nicho: "dossie",
    formato: "LONG_16_9",
    motorVisual: "FFmpeg+HyperFrames",
    resumo:
      "Produção completa de documentário investigativo em 16:9 com 6 atos estruturados, locução séria, legendas alinhadas, B-roll de arquivo, plano de edição visual (lower-thirds/dados) e composição HyperFrames.",
    entradas: ["tema", "fontes", "duracaoAlvoSeg"],
    gatesHumanos: ["aprovar_render", "publicar_youtube"],
    passos: [
      {
        id: "ideia",
        ordem: 1,
        titulo: "Selecionar tese e ângulo investigativo",
        executor: "hibrido",
        metodo: "POST",
        endpoint: "/api/v1/projects/:id/content",
        descricao: "Definir a ideia central com alto CTR e promessa clara de investigação.",
        criterioSucesso: "Ideia selecionada no projeto.",
      },
      {
        id: "roteiro",
        ordem: 2,
        titulo: "Construir roteiro documental em atos",
        executor: "hibrido",
        metodo: "POST",
        endpoint: "/api/v1/projects/:id/content",
        descricao: "Criar os blocos do roteiro com pistas visuais de arquivo e desenho de som.",
        criterioSucesso: "Roteiro com blocos salvos no banco.",
      },
      {
        id: "voz",
        ordem: 3,
        titulo: "Sintetizar locução documental",
        executor: "worker",
        metodo: "POST",
        endpoint: "/api/v1/projects/:id/actions",
        descricao: "Gerar faixas de voz de todos os atos.",
        criterioSucesso: "100% dos atos com áudio sintetizado.",
        exemploPayload: { action: "sintetizar_voz" },
      },
      {
        id: "legendas",
        ordem: 4,
        titulo: "Alinhar transcrição palavra por palavra",
        executor: "worker",
        metodo: "POST",
        endpoint: "/api/v1/projects/:id/actions",
        descricao: "Gerar timecodes exatos para legendas e gatilhos de lower-thirds.",
        criterioSucesso: "100% dos atos com legendas alinhadas.",
        exemploPayload: { action: "alinhar_legendas" },
      },
      {
        id: "cenas",
        ordem: 5,
        titulo: "Planejar cenas e coletar B-roll",
        executor: "hibrido",
        metodo: "POST",
        endpoint: "/api/v1/projects/:id/actions",
        descricao: "Planejar cenas e baixar mídias de apoio.",
        criterioSucesso: "Cenas criadas para os atos.",
        exemploPayload: { action: "planejar_cenas", density: "dense" },
      },
      {
        id: "plano_edicao",
        ordem: 6,
        titulo: "Criar Plano de Edição Visual (lower-thirds, dados e dossiê)",
        executor: "hibrido",
        metodo: "POST",
        endpoint: "/api/v1/projects/:id/content",
        descricao: "Injetar plano de edição (kind: 'edit_plan') ou rodar gerar_plano_edicao.",
        criterioSucesso: "EditPlan criado com >= 1 inserção visual.",
        exemploPayload: { action: "gerar_plano_edicao" },
      },
      {
        id: "composicao_ou_render",
        ordem: 7,
        titulo: "Exportar para HyperFrames Studio ou renderizar master",
        executor: "worker",
        metodo: "POST",
        endpoint: "/api/v1/projects/:id/actions",
        descricao: "Montar composição HyperFrames ou renderizar MP4 + thumbnail.",
        criterioSucesso: "Projeto HyperFrames exportado ou RenderJob concluído.",
        exemploPayload: { action: "exportar_hyperframes" },
      },
    ],
  },
  {
    id: "hyperframes-motion-pure",
    nome: "Composição Direta no HyperFrames Studio (HTML5 + GSAP)",
    nicho: "motion",
    formato: "QUALQUER",
    motorVisual: "HyperFrames",
    resumo:
      "Criação direta de peça de motion design ou vídeo completo em HTML5 + GSAP dentro de Videos-HF, com timeline sincronizada em window.__timelines['main'] e preview ao vivo.",
    entradas: ["nomeProjeto", "formato", "roteiroOuBeats"],
    gatesHumanos: ["aprovar_previa_studio"],
    passos: [
      {
        id: "roteiro",
        ordem: 1,
        titulo: "Estruturar beats no projeto",
        executor: "agente",
        metodo: "POST",
        endpoint: "/api/v1/projects/:id/content",
        descricao: "Enviar os beats/atos que compõem a timeline do vídeo.",
        criterioSucesso: "Pelo menos 1 bloco de roteiro salvo.",
      },
      {
        id: "exportar_hf",
        ordem: 2,
        titulo: "Gerar projeto HTML5/GSAP no HyperFrames Studio",
        executor: "worker",
        metodo: "POST",
        endpoint: "/api/v1/projects/:id/actions",
        descricao: "Cria a pasta em Videos-HF com index.html e timeline GSAP pronta para o agente lapidar.",
        criterioSucesso: "Arquivo index.html criado na pasta do projeto HyperFrames.",
        exemploPayload: { action: "exportar_hyperframes", dispatchAgent: false },
      },
    ],
  },
  {
    id: "clone-motion-sharingan",
    nome: "Clonagem Óptica Video-Sharingan + HyperFrames (GPU Local)",
    nicho: "motion",
    formato: "SHORT_9_16",
    motorVisual: "Sharingan+HyperFrames",
    resumo:
      "Engenharia reversa de vídeo de referência usando os 4 passes de visão local (Qwen2.5-VL-7B na RTX 3060) + recriação em HTML5/GSAP validada pelos 12 Portões de Qualidade.",
    entradas: ["refVideoPath", "visionMode"],
    gatesHumanos: ["aprovar_comparativo_qc"],
    passos: [
      {
        id: "analisar_referencia",
        ordem: 1,
        titulo: "Extrair DNA óptico e especificação VLM local",
        executor: "worker",
        metodo: "POST",
        endpoint: "/api/sharingan",
        descricao: "Dispara a análise óptica e extração de frames/tiras forenses na GPU local.",
        criterioSucesso: "analysis.json e brief.md gerados para a referência.",
        exemploPayload: { action: "start_clone", presetId: "referenciamotion", visionMode: "pass1_keyframes" },
      },
      {
        id: "recriar_hyperframes",
        ordem: 2,
        titulo: "Construir palco HTML5/GSAP fiel às coordenadas medidas",
        executor: "agente",
        metodo: "POST",
        endpoint: "/api/claude",
        descricao: "O agente escreve a composição GSAP seguindo X%/Y%, curvas e paleta extraídas.",
        criterioSucesso: "Composição HTML5 criada com window.__timelines['main'].",
      },
    ],
  },
  {
    id: "talking-head-cortes",
    nome: "Talking Head & Cortes Dinâmicos (Jump-Cut + Lockup + B-Roll)",
    nicho: "fala",
    formato: "SHORT_9_16",
    motorVisual: "HyperFrames",
    resumo:
      "Limpeza acústica de silêncios e hesitações, alinhamento palavra a palavra na GPU, legendas dinâmicas Lockup sem pisca e inserção de B-rolls.",
    entradas: ["videoPath", "transcriptOrAudio"],
    gatesHumanos: ["aprovar_corte_final"],
    passos: [
      {
        id: "analisar_fala",
        ordem: 1,
        titulo: "Transcrever e limpar hesitações / silêncios",
        executor: "worker",
        metodo: "POST",
        endpoint: "/api/reels-tools",
        descricao: "Gera timeline limpa e lockups de legendas a partir das palavras alinhadas.",
        criterioSucesso: "Timeline limpa e lockups calculados.",
      },
      {
        id: "montar_hyperframes",
        ordem: 2,
        titulo: "Montar corte com legenda cinética no HyperFrames",
        executor: "agente",
        metodo: "POST",
        endpoint: "/api/claude",
        descricao: "Gera a composição final com legendas Lockup e B-rolls nos pontos de ênfase.",
        criterioSucesso: "Composição pronta para revisão.",
      },
    ],
  },
  {
    id: "ugc-comercial-workflow",
    nome: "Comercial Vertical / UGC em Grafo (Workflow Studio)",
    nicho: "ugc-ia",
    formato: "SHORT_9_16",
    motorVisual: "Workflow",
    resumo:
      "Geração estruturada por nós (Avatar/Produto → Cenário → Prompt Multi-Shot → Voz → Renderizador) via API de Workflows.",
    entradas: ["nomeWorkflow", "kind", "nodes"],
    gatesHumanos: ["aprovar_previa_workflow"],
    passos: [
      {
        id: "criar_workflow",
        ordem: 1,
        titulo: "Criar grafo de workflow validado",
        executor: "agente",
        metodo: "POST",
        endpoint: "/api/v1/workflows",
        descricao: "Cria o workflow com template VERTICAL_COMMERCIAL ou UGC.",
        criterioSucesso: "Workflow salvo com nós conectados.",
        exemploPayload: { name: "Campanha Produto IA", kind: "VERTICAL_COMMERCIAL" },
      },
      {
        id: "executar_workflow",
        ordem: 2,
        titulo: "Executar grafo no worker",
        executor: "worker",
        metodo: "POST",
        endpoint: "/api/v1/workflows/:id",
        descricao: "Dispara RUN_WORKFLOW e aguarda em /api/v1/jobs/:jobId/wait.",
        criterioSucesso: "Job RUN_WORKFLOW finalizado com DONE.",
      },
    ],
  },
];

export function getRunbookById(runbookId: string): RunbookSpec | undefined {
  return RUNBOOKS.find((r) => r.id === runbookId);
}

/**
 * Avalia de forma determinística o estado atual de um projeto contra um Runbook.
 * Função pura (recebe ProjectAgentState), permitindo testes unitários instantâneos.
 */
export function evaluateRunbookAgainstState(
  runbook: RunbookSpec,
  state: ProjectAgentState,
): RunbookEvaluationResult {
  const pid = state.projectId;
  const evalSteps: RunbookStepEvaluation[] = runbook.passos.map((step) => {
    const endpoint = step.endpoint.replace(":id", pid);
    let passou = false;
    let evidencia = "Pendente";

    switch (step.id) {
      case "ideia":
        passou = state.etapasConcluidas.ideation;
        evidencia = passou
          ? `Ideia selecionada: "${state.metricas.ideiaSelecionadaTitulo ?? state.title}"`
          : "Nenhuma ideia selecionada.";
        break;
      case "roteiro":
        passou = state.etapasConcluidas.script;
        evidencia = passou
          ? `${state.metricas.totalAtos} ato(s), ${state.metricas.totalPalavrasRoteiro} palavras (~${state.metricas.duracaoEstimadaSeg}s)`
          : "Nenhum bloco de roteiro encontrado.";
        break;
      case "voz":
        passou = state.etapasConcluidas.voice;
        evidencia = passou
          ? `${state.metricas.atosComVoz}/${state.metricas.totalAtos} atos narrados (${(state.metricas.duracaoVozTotalMs / 1000).toFixed(1)}s)`
          : `${state.metricas.atosComVoz}/${state.metricas.totalAtos} atos com voz.`;
        break;
      case "legendas":
        passou = state.etapasConcluidas.captions;
        evidencia = passou
          ? `${state.metricas.atosComLegendaAlinhada}/${state.metricas.totalAtos} atos com palavras alinhadas`
          : `${state.metricas.atosComLegendaAlinhada}/${state.metricas.totalAtos} atos alinhados.`;
        break;
      case "cenas":
        passou = state.etapasConcluidas.scenes;
        evidencia = passou
          ? `${state.metricas.totalCenas} cena(s) planejada(s) (${state.metricas.cenasComArquivoExistente} com mídia em disco)`
          : "Nenhuma cena criada.";
        break;
      case "plano_edicao":
        passou = state.etapasConcluidas.editPlan;
        evidencia = passou
          ? `Plano de edição com ${state.metricas.insercoesPlanoEdicao} inserção(ões)`
          : "Plano de edição ainda não gerado.";
        break;
      case "exportar_hf":
      case "composicao_ou_render":
        passou = state.etapasConcluidas.hyperframesExported || state.etapasConcluidas.render;
        evidencia = state.etapasConcluidas.hyperframesExported
          ? `Composição HyperFrames pronta em ${state.metricas.hyperframesDir}`
          : state.etapasConcluidas.render
            ? `Render MP4 gerado em ${state.metricas.ultimoRenderPath}`
            : "Nem composição HyperFrames nem render MP4 foram gerados ainda.";
        break;
      default:
        passou = false;
        evidencia = "Passo especializado (executar via endpoint indicado).";
        break;
    }

    return {
      id: step.id,
      ordem: step.ordem,
      titulo: step.titulo,
      executor: step.executor,
      passou,
      evidencia,
      comoExecutar: {
        metodo: step.metodo,
        endpoint,
        payload: step.exemploPayload,
      },
    };
  });

  const passosConcluidos = evalSteps.filter((s) => s.passou).length;
  const totalPassos = evalSteps.length;
  const progressoPercent = totalPassos > 0 ? Math.round((passosConcluidos / totalPassos) * 100) : 100;
  const proximoPasso = evalSteps.find((s) => !s.passou) ?? null;

  return {
    runbookId: runbook.id,
    runbookNome: runbook.nome,
    projectId: state.projectId,
    projectTitle: state.title,
    concluido: passosConcluidos === totalPassos,
    progressoPercent,
    passosConcluidos,
    totalPassos,
    proximoPasso,
    passos: evalSteps,
  };
}

export async function evaluateRunbookForProject(
  runbookId: string,
  projectId: string,
): Promise<RunbookEvaluationResult | null> {
  const runbook = getRunbookById(runbookId) ?? RUNBOOKS[0]!;
  const state = await computeProjectAgentState(projectId);
  if (!state) return null;
  return evaluateRunbookAgainstState(runbook, state);
}
