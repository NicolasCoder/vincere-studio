/**
 * Ferramentas nativas portadas do ecossistema `reels_tools` (sem dependências pesadas).
 *
 * Estas funções rodam 100% em memória no Node.js (tanto na Nuvem/VPS quanto no PC Local) e cobrem:
 *  1. Aninhamento Tipográfico (Lockup Nesting — 07b_nesting.py)
 *  2. Emulação de Cor & Filtros SVG/LUT 256-pontos (06b_color_grade.py)
 *  3. Revisão Editorial de Transcrição (07c_review_script.py)
 *  4. Mascaramento de Cortes e Trajetórias de Câmera Talking Head (07_plan_visuals.py)
 *  5. Regra do Vão Livre e Limpeza Cirúrgica de Timeline (04_build_clean_timeline.py)
 */

// ============================================================================
// 1. ANINHAMENTO TIPOGRÁFICO (LOCKUP NESTING — portado de 07b_nesting.py)
// ============================================================================

const ASC = new Set(["b", "d", "f", "h", "k", "l"]);
const DOT = new Set(["i", "j"]);
const SEMI = new Set(["t"]);
const DESC = new Set(["g", "j", "p", "q", "y"]);

const CHAR_WIDTHS: Record<string, number> = {
  a: 0.58, b: 0.62, c: 0.56, d: 0.62, e: 0.59, f: 0.37, g: 0.62,
  h: 0.61, i: 0.27, j: 0.28, k: 0.58, l: 0.27, m: 0.92, n: 0.61,
  o: 0.62, p: 0.62, q: 0.62, r: 0.40, s: 0.54, t: 0.39, u: 0.61,
  v: 0.56, w: 0.84, x: 0.56, y: 0.56, z: 0.52,
  " ": 0.28, "-": 0.36, "?": 0.55, "!": 0.30,
};

const CAP_WIDTHS: Record<string, number> = {
  M: 0.88, W: 1.0, I: 0.30, J: 0.50, L: 0.55, F: 0.58, T: 0.60,
};

const MIN_SMALL = 0.28;
const MAX_SMALL = 0.50;
const TUCK_OK = 0.34;

export interface NestingRun {
  chars: string;
  x0: number;
  x1: number;
  width: number;
  frac: [number, number];
  semi: boolean;
}

export interface MainWordNesting {
  text: string;
  widthEm: number;
  freeAboveRuns: NestingRun[];
  freeBelowRuns: NestingRun[];
  bestAbove: NestingRun | null;
  bestBelow: NestingRun | null;
}

export interface SmallWordFit {
  text: string;
  widthEm: number;
  side: "above" | "below";
  nest: "tucked" | "tight" | "loose";
  scale: number;
  fitScale?: number;
  reason?: string;
  extraClearance?: boolean;
  slot?: {
    chars: string;
    frac: [number, number];
    widthEm: number;
    align: "left" | "center" | "right";
  };
}

export interface LockupAnalysis {
  main: MainWordNesting;
  above?: SmallWordFit;
  below?: SmallWordFit;
  quality: number;
}

function splitUnicodeMarks(ch: string): { base: string; topMark: boolean; bottomMark: boolean } {
  const nfd = ch.normalize("NFD");
  const base = nfd[0] ?? ch;
  const marks = nfd.slice(1);
  let topMark = false;
  let bottomMark = false;
  for (const m of marks) {
    if (m === "\u0327" || m === "\u0328") bottomMark = true;
    else topMark = true;
  }
  return { base, topMark, bottomMark };
}

export function charTypoInfo(ch: string) {
  const { base, topMark, bottomMark } = splitUnicodeMarks(ch);
  const low = base.toLowerCase();
  const isUpper = base !== low && base === base.toUpperCase();
  const isDigit = /\d/.test(base);

  let width = 0.58;
  let topFree = true;

  if (isUpper) {
    width = CAP_WIDTHS[base] ?? 0.68;
    topFree = false;
  } else if (isDigit) {
    width = 0.62;
    topFree = false;
  } else {
    width = CHAR_WIDTHS[low] ?? 0.58;
    topFree = true;
  }

  if (ASC.has(low) || DOT.has(low) || topMark || base === "?" || base === "!") {
    topFree = false;
  }
  const bottomFree = !(DESC.has(low) || bottomMark || base === "Q");
  return { width, topFree, bottomFree, semi: SEMI.has(low) };
}

export function estimateTextWidthEm(text: string): number {
  let sum = 0;
  for (const ch of text) sum += charTypoInfo(ch).width;
  return sum;
}

