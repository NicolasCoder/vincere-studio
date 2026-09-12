import { Video } from "@remotion/media";
import { fitText } from "@remotion/layout-utils";
import { AbsoluteFill, staticFile, useVideoConfig, type CalculateMetadataFunction } from "remotion";
import { BrandChrome } from "./BrandChrome";
import { KaraokeCaptions, type CaptionWord } from "./KaraokeCaptions";
import { fonteClipe } from "./fonts";

export type ClipeProps = {
  /** Caminho em public/ do clipe enviado pelo usuário. */
  master: string;
  /** Fica na tela o vídeo inteiro — diferente do intertítulo do documentário, que é só na abertura. */
  titulo: string;
  handle: string;
  logoPath?: string | null;
  words: CaptionWord[];
  corTexto: string;
  corAtiva: string;
  corBrilho: string;
  corSublinhado?: string;
  durationInFrames: number;
  width?: number;
  height?: number;
}

/** Mesmo motivo do calculateTrechoMetadata: duração e resolução vêm do clipe, a composição não adivinha. */
export const calculateClipeMetadata: CalculateMetadataFunction<ClipeProps> = ({ props }) => ({
  durationInFrames: Math.max(1, Math.round(props.durationInFrames)),
  width: props.width && props.width > 0 ? Math.round(props.width) : undefined,
  height: props.height && props.height > 0 ? Math.round(props.height) : undefined,
});

/**
 * Composição do formato "Clipe/Reação" — marca e título permanentes, clipe do usuário encaixado
 * no meio (não em tela cheia, sem Ken Burns: é vídeo de terceiro, já pronto), legenda karaokê
 * embaixo com a fala real transcrita. Estruturalmente paralela a Trecho.tsx (DVP), não uma edição
 * dele: lá tudo é <Sequence> por janela de tempo; aqui marca+título+legenda cobrem o vídeo inteiro.
 */
export const Clipe: React.FC<ClipeProps> = ({
  master,
  titulo,
  handle,
  logoPath,
  words,
  corTexto,
  corAtiva,
  corBrilho,
  corSublinhado,
}) => {
  const { width } = useVideoConfig();
  // O título é digitado por quem sobe o clipe — sem limite, uma frase longa estouraria a caixa.
  // fitText acha o tamanho que cabe na largura disponível (88% do quadro, os mesmos 6% de
  // padding de cada lado); 52 é o teto de antes, pra título curto não crescer artificialmente.
  const { fontSize: tituloFontSize } = fitText({
    text: titulo,
    withinWidth: width * 0.88,
    fontFamily: fonteClipe,
    fontWeight: 800,
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0B0B0F",
        translate: "0px -0.1px",
        scale: 1.031,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div style={{ height: "9%" }} />

        <div
          style={{
            padding: "0 6%",
            textAlign: "center",
            fontFamily: fonteClipe,
            fontWeight: 800,
            fontSize: Math.min(tituloFontSize, 52),
            lineHeight: 1.2,
            color: "#FFFFFF",
            textShadow: "0 2px 6px rgba(0,0,0,0.7)",
          }}
        >
          {titulo}
        </div>

        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "3% 0" }}>
          <div style={{ maxWidth: "94%", maxHeight: "100%", boxShadow: "0 8px 40px rgba(0,0,0,0.6)" }}>
            <Video
              src={staticFile(master)}
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                display: "block",
                scale: 1.046,
              }}
            />
          </div>
        </div>

        <div style={{ height: "26%", position: "relative" }}>
          <KaraokeCaptions words={words} corTexto={corTexto} corAtiva={corAtiva} corBrilho={corBrilho} corSublinhado={corSublinhado} />
        </div>
      </div>

      <BrandChrome handle={handle} logoPath={logoPath} primaryColor={corAtiva} />
    </AbsoluteFill>
  );
};
