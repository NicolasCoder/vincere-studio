// Prepara texto em português para síntese de voz. Motores de TTS leem "1962" dígito a dígito ou
// em inglês, tropeçam em "US$" e em marcações do roteiro; escrever por extenso é o que mais melhora
// a pronúncia. Também divide em trechos por frase: gerações longas de uma vez saem mais instáveis.

const UNIDADES = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "catorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CENTENAS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];
const ORDINAIS_M = ["", "primeiro", "segundo", "terceiro", "quarto", "quinto", "sexto", "sétimo", "oitavo", "nono", "décimo"];
const ORDINAIS_F = ["", "primeira", "segunda", "terceira", "quarta", "quinta", "sexta", "sétima", "oitava", "nona", "décima"];

function ate999(n: number): string {
  if (n < 20) return UNIDADES[n];
  if (n < 100) {
    const d = Math.floor(n / 10);
    const u = n % 10;
    return u ? `${DEZENAS[d]} e ${UNIDADES[u]}` : DEZENAS[d];
  }
  if (n === 100) return "cem";
  const c = Math.floor(n / 100);
  const resto = n % 100;
  return resto ? `${CENTENAS[c]} e ${ate999(resto)}` : CENTENAS[c];
}

/** Inteiro por extenso (até a casa dos trilhões). */
export function numeroPorExtenso(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  if (n < 0) return `menos ${numeroPorExtenso(-n)}`;
  n = Math.floor(n);
  if (n < 1000) return ate999(n);
  const escalas: Array<[number, string, string]> = [
    [1e12, "trilhão", "trilhões"],
    [1e9, "bilhão", "bilhões"],
    [1e6, "milhão", "milhões"],
    [1e3, "mil", "mil"],
  ];
  const partes: string[] = [];
  let resto = n;
  for (const [valor, sing, plur] of escalas) {
    const q = Math.floor(resto / valor);
    if (!q) continue;
    resto %= valor;
    if (valor === 1e3) partes.push(q === 1 ? "mil" : `${ate999(q)} mil`);
    else partes.push(`${numeroPorExtenso(q)} ${q === 1 ? sing : plur}`);
  }
  if (resto) partes.push(ate999(resto));
  // "e" antes do último bloco quando ele é < 100 ou centena redonda (mil e dez, mil e duzentos).
  if (partes.length > 1 && resto && (resto < 100 || resto % 100 === 0)) {
    const ultimo = partes.pop()!;
    return `${partes.join(" ")} e ${ultimo}`;
  }
  return partes.join(" ");
}

function decimalPorExtenso(inteiro: string, frac: string): string {
  const i = numeroPorExtenso(Number(inteiro.replace(/\./g, "")));
  const f = frac.replace(/0+$/, "");
  return f ? `${i} vírgula ${f.split("").map((d) => UNIDADES[Number(d)]).join(" ")}` : i;
}

/** Normaliza o texto para a voz ler como um narrador brasileiro leria. */
export function prepararTextoParaFala(texto: string): string {
  let t = texto;
  // Marcações do roteiro e do HyperFrames não são faladas.
  t = t.replace(/\[(?:fx|motion|ING)[^\]]*\]/gi, " ");
  // Moeda: US$ 35 / R$ 1.200,50 / $50
  t = t.replace(/(US\$|R\$|\$)\s?(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{1,2}))?/g, (_m, moeda: string, int: string, cent?: string) => {
    const nome = moeda === "R$" ? ["real", "reais"] : ["dólar", "dólares"];
    const v = Number(int.replace(/\./g, ""));
    let s = `${numeroPorExtenso(v)} ${v === 1 ? nome[0] : nome[1]}`;
    if (cent && Number(cent)) s += ` e ${numeroPorExtenso(Number(cent.padEnd(2, "0")))} centavos`;
    return s;
  });
  // Porcentagem: 85% / 12,5%
  t = t.replace(/(\d+)(?:,(\d+))?\s?%/g, (_m, i: string, f?: string) => `${f ? decimalPorExtenso(i, f) : numeroPorExtenso(Number(i))} por cento`);
  // Ordinais: 1º, 2ª
  t = t.replace(/\b(\d{1,2})\s?([ºª])/g, (_m, n: string, g: string) => {
    const v = Number(n);
    const tabela = g === "ª" ? ORDINAIS_F : ORDINAIS_M;
    return v <= 10 ? tabela[v] : `${numeroPorExtenso(v)}${g === "ª" ? "ª" : "º"}`;
  });
  // Decimais e milhares: 1.200 / 3,5
  t = t.replace(/\b(\d{1,3}(?:\.\d{3})+|\d+),(\d+)\b/g, (_m, i: string, f: string) => decimalPorExtenso(i, f));
  t = t.replace(/\b\d{1,3}(?:\.\d{3})+\b/g, (m) => numeroPorExtenso(Number(m.replace(/\./g, ""))));
  // Inteiros soltos (anos incluídos: 1962 → mil novecentos e sessenta e dois).
  t = t.replace(/\b\d+\b/g, (m) => numeroPorExtenso(Number(m)));
  // Abreviações comuns.
  t = t.replace(/\bSr\./g, "senhor").replace(/\bSra\./g, "senhora").replace(/\bDr\./g, "doutor").replace(/\bnº\b/gi, "número");
  return t.replace(/\s+/g, " ").replace(/\s([,.;:!?])/g, "$1").trim();
}