function computeFreeRuns(text: string, key: "topFree" | "bottomFree"): { runs: NestingRun[]; total: number } {
  const rawRuns: { c0: number; c1: number; x0: number; x1: number; semi: boolean }[] = [];
  let x = 0;
  let cur: { c0: number; c1: number; x0: number; x1: number; semi: boolean } | null = null;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    const info = charTypoInfo(ch);
    const free = ch !== " " ? info[key] : cur !== null;
    if (free) {
      if (!cur) cur = { c0: i, c1: i, x0: x, x1: x, semi: false };
      cur.c1 = i;
      cur.x1 = x + info.width;
      cur.semi = cur.semi || info.semi;
    } else if (cur) {
      rawRuns.push(cur);
      cur = null;
    }
    x += info.width;
  }
  if (cur) rawRuns.push(cur);

  const total = Math.max(0.01, x);
  const runs: NestingRun[] = [];
  for (const r of rawRuns) {
    while (r.c0 < r.c1 && text[r.c0] === " ") r.c0++;
    while (r.c1 > r.c0 && text[r.c1] === " ") r.c1--;
    const x0 = estimateTextWidthEm(text.slice(0, r.c0));
    const x1 = estimateTextWidthEm(text.slice(0, r.c1 + 1));
    runs.push({
      chars: text.slice(r.c0, r.c1 + 1),
      x0: Number(x0.toFixed(3)),
      x1: Number(x1.toFixed(3)),
      width: Number((x1 - x0).toFixed(3)),
      frac: [Number((x0 / total).toFixed(3)), Number((x1 / total).toFixed(3))],
      semi: r.semi,
    });
  }
  return { runs, total };
}

export function analyzeMainWord(mainText: string): MainWordNesting {
  const { runs: top, total } = computeFreeRuns(mainText, "topFree");
  const { runs: bottom } = computeFreeRuns(mainText, "bottomFree");
  const best = (rs: NestingRun[]) =>
    rs.length ? rs.reduce((a, b) => (b.width > a.width ? b : a), rs[0]!) : null;
  return {
    text: mainText,
    widthEm: Number(total.toFixed(3)),
    freeAboveRuns: top,
    freeBelowRuns: bottom,
    bestAbove: best(top),
    bestBelow: best(bottom),
  };
}

function alignSlot(run: NestingRun | null, totalW: number): "left" | "center" | "right" {
  if (!run || totalW <= 0) return "center";
  const c = (run.x0 + run.x1) / 2 / totalW;
  return c < 0.38 ? "left" : c > 0.62 ? "right" : "center";
}

function fitSmallWord(mainInfo: MainWordNesting, smallText: string, side: "above" | "below"): SmallWordFit {
  const run = side === "above" ? mainInfo.bestAbove : mainInfo.bestBelow;
  const sw = estimateTextWidthEm(smallText);
  if (!run || sw === 0) {
    return {
      text: smallText,
      widthEm: Number(sw.toFixed(3)),
      side,
      nest: "loose",
      scale: 0.3,
      reason: "sem folga livre nas ascendentes/descendentes",
    };
  }
  const fitScale = run.width / sw;
  const slot = {
    chars: run.chars,
    frac: run.frac,
    widthEm: run.width,
    align: alignSlot(run, mainInfo.widthEm),
  };

  let nest: "tucked" | "tight" | "loose";
  let scale: number;
  let reason: string | undefined;

  if (fitScale >= TUCK_OK) {
    nest = "tucked";
    scale = Number(Math.min(MAX_SMALL, fitScale).toFixed(3));
  } else if (fitScale >= MIN_SMALL) {
    nest = "tight";
    scale = Number(fitScale.toFixed(3));
  } else {
    nest = "loose";
    const looseScale = Math.max(MIN_SMALL, Math.min(MAX_SMALL, mainInfo.widthEm / sw));
    scale = Number(looseScale.toFixed(3));
    reason = `folga '${run.chars}' (${run.width.toFixed(2)}em) pequena para '${smallText}' (${sw.toFixed(2)}em)`;
  }

  return {
    text: smallText,
    widthEm: Number(sw.toFixed(3)),
    side,
    nest,
    scale,
    fitScale: Number(fitScale.toFixed(3)),
    slot,
    ...(reason ? { reason } : {}),
    ...(run.semi && nest !== "loose" ? { extraClearance: true } : {}),
  };
}

