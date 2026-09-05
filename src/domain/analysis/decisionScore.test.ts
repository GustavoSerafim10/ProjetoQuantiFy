import { describe, expect, it } from "vitest";

import { calculateDecisionScore } from "./decisionScore";

describe("calculateDecisionScore", () => {
  it("todos os sinais perfeitos produzem score 100", () => {
    const result = calculateDecisionScore({
      rankingScore: 1,
      modelAgreementScore: 1,
      robustnessScore: 1,
      sampleReliability: 1,
      leagueTrust: 1,
      correlationPenaltyDiagnostic: 0
    });

    expect(result.valid).toBe(true);
    expect(result.score).toBe(100);
  });

  it("sinais ausentes (modelAgreement/robustness) usam ponto neutro, não derrubam nem inflam o score", () => {
    const withSignals = calculateDecisionScore({
      rankingScore: 0.7,
      modelAgreementScore: 0.5,
      robustnessScore: 0.5
    });

    const withoutSignals = calculateDecisionScore({
      rankingScore: 0.7
    });

    expect(withoutSignals.score).toBe(withSignals.score);
    expect(withoutSignals.warnings).toContain(
      "MODEL_AGREEMENT_UNAVAILABLE_FOR_DECISION_SCORE"
    );
    expect(withoutSignals.warnings).toContain(
      "ROBUSTNESS_UNAVAILABLE_FOR_DECISION_SCORE"
    );
  });

  it("um único fator catastrófico (liga péssima) derruba o score mesmo com o resto bom — penalidade é multiplicativa", () => {
    const goodEverything = calculateDecisionScore({
      rankingScore: 0.9,
      modelAgreementScore: 0.9,
      robustnessScore: 0.9,
      sampleReliability: 1,
      leagueTrust: 1
    });

    const catastrophicLeague = calculateDecisionScore({
      rankingScore: 0.9,
      modelAgreementScore: 0.9,
      robustnessScore: 0.9,
      sampleReliability: 1,
      leagueTrust: 0.05
    });

    expect(catastrophicLeague.score as number).toBeLessThan(
      (goodEverything.score as number) * 0.2
    );
  });

  it("correlationPenaltyDiagnostic alto reduz o score proporcionalmente", () => {
    const noRedundancy = calculateDecisionScore({
      rankingScore: 0.8,
      correlationPenaltyDiagnostic: 0
    });

    const highRedundancy = calculateDecisionScore({
      rankingScore: 0.8,
      correlationPenaltyDiagnostic: 0.15
    });

    expect(highRedundancy.score as number).toBeLessThan(
      noRedundancy.score as number
    );
  });

  it("sem rankingScore, retorna resultado inválido sem lançar exceção", () => {
    const result = calculateDecisionScore({
      rankingScore: null
    });

    expect(result.valid).toBe(false);
    expect(result.score).toBeNull();
  });

  it("score nunca sai de [0, 100]", () => {
    const result = calculateDecisionScore({
      rankingScore: 0.5,
      sampleReliability: 0,
      leagueTrust: 0
    });

    expect(result.score as number).toBeGreaterThanOrEqual(0);
    expect(result.score as number).toBeLessThanOrEqual(100);
  });
});
