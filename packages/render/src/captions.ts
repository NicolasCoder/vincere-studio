import { corAss, getEditProfile, type EstiloLegenda } from "@docupulse/core";

/** Identidade que estava cravada no ASS; segue como padrao quando nenhum perfil e passado. */
const LEGENDA_PADRAO: EstiloLegenda = getEditProfile(null).legenda;

/** Dentro de uma tag inline o ASS usa &Hbbggrr& — sem o 00 do estilo e com & no fim. */
const corAssInline = (hex: string) => corAss(hex).replace("&H00", "&H") + "&";

import type { Timeline } from "./timeline";
import type { RenderProfile } from "./profiles";

const fmt = (ms: number) => {
  const cs = Math.round(ms / 10);
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  const c = cs % 100;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(c).padStart(2, "0")}`;
};
const esc = (t: string) => t.replace(/\\/g, "\\\\").replace(/\{/g, "(").replace(/\}/g, ")").replace(/\n/g, " ");

/**
 * Gera um arquivo ASS com as legendas a partir das palavras alinhadas.
 * Longo (16:9): linhas de até 7 palavras no rodapé, discretas.
 * Curto (9:16): 2–3 palavras por vez, grandes, centralizadas, com a palavra atual em destaque.
 */
/** Tempo no formato do SubRip: HH:MM:SS,mmm (vírgula, não ponto — o YouTube recusa com ponto). */
const fmtSrt = (ms: number) => {
  const total = Math.max(0, Math.round(ms));
  const h = Math.floor(total / 3_600_000);
  const m = Math.floor((total % 3_600_000) / 60_000);
  const s = Math.floor((total % 60_000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(total % 1000).padStart(3, "0")}`;
};

export interface FaixaLegenda {
  /** Deslocamento do ato no vídeo inteiro, em ms. */
  offsetMs: number;
  /** Palavras alinhadas, com tempo relativo ao ato. */
  words: { text: string; startMs: number; endMs: number }[];
}

/**
 * Gera legenda .srt com tempos absolutos, para enviar ao YouTube como faixa de legenda.
 *
 * Diferente do ASS, que é queimado na imagem: isto é texto que o YouTube indexa, traduz e oferece
 * como CC. No vídeo longo é a única legenda que existe — o master não queima nada de propósito,
 * porque o rodapé livre é onde a camada visual DVP põe os lower thirds.
 *
 * Agrupa por pausa, não por contagem fixa de palavras: quebrar a cada N palavras corta frase no
 * meio e o resultado fica difícil de ler. Uma pausa acima de `pausaMs` fecha a linha.
 */
export function buildSrt(faixas: FaixaLegenda[], opts: { maxPalavras?: number; maxMs?: number; pausaMs?: number } = {}): string {
  const maxPalavras = opts.maxPalavras ?? 12;
  const maxMs = opts.maxMs ?? 6000;
  const pausaMs = opts.pausaMs ?? 450;

  const linhas: { startMs: number; endMs: number; texto: string }[] = [];
  for (const f of faixas) {
    let atual: { startMs: number; endMs: number; palavras: string[] } | null = null;
    let fimAnterior: number | null = null;

    for (const w of f.words) {
      const ini = f.offsetMs + w.startMs;
      const fim = f.offsetMs + w.endMs;
      const quebrou =
        !atual ||
        atual.palavras.length >= maxPalavras ||
        fim - atual.startMs > maxMs ||
        (fimAnterior != null && f.offsetMs + w.startMs - fimAnterior > pausaMs);

      if (quebrou || !atual) {
        if (atual) linhas.push({ startMs: atual.startMs, endMs: atual.endMs, texto: atual.palavras.join(" ") });
        atual = { startMs: ini, endMs: fim, palavras: [w.text] };
      } else {
        atual.palavras.push(w.text);
        atual.endMs = fim;
      }
      fimAnterior = fim;
    }
    if (atual) linhas.push({ startMs: atual.startMs, endMs: atual.endMs, texto: atual.palavras.join(" ") });
  }

  return (
    linhas
      .filter((l) => l.texto.trim())
      .map((l, i) => `${i + 1}\n${fmtSrt(l.startMs)} --> ${fmtSrt(Math.max(l.endMs, l.startMs + 300))}\n${l.texto.trim()}`)
      .join("\n\n") + "\n"
  );
}

/**
 * Recorta o próximo grupo de palavras, fechando no fim da frase quando ela termina antes do limite.
 *
 * Cortar a cada N palavras fixas junta o fim de uma frase com o começo da próxima na mesma linha
 * — "PRÓPRIOS ANIMAIS. ELES" — e o ponto final no meio da tela lê como erro, não como pontuação.
 * Fechar na pontuação custa uma linha às vezes mais curta, o que é melhor do que uma linha que
 * mistura duas ideias.
 */