export function analyzeLockup(mainText: string, aboveText = "", belowText = ""): LockupAnalysis {
  const main = analyzeMainWord(mainText);
  const out: LockupAnalysis = { main, quality: 1.0 };
  const parts: ("tucked" | "tight" | "loose")[] = [];
  if (aboveText.trim()) {
    out.above = fitSmallWord(main, aboveText.trim(), "above");
    parts.push(out.above.nest);
  }
  if (belowText.trim()) {
    out.below = fitSmallWord(main, belowText.trim(), "below");
    parts.push(out.below.nest);
  }
  const scores = { tucked: 1.0, tight: 0.6, loose: 0.2 };
  if (parts.length > 0) {
    out.quality = Number((parts.reduce((acc, p) => acc + scores[p], 0) / parts.length).toFixed(2));
  }
  return out;
}

// ============================================================================
// 2. COLOR GRADING & LUT SVG/CSS ENGINE (portado de 06b_color_grade.py)
// ============================================================================

export interface ColorGradeLook {
  id: string;
  name: string;
  badge: string;
  description: string;
  category: "talking-head" | "cinema" | "clean";
  temperatureOffsetK: number;
  tintOffset: number;
  exposureOffsetEV: number;
  contrastOffset: number;
  saturationScale: number;
  vibranceOffset: number;
  toneCurve: [number, number][];
  redCurve: [number, number][];
  greenCurve: [number, number][];
  blueCurve: [number, number][];
  wheels: {
    shadowsHue: number;
    shadowsAmount: number;
    midsHue: number;
    midsAmount: number;
    highsHue: number;
    highsAmount: number;
  };
  bloomOverlay: {
    enabled: boolean;
    cssBackground: string;
    blendMode: string;
    opacity: number;
  };
}

