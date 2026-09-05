import { describe, expect, it } from "vitest";

import { calculateUncertaintyAdjustment } from "./uncertaintyAdjustment";

describe("calculateUncertaintyAdjustment", () => {
  it("sem nenhum sinal disponível, effectiveProbability = rawProbability", () => {
    const result = calculateUncertaintyAdjustment({
      probability: 0.6
    });

    expect(result.effectiveProbability).toBe(0.6);
    expect(result.uncertaintyPenalty).toBe(0);
    expect(result.warnings).toContain("NO_UNCERTAINTY_SIGNALS_AVAILABLE");
  });

  it("todos os sinais perfeitos (1.0) não geram penalidade", () => {
    const result = calculateUncertaintyAdjustment({
      probability: 0.6,
      sampleReliability: 1,
      leagueTrust: 1,
      globalConfidence: 1,
      modelAgreementScore: 1
    });

    expect(result.uncertaintyPenalty).toBe(0);
    expect(result.effectiveProbability).toBe(0.6);
  });

  it("todos os sinais péssimos (0) geram o teto de penalidade (8pp)", () => {
    const result = calculateUncertaintyAdjustment({
      probability: 0.6,
      sampleReliability: 0,
      leagueTrust: 0,
      globalConfidence: 0,
      modelAgreementScore: 0
    });

    expect(result.uncertaintyPenalty).toBe(0.08);
    expect(result.effectiveProbability).toBeCloseTo(0.52, 4);
  });

  it("um único sinal disponível não é diluído pelos pesos ausentes (renormalização)", () => {
    const result = calculateUncertaintyAdjustment({
      probability: 0.6,
      sampleReliability: 0
    });

    // sampleReliability é o único sinal disponível: com
    // renormalização, seu peso vira 100% do total, então o
    // déficit máximo (1) aplica a penalidade máxima (8pp) —
    // sem renormalizar ficaria em só 40% disso.
    expect(result.uncertaintyPenalty).toBe(0.08);
  });

  it("nunca deixa a probabilidade sair de [0, 1]", () => {
    const result = calculateUncertaintyAdjustment({
      probability: 0.02,
      sampleReliability: 0,
      leagueTrust: 0,
      globalConfidence: 0,
      modelAgreementScore: 0
    });

    expect(result.effectiveProbability).toBeGreaterThanOrEqual(0);
  });

  it("probabilidade inválida retorna resultado inválido sem lançar exceção", () => {
    const result = calculateUncertaintyAdjustment({
      probability: Number.NaN
    });

    expect(result.valid).toBe(false);
  });
});
