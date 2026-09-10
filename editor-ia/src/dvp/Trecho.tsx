import { Video } from "@remotion/media";
import { AbsoluteFill, Sequence, staticFile, useVideoConfig } from "remotion";
import { LowerThird, type LowerThirdStyle } from "./LowerThird";
import { OverlayDado } from "./OverlayDado";
import { Intertitulo } from "./Intertitulo";
import { TRECHO_INSERTIONS } from "./trecho-data";

export type TrechoInsertion = {
  id: string;
  layout: "lower-third" | "overlay-dado" | "graphic-fullscreen" | "insert-arquivo" | "split-evidencia";
  lowerThirdStyle: LowerThirdStyle | null;
  primary: string;
  secondary: string | null;
  /** Relativo ao início do trecho. */
  startMs: number;
  endMs: number;
  /** Master claro atrás — medido no frame real pelo job GENERATE_EDIT_PLAN. */
  onLight: boolean;
};

/**
 * Camada visual aplicada sobre um trecho do master do DocuPulse.
 *
 * O master entra como uma única <Video> contínua — imagem e som vêm dele, e nada aqui corta,
 * reordena ou mexe no áudio. Cada inserção é uma <Sequence> por cima, com o tempo vindo do
 * EditPlan, que por sua vez o derivou das legendas alinhadas.
 */
export const Trecho: React.FC<{ master: string; burnedCaptions?: boolean }> = ({ master, burnedCaptions = false }) => {
  const { fps } = useVideoConfig();
  const toFrames = (ms: number) => Math.round((ms / 1000) * fps);

  return (
    <AbsoluteFill name="Trecho" style={{ backgroundColor: "black" }}>
      <Video src={staticFile(master)} />

      {TRECHO_INSERTIONS.map((ins) => {
        const from = toFrames(ins.startMs);
        const durationInFrames = Math.max(1, toFrames(ins.endMs) - from);
        return (
          <Sequence key={ins.id} name={`${ins.layout} · ${ins.primary}`} from={from} durationInFrames={durationInFrames} premountFor={fps}>
            {ins.layout === "graphic-fullscreen" ? (
              <Intertitulo primary={ins.primary} secondary={ins.secondary ?? undefined} />
            ) : ins.layout === "overlay-dado" ? (
              <OverlayDado primary={ins.primary} secondary={ins.secondary ?? undefined} onLight={ins.onLight} />
            ) : ins.layout === "lower-third" ? (
              <LowerThird
                style={ins.lowerThirdStyle ?? "DATADO"}
                primary={ins.primary}
                secondary={ins.secondary ?? undefined}
                burnedCaptions={burnedCaptions}
              />
            ) : null /* insert-arquivo e split-evidencia dependem de um asset de evidencia, que
                        ainda nao vem do plano — cair para null deixa o master limpo em vez de
                        mostrar uma moldura vazia. */}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
