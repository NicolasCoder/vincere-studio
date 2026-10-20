import type { CaptionMode, EstiloLegenda } from "@vincere-studio/core";

const CAPTION_FONTS = ["Segoe UI", "Segoe UI Semibold", "Arial Black", "Georgia", "Verdana", "Trebuchet MS", "Impact"];
const hex = (value: FormDataEntryValue | null, fallback: string) => (/^#[0-9a-f]{6}$/i.test(String(value ?? "")) ? String(value) : fallback);
const numberIn = (value: FormDataEntryValue | null, fallback: number, min: number, max: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
};

export function captionStyleFromForm(formData: FormData): EstiloLegenda & { mode: CaptionMode } {
  const fontRaw = String(formData.get("captionFont") ?? "Segoe UI");
  const positionRaw = String(formData.get("captionPosition") ?? "bottom");
  const modeRaw = String(formData.get("captionMode") ?? "subtle-bottom");
  return {
    fonte: CAPTION_FONTS.includes(fontRaw) ? fontRaw : "Segoe UI",
    cor: hex(formData.get("captionColor"), "#FFFFFF"),
    corAtiva: hex(formData.get("captionActiveColor"), "#22D3EE"),
    corContorno: hex(formData.get("captionOutlineColor"), "#111111"),
    tamanhoRel: {
      horizontal: numberIn(formData.get("captionSizeH"), 4.2, 3, 7) / 100,
      vertical: numberIn(formData.get("captionSizeV"), 4.5, 3, 7) / 100,
    },
    posicao: (["top", "center", "bottom"] as const).includes(positionRaw as "top" | "center" | "bottom") ? (positionRaw as "top" | "center" | "bottom") : "bottom",
    palavrasPorLinha: Math.round(numberIn(formData.get("captionWords"), 5, 2, 10)),
    maiusculas: formData.get("captionUppercase") !== null,
    contorno: Math.round(numberIn(formData.get("captionOutlineWidth"), 3, 0, 8)),
    sombra: Math.round(numberIn(formData.get("captionShadow"), 1, 0, 5)),
    mode: modeRaw === "bold-center-animated" ? "bold-center-animated" : "subtle-bottom",
  };
}
