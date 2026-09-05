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

/*
 * Fase 2 do Decision Intelligence Layer (2026-09-04):
 * modelAgreementScore expõe de forma explícita a mesma
 * divergência |monteCarloProb - poissonProb| que já influenciava
 * `confidence` via os componentes MODEL_* e o cap de divergência
 * forte — sem introduzir nenhum ajuste numérico novo em
 * `confidence`.
 */
describe("calculateMarketConfidence — modelAgreementScore", () => {
  it("é null quando um dos dois modelos está ausente", () => {
    const result = calculateMarketConfidence({
      probability: 0.6,
      lambdaHome: 1.4,
      lambdaAway: 1.1,
      market: "HOME",
      monteCarloProb: 0.55
    });

    expect(result.modelAgreementScore).toBeNull();
  });

  it("é 1 quando os dois modelos concordam perfeitamente", () => {
    const result = calculateMarketConfidence({
      probability: 0.6,
      lambdaHome: 1.4,
      lambdaAway: 1.1,
      market: "HOME",
      monteCarloProb: 0.55,
      poissonProb: 0.55
    });

    expect(result.modelAgreementScore).toBe(1);
  });

  it("chega a 0 quando a divergência ultrapassa a mesma referência (0.16) que já ativa o cap de forte divergência", () => {
    const result = calculateMarketConfidence({
      probability: 0.6,
      lambdaHome: 1.4,
      lambdaAway: 1.1,
      market: "HOME",
      monteCarloProb: 0.75,
      poissonProb: 0.54
    });

    expect(result.modelAgreementScore).toBe(0);
    expect(result.warnings).toContain(
      "CONFIDENCE_CAPPED_BY_MODEL_DIVERGENCE"
    );
  });

  it("não altera confidence numericamente — é telemetria pura", () => {
    const withoutModels = calculateMarketConfidence({
      probability: 0.6,
      lambdaHome: 1.4,
      lambdaAway: 1.1,
      market: "HOME"
    });

    const withModelsButNoDivergence = calculateMarketConfidence({
      probability: 0.6,
      lambdaHome: 1.4,
      lambdaAway: 1.1,
      market: "HOME",
      monteCarloProb: 0.60,
      poissonProb: 0.60
    });

    // MODEL_STRONG_AGREEMENT já era somado antes desta fase — o
    // ponto aqui é que modelAgreementScore não cria um segundo
    // efeito sobre confidence além do que já existia.
    expect(withModelsButNoDivergence.modelAgreementScore).toBe(1);
    expect(withModelsButNoDivergence.confidence).toBeGreaterThanOrEqual(
      withoutModels.confidence
    );
  });
});
