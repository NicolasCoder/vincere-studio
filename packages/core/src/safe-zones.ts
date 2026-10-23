import type { VideoFormat } from "./formats";

export interface SafeZoneSpec {
  format: VideoFormat;
  name: string;
  width: number;
  height: number;
  safeMarginTopPct: number;
  safeMarginBottomPct: number;
  safeMarginLeftPct: number;
  safeMarginRightPct: number;
  description: string;
}

export const SAFE_ZONES: Record<VideoFormat, SafeZoneSpec> = {
  SHORT_9_16: {
    format: "SHORT_9_16",
    name: "Vertical (Shorts / Reels / TikTok)",
    width: 1080,
    height: 1920,
    safeMarginTopPct: 0.1, // 10% topo livre para header/perfil
    safeMarginBottomPct: 0.2, // 20% rodapé livre para descrição/som/ações
    safeMarginLeftPct: 0.05, // 5% margem esquerda
    safeMarginRightPct: 0.14, // 14% margem direita (botões curtir/comentar)
    description: "Zona segura de visualização sem sobreposição de botões sociais (TikTok, Reels, Shorts)",
  },
  LONG_16_9: {
    format: "LONG_16_9",
    name: "Horizontal (YouTube 16:9)",
    width: 1920,
    height: 1080,
    safeMarginTopPct: 0.05,
    safeMarginBottomPct: 0.08,
    safeMarginLeftPct: 0.05,
    safeMarginRightPct: 0.05,
    description: "Margem de segurança para telas de TV e barra de reprodução do YouTube",
  },
};

export interface SafeZoneViolation {
  element: string;
  field: string;
  valuePct: number;
  allowedRange: string;
  severity: "warning" | "error";
  message: string;
}

export function auditElementSafeZone(
  format: VideoFormat,
  elementName: string,
  box: { topPct: number; heightPct: number; leftPct: number; widthPct: number },
): SafeZoneViolation[] {
  const spec = SAFE_ZONES[format];
  const violations: SafeZoneViolation[] = [];
  const bottomPct = box.topPct + box.heightPct;
  const rightPct = box.leftPct + box.widthPct;

  if (box.topPct < spec.safeMarginTopPct) {
    violations.push({
      element: elementName,
      field: "top",
      valuePct: Math.round(box.topPct * 100),
      allowedRange: `>= ${Math.round(spec.safeMarginTopPct * 100)}%`,
      severity: "warning",
      message: `${elementName} está no topo de tela (${Math.round(box.topPct * 100)}%), disputando espaço com status bar e nome de canal.`,
    });
  }

  if (bottomPct > 1 - spec.safeMarginBottomPct) {
    violations.push({
      element: elementName,
      field: "bottom",
      valuePct: Math.round(bottomPct * 100),
      allowedRange: `<= ${Math.round((1 - spec.safeMarginBottomPct) * 100)}%`,
      severity: "warning",
      message: `${elementName} atinge o rodapé (${Math.round(bottomPct * 100)}%), onde a descrição e botões de som e comentários cobrem a imagem.`,
    });
  }

  if (rightPct > 1 - spec.safeMarginRightPct) {
    violations.push({
      element: elementName,
      field: "right",
      valuePct: Math.round(rightPct * 100),
      allowedRange: `<= ${Math.round((1 - spec.safeMarginRightPct) * 100)}%`,
      severity: "warning",
      message: `${elementName} atinge a lateral direita (${Math.round(rightPct * 100)}%), disputando espaço com a coluna de likes e compartilhamento.`,
    });
  }

  return violations;
}
