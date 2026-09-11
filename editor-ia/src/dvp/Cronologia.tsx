import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { DVP, bodyFont, titleFont } from "./tokens";

export type EventoCronologia = {
  /** Rótulo do eixo — normalmente o ano. Texto, não número, para aceitar "Mai 2008". */
  ano: string;
  /** Uma linha curta sobre o que aconteceu. */
  rotulo: string;
  /** Posição no eixo, de 0 a 1. O worker calcula a partir das datas para a escala ser honesta. */
  t: number;
  /** Marca o evento como virada — ponto maior, na cor de destaque. */
  destaque?: boolean;
};

export type CronologiaProps = {
  titulo?: string | null;
  subtitulo?: string | null;
  eventos: EventoCronologia[];
  /** Caminho em public/ de um substrato de época. Sem ele, cai num papel procedural. */
  fundo?: string | null;
};

/**
 * Cronologia animada sobre substrato de época.
 *
 * A divisão de trabalho é o ponto todo: o FUNDO vem de um gerador de imagem (textura de papel,
 * artefatos da época) e a LINHA DO TEMPO é desenhada aqui em vetor. Tentar pedir a cronologia
 * inteira ao gerador de imagem devolve ano ilegível e rótulo inventado — e datas erradas num
 * documentário custam mais caro que uma imagem feia.
 *
 * O fundo é opcional de propósito. Substrato bom depende de motor de imagem bom, e a cronologia
 * não pode depender disso para existir: sem imagem, o papel é desenhado por gradiente.
 */
