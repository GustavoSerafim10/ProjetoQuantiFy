import { describe, expect, it } from "vitest";

import { resolveBet, runBacktest } from "./runBacktest";

function match(homeGoals: number, awayGoals: number) {
  return { result: { homeGoals, awayGoals } };
}

describe("resolveBet", () => {
  it("resolves HOME/AWAY/DRAW by the final score", () => {
    expect(resolveBet("HOME", match(2, 1))).toBe("WIN");
    expect(resolveBet("HOME", match(1, 2))).toBe("LOSS");

    expect(resolveBet("AWAY", match(1, 2))).toBe("WIN");
    expect(resolveBet("AWAY", match(2, 1))).toBe("LOSS");

    expect(resolveBet("DRAW", match(1, 1))).toBe("WIN");
    expect(resolveBet("DRAW", match(1, 2))).toBe("LOSS");
  });

  it("resolves double chance markets", () => {
    // 1X: home win or draw
    expect(resolveBet("DOUBLE_CHANCE_1X", match(2, 1))).toBe("WIN");
    expect(resolveBet("DOUBLE_CHANCE_1X", match(1, 1))).toBe("WIN");
    expect(resolveBet("DOUBLE_CHANCE_1X", match(0, 1))).toBe("LOSS");

    // X2: away win or draw
    expect(resolveBet("DOUBLE_CHANCE_X2", match(0, 1))).toBe("WIN");
    expect(resolveBet("DOUBLE_CHANCE_X2", match(1, 1))).toBe("WIN");
    expect(resolveBet("DOUBLE_CHANCE_X2", match(2, 1))).toBe("LOSS");
  });

  /*
   * Regression: before the fix, OVER_1_5/OVER_2_5 never matched any
   * branch (the code looked for "over 1.5"/"over 2.5" with a space,
   * not the canonical "OVER_1_5"/"OVER_2_5") and silently fell
   * through to `false` — every winning over bet was scored as a
   * loss.
   */
  it("resolves OVER_1_5/OVER_2_5/UNDER_1_5/UNDER_2_5 by total goals", () => {
    expect(resolveBet("OVER_1_5", match(1, 1))).toBe("WIN"); // 2 > 1.5
    expect(resolveBet("OVER_1_5", match(0, 1))).toBe("LOSS"); // 1 <= 1.5

    expect(resolveBet("OVER_2_5", match(2, 1))).toBe("WIN"); // 3 > 2.5
    expect(resolveBet("OVER_2_5", match(1, 1))).toBe("LOSS"); // 2 <= 2.5

    expect(resolveBet("UNDER_1_5", match(0, 1))).toBe("WIN"); // 1 < 1.5
    expect(resolveBet("UNDER_1_5", match(1, 1))).toBe("LOSS"); // 2 >= 1.5

    expect(resolveBet("UNDER_2_5", match(1, 0))).toBe("WIN"); // 1 < 2.5
    expect(resolveBet("UNDER_2_5", match(2, 1))).toBe("LOSS"); // 3 >= 2.5
  });

  /*
   * Regression: before the fix, both BTTS_YES and BTTS_NO fell into
   * the same `market.includes("btts")` branch and always evaluated
   * "did both teams score" — so BTTS_NO paid out backwards.
   */
  it("resolves BTTS_YES/BTTS_NO as true opposites of each other", () => {
    expect(resolveBet("BTTS_YES", match(1, 1))).toBe("WIN");
    expect(resolveBet("BTTS_NO", match(1, 1))).toBe("LOSS");

    expect(resolveBet("BTTS_YES", match(1, 0))).toBe("LOSS");
    expect(resolveBet("BTTS_NO", match(1, 0))).toBe("WIN");

    expect(resolveBet("BTTS_YES", match(0, 0))).toBe("LOSS");
    expect(resolveBet("BTTS_NO", match(0, 0))).toBe("WIN");
  });

  it("resolves DNB_HOME/DNB_AWAY with a VOID on draw", () => {
    expect(resolveBet("DNB_HOME", match(2, 1))).toBe("WIN");
    expect(resolveBet("DNB_HOME", match(1, 2))).toBe("LOSS");
    expect(resolveBet("DNB_HOME", match(1, 1))).toBe("VOID");

    expect(resolveBet("DNB_AWAY", match(1, 2))).toBe("WIN");
    expect(resolveBet("DNB_AWAY", match(2, 1))).toBe("LOSS");
    expect(resolveBet("DNB_AWAY", match(1, 1))).toBe("VOID");
  });

  it("returns LOSS for an unrecognized market instead of throwing", () => {
    expect(resolveBet("SOMETHING_UNKNOWN", match(1, 1))).toBe("LOSS");
  });
});

/*
 * Integration coverage for the full live decision chain
 * (model -> simulation -> probability -> value -> correlation ->
 * risk -> confidence -> ranking -> decision), exercised end to end
 * through runBacktest() exactly as the app's own backtest tooling
 * calls it. matchGenerator seeds its RNG deterministically
 * ("quantify-v33"), so a fixed match count always produces the same
 * synthetic matches within a fresh test run.
 */
