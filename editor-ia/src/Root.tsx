import "./index.css";
import { Composition } from "remotion";
import { Prova, type ProvaProps } from "./dvp/Prova";
import { Trecho } from "./dvp/Trecho";

const base: ProvaProps = {
  frame: "frame-escuro-0014.jpg",
  layout: "lower-third",
  lowerThirdStyle: "DATADO",
  substrato: "papel-dossie",
  primary: "1995 — 2021",
  secondary: "Rodovia 44, trecho deserto",
  onLight: false,
  // Padrão do formato longo: sem legenda queimada, então o rodapé fica livre.
  burnedCaptions: false,
  showSafeZone: true,
};

/** 1080p30, herdado do master do DocuPulse. */
const video = { width: 1920, height: 1080, fps: 30, durationInFrames: 90 } as const;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Trecho real: 03:05 → 03:50 do master "A Rodovia 44 e os Carros Vazios". */}
      <Composition
        id="Trecho-Rodovia44"
        component={Trecho}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={45 * 30}
        defaultProps={{ master: "masters/trecho-rodovia44.mp4" }}
      />

      <Composition id="Prova-Datado" component={Prova} {...video} defaultProps={base} />
      <Composition
        id="Prova-Autoridade-FundoClaro"
        component={Prova}
        {...video}
        defaultProps={{
          ...base,
          frame: "frame-claro-0533.jpg",
          lowerThirdStyle: "AUTORIDADE",
          primary: "Thomas Miller",
          secondary: "Testemunha ocular",
          onLight: true,
        }}
      />
      <Composition
        id="Prova-Emocional-FundoClaro"
        component={Prova}
        {...video}
        defaultProps={{
          ...base,
          frame: "frame-claro-0533.jpg",
          lowerThirdStyle: "EMOCIONAL",
          primary: "Thomas Miller",
          secondary: "Testemunha ocular",
          onLight: true,
        }}
      />
      <Composition
        id="Prova-OverlayDado"
        component={Prova}
        {...video}
        defaultProps={{
          ...base,
          frame: "frame-escuro-0404.jpg",
          layout: "overlay-dado",
          primary: "Quilômetro 32",
          secondary: "Local da primeira anomalia",
        }}
      />
      {/* Duração maior: a inserção de arquivo tem deriva própria e precisa de tempo para respirar. */}
      <Composition
        id="Prova-InsertArquivo"
        component={Prova}
        {...video}
        durationInFrames={5 * 30}
        defaultProps={{
          ...base,
          frame: "frame-escuro-0404.jpg",
          layout: "insert-arquivo",
          substrato: "polaroid",
          primary: "1: RODOVIA 44",
          secondary: "Quilômetro 32 · outubro de 1995",
          showSafeZone: false,
        }}
      />
      <Composition
        id="Prova-InsertArquivo-Jornal"
        component={Prova}
        {...video}
        durationInFrames={5 * 30}
        defaultProps={{
          ...base,
          frame: "frame-claro-0533.jpg",
          layout: "insert-arquivo",
          substrato: "papel-dossie",
          primary: "BOLETIM DE OCORRÊNCIA",
          secondary: "Arquivo da Patrulha Rodoviária",
          showSafeZone: false,
        }}
      />
    </>
  );
};
