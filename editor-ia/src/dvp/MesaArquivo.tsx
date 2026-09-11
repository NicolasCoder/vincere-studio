import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { DVP, bodyFont, titleFont } from "./tokens";

/**
 * Mesa de arquivo: evidências como fotos reveladas, presas com fita sobre papel de dossiê.
 *
 * Referência de estética trazida pelo Igor (um template de After Effects de "documentário
 * vintage"). O que aquele template faz é composição, textura, tipografia e temporização — nada
 * que exija After Effects. A diferença que importa não é visual: lá são 9 espaços que alguém
 * preenche à mão a cada vídeo; aqui os dados vêm do plano de edição.
 *
 * As molduras e texturas são assets reais do projeto, não desenho em CSS: polaroid de verdade
 * tem borda amarelada e mancha, e um retângulo branco com sombra denuncia na hora que é falso.
 */

/**
 * Geometria da moldura, medida na própria imagem do asset com uma grade sobreposta.
 *
 * Tudo em fração do cartão e convertido para PIXEL na hora de usar. Com altura em porcentagem, a
 * foto dentro da janela não preenchia — porcentagem de altura não resolve contra um contêiner de
 * altura automática, e sobrava uma faixa do cinza do asset sob a imagem. Com o tamanho calculado
 * em px a partir da largura, não há ambiguidade nenhuma.
 */
const CARTAO = { w: 634, h: 716 };
const JANELA = { left: 0.065, top: 0.05, width: 0.89, height: 0.75 };

export type FotoMesa = {
  /** Caminho em public/ da evidência. */
  src: string;
  /** Legenda manuscrita sob a foto, curta. Opcional. */
  legenda?: string | null;
};

export type MesaArquivoProps = {
  fotos: FotoMesa[];
  titulo?: string | null;
  /** Carimbo de data no canto, como o do template. Ex: "OUT 1995". */
  carimbo?: string | null;
};

/** Inclinações fixas por posição: aleatório a cada render faria o mesmo trecho tremer entre execuções. */
const INCLINACOES = [-4.5, 3.2, -2.1, 5.4];

