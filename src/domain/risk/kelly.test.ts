import { describe, expect, it } from "vitest";

import {
  calculateStakePro,
  halfKelly,
  kellyCriterion,
  quarterKelly
} from "./kelly";

describe("kellyCriterion", () => {
  it("computes the standard Kelly fraction: f = (bp - q) / b", () => {
    // p = 0.60, odd = 2.00 -> b = 1, q = 0.40
    // f = (1*0.6 - 0.4) / 1 = 0.20
    expect(kellyCriterion(0.6, 2.0)).toBeCloseTo(0.2, 4);
  });

  it("returns 0 when the edge is negative instead of a negative stake", () => {
    // p = 0.40, odd = 2.00 -> b = 1, q = 0.60
    // f = (0.4 - 0.6) / 1 = -0.20 -> clamped to 0
    expect(kellyCriterion(0.4, 2.0)).toBe(0);
  });

  it("returns 0 for probability <= 0", () => {
    expect(kellyCriterion(0, 2.0)).toBe(0);
    expect(kellyCriterion(-0.1, 2.0)).toBe(0);
  });

  it("returns 0 for probability >= 1", () => {
    expect(kellyCriterion(1, 2.0)).toBe(0);
    expect(kellyCriterion(1.5, 2.0)).toBe(0);
  });

  it("returns 0 for odd <= 1 (no payout above stake)", () => {
    expect(kellyCriterion(0.6, 1.0)).toBe(0);
    expect(kellyCriterion(0.6, 0.9)).toBe(0);
  });

  it("returns 0 for non-finite inputs instead of NaN", () => {
    expect(kellyCriterion(NaN, 2.0)).toBe(0);
    expect(kellyCriterion(0.6, NaN)).toBe(0);
    expect(kellyCriterion(0.6, Infinity)).toBe(0);
  });
});

describe("halfKelly / quarterKelly", () => {
  it("scale the full Kelly fraction by 0.5 and 0.25", () => {
    const full = kellyCriterion(0.6, 2.0);

    expect(halfKelly(0.6, 2.0)).toBeCloseTo(full * 0.5, 4);
    expect(quarterKelly(0.6, 2.0)).toBeCloseTo(full * 0.25, 4);
  });

  it("stay at 0 when the full Kelly fraction is 0", () => {
    expect(halfKelly(0.4, 2.0)).toBe(0);
    expect(quarterKelly(0.4, 2.0)).toBe(0);
  });
});

describe("calculateStakePro", () => {
  it("returns 0 when the market has no positive kelly fraction", () => {
    expect(calculateStakePro({ kelly: 0 })).toBe(0);
    expect(calculateStakePro({ kelly: -0.1 })).toBe(0);
    expect(calculateStakePro({})).toBe(0);
  });

  it("never exceeds the default stake cap (2.5% of bankroll)", () => {
    const stake = calculateStakePro({
      kelly: 1, // an intentionally huge base kelly
      ev: 0.5,
      probability: 0.9,
      risk: 0.1,
      confidence: 0.9
    });

    expect(stake).toBeLessThanOrEqual(0.025);
  });

  it("respects a custom stakeCap override", () => {
    const stake = calculateStakePro(
      {
        kelly: 1,
        ev: 0.5,
        probability: 0.9,
        risk: 0.1,
        confidence: 0.9
      },
      { stakeCap: 0.01 }
    );

    expect(stake).toBeLessThanOrEqual(0.01);
  });

  it("falls back to the default cap when stakeCap is invalid (<=0 or non-finite)", () => {
    const base = calculateStakePro({
      kelly: 1,
      ev: 0.5,
      probability: 0.9,
      risk: 0.1,
      confidence: 0.9
    });

    const withZeroCap = calculateStakePro(
      { kelly: 1, ev: 0.5, probability: 0.9, risk: 0.1, confidence: 0.9 },
      { stakeCap: 0 }
    );

    const withNegativeCap = calculateStakePro(
      { kelly: 1, ev: 0.5, probability: 0.9, risk: 0.1, confidence: 0.9 },
      { stakeCap: -1 }
    );

    expect(withZeroCap).toBe(base);
    expect(withNegativeCap).toBe(base);
  });

  it("scales the stake down as risk increases, all else equal", () => {
    const lowRisk = calculateStakePro({
      kelly: 0.02,
      ev: 0.06,
      probability: 0.6,
      risk: 0.3,
      confidence: 0.6
    });

    const highRisk = calculateStakePro({
      kelly: 0.02,
      ev: 0.06,
      probability: 0.6,
      risk: 0.8,
      confidence: 0.6
    });

    expect(highRisk).toBeLessThan(lowRisk);
  });

  it("scales the stake up as EV increases, all else equal", () => {
    const lowEv = calculateStakePro({
      kelly: 0.02,
      ev: 0.02,
      probability: 0.6,
      risk: 0.3,
      confidence: 0.6
    });

    const highEv = calculateStakePro({
      kelly: 0.02,
      ev: 0.25,
      probability: 0.6,
      risk: 0.3,
      confidence: 0.6
    });

    expect(highEv).toBeGreaterThan(lowEv);
  });

  it("never returns a negative stake", () => {
    const stake = calculateStakePro({
      kelly: 0.02,
      ev: -5,
      probability: -5,
      risk: 5,
      confidence: -5
    });

    expect(stake).toBeGreaterThanOrEqual(0);
  });
});
