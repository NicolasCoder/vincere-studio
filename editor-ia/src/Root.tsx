import "./index.css";
import { Composition } from "remotion";
import { Cronologia } from "./dvp/Cronologia";
import { Prova, type ProvaProps } from "./dvp/Prova";
import { Trecho, calculateTrechoMetadata } from "./dvp/Trecho";
import { TRECHO_INSERTIONS } from "./dvp/trecho-data";

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
      {/*
        Segmento: a composição que o worker chama, um segmento por vez, passando os dados por
        --props. A duração vem dos props porque cada segmento tem um tamanho diferente.
        Os defaults abaixo servem só para abrir no Studio — em render, tudo vem do job.
      */}
      <Composition
        id="Segmento"
        component={Trecho}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={45 * 30}
        calculateMetadata={calculateTrechoMetadata}
        defaultProps={{
          master: "masters/trecho-rodovia44.mp4",
          insertions: TRECHO_INSERTIONS,
          burnedCaptions: false,
          durationInFrames: 45 * 30,
        }}
      />

      {/*
        Cronologia: substrato de época por baixo, linha do tempo desenhada em vetor por cima.
        Fica separada do Segmento porque não é uma inserção sobre o master — ela OCUPA a tela
        inteira por alguns segundos, como um intertítulo longo.
      */}
      <Composition
        id="Cronologia"
        component={Cronologia}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={8 * 30}
        defaultProps={{
          subtitulo: "Cronologia do caso",
          titulo: "Vinte e seis anos no mesmo trecho de quinze quilômetros",
          fundo: null,
          eventos: [
            { ano: "Out 1995", rotulo: "Primeiro sedã no km 32", t: 0, destaque: true },
            { ano: "Mai 2008", rotulo: "Arquivos da delegacia são abertos", t: 0.5 },
            { ano: "Mai 2021", rotulo: "Sétimo veículo, km 12", t: 0.96, destaque: true },
            { ano: "Dez 2021", rotulo: "Caso arquivado", t: 1 },
          ],
        }}
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
