import { EDIT_LAYOUTS, type EditLayout } from "./edit-plan";
import type { VideoFormat } from "./formats";

/**
 * Perfil de edição: o "padrão de montagem" de um nicho.
 *
 * Até aqui a camada visual era o DVP e ponto — paleta, fontes, assets e regras de quando usar
 * cada layout estavam espalhados entre o prompt do plano, os componentes do Remotion e os tokens.
 * Enquanto existe um nicho só isso funciona. No segundo, cada mudança de estética viraria um fork
 * dos componentes.
 *
 * O perfil junta num lugar as quatro coisas que mudam entre nichos e deixa fora o que não muda:
 *   1. quais layouts fazem sentido, POR FORMATO
 *   2. paleta e fontes
 *   3. o pacote de assets
 *   4. a orientação editorial que entra no prompt do plano
 *
 * O que NÃO entra aqui: como cada layout é desenhado. Isso continua nos componentes, que passam a
 * receber tokens em vez de conhecer um estilo. É essa separação que permite um nicho novo sem
 * reescrever o Remotion.
 */

/**
 * Duração média de uma inserção, medida nos 226 itens dos planos já produzidos: mediana 4,0s e
 * média 4,0s — raro um número bater tão redondo, e é o que torna honesta a conversão entre
 * "% do vídeo" e "quantas inserções pedir ao modelo".
 */
export const DURACAO_INSERCAO_S = 4;

/**
 * Os eixos de edição do perfil, em porcentagem.
 *
 * A ideia é a mesma que torna um editor controlável: cada eixo diz QUANTO do vídeo ele ocupa, e
 * fora disso o vídeo fica limpo. Antes esses números estavam cravados no código — uma inserção a
 * cada 18s ou 28s no prompt, e uma regra de hash `h % 5` decidindo transição. Funcionavam, mas
 * não eram ajustáveis nem nomeáveis, então nem a interface nem uma conversa conseguiam pedir
 * "menos" ou "mais".
 *
 * Medido nos planos reais antes de escolher os padrões: longos ficaram entre 13,6% e 16,5%, e
 * Shorts entre 25% e 30%. Os valores abaixo reproduzem isso, então ligar os eixos não muda o
 * resultado de nada que já existe.
 */
export interface EixosDeEdicao {
  /** % do tempo do vídeo coberto por inserção visual. O resto é descanso, não é falha. */
  insercoes: number;
  /** % dos cortes que recebem transição marcada; o resto segue no dissolve discreto. */
  transicoes: number;
}

/**
 * Faixa de intensidade: um dial só que move todos os eixos juntos.
 *
 * Existe porque ajustar eixo por eixo é trabalho de quem já sabe o que quer. Na maioria das vezes
 * a pergunta real é "mais calmo ou mais agitado?", e essa pergunta merece uma resposta de um
 * clique. É um multiplicador sobre os eixos do perfil, não um conjunto separado de números — o
 * perfil continua sendo a única fonte da verdade.
 */
export const INTENSIDADES = ["calmo", "equilibrado", "dinamico", "muito-dinamico"] as const;
export type Intensidade = (typeof INTENSIDADES)[number];

const FATOR_INTENSIDADE: Record<Intensidade, number> = {
  calmo: 0.6,
  equilibrado: 1,
  dinamico: 1.4,
  "muito-dinamico": 1.8,
};

/**
 * Estilo de legenda do perfil.
 *
 * Cores em hex RGB comum (#RRGGBB) de propósito. O ASS guarda cor em BGR — `&H00EED322` é
 * #22D3EE, um ciano, não o amarelo que o número sugere — e essa inversão é exatamente o tipo de
 * detalhe que faz alguém escolher a cor errada com confiança. A conversão fica num lugar só.
 *
 * Só entram aqui os campos que o render realmente usa hoje. Sem opção que não muda nada.
 */
export interface EstiloLegenda {
  /** Família tipográfica instalada no sistema que roda o render. */
  fonte: string;
  /** Cor do texto. */
  cor: string;
  /** Cor da palavra sendo dita, no modo com realce palavra a palavra. */
  corAtiva: string;
  /** Cor do contorno. */
  corContorno: string;
  /**
   * Tamanho como fração da ALTURA do quadro, por orientação.
   *
   * Vertical usa fração maior porque a altura é 1920: 0,045 dá ~86px, que é a convenção de Short
   * (leitura no celular, legenda como elemento gráfico). Horizontal em 0,042 de 1080 dá ~45px.
   * Os dois foram calibrados em vídeo publicado — não são o mesmo número por acaso.
   */
  tamanhoRel: { horizontal: number; vertical: number };
  /** Posição do bloco. Ausente preserva a regra histórica de cada formato. */
  posicao?: "top" | "center" | "bottom";
  /** Quantidade máxima aproximada de palavras por bloco. */
  palavrasPorLinha?: number;
  /** Se o texto inteiro deve ser escrito em caixa alta. */
  maiusculas?: boolean;
  /** Espessura do contorno ASS em pixels relativos ao PlayRes. */
  contorno?: number;
  /** Sombra ASS. Zero deixa o estilo mais limpo. */
  sombra?: number;
}

