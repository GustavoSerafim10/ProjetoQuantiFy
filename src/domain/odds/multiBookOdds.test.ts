import { describe, expect, it } from "vitest";

import { hasUsableMultiBookOdds } from "./multiBookOdds";

/*
 * Regressao real de 2026-09-09: homeOrDraw/awayOrDraw/dnbHome/
 * dnbAway existem no payload (a UI deixa preencher) mas nunca sao
 * lidos por fitMarketImpliedLambda (so 1X2/O-U/BTTS entram no
 * ajuste). Antes desta correcao, preencher so esses campos fazia
 * este helper devolver true, levando marketModelPipeline/
 * fusedModelPipeline a "ajustar" um lambda sem nenhum alvo real —
 * fitMarketImpliedLambda cai no fallback neutro (1.32/1.23,
 * fitError: 0), que parecia um ajuste perfeito mas era so ausencia
 * de dado disfarcada.
 */
describe("hasUsableMultiBookOdds", () => {
  it("returns false when only DNB odds are filled in", () => {
    expect(
      hasUsableMultiBookOdds({
        dnbHome: [1.85],
        dnbAway: [1.95]
      })
    ).toBe(false);
  });

  it("returns false when only dupla-chance (homeOrDraw/awayOrDraw) odds are filled in", () => {
    expect(
      hasUsableMultiBookOdds({
        homeOrDraw: [1.25],
        awayOrDraw: [1.6]
      })
    ).toBe(false);
  });

  it("returns true when 1X2 odds are present", () => {
    expect(
      hasUsableMultiBookOdds({
        home: [1.68],
        draw: [4.05],
        away: [4.45]
      })
    ).toBe(true);
  });

  it("returns true when only over/under is present", () => {
    expect(
      hasUsableMultiBookOdds({
        over25: [1.85],
        under25: [1.95]
      })
    ).toBe(true);
  });

  it("returns false for empty or missing odds", () => {
    expect(hasUsableMultiBookOdds(undefined)).toBe(false);
    expect(hasUsableMultiBookOdds(null)).toBe(false);
    expect(hasUsableMultiBookOdds({})).toBe(false);
  });
});