describe("runBacktest (integration)", () => {
  // 200 matches x 300 Monte Carlo sims through the full 9-stage
  // pipeline is the heaviest work in the suite; the default 5s
  // timeout leaves too little margin against normal CI/system load
  // variance (observed flaky timeout unrelated to any logic change).
  const INTEGRATION_TIMEOUT_MS = 15000;

  it("places bets, resolves them, and produces internally consistent totals", () => {
    const result = runBacktest(200, 1000, { monteCarloSimulations: 300 });

    expect(result.totalBets).toBeGreaterThan(0);
    expect(result.wins + result.losses + result.voids).toBe(result.totalBets);
    expect(Number.isFinite(result.roi)).toBe(true);
    expect(result.totalStaked).toBeGreaterThan(0);
    expect(result.bankrollHistory).toHaveLength(200);
    expect(result.maxDrawdown).toBeGreaterThanOrEqual(0);
  }, INTEGRATION_TIMEOUT_MS);

  it("never stakes more than the configured stakeCap fraction of the bankroll", () => {
    const stakeCap = 0.01;
    const initialBankroll = 1000;

    const result = runBacktest(200, initialBankroll, {
      monteCarloSimulations: 300,
      stakeCap
    });

    for (const bankrollAfter of result.bankrollHistory) {
      expect(bankrollAfter).toBeGreaterThan(0);
    }

    // With a 1% cap and no single bet allowed to compound into an
    // outsized fraction of a shrinking bankroll, total staked should
    // stay well under initialBankroll * bets * stakeCap.
    expect(result.totalStaked).toBeLessThan(
      initialBankroll * result.totalBets * stakeCap * 1.5
    );
  }, INTEGRATION_TIMEOUT_MS);

  it("raising evFloor never increases the number of bets placed", () => {
    const baseline = runBacktest(200, 1000, {
      monteCarloSimulations: 300
    });

    const stricter = runBacktest(200, 1000, {
      monteCarloSimulations: 300,
      evFloor: 0.5 // an unreasonably high EV floor should choke off bets
    });

    expect(stricter.totalBets).toBeLessThanOrEqual(
      baseline.totalBets
    );
  }, INTEGRATION_TIMEOUT_MS);
});

/*
 * Fase 9 do Decision Intelligence Layer (2026-09-04): durante as
 * fases 1-8, cada mudança em evaluateMarket.ts/operationalPolicy.ts/
 * correlationEngine.ts foi validada rodando runBacktest() manualmente
 * antes/depois e comparando totalBets/roi por mercado (foi assim que
 * as fases 4 e 6 foram pegas piorando ROI real e revertidas). Este
 * teste formaliza esse mesmo hábito: trava os números de produção
 * atuais (seed determinística de matchGenerator + Monte Carlo
 * seedado) para que qualquer mudança futura que vaze das fases de
 * telemetria pura (explain/uncertainty/robustness/decisionScore/
 * correlationPenaltyDiagnostic) para a decisão real quebre a suíte
 * imediatamente, em vez de depender de alguém lembrar de rodar o
 * script manual de novo.
 *
 * Se um valor aqui precisar mudar de propósito (ex.: recalibração
 * real de threshold com justificativa registrada em
 * marketPolicies.ts), atualize o número — não delete o teste.
 */
describe("runBacktest — estabilidade de decisão (regression guard)", () => {
  const REGRESSION_TIMEOUT_MS = 15000;

  it("produção com 200 partidas/300 simulações permanece com os mesmos números conhecidos", () => {
    /*
     * Números atualizados em 2026-09-05: goalProfile.ts corrigiu a
     * saturação do bilateralComponent (denominador 1.15 → 2.0, ver
     * comentário lá + goalProfile.saturation.test.ts). Isso baixa
     * goalExpectationScore na maioria das partidas, o que muda quantas
     * vezes riskPipeline/fragility.ts aplica CONTEXT_GOAL_SCORE_*
     * contra os thresholds fixos de riskPipeline/policy.ts
     * (STRUCTURE_THRESHOLDS.lowGoalScore/moderateGoalScore/
     * highGoalScore) — esses thresholds nunca foram calibrados de
     * forma independente do goalExpectationScore que existia na época
     * (o próprio arquivo já se declara "política provisória" a
     * validar por Brier/ROI). Investigação confirmou o mecanismo:
     * numa amostra de 2500 partidas sintéticas, a correção reduz
     * contradições UNDER/BTTS_NO em ~193 partidas (2404→2211) mas
     * aumenta contradições OVER/BTTS_YES em ~34 partidas (17→64) — e
     * como OVER_2_5/BTTS_YES concentram o volume lucrativo neste
     * backtest (UNDER/BTTS_NO já rodam perto de EV zero por viés do
     * matchGenerator, ver runBacktest — comentário de calibração),
     * o saldo líquido nesta amostra é menos apostas/stake menor. Não
     * é regressão de lógica: é a mesma correção de saturação exposta
     * também aqui, mais uma recalibração pendente de
     * STRUCTURE_THRESHOLDS que fica registrada como próximo passo.
     */
    const result = runBacktest(200, 1000, {
      monteCarloSimulations: 300
    });

    expect(result.totalBets).toBe(63);
    expect(result.wins).toBe(30);
    expect(result.losses).toBe(33);
    expect(result.voids).toBe(0);

    expect(result.roi).toBeCloseTo(-0.10531688511541676, 9);
    expect(result.totalProfit).toBeCloseTo(-140.87274256790968, 6);
    expect(result.totalStaked).toBeCloseTo(1337.6083276060365, 6);
    expect(result.maxDrawdown).toBeCloseTo(0.2923523002124933, 9);
  }, REGRESSION_TIMEOUT_MS);
});