export const TALKING_HEAD_COLOR_LOOKS: Record<string, ColorGradeLook> = {
  apple_sungazing: {
    id: "apple_sungazing",
    name: "Apple Sungazing (Deep Blacks & Golden Warmth)",
    badge: "APPLE SUNGAZING",
    description: "Estilo Apple Keynote / Shot on iPhone: pretos profundos e densos, contraste rico em S, calor dourado de fim de tarde e pele viva.",
    category: "talking-head",
    temperatureOffsetK: 520,
    tintOffset: 4,
    exposureOffsetEV: 0.03,
    contrastOffset: 14,
    saturationScale: 1.16,
    vibranceOffset: 24,
    toneCurve: [[0, 0], [0.08, 0.042], [0.22, 0.185], [0.5, 0.525], [0.8, 0.845], [1, 0.975]],
    redCurve: [[0, 0], [0.18, 0.165], [0.5, 0.542], [0.8, 0.845], [1, 0.992]],
    greenCurve: [[0, 0], [0.18, 0.155], [0.5, 0.51], [0.8, 0.815], [1, 0.968]],
    blueCurve: [[0, 0], [0.18, 0.142], [0.5, 0.468], [0.8, 0.76], [1, 0.905]],
    wheels: { shadowsHue: 220, shadowsAmount: 0.04, midsHue: 34, midsAmount: 0.12, highsHue: 44, highsAmount: 0.14 },
    bloomOverlay: {
      enabled: true,
      cssBackground: "radial-gradient(circle at 78% 14%, rgba(255, 195, 110, 0.28) 0%, rgba(255, 165, 80, 0.12) 42%, transparent 78%)",
      blendMode: "soft-light",
      opacity: 0.8,
    },
  },
  pastel_cozy: {
    id: "pastel_cozy",
    name: "Warm Cozy (Rich Pastel & Deep Shadows)",
    badge: "WARM COZY",
    description: "Cores aconchegantes e suaves nas luzes e meios-tons, com o preto ancorado no zero para manter nitidez no cabelo e na roupa.",
    category: "talking-head",
    temperatureOffsetK: 420,
    tintOffset: 5,
    exposureOffsetEV: 0.04,
    contrastOffset: 10,
    saturationScale: 1.12,
    vibranceOffset: 20,
    toneCurve: [[0, 0], [0.1, 0.058], [0.25, 0.215], [0.5, 0.53], [0.8, 0.84], [1, 0.965]],
    redCurve: [[0, 0], [0.2, 0.185], [0.5, 0.538], [1, 0.985]],
    greenCurve: [[0, 0], [0.2, 0.175], [0.5, 0.512], [1, 0.965]],
    blueCurve: [[0, 0], [0.2, 0.168], [0.5, 0.482], [1, 0.92]],
    wheels: { shadowsHue: 28, shadowsAmount: 0.05, midsHue: 35, midsAmount: 0.11, highsHue: 46, highsAmount: 0.13 },
    bloomOverlay: {
      enabled: true,
      cssBackground: "radial-gradient(circle at 70% 18%, rgba(255, 205, 140, 0.24) 0%, rgba(255, 175, 115, 0.10) 45%, transparent 80%)",
      blendMode: "soft-light",
      opacity: 0.7,
    },
  },
  kodak_portra_400: {
    id: "kodak_portra_400",
    name: "Kodak Portra 400 (Punchy Warm Film)",
    badge: "PORTRA 400",
    description: "Emulação Kodak Portra 400 com pretos densos: tons de pele dourados vibrantes, contraste firme nas sombras e brilho quente.",
    category: "cinema",
    temperatureOffsetK: 440,
    tintOffset: 3,
    exposureOffsetEV: 0.02,
    contrastOffset: 15,
    saturationScale: 1.18,
    vibranceOffset: 22,
    toneCurve: [[0, 0], [0.09, 0.045], [0.25, 0.2], [0.5, 0.525], [0.78, 0.835], [1, 0.972]],
    redCurve: [[0, 0], [0.22, 0.195], [0.5, 0.54], [1, 0.99]],
    greenCurve: [[0, 0], [0.22, 0.182], [0.5, 0.508], [1, 0.968]],
    blueCurve: [[0, 0], [0.22, 0.168], [0.5, 0.472], [1, 0.915]],
    wheels: { shadowsHue: 32, shadowsAmount: 0.06, midsHue: 30, midsAmount: 0.1, highsHue: 44, highsAmount: 0.13 },
    bloomOverlay: {
      enabled: true,
      cssBackground: "radial-gradient(circle at 75% 15%, rgba(255, 200, 125, 0.22) 0%, transparent 75%)",
      blendMode: "soft-light",
      opacity: 0.65,
    },
  },
  fuji_eterna_pastel: {
    id: "fuji_eterna_pastel",
    name: "Fuji Eterna 3513 (Crisp Cinema)",
    badge: "FUJI ETERNA",
    description: "Emulação cinematográfica japonesa Fuji Eterna: separação sutil nas sombras, altas-luzes creme quentes e pele limpa.",
    category: "cinema",
    temperatureOffsetK: 260,
    tintOffset: 2,
    exposureOffsetEV: 0.02,
    contrastOffset: 12,
    saturationScale: 1.1,
    vibranceOffset: 18,
    toneCurve: [[0, 0], [0.1, 0.055], [0.25, 0.21], [0.75, 0.81], [1, 0.968]],
    redCurve: [[0, 0], [0.5, 0.52], [1, 0.978]],
    greenCurve: [[0, 0], [0.5, 0.512], [1, 0.97]],
    blueCurve: [[0, 0], [0.5, 0.488], [1, 0.935]],
    wheels: { shadowsHue: 205, shadowsAmount: 0.07, midsHue: 36, midsAmount: 0.08, highsHue: 48, highsAmount: 0.11 },
    bloomOverlay: { enabled: false, cssBackground: "none", blendMode: "soft-light", opacity: 0 },
  },
  kodak_2383: {
    id: "kodak_2383",
    name: "Kodak Vision3 2383 (High-Contrast Cinema Print)",
    badge: "KODAK 2383",
    description: "Filme de cópia de cinema com contraste forte: pretos ultra-profundos, curva S dramática, sombras densas e altas-luzes douradas.",
    category: "cinema",
    temperatureOffsetK: 320,
    tintOffset: 2,
    exposureOffsetEV: 0,
    contrastOffset: 20,
    saturationScale: 1.18,
    vibranceOffset: 22,
    toneCurve: [[0, 0], [0.08, 0.032], [0.25, 0.175], [0.5, 0.52], [0.78, 0.855], [1, 0.98]],
    redCurve: [[0, 0], [0.22, 0.18], [0.5, 0.535], [1, 0.99]],
    greenCurve: [[0, 0], [0.22, 0.17], [0.5, 0.505], [1, 0.97]],
    blueCurve: [[0, 0], [0.22, 0.165], [0.5, 0.468], [1, 0.9]],
    wheels: { shadowsHue: 212, shadowsAmount: 0.1, midsHue: 34, midsAmount: 0.09, highsHue: 42, highsAmount: 0.14 },
    bloomOverlay: { enabled: false, cssBackground: "none", blendMode: "soft-light", opacity: 0 },
  },
  clean_natural: {
    id: "clean_natural",
    name: "Clean Natural (Deep Black Normalized)",
    badge: "NORMALIZED",
    description: "Correção Primária pura: remove o aspecto lavado original, crava o preto profundo e devolve a saturação natural da pele.",
    category: "clean",
    temperatureOffsetK: 180,
    tintOffset: 2,
    exposureOffsetEV: 0.01,
    contrastOffset: 10,
    saturationScale: 1.12,
    vibranceOffset: 16,
    toneCurve: [[0, 0], [0.08, 0.042], [0.5, 0.515], [1, 0.99]],
    redCurve: [[0, 0], [0.5, 0.508], [1, 1]],
    greenCurve: [[0, 0], [0.5, 0.5], [1, 1]],
    blueCurve: [[0, 0], [0.5, 0.49], [1, 1]],
    wheels: { shadowsHue: 0, shadowsAmount: 0, midsHue: 32, midsAmount: 0.04, highsHue: 0, highsAmount: 0 },
    bloomOverlay: { enabled: false, cssBackground: "none", blendMode: "soft-light", opacity: 0 },
  },
};

