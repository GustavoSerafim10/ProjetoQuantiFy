import { describe, expect, it } from "vitest";
import seedrandom from "seedrandom";

import { calculateGoalExpectationScore } from "./goalProfile";

/*
 * Alarme de saturação — mesma ideia de
 * contextAdjustment.saturation.test.ts / contextEngine.saturation.test.ts.
 *
 * Achado real em 2026-09-05, durante auditoria ao vivo de análises
 * reais do usuário (Fluminense x Vasco, São Paulo x Atlético-MG):
 * bilateralComponent usava denominador 1.15 — um lambda do lado mais
 * fraco de só 1.15 (pouco acima da média de um time mediano) já
 * saturava o componente inteiro. Medido com amostra realista (1000
 * jogos, lambdas 0.5-2.5): 37% do score final batiam no teto
 * (>=0.999), média de 0.858 — muito distante do ~0.5 esperado para
 * uma amostra aleatória. Isso inflava goalExpectationScore
 * artificialmente e disparava GOAL_EXPECTATION_CONTEXT_DIVERGENCE
 * (operationalPolicy.ts) contra contextualGoalExpectationScore (que
 * usa curva logística, não satura do mesmo jeito) em jogos comuns,
 * rebaixando ELITE/BET genuínos para WATCHLIST sem divergência real.
 *
 * Corrigido trocando o denominador para 2.0 — exige um ataque
 * genuinamente forte do lado mais fraco (2 gols esperados) para
 * saturar. Reduziu para 5.7% na mesma amostra.
 *
 * Este teste garante que, se alguém reintroduzir um denominador
 * apertado aqui no futuro, a saturação alta reaparece e o teste
 * falha — em vez de passar silenciosamente até aparecer de novo
 * numa análise real.
 */

const SEED = "quantify-goal-expectation-saturation-v1";
const SAMPLE_SIZE = 1000;

describe("calculateGoalExpectationScore — alarme de saturação", () => {
  it("não satura no teto para a maioria de uma amostra realista de lambdas", () => {
    const rng = seedrandom(SEED);

    let atCeiling = 0;
    let atFloor = 0;

    for (let i = 0; i < SAMPLE_SIZE; i++) {
      const lambdaHome = 0.5 + rng() * 2.0;
      const lambdaAway = 0.5 + rng() * 2.0;

      const score = calculateGoalExpectationScore(
        lambdaHome,
        lambdaAway
      );

      if (score >= 0.999) atCeiling++;
      if (score <= 0.001) atFloor++;
    }

    const rate = (n: number) => n / SAMPLE_SIZE;

    /*
     * O bug real produzia 37% sozinho no teto. 15% é uma folga
     * generosa acima do 5,7% medido pós-fix — detecta regressão
     * real sem ficar frágil a ruído de amostra.
     */
    expect(rate(atCeiling)).toBeLessThan(0.15);
    expect(rate(atFloor)).toBeLessThan(0.15);
  });

  it("um time mediano (lambda 1.0) não satura mais sozinho o componente bilateral", () => {
    // Antes do fix, weakerLambda=1.0 já dava bilateralComponent
    // quase máximo (1.0/1.15 = 0.87). Depois do fix, 1.0/2.0 = 0.5 —
    // genuinamente neutro, não mais "quase saturado".
    const score = calculateGoalExpectationScore(1.0, 1.0);

    expect(score).toBeLessThan(0.85);
  });

  it("um ataque genuinamente forte nos dois lados ainda consegue saturar", () => {
    // O fix não deve impedir saturação legítima em jogos realmente
    // abertos — só evitar que jogos comuns saturem por acidente.
    const score = calculateGoalExpectationScore(2.2, 2.1);

    expect(score).toBeGreaterThan(0.95);
  });
});