/** Divide em trechos por frase, sem passar de `max` caracteres (gerações curtas soam mais estáveis). */
export function dividirEmTrechos(texto: string, max = 320): string[] {
  const frases = texto.match(/[^.!?…]+[.!?…]+["”']?|[^.!?…]+$/g) ?? [texto];
  const trechos: string[] = [];
  let atual = "";
  for (const f of frases.map((x) => x.trim()).filter(Boolean)) {
    if ((atual + " " + f).trim().length > max && atual) {
      trechos.push(atual.trim());
      atual = f;
    } else {
      atual = `${atual} ${f}`;
    }
  }
  if (atual.trim()) trechos.push(atual.trim());
  return trechos;
}

/** Tira marcações do roteiro ([fx: …], [motion: …], [ING: …]) mantendo o texto que aparece na tela. */
export function limparMarcacoes(texto: string): string {
  return texto.replace(/\[(?:fx|motion|ING)[^\]]*\]/gi, " ").replace(/\s+/g, " ").trim();
}

export interface PalavraTempo {
  word: string;
  start: number;
  end: number;
}

/**
 * Tempo de cada palavra sem transcrição: sabemos o texto exato e a duração de cada trecho
 * gerado. Dentro do trecho, cada palavra pesa o tamanho dela FALADA ("1962" pesa como
 * "mil novecentos e sessenta e dois") e vírgulas/pontos ganham respiro. A legenda mostra
 * a palavra como foi escrita. Formato do subtitles-studio: { word, start, end } em segundos.
 */
export function alinharPalavras(trechosOriginais: string[], duracoesS: number[], pausaS: number): PalavraTempo[] {
  const saida: PalavraTempo[] = [];
  let base = 0;
  trechosOriginais.forEach((trecho, i) => {
    const dur = duracoesS[i] ?? 0;
    const palavras = trecho.split(/\s+/).filter(Boolean);
    // Margens do motor de voz: um respiro antes da 1ª palavra e depois da última.
    const ini = Math.min(0.08, dur * 0.05);
    const fim = Math.max(ini, dur - Math.min(0.15, dur * 0.06));
    const pesos = palavras.map((p) => {
      const falada = prepararTextoParaFala(p).replace(/[^\p{L}\p{N}]/gu, "");
      const respiro = /[.!?…]$/.test(p) ? 8 : /[,;:]$/.test(p) ? 4 : 0;
      return { fala: Math.max(2, falada.length), respiro };
    });
    const total = pesos.reduce((s, w) => s + w.fala + w.respiro, 0) || 1;
    const porUnidade = (fim - ini) / total;
    let t = ini;
    palavras.forEach((p, j) => {
      const start = base + t;
      t += pesos[j].fala * porUnidade;
      saida.push({ word: p, start: Math.round(start * 1000) / 1000, end: Math.round((base + t) * 1000) / 1000 });
      t += pesos[j].respiro * porUnidade;
    });
    base += dur + pausaS;
  });
  return saida;
}

function tempoSrt(s: number) {
  const ms = Math.max(0, Math.round(s * 1000));
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const seg = Math.floor((ms % 60_000) / 1000);
  const mil = ms % 1000;
  const p = (n: number, d = 2) => String(n).padStart(d, "0");
  return `${p(h)}:${p(m)}:${p(seg)},${p(mil, 3)}`;
}

/** SRT com linhas curtas (até 5 palavras ou ~32 caracteres), quebrando em pontuação forte. */
export function gerarSrt(palavras: PalavraTempo[]): string {
  const blocos: PalavraTempo[][] = [];
  let atual: PalavraTempo[] = [];
  for (const w of palavras) {
    atual.push(w);
    const texto = atual.map((x) => x.word).join(" ");
    if (atual.length >= 5 || texto.length >= 32 || /[.!?…]$/.test(w.word)) {
      blocos.push(atual);
      atual = [];
    }
  }
  if (atual.length) blocos.push(atual);
  return blocos
    .map((b, i) => `${i + 1}\n${tempoSrt(b[0].start)} --> ${tempoSrt(b[b.length - 1].end)}\n${b.map((x) => x.word).join(" ")}\n`)
    .join("\n");
}