export const talkingHeadColorLookList = Object.values(TALKING_HEAD_COLOR_LOOKS);

function evalMonotoneCurve(points: [number, number][], xArr: number[]): number[] {
  const pts = [...points].sort((a, b) => a[0] - b[0]);
  const n = pts.length;
  if (n < 2) return [...xArr];
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);

  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = Math.max(1e-8, xs[i + 1]! - xs[i]!);
    d.push((ys[i + 1]! - ys[i]!) / dx);
  }

  const m = new Array<number>(n).fill(0);
  m[0] = d[0]!;
  m[n - 1] = d[n - 2]!;
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1]! * d[i]! <= 0) m[i] = 0;
    else m[i] = 0.5 * (d[i - 1]! + d[i]!);
  }

  return xArr.map((x) => {
    const xc = Math.max(xs[0]!, Math.min(xs[n - 1]!, x));
    let idx = 0;
    for (let i = 0; i < n - 1; i++) {
      if (xc >= xs[i]!) idx = i;
    }
    const h = Math.max(1e-8, xs[idx + 1]! - xs[idx]!);
    const t = (xc - xs[idx]!) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;
    const y = h00 * ys[idx]! + h10 * h * m[idx]! + h01 * ys[idx + 1]! + h11 * h * m[idx + 1]!;
    return Math.max(0, Math.min(1, y));
  });
}

function hueDegToRgbOffset(hueDeg: number, amount: number): [number, number, number] {
  if (amount <= 1e-5) return [0, 0, 0];
  const rad = (hueDeg * Math.PI) / 180;
  const dr = Math.cos(rad) * amount * 0.14;
  const dg = Math.cos(rad - (2 * Math.PI) / 3) * amount * 0.11;
  const db = Math.cos(rad - (4 * Math.PI) / 3) * amount * 0.14;
  const lumaShift = 0.2126 * dr + 0.7152 * dg + 0.0722 * db;
  return [dr - lumaShift, dg - lumaShift, db - lumaShift];
}

export interface CompiledColorGradeRecipe {
  id: string;
  name: string;
  badge: string;
  description: string;
  effectiveParams: {
    exposureEV: number;
    temperatureK: number;
    tint: number;
    saturationScale: number;
    vibrance: number;
  };
  svgFilter: {
    filterId: string;
    feColorMatrix: string;
    tableR: string;
    tableG: string;
    tableB: string;
  };
  bloomOverlay: ColorGradeLook["bloomOverlay"];
}

