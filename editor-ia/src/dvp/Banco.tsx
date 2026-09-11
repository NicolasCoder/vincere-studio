import { AbsoluteFill, CanvasImage, staticFile, type CalculateMetadataFunction } from "remotion";
import { DVP } from "./tokens";
import { LowerThird } from "./LowerThird";
import { OverlayDado } from "./OverlayDado";
import { InsertArquivo } from "./InsertArquivo";
import { Intertitulo } from "./Intertitulo";
import { Cronologia } from "./Cronologia";
import { MesaArquivo } from "./MesaArquivo";
import { SplitEvidencia } from "./SplitEvidencia";

/**
 * Banco de layouts: uma composição só que desenha QUALQUER layout em QUALQUER formato.
 *
 * Existe para ser verificada por script. Sem ela, conferir os sete layouts nos dois formatos
 * exigiria quatorze composições declaradas à mão no Root, e foi exatamente essa ausência que deixou
 * passar três defeitos numa tarde só: o OverlayDado cortado em 9:16 (tudo dimensionado por `height`,
 * que em vertical é 1920), a faixa cinza da MesaArquivo (altura em porcentagem sem container com
 * altura resolvida) e a cronologia proposta em Short, onde ela nunca coube.
 *
 * Os dados são fixos de propósito: a verificação compara render contra render, então qualquer
 * variação teria que vir do código, nunca do conteúdo.
 */

export const LAYOUTS_BANCO = [
  "lower-third",
  "overlay-dado",
  "insert-arquivo",
  "split-evidencia",
  "graphic-fullscreen",
  "cronologia",
  "mesa-arquivo",
] as const;
export type LayoutBanco = (typeof LAYOUTS_BANCO)[number];

export type BancoProps = {
  layout: LayoutBanco;
  format: "LONG_16_9" | "SHORT_9_16";
  /**
   * Quando false, sai tudo menos o layout: sem frame do master, sem fundo, alfa transparente.
   *
   * É o que torna o corte mensurável. Com fundo, "o texto está saindo do quadro" é uma opinião
   * sobre pixels; sem fundo, a caixa do alfa ou cabe no quadro ou não cabe. Foi assim que o
   * OverlayDado em 9:16 passou despercebido: ele dimensionava tudo por `height`, que em vertical
   * é 1920, e o resultado estourava um container de 367px sem erro nenhum.
   */
  sobreMaster?: boolean;
};

const DIMENSOES = {
  LONG_16_9: { width: 1920, height: 1080 },
  SHORT_9_16: { width: 1080, height: 1920 },
} as const;

export const calculateBancoMetadata: CalculateMetadataFunction<BancoProps> = ({ props }) => ({
  ...DIMENSOES[props.format ?? "LONG_16_9"],
  fps: 30,
  durationInFrames: 90,
});

/** Telas cheias não recebem o frame do master por baixo — elas SÃO o quadro. */
const TELA_CHEIA: readonly LayoutBanco[] = ["graphic-fullscreen", "cronologia", "mesa-arquivo"];

const EVENTOS = [
  { ano: "Out 1995", rotulo: "Primeiro sedã no km 32", t: 0, destaque: true },
  { ano: "Mai 2008", rotulo: "Arquivos da delegacia são abertos", t: 0.5 },
  { ano: "Mai 2021", rotulo: "Sétimo veículo, km 12", t: 0.96, destaque: true },
  { ano: "Dez 2021", rotulo: "Caso arquivado", t: 1 },
];

const FOTOS = [
  { src: "tmp-mesa/e1.jpg", legenda: "central telefônica" },
  { src: "tmp-mesa/e2.jpg", legenda: "pastas do inquérito" },
  { src: "tmp-mesa/e3.jpg", legenda: "marcas no teto" },
];

export const Banco: React.FC<BancoProps> = ({ layout, format, sobreMaster = true }) => {
  const cheia = TELA_CHEIA.includes(layout);
  // Texto longo de propósito nos dois campos: layout que quebra por falta de espaço quebra aqui,
  // não no vídeo publicado.
  const primary = "Quilômetro 32 da Rodovia 44";
  const secondary = "Local da primeira anomalia registrada · outubro de 1995";

  return (
    <AbsoluteFill
      name={`Banco-${layout}-${format}`}
      style={sobreMaster ? { backgroundColor: DVP.carvao } : undefined}
    >
      {cheia || !sobreMaster ? null : (
        <CanvasImage
          src={staticFile("masters/frame-escuro-0404.jpg")}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      )}

      {layout === "lower-third" ? (
        <LowerThird style="DATADO" primary={primary} secondary={secondary} burnedCaptions={format === "SHORT_9_16"} />
      ) : layout === "overlay-dado" ? (
        <OverlayDado primary={primary} secondary={secondary} onLight={false} />
      ) : layout === "insert-arquivo" ? (
        <InsertArquivo substrato="papel-dossie" primary={primary} secondary={secondary} evidencia="tmp-mesa/e2.jpg" />
      ) : layout === "split-evidencia" ? (
        /*
          O lado alterna com o formato de propósito, para a matriz cobrir os dois ramos em vez de
          testar o mesmo duas vezes. Em 9:16 o painel de cima é o caso arriscado — é lá que o texto
          precisa subir para não cair na legenda queimada do meio do quadro.
        */
        <SplitEvidencia
          evidencia="tmp-mesa/e2.jpg"
          primary={primary}
          secondary={secondary}
          ladoDireito={format === "LONG_16_9"}
        />
      ) : layout === "graphic-fullscreen" ? (
        <Intertitulo primary={primary} secondary={secondary} />
      ) : layout === "cronologia" ? (
        <Cronologia
          titulo="Vinte e seis anos no mesmo trecho de quinze quilômetros"
          subtitulo="Cronologia do caso"
          fundo="props/fundos/fundo-papel-creme-01.jpg"
          eventos={EVENTOS}
        />
      ) : (
        <MesaArquivo titulo="O que sobrou dos sete veículos" carimbo="OUT 1995 — MAI 2021" fotos={FOTOS} />
      )}
    </AbsoluteFill>
  );
};
