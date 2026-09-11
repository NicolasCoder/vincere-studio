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
  /** Assets do pacote, relativos a editor-ia/public. */
  assets: {
    substratos: readonly string[];
    molduras: readonly string[];
    overlays: readonly string[];
    fundos: readonly string[];
  };
  /** Entra no prompt do plano como direção editorial do nicho. */
  orientacao: string;
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
