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
  const marginV = vertical ? Math.round(p.height * 0.38) : Math.round(p.height * 0.07);
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${p.width}
PlayResY: ${p.height}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Base,Segoe UI,${fontSize},&H00F8FAFC,&H00EED322,&H00101820,&H80000000,${mode === "bold-center-animated" ? -1 : 0},0,0,0,100,100,0,0,1,${vertical ? 4 : 2},${vertical ? 0 : 1},${vertical ? 5 : 2},60,60,${marginV},1
Style: Hi,Segoe UI,${Math.round(fontSize * 1.08)},&H00EED322,&H00EED322,&H00101820,&H80000000,-1,0,0,0,100,100,0,0,1,${vertical ? 4 : 2},${vertical ? 0 : 1},${vertical ? 5 : 2},60,60,${marginV},1

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
        // uma linha por palavra em destaque (karaokê simples)
        for (let k = 0; k < chunk.length; k++) {
          const ws = offset + chunk[k].startMs;
          const we = k === chunk.length - 1 ? end : offset + chunk[k + 1].startMs;
          const text = chunk.map((w, j) => (j === k ? `{\\c&HEED322&\\b1}${esc(w.text)}{\\c&HF8FAFC&\\b1}` : esc(w.text))).join(" ");
          lines.push(`Dialogue: 0,${fmt(ws)},${fmt(we)},Base,,0,0,0,,${text.toUpperCase()}`);
        }
      } else {
        lines.push(`Dialogue: 0,${fmt(start)},${fmt(end)},Base,,0,0,0,,${esc(chunk.map((w) => w.text).join(" "))}`);
      }
    }
    offset += a.voiceDurationMs + t.gapMs;
  }
  return header + lines.join("\n") + "\n";
}
