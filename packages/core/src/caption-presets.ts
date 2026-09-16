import type { VideoFormat } from "./formats";
import type { EstiloLegenda } from "./edit-profiles";

export const CAPTION_PRESET_IDS = ["auto", "documentary", "impact", "neon", "luxury", "education", "gaming", "wellness", "news", "custom"] as const;
export type CaptionPresetId = (typeof CAPTION_PRESET_IDS)[number];
export type CaptionMode = "subtle-bottom" | "bold-center-animated";

export interface CaptionPreset {
  id: CaptionPresetId;
  label: string;
  description: string;
  mode: CaptionMode | "auto";
  style: EstiloLegenda | null;
}

/**
 * Modelos prontos de legenda queimada.
 *
 * `auto` preserva exatamente o comportamento histórico do formato. Os demais carregam modo e
 * identidade completos, para que a prova curta seja fiel ao render final sem depender de estado
 * salvo no navegador ou de uma migração de banco.
 */
export const CAPTION_PRESETS: readonly CaptionPreset[] = [
  {
    id: "auto",
    label: "Automático do formato",
    description: "Rodapé discreto no 16:9 e karaokê ciano no 9:16.",
    mode: "auto",
    style: null,
  },
  {
    id: "documentary",
    label: "Documentário clean",
    description: "Texto branco sóbrio no rodapé, com contorno suave.",
    mode: "subtle-bottom",
    style: {
      fonte: "Segoe UI Semibold",
      cor: "#FCFAF8",
      corAtiva: "#22D3EE",
      corContorno: "#17120E",
      tamanhoRel: { horizontal: 0.042, vertical: 0.038 },
      posicao: "bottom",
      palavrasPorLinha: 7,
      maiusculas: false,
      contorno: 2,
      sombra: 1,
    },
  },
  {
    id: "impact",
    label: "Impacto amarelo",
    description: "Karaokê central forte, com palavra ativa amarela.",
    mode: "bold-center-animated",
    style: {
      fonte: "Arial Black",
      cor: "#FFFFFF",
      corAtiva: "#FFD400",
      corContorno: "#090909",
      tamanhoRel: { horizontal: 0.05, vertical: 0.05 },
      posicao: "center",
      palavrasPorLinha: 3,
      maiusculas: true,
      contorno: 4,
      sombra: 0,
    },
  },
  {
    id: "neon",
    label: "Neon magenta",
    description: "Karaokê moderno, branco com destaque magenta.",
    mode: "bold-center-animated",
    style: {
      fonte: "Arial Black",
      cor: "#FFFFFF",
      corAtiva: "#FF3CAC",
      corContorno: "#12091A",
      tamanhoRel: { horizontal: 0.048, vertical: 0.048 },
      posicao: "center",
      palavrasPorLinha: 3,
      maiusculas: true,
      contorno: 4,
      sombra: 1,
    },
  },
  {
    id: "luxury",
    label: "Luxo minimalista",
    description: "Georgia em creme e dourado, elegante e com pouco ruído visual.",
    mode: "subtle-bottom",
    style: { fonte: "Georgia", cor: "#FFF8E7", corAtiva: "#D4AF37", corContorno: "#17120B", tamanhoRel: { horizontal: 0.044, vertical: 0.043 }, posicao: "bottom", palavrasPorLinha: 6, maiusculas: false, contorno: 2, sombra: 1 },
  },
  {
    id: "education",
    label: "Educação clean",
    description: "Verdana azul e branco para leitura clara em aulas e explicações.",
    mode: "subtle-bottom",
    style: { fonte: "Verdana", cor: "#FFFFFF", corAtiva: "#38BDF8", corContorno: "#0F172A", tamanhoRel: { horizontal: 0.043, vertical: 0.044 }, posicao: "bottom", palavrasPorLinha: 6, maiusculas: false, contorno: 3, sombra: 1 },
  },
  {
    id: "gaming",
    label: "Gaming energético",
    description: "Arial Black em branco e verde-limão para cortes rápidos.",
    mode: "bold-center-animated",
    style: { fonte: "Arial Black", cor: "#FFFFFF", corAtiva: "#B8FF2C", corContorno: "#071207", tamanhoRel: { horizontal: 0.052, vertical: 0.052 }, posicao: "center", palavrasPorLinha: 3, maiusculas: true, contorno: 5, sombra: 1 },
  },
  {
    id: "wellness",
    label: "Bem-estar suave",
    description: "Trebuchet MS com tons claros e verde sálvia.",
    mode: "subtle-bottom",
    style: { fonte: "Trebuchet MS", cor: "#FFFDF7", corAtiva: "#9DD6B5", corContorno: "#24352D", tamanhoRel: { horizontal: 0.042, vertical: 0.043 }, posicao: "bottom", palavrasPorLinha: 6, maiusculas: false, contorno: 2, sombra: 1 },
  },
  {
    id: "news",
    label: "Notícias e negócios",
    description: "Segoe UI Semibold em branco e azul, direto e informativo.",
    mode: "subtle-bottom",
    style: { fonte: "Segoe UI Semibold", cor: "#FFFFFF", corAtiva: "#60A5FA", corContorno: "#07152B", tamanhoRel: { horizontal: 0.041, vertical: 0.042 }, posicao: "bottom", palavrasPorLinha: 7, maiusculas: false, contorno: 3, sombra: 1 },
  },
  {
    id: "custom",
    label: "Personalizado do projeto",
    description: "Cores, fonte, tamanho e posição salvos neste projeto.",
    mode: "auto",
    style: null,
  },
] as const;

export function captionPresetFor(id: unknown, format: VideoFormat, fallbackStyle: EstiloLegenda) {
  const preset = CAPTION_PRESETS.find((item) => item.id === id) ?? CAPTION_PRESETS[0];
  return {
    ...preset,
    mode: preset.mode === "auto"
      ? format === "SHORT_9_16" ? "bold-center-animated" : "subtle-bottom"
      : preset.mode,
    style: preset.style ?? fallbackStyle,
  } satisfies Omit<CaptionPreset, "mode" | "style"> & { mode: CaptionMode; style: EstiloLegenda };
}
