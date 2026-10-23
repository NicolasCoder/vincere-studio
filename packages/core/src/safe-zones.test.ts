import { describe, it, expect } from "vitest";
import { auditElementSafeZone, SAFE_ZONES } from "./safe-zones";

describe("Safe Zones Auditor", () => {
  it("tem especificações para os formatos principais", () => {
    expect(SAFE_ZONES.SHORT_9_16).toBeDefined();
    expect(SAFE_ZONES.LONG_16_9).toBeDefined();
  });

  it("aprova elemento dentro da área segura no vertical 9:16", () => {
    const violations = auditElementSafeZone("SHORT_9_16", "Legenda Central", {
      topPct: 0.45,
      heightPct: 0.08,
      leftPct: 0.1,
      widthPct: 0.7,
    });
    expect(violations).toHaveLength(0);
  });

  it("alerta quando legenda/elemento cai na zona de rodapé (disputa com TikTok/Shorts)", () => {
    const violations = auditElementSafeZone("SHORT_9_16", "Legenda Baixa", {
      topPct: 0.85,
      heightPct: 0.08,
      leftPct: 0.1,
      widthPct: 0.7,
    });
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].field).toBe("bottom");
  });

  it("alerta quando elemento cai na zona lateral direita (coluna de likes)", () => {
    const violations = auditElementSafeZone("SHORT_9_16", "Card de Evidência", {
      topPct: 0.4,
      heightPct: 0.2,
      leftPct: 0.7,
      widthPct: 0.25,
    });
    expect(violations.some((v) => v.field === "right")).toBe(true);
  });
});
