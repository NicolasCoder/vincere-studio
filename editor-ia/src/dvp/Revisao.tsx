import { staticFile, type CalculateMetadataFunction } from "remotion";
import { Trecho, type TrechoProps } from "./Trecho";

export type RevisaoProps = {
  master?: string;
  insertions?: TrechoProps["insertions"];
  burnedCaptions?: boolean;
  durationInFrames?: number;
  width?: number;
  height?: number;
  projectId?: string;
  projectTitle?: string;
};

/**
 * Composição "leva este projeto pro Remotion" — busca o master + o plano de edição REAIS do
 * projeto que o usuário estava olhando na ferramenta (gravados em public/tmp/current/props.json
 * pela rota apps/web/app/api/projects/[id]/remotion-props) e reaproveita o Trecho (DVP) sem
 * recortar em segmentos: aqui é revisão ao vivo no Studio, não render em lote.
 *
 * `cache: "no-store"` no fetch: sem isso, o navegador podia servir o props.json de um projeto
 * anterior — exatamente o bug relatado (abrir um projeto e ver o vídeo de outro).
 */
export const calculateRevisaoMetadata: CalculateMetadataFunction<RevisaoProps> = async () => {
  const res = await fetch(staticFile("tmp/current/props.json"), { cache: "no-store" });
  if (!res.ok) return {};
  const props = (await res.json()) as RevisaoProps;
  return {
    durationInFrames: Math.max(1, Math.round(props.durationInFrames ?? 1)),
    width: props.width,
    height: props.height,
    props,
  };
};

export const Revisao: React.FC<RevisaoProps> = ({ master, insertions, burnedCaptions, durationInFrames }) => {
  if (!master) {
    return (
      <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: "white", fontFamily: "sans-serif", padding: 40, textAlign: "center" }}>
        Nenhum projeto foi enviado pra cá ainda. No Passo do Plano de Edição, clique em
        &quot;Abrir Remotion Studio&quot;.
      </div>
    );
  }
  return <Trecho master={master} insertions={insertions ?? []} burnedCaptions={burnedCaptions ?? false} durationInFrames={durationInFrames ?? 1} />;
};
