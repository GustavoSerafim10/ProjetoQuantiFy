import { afterEach, describe, expect, it } from "vitest";

import { calibrateProbabilityDetailed } from "./probabilityCalibration";
import { registerBet, resetHistory, settleBet } from "../tracking/trackingEngine";

function seedMarketHistory(
  market: string,
  count: number,
  probability: number,
  winCount: number
) {
  for (let i = 0; i < count; i++) {
    const id = `${market}-${i}-${Math.random()}`;

    registerBet({
      id,
      match: "Seed Match",
      market,
      odd: 2,
      probability,
      ev: 0.1,
      kelly: 0.05,
      stake: 10,
      createdAt: Date.now(),
      type: "BET"
    });

    settleBet(id, i < winCount ? "win" : "loss");
  }
}

describe("calibrateProbabilityDetailed", () => {
  afterEach(() => {
    resetHistory();
  });

  it("stays identity when no market is given", () => {
    const result = calibrateProbabilityDetailed(0.6);

    expect(result.applied).toBe(false);
    expect(result.method).toBe("IDENTITY");
    expect(result.calibrated).toBe(0.6);
  });

  it("stays identity when the market has too few settled bets", () => {
    seedMarketHistory("HOME", 10, 0.6, 3);

    const result = calibrateProbabilityDetailed(0.6, "HOME");

    expect(result.applied).toBe(false);
    expect(result.reason).toBe("NO_VALIDATED_CALIBRATION_MODEL");
  });

  it("stays identity when the deviation is not statistically significant", () => {
    // n=50, avgProb=0.65, winRate=0.6 -- real-looking gap but not significant at this n
    seedMarketHistory("HOME", 50, 0.65, 30);

    const result = calibrateProbabilityDetailed(0.65, "HOME");

    expect(result.applied).toBe(false);
    expect(result.sampleSize).toBe(50);
  });

  it("applies a proportional, non-clamped correction for a significant deviation", () => {
    // n=100, avgProb=0.65, winRate=0.55 -- significant overconfidence
    seedMarketHistory("OVER_2_5", 100, 0.65, 55);

    const result = calibrateProbabilityDetailed(0.65, "OVER_2_5");

    expect(result.applied).toBe(true);
    expect(result.method).toBe("EMPIRICAL_BUCKETS");
    expect(result.appliedBias).toBeCloseTo(-0.05, 4);
    expect(result.calibrated).toBeCloseTo(0.6, 4);
  });

  it("clamps the correction for an extreme deviation instead of applying it in full", () => {
    // n=50, avgProb=0.70, winRate=0.10 -- huge, clearly significant overconfidence
    seedMarketHistory("DRAW", 50, 0.7, 5);

    const result = calibrateProbabilityDetailed(0.7, "DRAW");

    expect(result.applied).toBe(true);
    expect(result.appliedBias).toBeCloseTo(-0.08, 4);
    expect(result.calibrated).toBeCloseTo(0.62, 4);
  });

  it("keeps markets isolated from each other", () => {
    seedMarketHistory("HOME", 50, 0.7, 20); // miscalibrated
    seedMarketHistory("AWAY", 50, 0.5, 25); // well-calibrated

    const away = calibrateProbabilityDetailed(0.5, "AWAY");

    expect(away.applied).toBe(false);
  });

  it("clamps the final calibrated probability to [0.01, 0.99]", () => {
    // n=50, avgProb=0.90, winRate=1.0 -- correction would push past 1
    seedMarketHistory("BTTS_YES", 50, 0.9, 50);

    const result = calibrateProbabilityDetailed(0.95, "BTTS_YES");

    expect(result.applied).toBe(true);
    expect(result.calibrated).toBeLessThanOrEqual(0.99);
  });

  it("rejects invalid probabilities regardless of market", () => {
    const result = calibrateProbabilityDetailed(1.5, "HOME");

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("INVALID_PROBABILITY");
  });
});
