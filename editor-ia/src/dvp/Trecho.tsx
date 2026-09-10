import { Video } from "@remotion/media";
import { AbsoluteFill, Sequence, staticFile, useVideoConfig, type CalculateMetadataFunction } from "remotion";
import { LowerThird, type LowerThirdStyle } from "./LowerThird";
import { OverlayDado } from "./OverlayDado";
import { Intertitulo } from "./Intertitulo";
import { InsertArquivo, SUBSTRATOS, type SubstratoKind } from "./InsertArquivo";

export type TrechoInsertion = {
  id: string;
  layout: "lower-third" | "overlay-dado" | "graphic-fullscreen" | "insert-arquivo" | "split-evidencia";
  lowerThirdStyle: LowerThirdStyle | null;
  primary: string;
  secondary: string | null;
  /** Relativo ao início do trecho. */
  startMs: number;
  endMs: number;
  /** Master claro atrás — medido no frame real pelo job GENERATE_EDIT_PLAN. */
  onLight: boolean;
  /** Caminho em public/ da evidência gerada; sem ela, o layout de arquivo não tem o que mostrar. */
  evidencePath?: string | null;
};

export type TrechoProps = {
  /** Caminho em public/ do trecho de master. */
  master: string;
  insertions: TrechoInsertion[];
  burnedCaptions: boolean;
  /** Duração do trecho — o worker sabe, a composição não teria como adivinhar. */
  durationInFrames: number;
};

/** O worker corta segmentos de tamanhos diferentes; a composição herda a duração dos props. */
export const calculateTrechoMetadata: CalculateMetadataFunction<TrechoProps> = ({ props }) => ({
  durationInFrames: Math.max(1, Math.round(props.durationInFrames)),
});

const SUBSTRATO_ORDEM = Object.keys(SUBSTRATOS) as SubstratoKind[];

/**
 * Camada visual aplicada sobre um trecho do master.
 *
 * O master entra como uma única <Video> contínua — imagem e som vêm dele, e nada aqui corta,
 * reordena ou mexe no áudio. Cada inserção é uma <Sequence> por cima, com o tempo vindo do
 * EditPlan, que por sua vez o derivou das legendas alinhadas.
 */
export const Trecho: React.FC<TrechoProps> = ({ master, insertions, burnedCaptions }) => {
  const { fps } = useVideoConfig();
  const toFrames = (ms: number) => Math.round((ms / 1000) * fps);

  return (
    <AbsoluteFill name="Trecho" style={{ backgroundColor: "black" }}>
      <Video src={staticFile(master)} />

      {insertions.map((ins, idx) => {
        const from = toFrames(ins.startMs);
        const durationInFrames = Math.max(1, toFrames(ins.endMs) - from);
        // Rotaciona o substrato pelo índice: sem isso, todas as inserções de arquivo do vídeo
        // sairiam sobre o mesmo papel, e a repetição salta aos olhos.
        const substrato = SUBSTRATO_ORDEM[idx % SUBSTRATO_ORDEM.length];
        return (
          <Sequence key={ins.id} name={`${ins.layout} · ${ins.primary}`} from={from} durationInFrames={durationInFrames} premountFor={fps}>
            {ins.layout === "graphic-fullscreen" ? (
              <Intertitulo primary={ins.primary} secondary={ins.secondary ?? undefined} />
            ) : ins.layout === "overlay-dado" ? (
              <OverlayDado primary={ins.primary} secondary={ins.secondary ?? undefined} onLight={ins.onLight} />
            ) : ins.layout === "lower-third" ? (
              <LowerThird
                style={ins.lowerThirdStyle ?? "DATADO"}
                primary={ins.primary}
                secondary={ins.secondary ?? undefined}
                burnedCaptions={burnedCaptions}
              />
            ) : ins.evidencePath ? (
              <InsertArquivo
                substrato={substrato}
                evidencia={ins.evidencePath}
                primary={ins.primary}
                secondary={ins.secondary ?? undefined}
              />
            ) : null /* Sem evidência gerada, o layout de arquivo não tem o que mostrar — deixar o
                        master limpo é melhor que exibir uma moldura vazia. */}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