export function compileColorGradeRecipe(lookId: string, lookStrength = 0.95): CompiledColorGradeRecipe {
  const look = TALKING_HEAD_COLOR_LOOKS[lookId] ?? TALKING_HEAD_COLOR_LOOKS.apple_sungazing!;
  const expEv = look.exposureOffsetEV * lookStrength;
  const expGain = Math.pow(2, expEv);

  const finalTempK = 6500 + look.temperatureOffsetK * lookStrength;
  const finalTint = look.tintOffset * lookStrength;

  const tempNorm = (finalTempK - 6500) / 3600;
  const tintNorm = finalTint / 100;

  let rWb = 1 + tempNorm * 0.18 + tintNorm * 0.06;
  let gWb = 1 - Math.abs(tempNorm) * 0.015 - tintNorm * 0.08;
  let bWb = 1 - tempNorm * 0.2 + tintNorm * 0.04;
  const wbLuma = 0.2126 * rWb + 0.7152 * gWb + 0.0722 * bWb;
  rWb /= wbLuma;
  gWb /= wbLuma;
  bWb /= wbLuma;

  const vibranceTotal = look.vibranceOffset * lookStrength;
  const satScale = 1 + (look.saturationScale - 1) * lookStrength + (vibranceTotal / 100) * 0.55;

  const rg = rWb * expGain;
  const gg = gWb * expGain;
  const bg = bWb * expGain;

  const sr = (1 - satScale) * 0.2126;
  const sg = (1 - satScale) * 0.7152;
  const sb = (1 - satScale) * 0.0722;

  const feColorMatrix = [
    (sr + satScale) * rg, sg * rg, sb * rg, 0, 0,
    sr * gg, (sg + satScale) * gg, sb * gg, 0, 0,
    sr * bg, sg * bg, (sb + satScale) * bg, 0, 0,
    0, 0, 0, 1, 0,
  ].map((v) => Number(v.toFixed(5)));

  const x = Array.from({ length: 256 }, (_, i) => i / 255);
  const contrast = (look.contrastOffset * lookStrength) / 100;
  const xp = x.map((v) =>
    Math.abs(contrast) > 1e-4 ? Math.max(0, Math.min(1, v - 0.16 * contrast * Math.sin(2 * Math.PI * v))) : v,
  );

  const masterCurveY = evalMonotoneCurve(look.toneCurve, xp);
  const yMaster = xp.map((v, i) => (1 - lookStrength) * v + lookStrength * masterCurveY[i]!);

  const rCurve = evalMonotoneCurve(look.redCurve, yMaster);
  const gCurve = evalMonotoneCurve(look.greenCurve, yMaster);
  const bCurve = evalMonotoneCurve(look.blueCurve, yMaster);

  const [shDr, shDg, shDb] = hueDegToRgbOffset(look.wheels.shadowsHue, look.wheels.shadowsAmount * lookStrength);
  const [mdDr, mdDg, mdDb] = hueDegToRgbOffset(look.wheels.midsHue, look.wheels.midsAmount * lookStrength);
  const [hiDr, hiDg, hiDb] = hueDegToRgbOffset(look.wheels.highsHue, look.wheels.highsAmount * lookStrength);

  const rTable: number[] = [];
  const gTable: number[] = [];
  const bTable: number[] = [];

  for (let i = 0; i < 256; i++) {
    const ym = yMaster[i]!;
    const wSh = Math.pow(1 - ym, 2.2) * Math.pow(ym, 0.85) * 2.2;
    const wMd = 4 * ym * (1 - ym);
    const wHi = Math.pow(ym, 1.8) * Math.pow(1 - ym, 0.35) * 1.4;

    const rBase = (1 - lookStrength) * ym + lookStrength * rCurve[i]!;
    const gBase = (1 - lookStrength) * ym + lookStrength * gCurve[i]!;
    const bBase = (1 - lookStrength) * ym + lookStrength * bCurve[i]!;

    rTable.push(Math.max(0, Math.min(1, rBase + wSh * shDr + wMd * mdDr + wHi * hiDr)));
    gTable.push(Math.max(0, Math.min(1, gBase + wSh * shDg + wMd * mdDg + wHi * hiDg)));
    bTable.push(Math.max(0, Math.min(1, bBase + wSh * shDb + wMd * mdDb + wHi * hiDb)));
  }

  return {
    id: look.id,
    name: look.name,
    badge: look.badge,
    description: look.description,
    effectiveParams: {
      exposureEV: Number(expEv.toFixed(3)),
      temperatureK: Math.round(finalTempK),
      tint: Number(finalTint.toFixed(1)),
      saturationScale: Number(satScale.toFixed(3)),
      vibrance: Number(vibranceTotal.toFixed(1)),
    },
    svgFilter: {
      filterId: `lut-${look.id}`,
      feColorMatrix: feColorMatrix.map((v) => v.toFixed(5)).join(" "),
      tableR: rTable.map((v) => v.toFixed(4)).join(" "),
      tableG: gTable.map((v) => v.toFixed(4)).join(" "),
      tableB: bTable.map((v) => v.toFixed(4)).join(" "),
    },
    bloomOverlay: look.bloomOverlay,
  };
}

// ============================================================================
// 3. REVISÃO EDITORIAL DE ROTEIRO / TRANSCRIÇÃO (portado de 07c_review_script.py)
// ============================================================================

const NUMS_PT = new Set(
  "zero um uma dois duas tres quatro cinco seis sete oito nove dez onze doze treze quatorze catorze quinze dezesseis dezessete dezoito dezenove vinte trinta quarenta cinquenta sessenta setenta oitenta noventa cem cento duzentos trezentos quinhentos mil milhao milhoes bilhao reais real".split(" "),
);
const NUM_ONLY_PT = new Set([...NUMS_PT].filter((w) => !["um", "uma", "real", "reais", "mil", "cem", "zero"].includes(w)));
const BACKCHANNELS_PT = new Set(["aham", "uhum", "aha", "uhm", "hum", "hmm", "certo", "sim", "perfeito", "ta", "ok"]);
const FILLERS_PT = new Set(["eh", "eeh", "ah", "aah", "tipo", "ne", "entao"]);

