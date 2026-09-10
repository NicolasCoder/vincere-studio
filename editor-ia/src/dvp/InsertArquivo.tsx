import {
  AbsoluteFill,
  CanvasImage,
  Easing,
  Interactive,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { DVP, bodyFont, titleFont } from "./tokens";

/** Substratos disponiveis em public/props. Rotacionar entre eles evita repetir o mesmo papel. */
export const SUBSTRATOS = {
  "papel-dossie": "props/substratos/papel-dossie-01.jpg",
  "pasta-arquivo": "props/substratos/pasta-arquivo-aberta-01.jpg",
  prancheta: "props/substratos/prancheta-formulario-01.jpg",
  jornal: "props/substratos/jornal-antigo-01.jpg",
  ficha: "props/substratos/ficha-catalogo-01.jpg",
  "caixa-arquivo": "props/substratos/caixa-arquivo-01.jpg",
  polaroid: "props/molduras/moldura-polaroid-01.jpg",
  negativo: "props/molduras/tira-negativo-01.jpg",
  crt: "props/molduras/monitor-crt-01.jpg",
  corkboard: "props/molduras/quadro-investigacao-01.jpg",
} as const;
export type SubstratoKind = keyof typeof SUBSTRATOS;

/**
 * Insercao de arquivo: uma evidencia apresentada dentro de uma moldura sobre substrato,
 * com rotulo — o formato de "documento na tela" dos canais de documentario.
 *
 * O master continua rodando atras, escurecido por um scrim. Todo o movimento aqui e do
 * elemento inserido: o master ja tem Ken Burns proprio, e empilhar um segundo zoom no quadro
 * inteiro embrulha o olho.
 */
export const InsertArquivo: React.FC<{
  substrato: SubstratoKind;
  /** Caminho em public/ da imagem que vai dentro da moldura. */
  evidencia: string;
  primary: string;
  secondary?: string;
}> = ({ substrato, evidencia, primary, secondary }) => {
  const frame = useCurrentFrame();
  const { fps, height, durationInFrames } = useVideoConfig();
  const ease = { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) } as const;
  const linear = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

  return (
    <AbsoluteFill name="InsertArquivo">
      {/* Escurece o master para a evidencia ganhar o olho, sem apaga-lo. */}
      <AbsoluteFill
        name="Scrim"
        style={{
          background: `radial-gradient(ellipse at 50% 45%, ${DVP.carvao}66 0%, ${DVP.carvao}D9 70%, ${DVP.carvao}F2 100%)`,
          opacity: interpolate(frame, [0, 0.4 * fps, durationInFrames - 0.4 * fps, durationInFrames], [0, 1, 1, 0], ease),
        }}
      />

      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <Interactive.Div
          name="Moldura"
          style={{
            position: "relative",
            width: "58%",
            aspectRatio: "4 / 3",
            padding: height * 0.022,
            boxShadow: `0 ${height * 0.02}px ${height * 0.06}px #00000099`,
            opacity: interpolate(frame, [0, 0.35 * fps, durationInFrames - 0.35 * fps, durationInFrames], [0, 1, 1, 0], ease),
            // Deriva lenta e propria da insercao, independente do master.
            scale: interpolate(frame, [0, durationInFrames], [1, 1.045], {
              ...linear,
              output: "perceptual-scale",
            }),
            rotate: interpolate(frame, [0, 0.9 * fps], ["-1.6deg", "-0.7deg"], ease),
            translate: interpolate(frame, [0, 0.9 * fps], ["0px 22px", "0px 0px"], ease),
          }}
        >
          <CanvasImage
            src={staticFile(SUBSTRATOS[substrato])}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
          <CanvasImage
            src={staticFile(evidencia)}
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: "sepia(0.22) saturate(0.85) contrast(1.05)",
            }}
          />
        </Interactive.Div>

        <Interactive.Div
          name="Rotulo"
          style={{
            marginTop: height * 0.03,
            textAlign: "center",
            opacity: interpolate(frame, [0.45 * fps, 1 * fps, durationInFrames - 0.3 * fps, durationInFrames], [0, 1, 1, 0], ease),
            translate: interpolate(frame, [0.45 * fps, 1.1 * fps], ["0px 10px", "0px 0px"], ease),
          }}
        >
          <Interactive.Div
            name="Primary"
            style={{
              display: "inline-block",
              fontFamily: titleFont,
              fontSize: height * 0.042,
              fontWeight: 700,
              color: DVP.creme,
              background: `${DVP.carvao}D9`,
              padding: `${height * 0.01}px ${height * 0.024}px`,
              borderLeft: `${height * 0.004}px solid ${DVP.cobre}`,
            }}
          >
            {primary}
          </Interactive.Div>
          {secondary ? (
            <Interactive.Div
              name="Secondary"
              style={{
                marginTop: height * 0.012,
                fontFamily: bodyFont,
                fontSize: height * 0.024,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: DVP.areia,
                textShadow: `0 ${height * 0.002}px ${height * 0.01}px #000000CC`,
              }}
            >
              {secondary}
            </Interactive.Div>
          ) : null}
        </Interactive.Div>
      </AbsoluteFill>

      {/* Poeira e riscos de filme, em screen sobre preto — da textura sem sujar a leitura. */}
      <AbsoluteFill
        name="Poeira"
        style={{
          mixBlendMode: "screen",
          opacity: interpolate(frame, [0, 0.5 * fps, durationInFrames - 0.4 * fps, durationInFrames], [0, 0.5, 0.5, 0], ease),
        }}
      >
        <CanvasImage
          src={staticFile("props/overlays/poeira-riscos-01.jpg")}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            // As duas pontas precisam da mesma unidade: o Remotion recusa interpolar px para %.
            translate: interpolate(frame, [0, durationInFrames], ["0% 0%", "-1.5% -2%"], linear),
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
