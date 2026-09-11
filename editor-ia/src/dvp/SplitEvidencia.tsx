import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { DVP, bodyFont, titleFont } from "./tokens";

/**
 * Split de evidência: o master continua visível de um lado, a evidência ocupa o outro.
 *
 * Este layout estava no catálogo desde o começo — o modelo podia propô-lo, a tela mostrava a
 * etiqueta — e o Remotion não tinha ramo para ele: caía no ramo do insert-arquivo e renderizava
 * como inserção comum. O plano prometia uma coisa e o vídeo entregava outra, sem erro nenhum.
 *
 * Não redesenha o master: o painel cobre metade do quadro e o master aparece pela outra metade,
 * que já está atrás. É a leitura correta de "split" e evita ter que escalar o vídeo por dentro.
 *
 * O corte muda com o formato. Em 16:9 sobra largura e o split é lateral; em 9:16 sobra altura e o
 * split é horizontal — split lateral num quadro de 1080 de largura deixaria as duas metades
 * estreitas demais para qualquer uma das duas ser lida.
 */
export type SplitEvidenciaProps = {
  evidencia: string;
  primary: string;
  secondary?: string | null;
  /** Alterna o lado entre inserções para não repetir o mesmo enquadramento no vídeo todo. */
  ladoDireito?: boolean;
};

export const SplitEvidencia: React.FC<SplitEvidenciaProps> = ({ evidencia, primary, secondary, ladoDireito = true }) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const suave = { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) } as const;

  const vertical = height > width;
  const base = Math.min(width, height);

  const entra = interpolate(frame, [0, 0.55 * fps], [0, 1], suave);
  const sai = interpolate(frame, [durationInFrames - 0.4 * fps, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  // Desloca a partir da borda de onde o painel vem, não de um ponto arbitrário.
  const deslocaPx = (1 - entra) * (vertical ? height * 0.12 : width * 0.12);

  const painel: React.CSSProperties = vertical
    ? { left: 0, right: 0, top: ladoDireito ? "50%" : 0, height: "50%", transform: `translateY(${ladoDireito ? deslocaPx : -deslocaPx}px)` }
    : { top: 0, bottom: 0, left: ladoDireito ? "50%" : 0, width: "50%", transform: `translateX(${ladoDireito ? deslocaPx : -deslocaPx}px)` };

  return (
    <AbsoluteFill style={{ opacity: entra * sai }}>
      <div style={{ position: "absolute", ...painel, overflow: "hidden", backgroundColor: DVP.carvao }}>
        <Img
          src={staticFile(evidencia)}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
        {/* Escurece a base do painel para o texto ter onde assentar, sem cobrir a evidência. */}
        <AbsoluteFill
          style={{
            background: `linear-gradient(to top, rgba(20,18,16,0.92) 0%, rgba(20,18,16,0.55) 22%, rgba(20,18,16,0) 46%)`,
          }}
        />
        <div style={{ position: "absolute", left: "7%", right: "7%", bottom: "8%" }}>
          <div
            style={{
              fontFamily: titleFont,
              fontSize: base * 0.042,
              lineHeight: 1.12,
              color: DVP.creme,
              opacity: interpolate(frame, [0.35 * fps, 0.9 * fps], [0, 1], suave),
            }}
          >
            {primary}
          </div>
          {secondary && (
            <div
              style={{
                marginTop: base * 0.012,
                fontFamily: bodyFont,
                fontSize: base * 0.021,
                letterSpacing: "0.05em",
                color: DVP.areia,
                opacity: interpolate(frame, [0.5 * fps, 1.05 * fps], [0, 0.9], suave),
              }}
            >
              {secondary}
            </div>
          )}
        </div>
      </div>

      {/* Fio de separação: sem ele as duas metades encostam e parece falha de composição. */}
      <div
        style={{
          position: "absolute",
          backgroundColor: DVP.cobre,
          opacity: 0.85 * entra,
          ...(vertical
            ? { left: 0, right: 0, top: ladoDireito ? "50%" : "50%", height: Math.max(2, height * 0.002) }
            : { top: 0, bottom: 0, left: "50%", width: Math.max(2, width * 0.002) }),
        }}
      />
    </AbsoluteFill>
  );
};
