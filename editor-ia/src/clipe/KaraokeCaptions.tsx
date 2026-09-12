import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { uiSwitch } from "@remotion/sfx";
import { Underline } from "@remotion/rough-notation";
import { fonteClipe } from "./fonts";

export type CaptionWord = {
  text: string;
  startMs: number;
  endMs: number;
  /** Marcada na revisão da transcrição — ganha brilho + sublinhado em vez do destaque comum. */
  emphasis?: boolean;
};

export type KaraokeCaptionsProps = {
  words: CaptionWord[];
  corTexto: string;
  corAtiva: string;
  corBrilho: string;
  corSublinhado?: string;
  /** Palavras por linha — 3 é o mesmo número do modo "bold-center-animated" do documentário. */
  porLinha?: number;
}

/**
 * Recorta o próximo grupo, fechando cedo se a frase terminar antes do limite — mesma regra de
 * `recortarAteFimDeFrase` em packages/render/src/captions.ts, reescrita aqui porque ali o alvo é
 * ASS/libass (estático) e aqui é uma animação Remotion de verdade (interpolate por frame).
 */
function chunkWords(words: CaptionWord[], max: number): CaptionWord[][] {
  const chunks: CaptionWord[][] = [];
  let i = 0;
  while (i < words.length) {
    let fim = Math.min(i + max, words.length);
    for (let j = i; j < fim; j++) {
      if (/[.!?…:]["')\]]?$/.test(words[j].text)) {
        fim = j + 1;
        break;
      }
    }
    chunks.push(words.slice(i, fim));
    i = fim;
  }
  return chunks;
}

/**
 * Legenda karaokê palavra a palavra — a peça que não existe em lugar nenhum do código hoje.
 * `buildAss` (documentário) faz o destaque via libass estático; aqui é `interpolate()` real por
 * frame, o que permite o efeito de brilho+sublinhado nas palavras marcadas que o ASS não faz.
 */
export const KaraokeCaptions: React.FC<KaraokeCaptionsProps> = ({
  words,
  corTexto,
  corAtiva,
  corBrilho,
  corSublinhado,
  porLinha = 3,
}) => {
  const { fps } = useVideoConfig();
  const toFrames = (ms: number) => Math.round((ms / 1000) * fps);
  const chunks = chunkWords(words, porLinha);
  // Som curto só nas palavras marcadas — um <Sequence> próprio por palavra, em frame absoluto,
  // porque as linhas de texto (abaixo) são relativas ao chunk, não à composição inteira.
  const palavrasComSom = words.filter((w) => w.emphasis);

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        translate: "241.5px -77.4px",
      }}
    >
      {chunks.map((chunk, idx) => {
        const from = toFrames(chunk[0].startMs);
        const durationInFrames = Math.max(1, toFrames(chunk[chunk.length - 1].endMs) - from);
        return (
          <Sequence key={idx} from={from} durationInFrames={durationInFrames} premountFor={fps}>
            <Linha chunk={chunk} corTexto={corTexto} corAtiva={corAtiva} corBrilho={corBrilho} corSublinhado={corSublinhado ?? corBrilho} />
          </Sequence>
        );
      })}

      {palavrasComSom.map((w, idx) => (
        <Sequence key={`sfx-${idx}`} from={toFrames(w.startMs)} durationInFrames={Math.round(fps * 0.6)} layout="none">
          <Audio src={uiSwitch} volume={0.5} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

const Linha: React.FC<{
  chunk: CaptionWord[];
  corTexto: string;
  corAtiva: string;
  corBrilho: string;
  corSublinhado: string;
}> = ({ chunk, corTexto, corAtiva, corBrilho, corSublinhado }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const nowMs = (frame / fps) * 1000 + chunk[0].startMs;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: "0.35em",
        maxWidth: "88%",
        fontFamily: fonteClipe,
        fontWeight: 800,
        fontSize: 64,
        lineHeight: 1.15,
        textTransform: "uppercase",
      }}
    >
      {chunk.map((w, k) => {
        const ativo = nowMs >= w.startMs && nowMs < w.endMs;
        // Pop de escala nos primeiros 120ms da palavra ativa — o ASS evita isso por reflow, mas
        // aqui cada palavra tem largura própria (flex-wrap), então uma palavra crescer não empurra
        // as outras de layout de forma perceptível.
        const localMs = nowMs - w.startMs;
        const pop = ativo ? interpolate(localMs, [0, 120], [1, 1.08], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;

        const base = {
          display: "inline-block",
          transform: `scale(${pop})`,
          color: ativo ? corAtiva : corTexto,
          textShadow: "0 2px 4px rgba(0,0,0,0.7)",
        } as const;

        if (w.emphasis) {
          // Traço desenhado de verdade (rough-notation), não um text-decoration ligado/desligado —
          // começa a desenhar no instante em que a palavra vira ativa e fica riscado depois.
          const desenhado = interpolate(nowMs - w.startMs, [0, 150], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <Underline key={k} color={corSublinhado} strokeWidth={4} padding={{ top: 2 }} progress={desenhado}>
              <span
                style={{
                  ...base,
                  color: ativo ? corAtiva : corBrilho,
                  textShadow: `0 0 12px ${corBrilho}, 0 0 24px ${corBrilho}, 0 2px 4px rgba(0,0,0,0.7)`,
                }}
              >
                {w.text}
              </span>
            </Underline>
          );
        }
        return (
          <span key={k} style={base}>
            {w.text}
          </span>
        );
      })}
    </div>
  );
};
