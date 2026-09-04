import { describe, expect, it } from "vitest";

import { isSignificantDeviation } from "./significance";

describe("isSignificantDeviation", () => {
  it("returns false for tiny samples with a moderate observed gap", () => {
    // 3 bets, 1/3 won vs. model predicted 60% -- could easily be noise
    expect(isSignificantDeviation(3, 1 / 3, 0.6)).toBe(false);
  });

  it("returns true for a large, consistent gap with enough sample", () => {
    // 50 bets, model predicted 60% on average, actual win rate 35%
    expect(isSignificantDeviation(50, 0.35, 0.6)).toBe(true);
  });

  it("returns false when observed matches expected closely", () => {
    expect(isSignificantDeviation(100, 0.58, 0.6)).toBe(false);
  });

  it("returns false at the boundary (exactly matching)", () => {
    expect(isSignificantDeviation(100, 0.6, 0.6)).toBe(false);
  });

  it("is not fooled by borderline sample sizes with a moderate gap", () => {
    // 30 bets is the calibration report's own minimum sample --
    // a 10pp gap at n=30 should NOT yet be statistically significant
    expect(isSignificantDeviation(30, 0.5, 0.6)).toBe(false);
  });

  it("guards against degenerate expectedRate (0 or 1)", () => {
    expect(isSignificantDeviation(50, 0.5, 0)).toBe(false);
    expect(isSignificantDeviation(50, 0.5, 1)).toBe(false);
  });

  it("guards against invalid inputs", () => {
    expect(isSignificantDeviation(0, 0.5, 0.6)).toBe(false);
    expect(isSignificantDeviation(-5, 0.5, 0.6)).toBe(false);
    expect(isSignificantDeviation(NaN, 0.5, 0.6)).toBe(false);
  });
});
