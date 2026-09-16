import path from "node:path";
import { writeFile } from "node:fs/promises";
import { FFMPEG, run } from "@docupulse/providers";

/**
 * Composição da thumbnail no padrão do canal: foto tratada para escuro e manchete em duas
 * alturas por cima.
 *
 * Mora aqui, e não no job, porque a tela de publicação precisa da mesma composição para
 * pré-visualizar ao vivo. Duas cópias divergiriam no primeiro ajuste, e aí a prévia deixaria de
 * valer como prévia — que é a única coisa que ela precisa fazer.
 */

export const THUMB_W = 1280;
export const THUMB_H = 720;

export interface OpcoesThumb {
  titulo: string;
  sub?: string;
  /** 0 a 1. Quanto a foto escurece e perde cor. 0,5 é o padrão do formato. */
  escuridao?: number;
  /** 0 a 1. Intensidade do halo atrás do texto. */
  halo?: number;
  /** Sobrepõe o tamanho calculado do título, em px. */
  tamanhoTitulo?: number;
  fonte?: string;
  largura?: number;
  altura?: number;
}

/**
 * Fonte de display: condensada e pesada. É ela que dá o peso do formato — uma sans normal em
 * negrito ocupa largura demais por letra e o título nunca chega ao tamanho que o estilo pede.
 * Impact vem instalada em todo Windows; fora dele cai numa bold comum, mais larga porém legível.
 */
export const fonteDisplay = () =>
  process.env.THUMB_FONT ||
  (process.platform === "win32" ? "C:/Windows/Fonts/impact.ttf" : "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf");

const ffPath = (p: string) => p.replace(/\\/g, "/").replace(/:/g, "\\:");
const entre = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/**
 * Separa a manchete em título grande e subtítulo fino.
 *
 * Com dois-pontos (ou travessão/barra) o corte é o do próprio título — é onde o autor já separou
 * gancho de explicação. Sem separador, as primeiras palavras que couberem viram o título e o resto
 * desce: "O DESASTRE NUCLEAR" / "QUE A URSS ESCONDEU POR 31 ANOS".
 */
export function partirManchete(texto: string): { titulo: string; sub: string } {
  const t = texto.replace(/\s+/g, " ").trim();
  const partes = t.split(/\s*[:—–|]\s*/);
  if (partes.length > 1 && partes[0].length >= 6) {
    return { titulo: partes[0], sub: partes.slice(1).join(" ") };
  }
  const palavras = t.split(" ");
  let titulo = "";
  let i = 0;
  while (i < palavras.length && `${titulo} ${palavras[i]}`.trim().length <= 18) {
    titulo = `${titulo} ${palavras[i]}`.trim();
    i++;
  }
  if (!titulo) {
    titulo = palavras[0] ?? t;
    i = 1;
  }
  return { titulo, sub: palavras.slice(i).join(" ") };
}

/**
 * Espaça o subtítulo letra a letra. O drawtext não tem entreletramento, e a Impact é estreita
 * demais para o espaço simples aparecer — daí o espaço triplo entre palavras.
 */
export const espacar = (s: string) =>
  s
    .toUpperCase()
    .split("")
    .map((c) => (c === " " ? "   " : c))
    .join(" ");

export const tamanhoParaTitulo = (titulo: string) =>
  Math.max(70, Math.min(160, Math.floor(2350 / Math.max(1, titulo.length))));

/** Se a origem for vídeo, extrai um quadro. Devolve sempre um caminho de imagem. */
export async function quadroDe(origem: string, destinoDir: string, marca = 30): Promise<string> {
  if (!/\.(mp4|mov|mkv|webm|avi)$/i.test(origem)) return origem;
  const still = path.join(destinoDir, `quadro-${Date.now()}.jpg`);
  await run(FFMPEG, [
    "-y", "-hide_banner", "-loglevel", "error",
    "-i", origem, "-vf", `select=eq(n\\,${marca})`, "-vframes", "1", "-update", "1", still,
  ]);
  return still;
}

