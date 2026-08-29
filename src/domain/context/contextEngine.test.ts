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
