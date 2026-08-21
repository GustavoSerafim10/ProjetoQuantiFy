import { describe, expect, it } from "vitest";

import { classifyBet, expectedValue } from "./expectedValue";

describe("expectedValue", () => {
  it("computes EV = probability * odd - 1", () => {
    // p = 0.60, odd = 2.00 -> EV = 0.20 (20% expected return)
    expect(expectedValue(0.6, 2.0)).toBeCloseTo(0.2, 10);
  });

  it("returns a negative EV when the bet is priced against the bettor", () => {
    // p = 0.40, odd = 2.00 -> EV = -0.20
    expect(expectedValue(0.4, 2.0)).toBeCloseTo(-0.2, 10);
  });

  it("returns exactly 0 at breakeven", () => {
    // p = 0.50, odd = 2.00 -> EV = 0
    expect(expectedValue(0.5, 2.0)).toBe(0);
  });

  it("returns NaN for probability outside [0, 1]", () => {
    expect(expectedValue(-0.1, 2.0)).toBeNaN();
    expect(expectedValue(1.1, 2.0)).toBeNaN();
  });

  it("returns NaN for odd <= 1", () => {
    expect(expectedValue(0.6, 1.0)).toBeNaN();
    expect(expectedValue(0.6, 0.5)).toBeNaN();
  });

  it("returns NaN for non-finite inputs", () => {
    expect(expectedValue(NaN, 2.0)).toBeNaN();
    expect(expectedValue(0.6, Infinity)).toBeNaN();
    expect(expectedValue(0.6, NaN)).toBeNaN();
  });

  it("accepts the boundary probabilities 0 and 1", () => {
    expect(expectedValue(0, 2.0)).toBeCloseTo(-1, 10);
    expect(expectedValue(1, 2.0)).toBeCloseTo(1, 10);
  });
});

describe("classifyBet", () => {
  it("classifies EV bands from STRONG_VALUE down to NO_VALUE", () => {
    expect(classifyBet(0.2)).toBe("STRONG_VALUE");
    expect(classifyBet(0.12)).toBe("STRONG_VALUE");
    expect(classifyBet(0.08)).toBe("VALUE");
    expect(classifyBet(0.05)).toBe("VALUE");
    expect(classifyBet(0.02)).toBe("MARGINAL_VALUE");
    expect(classifyBet(0)).toBe("BREAKEVEN");
    expect(classifyBet(-0.05)).toBe("NO_VALUE");
  });

  it("treats a non-finite EV as NO_VALUE", () => {
    expect(classifyBet(NaN)).toBe("NO_VALUE");
    expect(classifyBet(Infinity)).toBe("NO_VALUE");
  });
});