function recortarAteFimDeFrase(
  words: { text: string; startMs: number; endMs: number }[],
  inicio: number,
  max: number,
): { text: string; startMs: number; endMs: number }[] {
  const fim = Math.min(inicio + max, words.length);
  for (let j = inicio; j < fim; j++) {
    // Só pontuação que encerra period: vírgula e ponto e vírgula seguram a frase.
    if (/[.!?…:]["')\]]?$/.test(words[j].text)) return words.slice(inicio, j + 1);
  }
  return words.slice(inicio, fim);
}

export function buildAss(
  t: Timeline,
  p: RenderProfile,
  mode: "subtle-bottom" | "bold-center-animated",
  /** Estilo do perfil de edição. Sem ele, mantém a identidade que já estava cravada aqui. */
  estilo: EstiloLegenda = LEGENDA_PADRAO,
): string {
  const vertical = p.height > p.width;
  const fontSize = Math.round(p.height * (vertical ? estilo.tamanhoRel.vertical : estilo.tamanhoRel.horizontal));

  /**
   * Vertical ancora no TOPO (alinhamento 8), não no meio.
   *
   * Com alinhamento 5 o bloco fica centrado na altura, então uma legenda que quebra em duas
   * linhas cresce para os dois lados e a primeira linha sobe meia altura de linha — de volta ao
   * lugar na legenda seguinte, que cabe em uma linha só. É esse vai e vem que se vê como
   * "aparece e sobe um pouco". Ancorando no topo, a primeira linha fica sempre no mesmo y e o
   * que cresce cresce para baixo.
   *
   * 0,47 põe a linha única praticamente onde ela já estava, então o enquadramento não muda.
   */
  const posicao = estilo.posicao ?? (vertical ? "top" : "bottom");
  // Sem posição explícita, mantém a coordenada histórica dos projetos antigos. Presets novos e
  // o editor visual sempre gravam a posição, então usam margens semânticas fiéis à prévia.
  const marginV = estilo.posicao == null
    ? vertical ? Math.round(p.height * 0.47) : Math.round(p.height * 0.07)
    : posicao === "top"
      ? Math.round(p.height * 0.1)
      : posicao === "center"
        ? 0
        : Math.round(p.height * (vertical ? 0.16 : 0.07));
  const alignment = posicao === "top" ? 8 : posicao === "center" ? 5 : 2;
  const bord = estilo.contorno ?? (vertical ? 4 : 2);
  const shadow = estilo.sombra ?? (vertical ? 0 : 1);
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${p.width}
PlayResY: ${p.height}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Base,${estilo.fonte},${fontSize},${corAss(estilo.cor)},${corAss(estilo.corAtiva)},${corAss(estilo.corContorno)},&H80000000,${mode === "bold-center-animated" ? -1 : 0},0,0,0,100,100,0,0,1,${bord},${shadow},${alignment},60,60,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  const lines: string[] = [];
  let offset = 0;
  const perLine = Math.max(2, Math.min(10, Math.round(estilo.palavrasPorLinha ?? (mode === "bold-center-animated" ? 3 : 7))));
  const uppercase = estilo.maiusculas ?? mode === "bold-center-animated";
  for (const a of t.acts) {
    const words = a.words;
    for (let i = 0; i < words.length; ) {
      const chunk = recortarAteFimDeFrase(words, i, perLine);
      i += chunk.length;
      const start = offset + chunk[0].startMs;
      const end = offset + chunk[chunk.length - 1].endMs + 120;
      if (mode === "bold-center-animated") {
        // Uma linha por palavra em destaque (karaokê simples).
        //
        // O destaque é cor + um engrossamento da borda que assenta em 120ms. Movimento de
        // verdade (escala, deslocamento) foi descartado de propósito: qualquer coisa que mude a
        // largura do texto reflui a linha inteira, e o bloco volta a balançar — que é
        // exatamente o problema que estamos corrigindo. Borda não altera o avanço do glifo.
        const ativo = `{\\c${corAssInline(estilo.corAtiva)}\\b1\\bord${bord + 3}\\t(0,120,\\bord${bord})}`;
        const normal = `{\\c${corAssInline(estilo.cor)}\\b1\\bord${bord}}`;
        for (let k = 0; k < chunk.length; k++) {
          const ws = offset + chunk[k].startMs;
          const we = k === chunk.length - 1 ? end : offset + chunk[k + 1].startMs;
          // Maiúscula só nas palavras: passar toUpperCase na linha inteira maiúsculiza também as
          // tags de override. O libass tolera, mas depender dessa tolerância é frágil à toa.
          const palavra = (text: string) => uppercase ? esc(text).toUpperCase() : esc(text);
          const text = chunk
            .map((w, j) => (j === k ? `${ativo}${palavra(w.text)}${normal}` : palavra(w.text)))
            .join(" ");
          // Só a primeira palavra do trecho abre com fade: por palavra viraria piscada.
          const entrada = k === 0 ? "{\\fad(70,0)}" : "";
          lines.push(`Dialogue: 0,${fmt(ws)},${fmt(we)},Base,,0,0,0,,${entrada}${text}`);
        }
      } else {
        lines.push(`Dialogue: 0,${fmt(start)},${fmt(end)},Base,,0,0,0,,${esc(chunk.map((w) => w.text).join(" "))}`);
      }
    }
    offset += a.voiceDurationMs + t.gapMs;
  }
  return header + lines.join("\n") + "\n";
}
