// Combinações tipográficas por nicho para vídeos no HyperFrames. Regras (hyperframes-creative,
// references/typography.md): cruzar classes (serifa + sem serifa, ou sem serifa + mono), um só
// tipo expressivo por cena, contraste de peso extremo, tamanhos de vídeo, evitar a lista de
// fontes "banidas" (genéricas de IA). `embutida` = o renderer já traz a fonte (offline, sem aviso).

export interface FonteDoPar {
  familia: string;
  pesos: number[];
  papel: "título" | "texto" | "dados" | "destaque";
  embutida: boolean;
}

export interface ParTipografico {
  id: string;
  nome: string;
  nichos: string[]; // ids de lib/nichos.ts
  fontes: FonteDoPar[];
  porque: string;
  exemplo: { titulo: string; apoio: string };
  cores: { fundo: string; texto: string; acento: string };
}

export const PARES: ParTipografico[] = [
  {
    id: "dossie-carimbo",
    nome: "Dossiê · carimbo e máquina de escrever",
    nichos: ["dossie"],
    fontes: [
      { familia: "Archivo Black", pesos: [400], papel: "título", embutida: true },
      { familia: "Special Elite", pesos: [400], papel: "dados", embutida: false },
    ],
    porque: "O peso do carimbo institucional contra o papel datilografado: a versão oficial versus o documento que vazou.",
    exemplo: { titulo: "CONFIDENCIAL", apoio: "Relatório nº 47 · arquivado em 1971" },
    cores: { fundo: "#14110d", texto: "#efe6d4", acento: "#c4302b" },
  },
  {
    id: "true-crime",
    nome: "True crime · manchete e jornal",
    nichos: ["dossie", "curiosidades"],
    fontes: [
      { familia: "Oswald", pesos: [300, 700], papel: "título", embutida: true },
      { familia: "Libre Caslon Text", pesos: [400], papel: "texto", embutida: false },
    ],
    porque: "Manchete condensada e urgente sobre um corpo de texto clássico de jornal: o fato frio contra a história.",
    exemplo: { titulo: "O PONTO FINAL", apoio: "que traiu o assassino" },
    cores: { fundo: "#0d0f12", texto: "#f1f1ee", acento: "#e2b25e" },
  },
  {
    id: "retencao-numero",
    nome: "Alta retenção · número gigante",
    nichos: ["curiosidades", "cortes"],
    fontes: [
      { familia: "League Gothic", pesos: [400], papel: "título", embutida: true },
      { familia: "JetBrains Mono", pesos: [400, 700], papel: "dados", embutida: true },
    ],
    porque: "Display ultracondensado ocupa a tela inteira em 9:16; o mono dá precisão ao dado que segura o espectador.",
    exemplo: { titulo: "700 MIL", apoio: "pessoas manipuladas · 2012" },
    cores: { fundo: "#0a0b10", texto: "#ffffff", acento: "#fde047" },
  },
  {
    id: "cinema-epico",
    nome: "Cinema · épico e solene",
    nichos: ["character-cinema"],
    fontes: [
      { familia: "Fraunces", pesos: [300, 900], papel: "título", embutida: false },
      { familia: "Space Mono", pesos: [400], papel: "dados", embutida: true },
    ],
    porque: "Serifa de ótica variável com drama editorial, ancorada por legendas técnicas em mono: o mito contra o registro.",
    exemplo: { titulo: "O Último Inverno", apoio: "CAPÍTULO I · NORUEGA, 1944" },
    cores: { fundo: "#0b0c0e", texto: "#ece7dc", acento: "#9fb3c8" },
  },
  {
    id: "ugc-comercial",
    nome: "UGC / comercial · direto e humano",
    nichos: ["ugc-ia", "oferta"],
    fontes: [
      { familia: "Bricolage Grotesque", pesos: [400, 800], papel: "título", embutida: false },
      { familia: "Instrument Serif", pesos: [400], papel: "destaque", embutida: false },
    ],
    porque: "Grotesca com personalidade para o benefício, e um itálico serifado para a palavra que emociona.",
    exemplo: { titulo: "30 segundos", apoio: "e a pele muda de verdade" },
    cores: { fundo: "#f6f1ea", texto: "#151515", acento: "#ff5a36" },
  },
  {
    id: "oferta-preco",
    nome: "Oferta · preço que salta",
    nichos: ["oferta"],
    fontes: [
      { familia: "Archivo Black", pesos: [400], papel: "título", embutida: true },
      { familia: "IBM Plex Mono", pesos: [400, 700], papel: "dados", embutida: true },
    ],
    porque: "Bloco pesado para o preço, mono para condições e prazo: leitura em 1 segundo no feed.",
    exemplo: { titulo: "R$ 89", apoio: "DE R$ 199 · SÓ HOJE" },
    cores: { fundo: "#101010", texto: "#ffffff", acento: "#22c55e" },
  },
  {
    id: "motion-geometrico",
    nome: "Motion design · geométrico",
    nichos: ["motion"],
    fontes: [
      { familia: "Unbounded", pesos: [300, 900], papel: "título", embutida: false },
      { familia: "IBM Plex Mono", pesos: [400], papel: "dados", embutida: true },
    ],
    porque: "Display largo e redondo que pede animação de escala; o mono marca tempo e versão como numa ficha técnica.",
    exemplo: { titulo: "VINCERE", apoio: "v2.0 · abertura · 4s" },
    cores: { fundo: "#0a0b10", texto: "#f2f3f7", acento: "#4d6bff" },
  },
  {
    id: "explicativo-claro",
    nome: "Explicativo · editorial e claro",
    nichos: ["explicativo"],
    fontes: [
      { familia: "Newsreader", pesos: [400, 700], papel: "título", embutida: false },
      { familia: "Space Grotesk", pesos: [400, 700], papel: "texto", embutida: false },
    ],
    porque: "Serifa de leitura para a ideia, grotesca técnica para rótulos de gráfico: professor e quadro-negro.",
    exemplo: { titulo: "Por que a inflação sobe?", apoio: "1 · oferta   2 · demanda   3 · expectativa" },
    cores: { fundo: "#f4f2ed", texto: "#1a1a1a", acento: "#2f6bff" },
  },
  {
    id: "fala-igor",
    nome: "Vídeo de fala · legenda forte",
    nichos: ["fala", "cortes"],
    fontes: [
      { familia: "Montserrat", pesos: [400, 900], papel: "título", embutida: true },
      { familia: "Instrument Serif", pesos: [400], papel: "destaque", embutida: false },
    ],
    porque: "Legenda geométrica pesada e legível em movimento; o itálico serifado entra só na palavra de ênfase.",
    exemplo: { titulo: "ISSO MUDA", apoio: "tudo" },
    cores: { fundo: "#0d0d0d", texto: "#ffffff", acento: "#22d3ee" },
  },
  {
    id: "anime-impacto",
    nome: "Cortes de anime · impacto",
    nichos: ["cortes"],
    fontes: [
      { familia: "Bangers", pesos: [400], papel: "título", embutida: false },
      { familia: "Oswald", pesos: [400], papel: "texto", embutida: true },
    ],
    porque: "Letra de quadrinho para a onomatopeia e o grito; condensada neutra para a legenda não competir.",
    exemplo: { titulo: "KABOOM!", apoio: "Episódio 3 · o plano falhou" },
    cores: { fundo: "#111827", texto: "#ffffff", acento: "#f97316" },
  },
  {
    id: "luxo-premium",
    nome: "Premium · luxo silencioso",
    nichos: ["ugc-ia", "character-cinema"],
    fontes: [
      { familia: "Italiana", pesos: [400], papel: "título", embutida: false },
      { familia: "Manrope", pesos: [300, 800], papel: "texto", embutida: false },
    ],
    porque: "Didone fina e espaçada para o nome; sem serifa leve para detalhes: muito espaço, pouco ruído.",
    exemplo: { titulo: "Aura Night", apoio: "SÉRUM · 30 ML" },
    cores: { fundo: "#0e0d0c", texto: "#e9e2d6", acento: "#c8a96a" },
  },
  {
    id: "tech-ia",
    nome: "Tecnologia · IA e futuro",
    nichos: ["explicativo", "motion", "curiosidades"],
    fontes: [
      { familia: "Space Grotesk", pesos: [300, 700], papel: "título", embutida: false },
      { familia: "JetBrains Mono", pesos: [400], papel: "dados", embutida: true },
    ],
    porque: "Grotesca com detalhes de engenharia e mono de terminal: produto e código no mesmo quadro.",
    exemplo: { titulo: "Seu cérebro hackeado", apoio: "> 3,2 h/dia em vídeos curtos" },
    cores: { fundo: "#05070c", texto: "#e6edf7", acento: "#8297ff" },
  },
];

