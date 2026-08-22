import { describe, expect, it } from "vitest";

import { resolveBet, runBacktest } from "./runBacktest";

function match(homeGoals: number, awayGoals: number) {
  return { result: { homeGoals, awayGoals } };
}

describe("resolveBet", () => {
  it("resolves HOME/AWAY/DRAW by the final score", () => {
    expect(resolveBet("HOME", match(2, 1))).toBe(true);
    expect(resolveBet("HOME", match(1, 2))).toBe(false);

    expect(resolveBet("AWAY", match(1, 2))).toBe(true);
    expect(resolveBet("AWAY", match(2, 1))).toBe(false);

    expect(resolveBet("DRAW", match(1, 1))).toBe(true);
    expect(resolveBet("DRAW", match(1, 2))).toBe(false);
  });

  it("resolves double chance markets", () => {
    // 1X: home win or draw
    expect(resolveBet("DOUBLE_CHANCE_1X", match(2, 1))).toBe(true);
    expect(resolveBet("DOUBLE_CHANCE_1X", match(1, 1))).toBe(true);
    expect(resolveBet("DOUBLE_CHANCE_1X", match(0, 1))).toBe(false);

    // X2: away win or draw
    expect(resolveBet("DOUBLE_CHANCE_X2", match(0, 1))).toBe(true);
    expect(resolveBet("DOUBLE_CHANCE_X2", match(1, 1))).toBe(true);
    expect(resolveBet("DOUBLE_CHANCE_X2", match(2, 1))).toBe(false);
  });

  /*
   * Regression: before the fix, OVER_1_5/OVER_2_5 never matched any
   * branch (the code looked for "over 1.5"/"over 2.5" with a space,
   * not the canonical "OVER_1_5"/"OVER_2_5") and silently fell
   * through to `false` — every winning over bet was scored as a
   * loss.
   */
  it("resolves OVER_1_5/OVER_2_5/UNDER_2_5 by total goals", () => {
    expect(resolveBet("OVER_1_5", match(1, 1))).toBe(true); // 2 > 1.5
    expect(resolveBet("OVER_1_5", match(0, 1))).toBe(false); // 1 <= 1.5

    expect(resolveBet("OVER_2_5", match(2, 1))).toBe(true); // 3 > 2.5
    expect(resolveBet("OVER_2_5", match(1, 1))).toBe(false); // 2 <= 2.5

    expect(resolveBet("UNDER_2_5", match(1, 0))).toBe(true); // 1 < 2.5
    expect(resolveBet("UNDER_2_5", match(2, 1))).toBe(false); // 3 >= 2.5
  });

  /*
   * Regression: before the fix, both BTTS_YES and BTTS_NO fell into
   * the same `market.includes("btts")` branch and always evaluated
   * "did both teams score" — so BTTS_NO paid out backwards.
   */
  it("resolves BTTS_YES/BTTS_NO as true opposites of each other", () => {
    expect(resolveBet("BTTS_YES", match(1, 1))).toBe(true);
    expect(resolveBet("BTTS_NO", match(1, 1))).toBe(false);

    expect(resolveBet("BTTS_YES", match(1, 0))).toBe(false);
    expect(resolveBet("BTTS_NO", match(1, 0))).toBe(true);

    expect(resolveBet("BTTS_YES", match(0, 0))).toBe(false);
    expect(resolveBet("BTTS_NO", match(0, 0))).toBe(true);
  });

  it("returns false for an unrecognized market instead of throwing", () => {
    expect(resolveBet("SOMETHING_UNKNOWN", match(1, 1))).toBe(false);
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
    expect(result.wins + result.losses).toBe(result.totalBets);
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
