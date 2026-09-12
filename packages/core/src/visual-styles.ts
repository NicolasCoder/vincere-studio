/**
 * Estilos visuais: definem a linguagem dos prompts de imagem de todas as cenas,
 * thumbnail e capas. Um projeto tem um estilo; o "Modo Flow" exporta os prompts
 * já neste estilo, e qualquer API de imagem recebe o mesmo texto.
 */
export interface VisualStyle {
  id: string;
  label: string;
  description: string;
  /** Prefixo anteposto a todo prompt de cena */
  prefix: string;
  /** Sufixo com câmera/luz/acabamento */
  suffix: string;
  negative: string;
  /** Movimento padrão de câmera no render (Ken Burns) */
  motion: "slow-zoom-in" | "slow-pan" | "gentle-float" | "static";
  /** Paleta em palavras para o grading */
  grading: string;
}

export const VISUAL_STYLES: Record<string, VisualStyle> = {
  DARK_DOC: {
    id: "DARK_DOC",
    label: "Documentário cinematográfico dark",
    description: "Fotorrealismo sombrio, contraste alto, teal & orange, atmosfera de mistério",
    prefix: "Cinematic dark documentary still, photorealistic, moody atmosphere,",
    suffix: "dramatic volumetric lighting, deep shadows, teal and orange color grade, 35mm film grain, anamorphic lens, ultra detailed, 8k",
    negative: "text, watermark, logo, caption, cartoon, anime, low quality, blurry, deformed hands, extra fingers, oversaturated",
    motion: "slow-zoom-in",
    grading: "obsidian teal & orange, crushed blacks",
  },
  HISTORIC_REAL: {
    id: "HISTORIC_REAL",
    label: "Fotorrealismo histórico",
    description: "Reconstituições de época com aparência de fotografia/arquivo",
    prefix: "Historical reconstruction, photorealistic archival photograph style,",
    suffix: "period-accurate details, natural light, slight sepia tone, film grain, documentary framing, highly detailed",
    negative: "text, watermark, modern objects, anachronism, cartoon, low quality, deformed",
    motion: "slow-pan",
    grading: "sépia suave, contraste médio",
  },
  SPACE_SCI: {
    id: "SPACE_SCI",
    label: "Ciência & cosmos",
    description: "Espaço, astronomia e ciência com visual de render NASA/ESA",
    prefix: "Scientific visualization, cosmic scene, photorealistic space render,",
    suffix: "NASA archival aesthetic, deep blacks, glowing nebula accents, sharp detail, cinematic wide shot",
    negative: "text, watermark, cartoon, low quality, blurry, lens flare overload",
    motion: "gentle-float",
    grading: "azul profundo com acentos cyan",
  },
  KIDS_3D: {
    id: "KIDS_3D",
    label: "3D animação infantil",
    description: "Personagens fofos em 3D estilizado, cores vivas, iluminação suave",
    prefix: "Charming 3D animated movie still, stylized cute characters, big expressive eyes,",
    suffix: "soft global illumination, vibrant saturated colors, pastel background, subsurface scattering, rendered in high quality 3D, family friendly",
    negative: "text, watermark, realistic gore, scary, dark, horror, low quality, deformed",
    motion: "gentle-float",
    grading: "cores vivas, contraste suave",
  },
  WATERCOLOR: {
    id: "WATERCOLOR",
    label: "Ilustração aquarela",
    description: "Ilustrações pintadas à mão, ideal para histórias e curiosidades",
    prefix: "Hand-painted watercolor illustration,",
    suffix: "soft edges, paper texture, warm palette, storybook composition, detailed but gentle",
    negative: "text, watermark, photo, 3d render, low quality",
    motion: "slow-pan",
    grading: "quente, papel",
  },
  TRUE_CRIME: {
    id: "TRUE_CRIME",
    label: "True crime / investigativo",
    description: "Cenas de evidência, arquivos, luz fria, tensão policial",
    prefix: "True crime documentary still, photorealistic, cold investigative mood,",
    suffix: "fluorescent and neon lighting, evidence board details, shallow depth of field, desaturated palette with red accents, film grain",
    negative: "text, watermark, gore, blood, cartoon, low quality, deformed",
    motion: "slow-zoom-in",
    grading: "dessaturado com acentos vermelhos",
  },
};

export const visualStyleList = Object.values(VISUAL_STYLES);
export const getVisualStyle = (id?: string | null) => VISUAL_STYLES[id ?? ""] ?? VISUAL_STYLES.DARK_DOC;

/**
 * "Vertical 9:16 composition" sozinho não impede o modelo de devolver a cena deitada — ele
 * obedece o enquadramento do assunto, não necessariamente a moldura do frame. Aconteceu em
 * produção: imagens do Modo Flow (o usuário gera à mão, colando este texto, sem parâmetro de
 * API nenhum por trás) saíram no formato paisagem para um projeto Short. A correção só pode
 * morar no texto aqui — o Flow não recebe altura/largura, só o prompt.
 */
export function composeImagePrompt(style: VisualStyle, scene: string, ratio: "16:9" | "9:16") {
  const aspect =
    ratio === "9:16"
      ? "vertical 9:16 portrait frame, taller than wide, full-bleed upright composition as if shot on a phone held vertically"
      : "horizontal 16:9 widescreen frame, wider than tall, cinematic letterboxed composition";
  const negativeAspect = ratio === "9:16" ? "landscape orientation, horizontal composition, sideways framing, wider than tall" : "portrait orientation, vertical composition, taller than wide";
  return `${style.prefix} ${scene}, ${aspect}, ${style.suffix}. Negative: ${style.negative}, ${negativeAspect}`;
}
