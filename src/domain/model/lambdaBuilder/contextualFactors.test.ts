import { describe, expect, it } from "vitest";

import { calculateShotQualityFactor } from "./contextualFactors";
import { SHOT_QUALITY_MAX_ADJUSTMENT } from "./constants";

/*
 * Achado real em 2026-09-09: sotQuality/bigChanceQuality/
 * conversionQuality eram clamp(x, 0, 1.6) — assimétrico em torno do
 * centro neutro (1.0): +0.6 acima, -1.0 abaixo. Depois de comprimido
 * por SHOT_QUALITY_MAX_ADJUSTMENT, o melhor ataque possível nunca
 * alcançava o teto do clamp final (1.14), parando em 1.084, enquanto
 * o pior ataque possível alcançava o piso (0.86) sem problema. Teto
 * dos componentes alargado de 1.6 para 2.0 para corrigir a simetria.
 */
describe("calculateShotQualityFactor — simetria do ajuste (regressao 2026-09-09)", () => {
  it("um ataque de elite alcanca o teto do clamp final, nao mais parando em 1.084", () => {
    const result = calculateShotQualityFactor({
      goalsRate: 3,
      shotsOnTarget: 10, // sotQuality = 10/5 = 2.0 (teto)
      shots: null,
      bigChances: 4, // bigChanceQuality = 4/2 = 2.0 (teto)
      providedConversionRate: 0.24 // conversionQuality = 0.24/0.12 = 2.0 (teto)
    });

    expect(result.factor).toBeCloseTo(1 + SHOT_QUALITY_MAX_ADJUSTMENT, 6);
  });

  it("um ataque muito ruim alcanca o piso do clamp final (comportamento ja correto antes)", () => {
    const result = calculateShotQualityFactor({
      goalsRate: 0,
      shotsOnTarget: 0,
      shots: null,
      bigChances: 0,
      providedConversionRate: 0
    });

    expect(result.factor).toBeCloseTo(1 - SHOT_QUALITY_MAX_ADJUSTMENT, 6);
  });

  it("o ajuste e simetrico: elite e péssimo se afastam igualmente do neutro (1.0)", () => {
    const elite = calculateShotQualityFactor({
      goalsRate: 3,
      shotsOnTarget: 10,
      shots: null,
      bigChances: 4,
      providedConversionRate: 0.24
    });

    const terrible = calculateShotQualityFactor({
      goalsRate: 0,
      shotsOnTarget: 0,
      shots: null,
      bigChances: 0,
      providedConversionRate: 0
    });

    const eliteDistance = elite.factor - 1;
    const terribleDistance = 1 - terrible.factor;

    expect(eliteDistance).toBeCloseTo(terribleDistance, 6);
  });

  it("um time exatamente na media (sot=5, bigChances=2, conversao=12%) fica neutro (1.0)", () => {
    const result = calculateShotQualityFactor({
      goalsRate: 1,
      shotsOnTarget: 5,
      shots: null,
      bigChances: 2,
      providedConversionRate: 0.12
    });

    expect(result.factor).toBeCloseTo(1, 6);
  });
});