export const MesaArquivo: React.FC<MesaArquivoProps> = ({ fotos, titulo, carimbo }) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();

  const entrada = interpolate(frame, [0, 0.4 * fps], [0, 1], { extrapolateRight: "clamp" });
  const saida = interpolate(frame, [durationInFrames - 0.5 * fps, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  // Deriva lenta: a mesa "respira" em vez de ficar congelada por seis segundos.
  const escala = interpolate(frame, [0, durationInFrames], [1.02, 1.06], { extrapolateRight: "clamp" });

  const visiveis = fotos.slice(0, 3);
  const larguraFoto = visiveis.length === 1 ? width * 0.42 : visiveis.length === 2 ? width * 0.34 : width * 0.27;
  const alturaCartao = (larguraFoto * CARTAO.h) / CARTAO.w;

  return (
    <AbsoluteFill style={{ backgroundColor: "#151310", opacity: entrada * saida }}>
      <AbsoluteFill style={{ transform: `scale(${escala})` }}>
        {/* O asset é uma folha retrato fotografada sobre ardósia. Em 16:9, `cover` deixa o papel
            como uma tira no meio e ardósia dos dois lados — parece um pedaço de papel, não uma
            mesa. A escala de 2,1 entra no papel, que é o que precisa preencher o quadro. */}
        <Img
          src={staticFile("props/substratos/papel-dossie-01.jpg")}
          style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scale(2.1)" }}
        />
        {/* Escurece o papel para a foto revelada saltar — sem isto tudo fica no mesmo tom. */}
        <AbsoluteFill style={{ background: "radial-gradient(ellipse 70% 70% at 50% 45%, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.62) 100%)" }} />
      </AbsoluteFill>

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: width * 0.02, flexDirection: "row" }}>
        {visiveis.map((f, i) => {
          // Cada foto assenta com um atraso: três chegando juntas parece transição, não mesa sendo montada.
          const pop = spring({ frame: frame - (0.35 + i * 0.28) * fps, fps, config: { damping: 16, mass: 0.7 } });
          const inclina = INCLINACOES[i % INCLINACOES.length];
          return (
            <div
              key={f.src}
              style={{
                position: "relative",
                width: larguraFoto,
                transform: `rotate(${inclina * pop}deg) translateY(${(1 - pop) * height * 0.05}px) scale(${0.92 + pop * 0.08})`,
                opacity: pop,
                filter: `drop-shadow(0 ${height * 0.012}px ${height * 0.022}px rgba(0,0,0,0.65))`,
              }}
            >
              <Img src={staticFile("props/molduras/polaroid-recorte-01.png")} style={{ width: alturaCartao ? larguraFoto : "100%", height: alturaCartao, display: "block" }} />
              <div
                style={{
                  position: "absolute",
                  left: larguraFoto * JANELA.left,
                  top: alturaCartao * JANELA.top,
                  width: larguraFoto * JANELA.width,
                  height: alturaCartao * JANELA.height,
                  overflow: "hidden",
                }}
              >
                <Img
                  src={staticFile(f.src)}
                  style={{
                    width: larguraFoto * JANELA.width,
                    height: alturaCartao * JANELA.height,
                    objectFit: "cover",
                    // A foto herda o envelhecimento do papel; cor saturada dentro de moldura amarelada
                    // entrega que a imagem foi colada depois.
                    filter: "sepia(0.42) saturate(0.75) contrast(1.08) brightness(0.94)",
                  }}
                />
              </div>
              {f.legenda && (
                <div
                  style={{
                    position: "absolute",
                    left: "7%",
                    right: "7%",
                    // Abaixo da janela, na borda branca larga da polaroid — que é onde legenda
                    // escrita à mão fica numa foto revelada de verdade.
                    top: alturaCartao * 0.86,
                    textAlign: "center",
                    fontFamily: bodyFont,
                    fontSize: larguraFoto * 0.052,
                    color: "#3A3128",
                    opacity: 0.85 * pop,
                  }}
                >
                  {f.legenda}
                </div>
              )}
              {/* Fita crepe: dois retângulos translúcidos cruzando o canto superior. */}
              <div
                style={{
                  position: "absolute",
                  left: "-6%",
                  top: "-3%",
                  width: "34%",
                  height: larguraFoto * 0.075,
                  background: "linear-gradient(180deg, rgba(226,209,170,0.62), rgba(198,178,140,0.52))",
                  transform: `rotate(${-inclina * 2.4}deg)`,
                  boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
                  opacity: pop,
                }}
              />
            </div>
          );
        })}
      </AbsoluteFill>

      {titulo && (
        <div style={{ position: "absolute", left: width * 0.06, top: height * 0.09, maxWidth: width * 0.6 }}>
          <div
            style={{
              fontFamily: titleFont,
              fontSize: height * 0.052,
              color: DVP.creme,
              textShadow: `0 ${height * 0.003}px ${height * 0.016}px rgba(0,0,0,0.8)`,
              opacity: interpolate(frame, [0.2 * fps, 1 * fps], [0, 1], { extrapolateRight: "clamp" }),
            }}
          >
            {titulo}
          </div>
        </div>
      )}

      {carimbo && (
        <div
          style={{
            position: "absolute",
            right: width * 0.06,
            bottom: height * 0.1,
            fontFamily: bodyFont,
            fontSize: height * 0.03,
            letterSpacing: "0.18em",
            color: DVP.cobre,
            textShadow: `0 0 ${height * 0.02}px ${DVP.cobre}55`,
            opacity: interpolate(frame, [1.1 * fps, 1.8 * fps], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          {carimbo}
        </div>
      )}

      {/* Poeira e riscos por cima de tudo, em screen: o asset é branco sobre preto, feito para isso. */}
      <AbsoluteFill style={{ mixBlendMode: "screen", opacity: 0.32 }}>
        <Img src={staticFile("props/overlays/poeira-riscos-01.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
