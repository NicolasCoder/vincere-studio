import { AbsoluteFill, CanvasImage, Easing, Interactive, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { DVP, titleFont } from "./tokens";

/**
 * Intertítulo de virada de ato (layout `graphic-fullscreen`).
 *
 * Cobre o quadro inteiro, então não depende da zona segura nem do brilho do master. O fundo é o
 * papel creme dos assets, escurecido, com o título em Playfair centralizado.
 */
export const Intertitulo: React.FC<{ primary: string; secondary?: string }> = ({ primary, secondary }) => {
  const frame = useCurrentFrame();
  const { fps, height, durationInFrames } = useVideoConfig();
  const ease = { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) } as const;

  return (
    <AbsoluteFill name="Intertitulo" style={{ backgroundColor: DVP.carvao }}>
      <AbsoluteFill
        name="Fundo"
        style={{
          opacity: interpolate(frame, [0, 0.4 * fps, durationInFrames - 0.4 * fps, durationInFrames], [0, 1, 1, 0], ease),
        }}
      >
        <CanvasImage
          src={staticFile("props/fundos/fundo-papel-creme-01.jpg")}
          style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.22) saturate(0.7)" }}
        />
      </AbsoluteFill>

      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 12%" }}>
        <Interactive.Div
          name="Titulo"
          style={{
            fontFamily: titleFont,
            fontSize: height * 0.085,
            fontWeight: 700,
            color: DVP.creme,
            textAlign: "center",
            lineHeight: 1.1,
            opacity: interpolate(frame, [0.2 * fps, 0.7 * fps, durationInFrames - 0.35 * fps, durationInFrames], [0, 1, 1, 0], ease),
            translate: interpolate(frame, [0.2 * fps, 0.9 * fps], ["0px 16px", "0px 0px"], ease),
          }}
        >
          {primary}
        </Interactive.Div>
        <Interactive.Div
          name="Regua"
          style={{
            width: height * 0.14,
            height: Math.max(2, height * 0.004),
            backgroundColor: DVP.cobre,
            marginTop: height * 0.035,
            scale: interpolate(frame, [0.4 * fps, 1.1 * fps], [0, 1], { ...ease, output: "perceptual-scale" }),
            opacity: interpolate(frame, [durationInFrames - 0.35 * fps, durationInFrames], [1, 0], ease),
          }}
        />
        {secondary ? (
          <Interactive.Div
            name="Subtitulo"
            style={{
              fontFamily: titleFont,
              fontSize: height * 0.03,
              color: DVP.areia,
              marginTop: height * 0.028,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              opacity: interpolate(frame, [0.5 * fps, 1 * fps, durationInFrames - 0.35 * fps, durationInFrames], [0, 1, 1, 0], ease),
            }}
          >
            {secondary}
          </Interactive.Div>
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
