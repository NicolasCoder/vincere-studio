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
export function buildAss(t: Timeline, p: RenderProfile, mode: "subtle-bottom" | "bold-center-animated"): string {
  const vertical = p.height > p.width;
  const fontSize = vertical ? Math.round(p.height * 0.045) : Math.round(p.height * 0.042);

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
  const marginV = vertical ? Math.round(p.height * 0.47) : Math.round(p.height * 0.07);
  const alignment = vertical ? 8 : 2;
  const bord = vertical ? 4 : 2;
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${p.width}
PlayResY: ${p.height}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Base,Segoe UI,${fontSize},&H00F8FAFC,&H00EED322,&H00101820,&H80000000,${mode === "bold-center-animated" ? -1 : 0},0,0,0,100,100,0,0,1,${bord},${vertical ? 0 : 1},${alignment},60,60,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  const lines: string[] = [];
  let offset = 0;
  const perLine = mode === "bold-center-animated" ? 3 : 7;
  for (const a of t.acts) {
    const words = a.words;
    for (let i = 0; i < words.length; i += perLine) {
      const chunk = words.slice(i, i + perLine);
      const start = offset + chunk[0].startMs;
      const end = offset + chunk[chunk.length - 1].endMs + 120;
      if (mode === "bold-center-animated") {
        // Uma linha por palavra em destaque (karaokê simples).
        //
        // O destaque é cor + um engrossamento da borda que assenta em 120ms. Movimento de
        // verdade (escala, deslocamento) foi descartado de propósito: qualquer coisa que mude a
        // largura do texto reflui a linha inteira, e o bloco volta a balançar — que é
        // exatamente o problema que estamos corrigindo. Borda não altera o avanço do glifo.
        const ativo = `{\\c&HEED322&\\b1\\bord${bord + 3}\\t(0,120,\\bord${bord})}`;
        const normal = `{\\c&HF8FAFC&\\b1\\bord${bord}}`;
        for (let k = 0; k < chunk.length; k++) {
          const ws = offset + chunk[k].startMs;
          const we = k === chunk.length - 1 ? end : offset + chunk[k + 1].startMs;
          // Maiúscula só nas palavras: passar toUpperCase na linha inteira maiúsculiza também as
          // tags de override. O libass tolera, mas depender dessa tolerância é frágil à toa.
          const text = chunk
            .map((w, j) => (j === k ? `${ativo}${esc(w.text).toUpperCase()}${normal}` : esc(w.text).toUpperCase()))
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