export interface EditProfile {
  id: string;
  label: string;
  description: string;
  /**
   * Layouts liberados por formato. Existe porque alguns são horizontais por natureza: cronologia
   * é um eixo deitado e a mesa põe três fotos lado a lado — em 9:16 os dois ficam ilegíveis.
   * Declarar isso aqui evita o modelo propor no plano algo que o quadro não comporta.
   */
  layoutsPorFormato: Record<VideoFormat, readonly EditLayout[]>;
  /** Quanto de cada eixo entra, por formato. Short aguenta (e pede) mais densidade que longo. */
  eixosPorFormato: Record<VideoFormat, EixosDeEdicao>;
  /** Assets do pacote, relativos a editor-ia/public. */
  assets: {
    substratos: readonly string[];
    molduras: readonly string[];
    overlays: readonly string[];
    fundos: readonly string[];
  };
  /** Entra no prompt do plano como direção editorial do nicho. */
  orientacao: string;
  /** Tipografia e cor da legenda queimada. */
  legenda: EstiloLegenda;
}

const TODOS_16_9 = EDIT_LAYOUTS;
/** Em 9:16 saem os dois que dependem de largura. */
const VERTICAL_DVP = EDIT_LAYOUTS.filter((l) => l !== "cronologia" && l !== "mesa-arquivo");

export const EDIT_PROFILES: Record<string, EditProfile> = {
  DOCUMENTARIO_DVP: {
    id: "DOCUMENTARIO_DVP",
    label: "Documentário investigativo (DVP)",
    description: "Papel de dossiê, fotografia revelada, tipografia sóbria. Para mistério, true crime e história.",
    layoutsPorFormato: { LONG_16_9: TODOS_16_9, SHORT_9_16: VERTICAL_DVP },
    // Reproduzem o que os planos já produziam antes dos eixos existirem: longos em ~15% e Shorts
    // em ~28%. Transições em 20% é a regra `h % 5` de antes, escrita como número.
    eixosPorFormato: {
      LONG_16_9: { insercoes: 15, transicoes: 20 },
      SHORT_9_16: { insercoes: 28, transicoes: 20 },
    },
    assets: {
      substratos: [
        "props/substratos/papel-dossie-01.jpg",
        "props/substratos/pasta-arquivo-aberta-01.jpg",
        "props/substratos/prancheta-formulario-01.jpg",
        "props/substratos/jornal-antigo-01.jpg",
        "props/substratos/ficha-catalogo-01.jpg",
        "props/substratos/caixa-arquivo-01.jpg",
        "props/substratos/metal-escovado-01.jpg",
      ],
      molduras: [
        "props/molduras/polaroid-recorte-01.png",
        "props/molduras/tira-negativo-01.jpg",
        "props/molduras/monitor-crt-01.jpg",
        "props/molduras/quadro-investigacao-01.jpg",
      ],
      overlays: ["props/overlays/poeira-riscos-01.jpg", "props/overlays/light-leak-01.jpg"],
      fundos: [
        "props/fundos/fundo-papel-creme-01.jpg",
        "props/fundos/fundo-carvao-grao-01.jpg",
        "props/fundos/mapa-topografico-01.jpg",
        "props/fundos/mapa-topografico-02.jpg",
        "props/fundos/papel-milimetrado-01.jpg",
      ],
    },
    // Valores extraídos do buildAss, onde estavam cravados. Trocá-los aqui muda o vídeo inteiro.
    legenda: {
      fonte: "Segoe UI",
      cor: "#FCFAF8",
      corAtiva: "#22D3EE",
      corContorno: "#201810",
      tamanhoRel: { horizontal: 0.042, vertical: 0.045 },
    },
    orientacao:
      "Identidade sóbria e documental: nada de emoji, gíria ou linguagem de marketing. O texto na tela é enxuto e factual, e a imagem sugere o contexto sem afirmar o que a narração não afirma.",
  },
};

export const getEditProfile = (id?: string | null): EditProfile =>
  EDIT_PROFILES[id ?? ""] ?? EDIT_PROFILES.DOCUMENTARIO_DVP;

/** Layouts que o plano pode propor neste projeto. É por aqui que o prompt é montado. */
export function layoutsPermitidos(profileId: string | null | undefined, format: VideoFormat): readonly EditLayout[] {
  return getEditProfile(profileId).layoutsPorFormato[format] ?? EDIT_LAYOUTS;
}

const limitar = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

/**
 * Eixos efetivos deste projeto: os do perfil para o formato, escalados pela intensidade.
 *
 * O teto de 60% não é arbitrário: acima disso "fora disso fica limpo" deixa de ser verdade e o
 * vídeo vira carrossel de efeito, que é exatamente o que o perfil documental existe para evitar.
 */
export function eixosDe(
  profileId: string | null | undefined,
  format: VideoFormat,
  intensidade: Intensidade = "equilibrado",
): EixosDeEdicao {
  const base = getEditProfile(profileId).eixosPorFormato[format];
  const f = FATOR_INTENSIDADE[intensidade] ?? 1;
  return {
    insercoes: limitar(Math.round(base.insercoes * f), 4, 60),
    transicoes: limitar(Math.round(base.transicoes * f), 0, 100),
  };
}

/**
 * Converte "% do vídeo" em "uma inserção a cada N segundos", que é o que o prompt sabe pedir.
 * Sai da duração média medida, não de um palpite.
 */
export const segundosPorInsercao = (percentual: number) =>
  Math.round(DURACAO_INSERCAO_S / (limitar(percentual, 1, 100) / 100));

/**
 * Converte #RRGGBB no literal de cor do ASS, que é `&H00BBGGRR` — os bytes ao contrário.
 * Existe para que ninguém precise pensar nisso duas vezes.
 */
export function corAss(hex: string): string {
  const h = hex.replace("#", "").trim();
  const rr = h.slice(0, 2);
  const gg = h.slice(2, 4);
  const bb = h.slice(4, 6);
  return `&H00${bb}${gg}${rr}`.toUpperCase();
}

/** Estilo de legenda deste projeto. */
export const legendaDe = (profileId?: string | null): EstiloLegenda => getEditProfile(profileId).legenda;
