import { AbsoluteFill, Img, staticFile } from "remotion";
import { fonteClipe } from "./fonts";

export type BrandChromeProps = {
  handle: string;
  logoPath?: string | null;
  primaryColor: string;
}

/**
 * Marca do canal, fixa no topo pelo vídeo inteiro — diferente das inserções do DVP (Trecho.tsx),
 * que aparecem só numa janela de tempo. Aqui não existe "janela": a marca é a mesma do início ao
 * fim, então o componente não recebe from/duration, só ocupa o espaço que o Clipe reserva pra ele.
 */
export const BrandChrome: React.FC<BrandChromeProps> = ({ handle, logoPath, primaryColor }) => {
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-start", paddingTop: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {logoPath ? (
          <Img src={staticFile(logoPath)} style={{ width: 44, height: 44, borderRadius: 999, objectFit: "cover" }} />
        ) : (
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              background: primaryColor,
              display: "grid",
              placeItems: "center",
              fontWeight: 900,
              fontSize: 20,
              color: "#0B0B0F",
            }}
          >
            {handle.replace("@", "").slice(0, 1).toUpperCase()}
          </div>
        )}
        <span
          style={{
            fontFamily: fonteClipe,
            fontWeight: 800,
            fontSize: 26,
            color: "#FFFFFF",
            textShadow: "0 2px 6px rgba(0,0,0,0.6)",
          }}
        >
          {handle}
        </span>
      </div>
    </AbsoluteFill>
  );
};
