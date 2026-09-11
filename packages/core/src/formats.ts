/**
 * Formatos de vídeo: o seletor 16:9 vs 9:16 do Passo 1 é um conceito de primeira
 * classe. Tudo que muda entre um documentário longo e um vídeo curto mora aqui,
 * e os prompts, o editor de roteiro e o render leem desta configuração.
 */
export type VideoFormat = "LONG_16_9" | "SHORT_9_16";

export interface FormatSpec {
  id: VideoFormat;
  label: string;
  ratio: "16:9" | "9:16";
  description: string;
  width: number;
  height: number;
  fps: number;
  /** Duração alvo em segundos */
  duration: { min: number; default: number; max: number };
  /** Estrutura narrativa */
  structure: { acts: number; hookSeconds: number; blockLabels: string[] };
  /** Ritmo de corte em segundos por cena */
  cutPace: { min: number; max: number };
  captions: { required: boolean; style: "subtle-bottom" | "bold-center-animated" };
  broll: { preferVideo: boolean; imageOrientation: "landscape" | "portrait" };
  publish: { youtubeKind: "video" | "short" };
}

export const FORMATS: Record<VideoFormat, FormatSpec> = {
  LONG_16_9: {
    id: "LONG_16_9",
    label: "Vídeo Longo (16:9)",
    ratio: "16:9",
    description: "Documentário aprofundado (8–25 min) · Horizontal · YouTube long-form",
    width: 1920,
    height: 1080,
    fps: 30,
    duration: { min: 8 * 60, default: 18 * 60, max: 25 * 60 },
    structure: {
      acts: 6,
      hookSeconds: 45,
      blockLabels: [
        "Gancho Fatal",
        "Quebra de Padrão & Contexto",
        "Primeira Anomalia",
        "Escalada & Revelações",
        "Clímax",
        "Resolução & Próximo Mistério",
      ],
    },
    // 4–7s por cena. Era 3–6, e o vídeo de 11 min saía com 61 cenas — imagem trocando antes de o
    // espectador terminar de ler o que está na tela. Documentário ganha com plano que respira;
    // corte rápido é linguagem de outro formato. De quebra, menos cena é menos B-roll para baixar.
    cutPace: { min: 4, max: 7 },
    captions: { required: false, style: "subtle-bottom" },
    broll: { preferVideo: true, imageOrientation: "landscape" },
    publish: { youtubeKind: "video" },
  },
  SHORT_9_16: {
    id: "SHORT_9_16",
    label: "Vídeo Curto (9:16)",
    ratio: "9:16",
    description: "Shorts, Reels e TikTok (30–90s) · Vertical · Narração conduz, imagem acompanha",
    width: 1080,
    height: 1920,
    fps: 30,
    duration: { min: 30, default: 60, max: 90 },
    structure: {
      acts: 4,
      hookSeconds: 3,
      blockLabels: ["Gancho de 3s", "Batida 1", "Batida 2", "Revelação & CTA"],
    },
    // 2–4s por cena. Era 1–2, média de 1,5s: um Short de 81s saía com ~54 cenas, e a imagem
    // trocava mais rápido que a narração conseguia acompanhar. Esse ritmo é de vídeo de dança,
    // não de documentário narrado — aqui a fala é que conduz, e ela precisa de plano estável
    // atrás. A média de 3s corta o número de cenas quase pela metade.
    cutPace: { min: 2, max: 4 },
    captions: { required: true, style: "bold-center-animated" },
    broll: { preferVideo: false, imageOrientation: "portrait" },
    publish: { youtubeKind: "short" },
  },
};

export const formatList = Object.values(FORMATS);
export const getFormat = (id: VideoFormat) => FORMATS[id];
