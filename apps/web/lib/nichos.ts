// Catálogo único de nichos do Vincere Studio. Alimenta o "O que vamos criar?" do Início,
// os estilos do Roteiro em beats e as receitas da biblioteca de skills.
// Novo nicho = nova entrada aqui; nada mais precisa mudar.

import { IDIOMA_PADRAO, type Idioma } from "./idiomas";

export type Formato = "9:16" | "16:9" | "1:1";

export interface Nicho {
  id: string;
  nome: string;
  icone: string;
  resumo: string;
  formato: Formato;
  /** Skill que lidera o pedido ao Claude. */
  skill: string;
  /** Passos na ordem, como aparecem na receita. */
  passos: string[];
  /** O que o Igor precisa trazer (aparece como dica no formulário). */
  precisa: string;
  exemploTema: string;
}

export const NICHOS: Nicho[] = [
  {
    id: "dossie",
    nome: "Documentário / Dossiê",
    icone: "folder_open",
    resumo: "Histórias reais, marcas e mistérios com documentos, carimbos e fontes citadas.",
    formato: "9:16",
    skill: "/hyperframes",
    passos: ["Roteiro em beats com fontes", "Narração primeiro", "/get-brolls (arquivo real)", "/flow-studio (cenas conceituais)", "Montagem no HyperFrames", "/subtitles-studio", "Render"],
    precisa: "Tema e, se tiver, as fontes (livros, matérias, processos).",
    exemploTema: "A história oculta da fundação da Nike",
  },
  {
    id: "cortes",
    nome: "Cortes de vídeo / desenho / anime",
    icone: "content_cut",
    resumo: "Trechos de episódios, podcasts ou lives com legenda cinética e SFX.",
    formato: "9:16",
    skill: "/hyperframes",
    passos: ["Vídeo de origem em referencias/", "Transcrição e escolha dos melhores trechos", "Corte e reenquadramento 9:16", "/subtitles-studio", "SFX nos momentos-chave", "Render em lote"],
    precisa: "O vídeo ou link de origem e o tom (engraçado, polêmico, emocionante).",
    exemploTema: "5 cortes engraçados do episódio 3 dos Simpsons",
  },
  {
    id: "character-cinema",
    nome: "Vídeo cinematográfico com Character Sheet",
    icone: "person_pin",
    resumo: "Personagem com o mesmo rosto em todas as cenas, estilo filme ou série.",
    formato: "16:9",
    skill: "/flow-studio",
    passos: ["Folha do personagem em 4 ângulos (Flow)", "Roteiro em beats", "Cenas no Veo com [ING: folha]", "Narração / diálogo", "Montagem no HyperFrames", "Trilha e color", "Render"],
    precisa: "Descrição do personagem (idade, rosto, roupa) e a história.",
    exemploTema: "Detetive dos anos 40 investigando um sumiço na chuva",
  },
  {
    id: "ugc-ia",
    nome: "UGC com IA / comercial",
    icone: "shopping_bag",
    resumo: "Vídeo vertical estilo depoimento ou demonstração de produto, feito com IA.",
    formato: "9:16",
    skill: "/flow-studio",
    passos: ["Foto do produto + folha do apresentador", "Gancho de benefício nos 2s iniciais", "Cenas no Veo (uso do produto)", "Narração estilo UGC", "/hyperframes com CTA", "/subtitles-studio", "Render"],
    precisa: "Produto (foto ou link), público e a oferta.",
    exemploTema: "Sérum facial Aura: rotina de 30 segundos",
  },
  {
    id: "motion",
    nome: "Motion graphics / design",
    icone: "animation",
    resumo: "Aberturas, vinhetas, títulos animados, lower-thirds e explicativos com tipografia.",
    formato: "16:9",
    skill: "/motion-graphics",
    passos: ["Referência (opcional): /watch + /video-sharingan", "Texto e paleta", "/motion-graphics no HyperFrames", "Ajustes ao vivo no Studio", "Render (com alfa, se for overlay)"],
    precisa: "O texto, a marca/paleta e uma referência se tiver.",
    exemploTema: "Abertura de 4s para o canal Códex Perdido",
  },
  {
    id: "oferta",
    nome: "Reel de oferta",
    icone: "sell",
    resumo: "Produto do dia do GerouPromo com preço, benefício e chamada.",
    formato: "9:16",
    skill: "/reel-de-oferta",
    passos: ["Produto da pauta", "Imagens no Flow", "Texto de oferta", "Montagem e CTA", "Render"],
    precisa: "Produto (ou deixe escolher pela pauta do dia).",
    exemploTema: "Oferta do dia: fone bluetooth",
  },
  {
    id: "curiosidades",
    nome: "Curiosidades / alta retenção",
    icone: "bolt",
    resumo: "Fatos incomuns com números gigantes na tela e corte a cada 2-3s.",
    formato: "9:16",
    skill: "/hyperframes",
    passos: ["Gancho forte", "Roteiro em beats curtos", "Narração", "Mídias (/get-brolls ou Flow)", "Números e zooms animados", "/subtitles-studio", "Render"],
    precisa: "O tema e o fato surpreendente principal.",
    exemploTema: "O lugar da Terra onde quase ninguém pode entrar",
  },
  {
    id: "explicativo",
    nome: "Explicativo / educacional",
    icone: "school",
    resumo: "Conceitos com diagramas, gráficos e animações passo a passo.",
    formato: "16:9",
    skill: "/hyperframes",
    passos: ["Roteiro didático em beats", "Narração", "Diagramas no HyperFrames (ou /manim-video para matemática)", "Destaques e legendas", "Render"],
    precisa: "O assunto e o nível do público.",
    exemploTema: "Como funciona a inflação, em 60 segundos",
  },
  {
    id: "fala",
    nome: "Vídeo de fala (você ou clone)",
    icone: "record_voice_over",
    resumo: "Sua gravação com legenda dinâmica, zooms, cortes e ilustrações por cima.",
    formato: "9:16",
    skill: "/hyperframes",
    passos: ["Gravação em referencias/", "Transcrição e cortes de silêncio", "Zooms e ilustrações nas ênfases", "/subtitles-studio", "Render"],
    precisa: "O arquivo gravado.",
    exemploTema: "Gravação de hoje sobre produtividade",
  },
];

export const nichoPorId = (id: string) => NICHOS.find((n) => n.id === id);

/** Pedido padrão ao Claude para começar um vídeo de um nicho. */
export function pedidoDoNicho(n: Nicho, tema: string, formato: Formato, notas?: string, idioma?: Idioma) {
  const lingua = idioma ?? IDIOMA_PADRAO;
  return [
    `Novo vídeo — nicho "${n.nome}", formato ${formato}, idioma ${lingua.nome} (público ${lingua.mercados.join("/")}).`,
    lingua.codigo !== "pt"
      ? `Roteiro, narração, legendas e textos na tela em ${lingua.nome}, nativos (não traduzidos ao pé da letra), com referências culturais desse público.`
      : "",
    `Tema: ${tema}.`,
    notas ? `Notas: ${notas}.` : "",
    `Entre por ${n.skill} e siga: ${n.passos.join(" → ")}.`,
    "Crie o projeto em C:\\Users\\Igor\\Videos-HF e me avise quando a primeira versão estiver no Studio.",
  ]
    .filter(Boolean)
    .join(" ");
}