export const Cronologia: React.FC<CronologiaProps> = ({ titulo, subtitulo, eventos, fundo }) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();

  const larguraRotulo = width * 0.17;
  const margemRotulo = width * 0.02;
  // O eixo começa e termina onde a caixa de rótulo ainda cabe inteira dentro do quadro.
  const x0 = margemRotulo + larguraRotulo / 2;
  const x1 = width - margemRotulo - larguraRotulo / 2;
  // Eixo abaixo do meio, não no meio. Com o título no terço superior, centrar o eixo empurrava
  // todo o peso para cima e deixava 40% de tela vazia embaixo — o defeito que mais aparece
  // quando a composição não é pensada para o quadro inteiro.
  const yEixo = height * 0.62;

  // A linha se desenha da esquerda para a direita e os eventos entram atrás dela, nunca antes:
  // ponto aparecendo em pedaço de eixo que ainda não existe fica solto no ar.
  const desenho = interpolate(frame, [0.3 * fps, 2.2 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Deriva lenta de câmera. Imagem parada por 6s lê como imagem travada, não como escolha.
  const escala = interpolate(frame, [0, durationInFrames], [1, 1.045], { extrapolateRight: "clamp" });
  const entrada = interpolate(frame, [0, 0.5 * fps], [0, 1], { extrapolateRight: "clamp" });
  const saida = interpolate(frame, [durationInFrames - 0.5 * fps, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: DVP.carvao, opacity: entrada * saida }}>
      <AbsoluteFill style={{ transform: `scale(${escala})` }}>
        {fundo ? (
          <Img src={staticFile(fundo)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          // Papel, não holofote. A primeira versão era um radial forte e o centro virava um borrão
          // claro atrás do texto. Camadas largas e de baixo contraste leem como superfície.
          <AbsoluteFill style={{ backgroundColor: DVP.areia }}>
            <AbsoluteFill
              style={{
                background: `
                  radial-gradient(ellipse 80% 60% at 22% 18%, rgba(255,252,245,0.55) 0%, rgba(255,252,245,0) 60%),
                  radial-gradient(ellipse 70% 55% at 78% 82%, rgba(122,98,70,0.30) 0%, rgba(122,98,70,0) 62%),
                  linear-gradient(152deg, rgba(196,175,143,0.00) 30%, rgba(122,98,70,0.28) 100%)
                `,
              }}
            />
          </AbsoluteFill>
        )}
        {/* Vinheta por cima do substrato: o texto precisa de borda escura para não competir com a
            textura, e aplicada aqui funciona igual com imagem ou com gradiente. Suave — a versão
            anterior criava faixas escuras duras no topo e no rodapé. */}
        <AbsoluteFill
          style={{ background: "radial-gradient(ellipse 75% 78% at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.28) 100%)" }}
        />
      </AbsoluteFill>

      {(titulo || subtitulo) && (
        <div style={{ position: "absolute", left: x0, top: height * 0.13, width: width * 0.6 }}>
          {subtitulo && (
            <div
              style={{
                fontFamily: bodyFont,
                fontSize: height * 0.019,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: DVP.cacau,
                opacity: interpolate(frame, [0.2 * fps, 1 * fps], [0, 0.85], { extrapolateRight: "clamp" }),
              }}
            >
              {subtitulo}
            </div>
          )}
          {titulo && (
            <div
              style={{
                marginTop: height * 0.012,
                fontFamily: titleFont,
                fontSize: height * 0.055,
                lineHeight: 1.08,
                color: DVP.carvao,
                opacity: interpolate(frame, [0.4 * fps, 1.2 * fps], [0, 1], { extrapolateRight: "clamp" }),
                transform: `translateY(${interpolate(frame, [0.4 * fps, 1.2 * fps], [height * 0.012, 0], { extrapolateRight: "clamp" })}px)`,
              }}
            >
              {titulo}
            </div>
          )}
        </div>
      )}

      {/* Eixo */}
      <div
        style={{
          position: "absolute",
          left: x0,
          top: yEixo,
          height: 2,
          width: (x1 - x0) * desenho,
          backgroundColor: DVP.cacau,
          opacity: 0.75,
        }}
      />

      {eventos.map((e, i) => {
        const x = x0 + (x1 - x0) * Math.min(1, Math.max(0, e.t));
        // Cada evento entra quando a linha passa por ele, com meio segundo de folga.
        const inicio = 0.3 * fps + (2.2 - 0.3) * fps * Math.min(1, Math.max(0, e.t)) + 0.15 * fps;
        const pop = spring({ frame: frame - inicio, fps, config: { damping: 14, mass: 0.5 } });
        if (frame < inicio - 1) return null;

        const raio = (e.destaque ? height * 0.011 : height * 0.007) * pop;
        const acima = i % 2 === 1;

        return (
          <div key={`${e.ano}-${i}`}>
            <div
              style={{
                position: "absolute",
                left: x - raio,
                top: yEixo + 1 - raio,
                width: raio * 2,
                height: raio * 2,
                borderRadius: "50%",
                backgroundColor: e.destaque ? DVP.terra : DVP.carvao,
                boxShadow: e.destaque ? `0 0 ${height * 0.02}px ${DVP.terra}` : "none",
              }}
            />
            <div
              style={{
                position: "absolute",
                // O rótulo é centrado no ponto, mas preso dentro do quadro: nas pontas do eixo a
                // caixa passava da borda e "Out 1995" saía cortado pela metade.
                left: Math.min(Math.max(x - larguraRotulo / 2, margemRotulo), width - larguraRotulo - margemRotulo),
                width: larguraRotulo,
                top: acima ? yEixo - height * 0.165 : yEixo + height * 0.035,
                textAlign: "center",
                opacity: pop,
                transform: `translateY(${(1 - pop) * height * 0.014 * (acima ? 1 : -1)}px)`,
              }}
            >
              <div style={{ fontFamily: titleFont, fontSize: height * 0.036, color: DVP.carvao }}>{e.ano}</div>
              <div
                style={{
                  marginTop: height * 0.01,
                  fontFamily: bodyFont,
                  fontSize: height * 0.021,
                  lineHeight: 1.28,
                  color: DVP.cacau,
                }}
              >
                {e.rotulo}
              </div>
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
