import { describe, expect, it } from "vitest";

import { contextEngine } from "./contextEngine";

describe("contextEngine — tempo/pressure com dados ausentes", () => {
  it("nao pena o lambda quando shots e cornersAvg nao foram informados (regressao: 0 tratado como dado real)", () => {
    const result = contextEngine({
      homeStats: {
        last5GoalsFor: 1.2
      },
      awayStats: {
        last5GoalsFor: 1.2
      },
      baseLambdaHome: 1.1649,
      baseLambdaAway: 1.0506
    });

    expect(result.tempoFactor).toBeCloseTo(1, 5);
    expect(result.pressureFactor).toBeCloseTo(1, 5);
  });

  it("ainda aplica o piso quando shots/cornersAvg vem realmente baixos (nao e so um zero de dado ausente)", () => {
    const result = contextEngine({
      homeStats: {
        last5GoalsFor: 1.2,
        shots: 0,
        cornersAvg: 0
      },
      awayStats: {
        last5GoalsFor: 1.2,
        shots: 0,
        cornersAvg: 0
      },
      baseLambdaHome: 1.1649,
      baseLambdaAway: 1.0506
    });

    expect(result.tempoFactor).toBeCloseTo(0.94, 5);
    expect(result.pressureFactor).toBeCloseTo(0.94, 5);
  });

  it("usa shots/cornersAvg reais quando informados, sem cair no piso", () => {
    const result = contextEngine({
      homeStats: {
        last5GoalsFor: 1.2,
        shots: 12,
        cornersAvg: 5,
        shotsOnTarget: 4
      },
      awayStats: {
        last5GoalsFor: 1.2,
        shots: 13,
        cornersAvg: 6,
        shotsOnTarget: 4.8
      },
      baseLambdaHome: 1.1649,
      baseLambdaAway: 1.0506
    });

    expect(result.tempoFactor).toBeGreaterThan(0.94);
  });
});

describe("contextEngine — recentGoalsFactor (regressao 2026-09-09)", () => {
  it("premia sequencia artilheira (last5GoalsFor alto) em vez de penalizar", () => {
    // Antes da correcao, a heuristica "raw > 5 ? raw/5 : raw" tratava
    // 5.4 (uma media por jogo real e valida, teto 6 em sanitize.ts)
    // como se fosse um total de 5 jogos, dividindo por 5 -> 1.08 ->
    // formFactor abaixo do neutro (penalidade) para o time mais
    // artilheiro do jogo.
    const hotStreak = contextEngine({
      homeStats: {
        last5GoalsFor: 5.4,
        shots: 12,
        cornersAvg: 5,
        shotsOnTarget: 4.3
      },
      awayStats: {
        last5GoalsFor: 1.2,
        shots: 12,
        cornersAvg: 5,
        shotsOnTarget: 4.3
      },
      baseLambdaHome: 1.2,
      baseLambdaAway: 1.2
    });

    const neutral = contextEngine({
      homeStats: {
        last5GoalsFor: 1.2,
        shots: 12,
        cornersAvg: 5,
        shotsOnTarget: 4.3
      },
      awayStats: {
        last5GoalsFor: 1.2,
        shots: 12,
        cornersAvg: 5,
        shotsOnTarget: 4.3
      },
      baseLambdaHome: 1.2,
      baseLambdaAway: 1.2
    });

    expect(hotStreak.lambdaHome).toBeGreaterThan(neutral.lambdaHome);
  });

  it("usa goalsPerGame como fallback (nunca o total goalsFor da temporada) quando last5GoalsFor esta ausente", () => {
    const withFallback = contextEngine({
      homeStats: {
        goalsPerGame: 2.0,
        shots: 12,
        cornersAvg: 5,
        shotsOnTarget: 4.3
      },
      awayStats: {
        last5GoalsFor: 1.2,
        shots: 12,
        cornersAvg: 5,
        shotsOnTarget: 4.3
      },
      baseLambdaHome: 1.2,
      baseLambdaAway: 1.2
    });

    const neutral = contextEngine({
      homeStats: {
        last5GoalsFor: 1.2,
        shots: 12,
        cornersAvg: 5,
        shotsOnTarget: 4.3
      },
      awayStats: {
        last5GoalsFor: 1.2,
        shots: 12,
        cornersAvg: 5,
        shotsOnTarget: 4.3
      },
      baseLambdaHome: 1.2,
      baseLambdaAway: 1.2
    });

    expect(withFallback.lambdaHome).toBeGreaterThan(neutral.lambdaHome);
  });
});
