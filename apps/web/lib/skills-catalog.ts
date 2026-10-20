// Catálogo das skills de vídeo instaladas no Claude do PC. Usado pela biblioteca (/skills)
// e pelo assistente, para recomendar a skill certa em cada momento.

export type Motor = "HyperFrames" | "Remotion" | "Google Flow" | "Pesquisa" | "Legendas";
export type Preview = "slash" | "lockup" | "grid" | "zoom" | "stamp" | "frames" | "orbit" | "nodes" | "wave";

export interface Skill {
  id: string;
  nome: string;
  comando: string;
  motor: Motor;
  quando: string;
  voceDa: string;
  voceRecebe: string;
  exemplo: string;
  preview: Preview;
}

// Só skills instaladas em C:\Users\Igor\.claude\skills (conferido em 19/10/2026).
export const SKILLS: Skill[] = [
  {
    id: "hyperframes",
    nome: "HyperFrames (porta de entrada)",
    comando: "/hyperframes",
    motor: "HyperFrames",
    quando: "Sempre que for criar, editar, animar ou renderizar um vídeo. Ela escolhe o fluxo certo e chama as outras.",
    voceDa: "A ideia, um roteiro, um link ou um vídeo de referência",
    voceRecebe: "Projeto em Videos-HF com cenas em HTML, preview ao vivo e render",
    exemplo: "Use /hyperframes para criar um vídeo vertical de 40s sobre a história da Nike, estilo dossiê.",
    preview: "nodes",
  },
  {
    id: "general-video",
    nome: "Vídeo livre com várias cenas",
    comando: "/general-video",
    motor: "HyperFrames",
    quando: "Vídeos mais longos ou com muitas cenas: explicativos, montagens, reels de marca.",
    voceDa: "Roteiro em beats e as mídias (ou peça para buscar)",
    voceRecebe: "Composição completa com câmera, transições e SFX",
    exemplo: "Com /general-video, monte os 5 beats do roteiro anexo em 9:16, com narração primeiro.",
    preview: "frames",
  },
  {
    id: "motion-graphics",
    nome: "Motion graphic curto",
    comando: "/motion-graphics",
    motor: "HyperFrames",
    quando: "Peças curtas sem narração: abertura, título animado, lower-third, vinheta.",
    voceDa: "O texto e o estilo (ou uma referência)",
    voceRecebe: "Animação pronta para usar sozinha ou dentro de outro vídeo",
    exemplo: "Faça com /motion-graphics uma abertura de 3s com a palavra DOSSIÊ batendo na tela.",
    preview: "slash",
  },
  {
    id: "subtitles-studio",
    nome: "Legendas dinâmicas (Lockup)",
    comando: "/subtitles-studio",
    motor: "Legendas",
    quando: "Depois da narração pronta, para legendas de alta retenção.",
    voceDa: "O áudio narrado (ou o words.json do Whisper) e o estilo",
    voceRecebe: "Legenda com palavra gigante, apoio nos vãos e brilho, sem piscar",
    exemplo: "Aplique /subtitles-studio no estilo dossie_mono na narração do projeto nike-história.",
    preview: "lockup",
  },
  {
    id: "get-brolls",
    nome: "B-rolls com revisão",
    comando: "/get-brolls",
    motor: "Pesquisa",
    quando: "Fatos reais e história: fotos e trechos de arquivo com origem registrada.",
    voceDa: "O tema ou os beats que precisam de imagem",
    voceRecebe: "Prancheta para aprovar e os clipes baixados com fonte e licença",
    exemplo: "Busque com /get-brolls fotos de arquivo da Blue Ribbon Sports dos anos 60.",
    preview: "grid",
  },
  {
    id: "flow-studio",
    nome: "Imagem e vídeo no Google Flow",
    comando: "/flow-studio",
    motor: "Google Flow",
    quando: "Cenas que não existem em arquivo: conceito, produto, personagem consistente.",
    voceDa: "O prompt da cena (e a folha do personagem, se houver)",
    voceRecebe: "Imagem Nano Banana ou vídeo Veo, salvos no projeto",
    exemplo: "Gere no /flow-studio um galpão abandonado à noite, chuva, 9:16, estilo cinema.",
    preview: "orbit",
  },
  {
    id: "watch",
    nome: "Assistir a uma referência",
    comando: "/watch",
    motor: "Pesquisa",
    quando: "Antes de copiar um estilo: o Claude assiste e descreve ritmo, cortes e texto.",
    voceDa: "Link ou arquivo do vídeo + a pergunta",
    voceRecebe: "Frames, transcrição e análise do que acontece",
    exemplo: "/watch https://… o que acontece nos 3 primeiros segundos e como é a legenda?",
    preview: "wave",
  },
  {
    id: "video-sharingan",
    nome: "Engenharia reversa de vídeo (Sharingan)",
    comando: "/video-sharingan",
    motor: "Pesquisa",
    quando: "Quer recriar o estilo de uma referência com precisão: cortes, câmera, look e ritmo medidos em números.",
    voceDa: "O vídeo de referência (salvo em referencias/)",
    voceRecebe: "Brief com tempos de corte, velocidade de câmera, easing, cores e BPM para recriar no HyperFrames",
    exemplo: "Rode /video-sharingan em referencias/trailer.mp4 e gere o brief para recriarmos no HyperFrames.",
    preview: "frames",
  },
  {
    id: "motion-criar",
    nome: "Criar motion a partir de referência",
    comando: "/motion-criar-da-referencia",
    motor: "HyperFrames",
    quando: "Gostou de uma animação no Pinterest/Reels e quer ela no seu catálogo.",
    voceDa: "O vídeo de referência",
    voceRecebe: "Motion com nome, reutilizável em qualquer projeto",
    exemplo: "Transforme referencias/titulo.mp4 em um motion reutilizável com /motion-criar-da-referencia.",
    preview: "zoom",
  },
  {
    id: "motion-aplicar",
    nome: "Aplicar motions do catálogo",
    comando: "/motion-aplicar-da-biblioteca",
    motor: "Remotion",
    quando: "Marcar no roteiro onde entra cada motion pronto do Editor-Video.",
    voceDa: "O roteiro",
    voceRecebe: "Falas marcadas com [motion: nome @segundos texto]",
    exemplo: "Use /motion-aplicar-da-biblioteca para sugerir motions no roteiro anexo.",
    preview: "stamp",
  },
  {
    id: "editar-documentario",
    nome: "Documentário narrado",
    comando: "/editar-documentario-narrado",
    motor: "Remotion",
    quando: "Documentários e curiosidades no Editor-Video, com fontes e imagens de arquivo.",
    voceDa: "Tema ou roteiro com fontes",
    voceRecebe: "Vídeo narrado montado no Remotion",
    exemplo: "/editar-documentario-narrado sobre a anomalia gravitacional do Atlântico, 60s vertical.",
    preview: "stamp",
  },
  {
    id: "editar-igor",
    nome: "Vídeo de fala estilo Igor",
    comando: "/editar-igor",
    motor: "Remotion",
    quando: "Vídeos com você (ou seu clone) falando: legenda dinâmica, zooms e cortes.",
    voceDa: "O vídeo gravado",
    voceRecebe: "Edição pronta para Reels/TikTok",
    exemplo: "Edite com /editar-igor o arquivo gravacao-01.mp4 em 9:16.",
    preview: "zoom",
  },
  {
    id: "caosanimado",
    nome: "Cortes de desenho e anime",
    comando: "/caosanimado-video-pipeline",
    motor: "Remotion",
    quando: "Cortes do Caos Animado: transcrição, legenda, revisão e publicação.",
    voceDa: "Os episódios ou trechos",
    voceRecebe: "Cortes renderizados e prontos para publicar",
    exemplo: "Rode /caosanimado-video-pipeline no lote LOTE_Simpsons de hoje.",
    preview: "frames",
  },
  {
    id: "reel-oferta",
    nome: "Reel de oferta",
    comando: "/reel-de-oferta",
    motor: "Google Flow",
    quando: "Comercial vertical de produto do GerouPromo, ponta a ponta.",
    voceDa: "O produto (ou deixe escolher pela pauta do dia)",
    voceRecebe: "Reel com imagens do Flow, texto de oferta e CTA",
    exemplo: "Faça um /reel-de-oferta com o produto da pauta de hoje.",
    preview: "orbit",
  },
];
