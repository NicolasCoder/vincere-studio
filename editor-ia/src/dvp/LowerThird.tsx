import { AbsoluteFill, Easing, Interactive, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { DVP, SIDE_MARGIN_PCT, bodyFont, bottomBandTopPct, titleFont } from "./tokens";

export type LowerThirdStyle = "AUTORIDADE" | "EMOCIONAL" | "DATADO";

/**
 * Lower third nos três estilos das artes DVP.
 *
 * AUTORIDADE: placa de metal escovado, para fonte/instituição — o único com fundo opaco, então é
 * também o fallback quando o master está claro atrás.
 * EMOCIONAL: sem placa, texto claro com sombra. Só serve sobre fundo escuro.
 * DATADO: caixa pequena e translúcida, para data/local.
 */
export const LowerThird: React.FC<{
  style: LowerThirdStyle;
  primary: string;
  secondary?: string;
  /** Quando o master tem legenda queimada, a placa sobe para nao invadir a faixa. */
  burnedCaptions?: boolean;
}> = ({ style, primary, secondary, burnedCaptions = false }) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();

  // Sobe e aparece; a saída fica por conta do <Sequence> que envolve o componente.
  const enter = { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) } as const;

  return (
    <AbsoluteFill name={`LowerThird ${style}`}>
      <Interactive.Div
        name="Placa"
        style={{
          position: "absolute",
          left: `${SIDE_MARGIN_PCT}%`,
          // Ancorado logo acima da faixa proibida do rodape — nunca invade.
          bottom: `${100 - bottomBandTopPct(burnedCaptions) + 1.5}%`,
          maxWidth: "62%",
          padding: style === "EMOCIONAL" ? 0 : `${height * 0.018}px ${height * 0.028}px`,
          background:
            style === "AUTORIDADE"
              // Opacidade calibrada num still real: escuro o bastante para texto claro ficar legível
              // sobre master claro, translúcido o bastante para o metal escovado aparecer.
              ? `linear-gradient(180deg, ${DVP.carvao}E0 0%, ${DVP.carvao}C4 100%), url(${staticFile("props/substratos/metal-escovado-01.jpg")}) center/cover`
              : style === "DATADO"
                ? `${DVP.carvao}CC`
                : "transparent",
          borderLeft: style === "DATADO" ? `${height * 0.004}px solid ${DVP.terra}` : "none",
          opacity: interpolate(frame, [0, 0.4 * fps], [0, 1], enter),
          translate: interpolate(frame, [0, 0.5 * fps], ["0px 14px", "0px 0px"], enter),
        }}
      >
        <Interactive.Div
          name="Primary"
          style={{
            fontFamily: style === "DATADO" ? bodyFont : titleFont,
            fontSize: height * (style === "DATADO" ? 0.038 : 0.052),
            fontWeight: style === "DATADO" ? 600 : 700,
            letterSpacing: style === "DATADO" ? "0.08em" : "0",
            textTransform: style === "DATADO" ? "uppercase" : "none",
            color: style === "DATADO" ? DVP.areia : DVP.creme,
            lineHeight: 1.15,
            textShadow: style === "EMOCIONAL" ? `0 ${height * 0.003}px ${height * 0.012}px #000000CC` : "none",
          }}
        >
          {primary}
        </Interactive.Div>
        {secondary ? (
          <Interactive.Div
            name="Secondary"
            style={{
              fontFamily: bodyFont,
              fontSize: height * 0.028,
              fontWeight: 400,
              color: style === "AUTORIDADE" ? DVP.olive : DVP.areia,
              marginTop: height * 0.008,
              lineHeight: 1.25,
              textShadow: style === "EMOCIONAL" ? `0 ${height * 0.002}px ${height * 0.01}px #000000CC` : "none",
              opacity: interpolate(frame, [0.2 * fps, 0.6 * fps], [0, 1], enter),
            }}
          >
            {secondary}
          </Interactive.Div>
        ) : null}
      </Interactive.Div>
    </AbsoluteFill>
  );
};