export interface TimedWord {
  gid: number;
  word: string;
  tStart: number;
  tEnd: number;
}

export interface ScriptReviewReport {
  totalWords: number;
  cleanDurationS: number;
  issues: {
    REPETICAO: { gids: [number, number]; texto: string; t: number }[];
    NUMERO: { gids: [number, number]; texto: string; t: number }[];
    NOME: { termo: string; gids: number[] }[];
    BACKCHAN: { gid: number; palavra: string; t: number; obs?: string }[];
    PAUSA: { gids: [number, number]; gapS: number; t: number }[];
    EMENDA: { gid: number; tipo: string; palavra: string; t: number }[];
  };
}

function normWord(w: string): string {
  return w
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9[\]-]/g, "");
}

export function reviewCleanTranscript(words: TimedWord[], bigPauseThresholdS = 0.65): ScriptReviewReport {
  const n = words.map((w) => normWord(w.word));
  const issues: ScriptReviewReport["issues"] = {
    REPETICAO: [],
    NUMERO: [],
    NOME: [],
    BACKCHAN: [],
    PAUSA: [],
    EMENDA: [],
  };

  const caps = new Map<string, { raw: string; gids: number[] }>();
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    const raw = w.word.replace(/^[,.;:?!]+|[,.;:?!]+$/g, "");
    const prevEnd = i === 0 || /[.?!]$/.test(words[i - 1]!.word);
    if (raw.length > 2 && /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(raw) && !prevEnd) {
      const k = normWord(raw);
      const entry = caps.get(k) ?? { raw, gids: [] };
      entry.gids.push(w.gid);
      caps.set(k, entry);
    }
  }
  for (const { raw, gids } of caps.values()) {
    issues.NOME.push({ termo: raw, gids });
  }

  // Números por extenso
  let idx = 0;
  while (idx < n.length) {
    if (NUM_ONLY_PT.has(n[idx]!)) {
      let j = idx;
      while (j + 1 < n.length && j + 1 - idx < 4 && (NUMS_PT.has(n[j + 1]!) || n[j + 1] === "e")) {
        j++;
      }
      if (j > idx || n[idx] !== "dez") {
        issues.NUMERO.push({
          gids: [words[idx]!.gid, words[j]!.gid],
          texto: words.slice(idx, j + 1).map((x) => x.word).join(" "),
          t: Number(words[idx]!.tStart.toFixed(2)),
        });
      }
      idx = j + 1;
    } else {
      idx++;
    }
  }

  // Repetições / gagueiras
  for (let i = 0; i < n.length - 1; i++) {
    if (n[i] && n[i] === n[i + 1]) {
      issues.REPETICAO.push({
        gids: [words[i]!.gid, words[i + 1]!.gid],
        texto: `${words[i]!.word} ${words[i + 1]!.word}`,
        t: Number(words[i]!.tStart.toFixed(2)),
      });
    }
  }

  // Backchannels, fillers e fragmentos curtos (<50ms)
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    const dur = w.tEnd - w.tStart;
    if (dur < 0.05) {
      issues.EMENDA.push({ gid: w.gid, tipo: "fragmento (<50ms)", palavra: w.word, t: Number(w.tStart.toFixed(2)) });
    }
    if (w.word.startsWith("[")) {
      issues.BACKCHAN.push({ gid: w.gid, palavra: w.word, t: Number(w.tStart.toFixed(2)), obs: "ruído/respiração" });
    } else if ((BACKCHANNELS_PT.has(n[i]!) || FILLERS_PT.has(n[i]!)) && dur < 0.55) {
      issues.BACKCHAN.push({ gid: w.gid, palavra: w.word, t: Number(w.tStart.toFixed(2)), obs: "vício de linguagem / filler" });
    }
  }

  // Pausas internas acima do limiar ("Regra do Vão Livre")
  for (let i = 0; i < words.length - 1; i++) {
    const gap = words[i + 1]!.tStart - words[i]!.tEnd;
    if (gap >= bigPauseThresholdS) {
      issues.PAUSA.push({
        gids: [words[i]!.gid, words[i + 1]!.gid],
        gapS: Number(gap.toFixed(2)),
        t: Number(words[i]!.tEnd.toFixed(2)),
      });
    }
  }

  const cleanDurationS = words.length ? Number((words[words.length - 1]!.tEnd - words[0]!.tStart).toFixed(2)) : 0;
  return { totalWords: words.length, cleanDurationS, issues };
}

