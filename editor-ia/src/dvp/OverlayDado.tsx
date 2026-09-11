import { AbsoluteFill, Easing, Interactive, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { DVP, bodyFont, titleFont } from "./tokens";

/**
 * Destaque de dado: um nÃºmero em evidÃªncia no canto superior direito, com uma linha de apoio.
 * Fica fora da faixa das legendas por construÃ§Ã£o (topo do quadro).
 *
 * `onLight` inverte o tratamento quando o master atrÃ¡s estÃ¡ claro â€” sem isso, texto claro sobre
 * B-roll claro some. Vem da luma medida no frame real pelo job GENERATE_EDIT_PLAN.
 */
export const OverlayDado: React.FC<{
  primary: string;
  secondary?: string;
  onLight?: boolean;
}> = ({ primary, secondary, onLight = false }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const enter = { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) } as const;

  /**
   * Escala pelo MENOR lado, nÃ£o pela altura.
   *
   * Dimensionar por altura funciona em 16:9 e explode em 9:16: com 1920 de altura o nÃºmero saÃ­a
   * a 144px dentro de uma caixa de 367px de largura, e "50 ursos polares" aparecia cortado no
   * meio da palavra, invadindo a faixa da legenda. Em 16:9 o menor lado Ã© a prÃ³pria altura, entÃ£o
   * o layout deitado nÃ£o muda em nada.
   */
  const base = Math.min(width, height);
  const vertical = height > width;

  return (
    <AbsoluteFill name="OverlayDado">
      <Interactive.Div
        name="Bloco"
        style={{
          position: "absolute",
          right: "6%",
          top: "10%",
          // No vertical sobra altura e falta largura â€” a caixa precisa ser proporcionalmente mais
          // larga para o nÃºmero caber em menos linhas.
          maxWidth: vertical ? "62%" : "34%",
          textAlign: "right",
          padding: onLight ? `${base * 0.016}px ${base * 0.022}px` : 0,
          background: onLight ? `${DVP.carvao}E6` : "transparent",
          borderRight: `${base * 0.005}px solid ${DVP.cobre}`,
          paddingRight: base * 0.022,
          opacity: interpolate(frame, [0, 0.35 * fps], [0, 1], enter),
          translate: interpolate(frame, [0, 0.5 * fps], ["18px 0px", "0px 0px"], enter),
        }}
      >
        <Interactive.Div
          name="Numero"
          style={{
            fontFamily: titleFont,
            fontSize: base * 0.075,
            fontWeight: 700,
            color: DVP.creme,
            lineHeight: 1.05,
            textShadow: onLight ? "none" : `0 ${base * 0.003}px ${base * 0.014}px #000000CC`,
          }}
        >
          {primary}
        </Interactive.Div>
        {secondary ? (
          <Interactive.Div
            name="Apoio"
            style={{
              fontFamily: bodyFont,
              fontSize: base * 0.024,
              fontWeight: 400,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: DVP.areia,
              marginTop: base * 0.006,
              textShadow: onLight ? "none" : `0 ${base * 0.002}px ${base * 0.01}px #000000CC`,
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
