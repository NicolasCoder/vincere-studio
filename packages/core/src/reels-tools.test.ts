import { describe, expect, it } from "vitest";
import {
  analyzeLockup,
  buildCleanTimelineFromWords,
  compileColorGradeRecipe,
  reviewCleanTranscript,
} from "./reels-tools";

describe("reels-tools core utilities", () => {
  it("analyzeLockup mede encaixes nas ascendentes e descendentes da palavra principal", () => {
    const res = analyzeLockup("limpeza", "pra fazer", "das lavouras");
    expect(res.main.text).toBe("limpeza");
    expect(res.main.widthEm).toBeGreaterThan(2);
    expect(res.above).toBeDefined();
    expect(res.below).toBeDefined();
    expect(res.quality).toBeGreaterThan(0);
  });

  it("compileColorGradeRecipe gera feColorMatrix 4x5 e tabelas de 256 pontos para os looks do reels_tools", () => {
    const recipe = compileColorGradeRecipe("apple_sungazing");
    expect(recipe.id).toBe("apple_sungazing");
    expect(recipe.svgFilter.feColorMatrix.split(" ")).toHaveLength(20);
    expect(recipe.svgFilter.tableR.split(" ")).toHaveLength(256);
    expect(recipe.svgFilter.tableG.split(" ")).toHaveLength(256);
    expect(recipe.svgFilter.tableB.split(" ")).toHaveLength(256);
  });

  it("buildCleanTimelineFromWords aplica a Regra do Vão Livre e mascara cortes secos com salto de escala", () => {
    const words = [
      { gid: 0, word: "Olá", tStart: 0.1, tEnd: 0.4 },
      { gid: 1, word: "pessoal", tStart: 0.45, tEnd: 0.9 },
      { gid: 2, word: "[respiração]", tStart: 1.0, tEnd: 1.5 },
      { gid: 3, word: "hoje", tStart: 1.6, tEnd: 1.9 },
      { gid: 4, word: "vamos", tStart: 1.95, tEnd: 2.3 },
    ];
    const tl = buildCleanTimelineFromWords(words, { minSilenceGapS: 0.35 });
    expect(tl.clips).toHaveLength(2);
    expect(tl.cutsCount).toBe(1);
    expect(tl.clips[1]?.spliceJumpMasked).toBe(true);
    expect(Math.abs((tl.clips[1]?.scaleFrom ?? 100) - (tl.clips[0]?.scaleTo ?? 100))).toBeGreaterThanOrEqual(6);

    const rev = reviewCleanTranscript(words);
    expect(rev.issues.BACKCHAN.length).toBeGreaterThanOrEqual(1);
  });
});