// ============================================================================
// 4. REGRA DO VÃO LIVRE & PLANO DE CÂMERA TALKING HEAD (04 & 07_plan_visuals.py)
// ============================================================================

export type CameraMoveType = "hold" | "push_slow" | "push_fast" | "punch_in" | "pull_out" | "reset" | "jump_in";

export interface TalkingHeadClip {
  index: number;
  inPoint: number;
  outPoint: number;
  cleanStart: number;
  cleanEnd: number;
  duration: number;
  text: string;
  cameraMove: CameraMoveType;
  scaleFrom: number;
  scaleTo: number;
  spliceJumpMasked: boolean;
  fadeMs: number;
}

/**
 * Aplica a "Regra do Vão Livre" (audio_cleaning_skill.md) e o mascaramento automático
 * de cortes por salto de escala >= 6% (visual_planning_skill.md) sobre uma lista de palavras.
 */
export function buildCleanTimelineFromWords(
  words: TimedWord[],
  options: {
    minSilenceGapS?: number;
    prePadS?: number;
    postPadS?: number;
    fadeMs?: number;
  } = {},
): {
  clips: TalkingHeadClip[];
  rawDurationS: number;
  cleanDurationS: number;
  savedSeconds: number;
  cutsCount: number;
} {
  const minGap = options.minSilenceGapS ?? 0.35;
  const prePad = options.prePadS ?? 0.06;
  const postPad = options.postPadS ?? 0.08;
  const fadeMs = options.fadeMs ?? 28; // micro-fade 25-30ms anti-clique

  const valid = words.filter((w) => !w.word.startsWith("["));
  if (valid.length === 0) {
    return { clips: [], rawDurationS: 0, cleanDurationS: 0, cutsCount: 0, savedSeconds: 0 };
  }

  const groups: TimedWord[][] = [];
  let cur: TimedWord[] = [valid[0]!];

  for (let i = 1; i < valid.length; i++) {
    const prev = valid[i - 1]!;
    const w = valid[i]!;
    const gap = w.tStart - prev.tEnd;
    if (gap >= minGap) {
      groups.push(cur);
      cur = [w];
    } else {
      cur.push(w);
    }
  }
  if (cur.length) groups.push(cur);

  const clips: TalkingHeadClip[] = [];
  let cleanCursor = 0;
  let currentScale = 100;

  groups.forEach((grp, idx) => {
    const first = grp[0]!;
    const last = grp[grp.length - 1]!;
    const inPoint = Math.max(0, Number((first.tStart - prePad).toFixed(3)));
    const outPoint = Number((last.tEnd + postPad).toFixed(3));
    const duration = Math.max(0.1, Number((outPoint - inPoint).toFixed(3)));

    // Mascaramento automático de emenda (splice masking): alterna escala em >=10% nos cortes secos
    let cameraMove: CameraMoveType = "hold";
    let scaleFrom = currentScale;
    let scaleTo = currentScale;
    let spliceJumpMasked = false;

    if (idx === 0) {
      cameraMove = "push_slow";
      scaleFrom = 100;
      scaleTo = 105;
    } else {
      spliceJumpMasked = true;
      if (currentScale < 108) {
        cameraMove = "jump_in";
        scaleFrom = 112;
        scaleTo = duration > 2.5 ? 115 : 112;
      } else {
        cameraMove = "reset";
        scaleFrom = 100;
        scaleTo = duration > 2.5 ? 104 : 100;
      }
    }
    currentScale = scaleTo;

    clips.push({
      index: idx + 1,
      inPoint,
      outPoint,
      cleanStart: Number(cleanCursor.toFixed(3)),
      cleanEnd: Number((cleanCursor + duration).toFixed(3)),
      duration,
      text: grp.map((w) => w.word).join(" "),
      cameraMove,
      scaleFrom,
      scaleTo,
      spliceJumpMasked,
      fadeMs,
    });

    cleanCursor += duration;
  });

  const rawDurationS = Number((valid[valid.length - 1]!.tEnd - valid[0]!.tStart).toFixed(2));
  const cleanDurationS = Number(cleanCursor.toFixed(2));
  const savedSeconds = Math.max(0, Number((rawDurationS - cleanDurationS).toFixed(2)));

  return {
    clips,
    rawDurationS,
    cleanDurationS,
    savedSeconds,
    cutsCount: Math.max(0, clips.length - 1),
  };
}