/**
 * Renderiza a thumbnail. `origem` precisa ser imagem — use `quadroDe` antes se puder ser vídeo.
 * Os .txt auxiliares são gravados ao lado da saída (o drawtext lê texto de arquivo para não
 * precisar escapar acento, dois-pontos e aspas dentro do filtro).
 */
export async function renderizarThumbnail(origem: string, saida: string, o: OpcoesThumb): Promise<void> {
  const dir = path.dirname(saida);
  const base = path.basename(saida, path.extname(saida));
  const fonte = ffPath(o.fonte ?? fonteDisplay());
  const largura = o.largura ?? THUMB_W;
  const altura = o.altura ?? THUMB_H;
  const vertical = altura > largura;

  const escuridao = entre(o.escuridao ?? 0.5, 0, 1);
  const halo = entre(o.halo ?? 0.8, 0, 1);
  const brilho = (-0.16 * escuridao).toFixed(3);
  const contraste = (1.1 + 0.3 * escuridao).toFixed(3);
  const saturacao = (1.0 - 0.55 * escuridao).toFixed(3);

  const arqTitulo = path.join(dir, `${base}-t.txt`);
  await writeFile(arqTitulo, o.titulo.toUpperCase(), "utf8");
  const tamBase = tamanhoParaTitulo(o.titulo);
  const tam = o.tamanhoTitulo ?? (vertical ? Math.round(tamBase * 1.05) : tamBase);
  const t1 = `drawtext=fontfile='${fonte}':textfile='${ffPath(arqTitulo)}':fontcolor=white:fontsize=${tam}:x=(w-text_w)/2:y=h*${vertical ? "0.55" : "0.58"}`;

  let t2 = "";
  if (o.sub?.trim()) {
    const arqSub = path.join(dir, `${base}-s.txt`);
    const subTexto = vertical ? o.sub.trim().toUpperCase() : espacar(o.sub.trim());
    await writeFile(arqSub, subTexto, "utf8");
    const subTam = vertical ? Math.max(24, Math.min(42, Math.floor(1650 / Math.max(1, o.sub.trim().length)))) : 30;
    t2 = `,drawtext=fontfile='${fonte}':textfile='${ffPath(arqSub)}':fontcolor=white@0.92:fontsize=${subTam}:x=(w-text_w)/2:y=h*${vertical ? "0.74" : "0.82"}`;
  }
  const textos = `${t1}${t2}`;

  /**
   * O texto ganha halo em vez de contorno preto: o mesmo texto é desenhado numa camada preta,
   * borrado e somado em `screen`, e a versão nítida entra por cima. Contorno grosso lê como
   * legenda de televisão; o halo separa o texto do fundo sem desenhar moldura em volta dele.
   *
   * O `format=gbrp` antes do blend não é decoração. Em YUV o modo screen também opera nos planos
   * de croma, centrados em 128, e o resultado sai com um magenta que não existe na foto.
   */
  const filtro =
    `[0:v]scale=${largura}:${altura}:force_original_aspect_ratio=increase,crop=${largura}:${altura},setsar=1,` +
    `eq=contrast=${contraste}:saturation=${saturacao}:brightness=${brilho},` +
    `vignette=PI/3.5,format=gbrp[bg];` +
    `color=c=black:s=${largura}x${altura},format=gbrp,${textos},gblur=sigma=24[glow];` +
    `[bg][glow]blend=all_mode=screen:all_opacity=${halo.toFixed(2)},format=yuv420p[lit];` +
    `[lit]${textos}[out]`;

  await run(FFMPEG, [
    "-y", "-hide_banner", "-loglevel", "error",
    "-loop", "1", "-i", origem,
    "-filter_complex", filtro, "-map", "[out]",
    "-frames:v", "1", "-q:v", "2", saida,
  ]);
}
