import { AbsoluteFill, Easing, Interactive, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { DVP, bodyFont, titleFont } from "./tokens";

/**
 * Destaque de dado: um número em evidência no canto superior direito, com uma linha de apoio.
 * Fica fora da faixa das legendas por construção (topo do quadro).
 *
 * `onLight` inverte o tratamento quando o master atrás está claro — sem isso, texto claro sobre
 * B-roll claro some. Vem da luma medida no frame real pelo job GENERATE_EDIT_PLAN.
 */
export const OverlayDado: React.FC<{
  primary: string;
  secondary?: string;
  onLight?: boolean;
}> = ({ primary, secondary, onLight = false }) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const enter = { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) } as const;

  return (
    <AbsoluteFill name="OverlayDado">
      <Interactive.Div
        name="Bloco"
        style={{
          position: "absolute",
          right: "6%",
          top: "10%",
          maxWidth: "34%",
          textAlign: "right",
          padding: onLight ? `${height * 0.016}px ${height * 0.022}px` : 0,
          background: onLight ? `${DVP.carvao}E6` : "transparent",
          borderRight: `${height * 0.005}px solid ${DVP.cobre}`,
          paddingRight: height * 0.022,
          opacity: interpolate(frame, [0, 0.35 * fps], [0, 1], enter),
          translate: interpolate(frame, [0, 0.5 * fps], ["18px 0px", "0px 0px"], enter),
        }}
      >
        <Interactive.Div
          name="Numero"
          style={{
            fontFamily: titleFont,
            fontSize: height * 0.075,
            fontWeight: 700,
            color: DVP.creme,
            lineHeight: 1.05,
            textShadow: onLight ? "none" : `0 ${height * 0.003}px ${height * 0.014}px #000000CC`,
          }}
        >
          {primary}
        </Interactive.Div>
        {secondary ? (
          <Interactive.Div
            name="Apoio"
            style={{
              fontFamily: bodyFont,
              fontSize: height * 0.024,
              fontWeight: 400,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: DVP.areia,
              marginTop: height * 0.006,
              textShadow: onLight ? "none" : `0 ${height * 0.002}px ${height * 0.01}px #000000CC`,
              opacity: interpolate(frame, [0.15 * fps, 0.55 * fps], [0, 1], enter),
            }}
          >
            {secondary}
          </Interactive.Div>
        ) : null}
      </Interactive.Div>
    </AbsoluteFill>
  );
};
