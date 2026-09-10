import { AbsoluteFill, CanvasImage, staticFile } from "remotion";
import { CAPTION_BAND_TOP_PCT, DVP } from "./tokens";
import { LowerThird, type LowerThirdStyle } from "./LowerThird";
import { OverlayDado } from "./OverlayDado";

export type ProvaProps = {
  /** Frame real extraído do master, em public/masters/ */
  frame: string;
  layout: "lower-third" | "overlay-dado";
  lowerThirdStyle: LowerThirdStyle;
  primary: string;
  secondary?: string;
  onLight: boolean;
  /** Desenha a faixa proibida das legendas queimadas, para conferir invasão. */
  showSafeZone: boolean;
};

/**
 * Banco de prova: um layout DVP sobre um frame real do master, para validar tipografia,
 * contraste e zona segura antes de ligar o pipeline inteiro.
 */
export const Prova: React.FC<ProvaProps> = ({
  frame,
  layout,
  lowerThirdStyle,
  primary,
  secondary,
  onLight,
  showSafeZone,
}) => {
  return (
    <AbsoluteFill name="Prova" style={{ backgroundColor: DVP.carvao }}>
      <CanvasImage src={staticFile(`masters/${frame}`)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />

      {layout === "lower-third" ? (
        <LowerThird style={lowerThirdStyle} primary={primary} secondary={secondary} />
      ) : (
        <OverlayDado primary={primary} secondary={secondary} onLight={onLight} />
      )}

      {showSafeZone ? (
        <AbsoluteFill name="GuiaZonaSegura">
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: `${CAPTION_BAND_TOP_PCT}%`,
              bottom: 0,
              background: "#FF000022",
              borderTop: "2px dashed #FF3B3B",
            }}
          />
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
