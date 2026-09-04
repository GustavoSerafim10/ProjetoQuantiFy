import { describe, expect, it } from "vitest";

import { calculateMarketConfidence } from "./confidenceEngine";

/*
 * Regression: addDnbStructure não tinha o bônus de "jogo
 * equilibrado" que addDoubleChanceStructure já tem, apesar de
 * ser estruturalmente o mesmo mercado (aposta direcional que
 * remove o risco do empate). Medido em 2026-09-03: sem esse
 * bônus, DNB_HOME/DNB_AWAY nunca alcançavam o minimumConfidence
 * de produção e ficavam com zero apostas no backtest sintético
 * (ver marketPolicies.ts).
 */
describe("calculateMarketConfidence — DNB balanced support", () => {
  it("adds STRUCTURE_DNB_BALANCED_SUPPORT when lambdas are close", () => {
    const result = calculateMarketConfidence({
      probability: 0.55,
      lambdaHome: 1.50,
      lambdaAway: 1.40,
      market: "DNB_HOME"
    });

    const component = result.components.find(
      c => c.source === "STRUCTURE_DNB_BALANCED_SUPPORT"
    );

    expect(component).toBeDefined();
    expect(component?.adjustment).toBeGreaterThan(0);
  });

  it("does not add the balanced-support bonus for a lopsided match", () => {
    const result = calculateMarketConfidence({
      probability: 0.70,
      lambdaHome: 2.20,
      lambdaAway: 0.90,
      market: "DNB_HOME"
    });

    const component = result.components.find(
      c => c.source === "STRUCTURE_DNB_BALANCED_SUPPORT"
    );

    expect(component).toBeUndefined();
  });

  it("also applies the bonus to DNB_AWAY", () => {
    const result = calculateMarketConfidence({
      probability: 0.55,
      lambdaHome: 1.30,
      lambdaAway: 1.35,
      market: "DNB_AWAY"
    });

    const component = result.components.find(
      c => c.source === "STRUCTURE_DNB_BALANCED_SUPPORT"
    );

    expect(component).toBeDefined();
    expect(component?.adjustment).toBeGreaterThan(0);
  });
});
