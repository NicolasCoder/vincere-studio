import { describe, expect, it } from "vitest";
import { captionSafeZone } from "./edit-plan";

// IGO-7: os 3 cenários abaixo já foram validados manualmente durante o IGO-5
// (correção da divergência entre editor-ia/src/dvp/tokens.ts e esta função,
// que é a fonte de verdade). Cobrindo aqui para não regredir sem teste de novo.
describe("captionSafeZone", () => {
  it("longo 1920x1080 com legenda queimada", () => {
    const zone = captionSafeZone(1920, 1080, true);
    expect(zone.fromPct).toBe(82);
    expect(zone.toPct).toBe(100);
  });

  it("short 1080x1920 com legenda queimada", () => {
    const zone = captionSafeZone(1080, 1920, true);
    expect(zone.fromPct).toBe(40);
    expect(zone.toPct).toBe(65);
  });

  it("sem legenda queimada (qualquer formato)", () => {
    const longo = captionSafeZone(1920, 1080, false);
    expect(longo.fromPct).toBe(92);
    expect(longo.toPct).toBe(100);

    const short = captionSafeZone(1080, 1920, false);
    expect(short.fromPct).toBe(92);
    expect(short.toPct).toBe(100);
  });
});