// Famílias que a própria interface do Vincere usa: nunca carregar em subset, senão a versão
// parcial (só as letras do exemplo) substitui a da interface e somem letras dos menus.
const FONTES_DA_INTERFACE = new Set(["JetBrains Mono", "Sora", "Geist"]);

/** URL do Google Fonts com só as letras do texto (subset): a prévia baixa poucos KB. */
export function urlGoogleFonts(fontes: FonteDoPar[], texto?: string): string {
  if (texto && fontes.some((f) => FONTES_DA_INTERFACE.has(f.familia))) {
    return [urlGoogleFonts(fontes.filter((f) => !FONTES_DA_INTERFACE.has(f.familia)), texto), urlGoogleFonts(fontes.filter((f) => FONTES_DA_INTERFACE.has(f.familia)))]
      .filter((u) => !u.includes("css2?&"))
      .join(" ");
  }
  const familias = fontes
    .map((f) => `family=${encodeURIComponent(f.familia).replace(/%20/g, "+")}:wght@${[...f.pesos].sort((a, b) => a - b).join(";")}`)
    .join("&");
  const subset = texto ? `&text=${encodeURIComponent(Array.from(new Set(texto)).join(""))}` : "";
  return `https://fonts.googleapis.com/css2?${familias}&display=swap${subset}`;
}

/** Trecho pronto para colar no <head> e no CSS de uma composição HyperFrames. */
export function trechoParaHyperframes(par: ParTipografico) {
  const titulo = par.fontes.find((f) => f.papel === "título") ?? par.fontes[0];
  const outra = par.fontes.find((f) => f !== titulo) ?? par.fontes[1];
  const precisaLink = par.fontes.some((f) => !f.embutida);
  return [
    precisaLink ? `<link rel="stylesheet" href="${urlGoogleFonts(par.fontes.filter((f) => !f.embutida))}" />` : "<!-- fontes embutidas no HyperFrames: nenhum link necessário -->",
    "<style>",
    `  :root { --fonte-titulo: "${titulo.familia}"; --fonte-apoio: "${outra.familia}"; --acento: ${par.cores.acento}; }`,
    `  .titulo { font-family: var(--fonte-titulo); font-weight: ${Math.max(...titulo.pesos)}; letter-spacing: -0.03em; }`,
    `  .apoio  { font-family: var(--fonte-apoio); font-weight: ${Math.min(...outra.pesos)}; }`,
    "</style>",
  ].join("\n");
}
