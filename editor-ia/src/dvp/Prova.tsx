import { AbsoluteFill, CanvasImage, staticFile, useVideoConfig } from "remotion";
import { DVP, zonaProibida } from "./tokens";
import { LowerThird, type LowerThirdStyle } from "./LowerThird";
import { OverlayDado } from "./OverlayDado";
import { InsertArquivo, type SubstratoKind } from "./InsertArquivo";

export type ProvaProps = {
  /** Frame real extraído do master, em public/masters/ */
  frame: string;
  layout: "lower-third" | "overlay-dado" | "insert-arquivo";
  lowerThirdStyle: LowerThirdStyle;
  substrato: SubstratoKind;
  primary: string;
  secondary?: string;
  onLight: boolean;
  /** O master tem legenda queimada? Muda onde o rodapé fica proibido. */
  burnedCaptions: boolean;
  /** Desenha a faixa proibida do rodapé, para conferir invasão. */
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
  substrato,
  primary,
  secondary,
  onLight,
  burnedCaptions,
  showSafeZone,
}) => {
  const { width, height } = useVideoConfig();
  // A guia desenha a faixa REAL: no Short ela fica no meio, não no rodapé.
  const zona = zonaProibida(width, height, burnedCaptions);
  return (
    <AbsoluteFill name="Prova" style={{ backgroundColor: DVP.carvao }}>
      <CanvasImage src={staticFile(`masters/${frame}`)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />

      {layout === "lower-third" ? (
        <LowerThird style={lowerThirdStyle} primary={primary} secondary={secondary} burnedCaptions={burnedCaptions} />
      ) : layout === "insert-arquivo" ? (
        <InsertArquivo substrato={substrato} primary={primary} secondary={secondary} evidencia={`masters/${frame}`} />
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
              top: `${zona.fromPct}%`,
              bottom: `${100 - zona.toPct}%`,
              background: "#FF000022",
              borderTop: "2px dashed #FF3B3B",
              borderBottom: zona.toPct < 100 ? "2px dashed #FF3B3B" : "none",
            }}
          />
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
