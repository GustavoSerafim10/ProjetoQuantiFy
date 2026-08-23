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

  it("defaults voidProbability to 0, matching the 2-arg call exactly (regression for the 9 pre-existing markets)", () => {
    expect(expectedValue(0.6, 2.0, 0)).toBe(expectedValue(0.6, 2.0));
    expect(expectedValue(0.42, 3.5, 0)).toBe(expectedValue(0.42, 3.5));
  });

  /*
   * Empate Anula (DNB): EV = (1 - voidProbability) * (p*odd - 1).
   * p = 0.6, odd = 2.0 -> raw p*odd-1 = 0.2; com 20% de chance de
   * anulação, o EV real é 80% disso.
   */
  it("discounts EV by voidProbability for markets that can push", () => {
    expect(expectedValue(0.6, 2.0, 0.2)).toBeCloseTo(0.16, 6);
  });

  it("returns NaN for an invalid voidProbability (must be in [0, 1))", () => {
    expect(Number.isNaN(expectedValue(0.6, 2.0, -0.1))).toBe(true);
    expect(Number.isNaN(expectedValue(0.6, 2.0, 1))).toBe(true);
    expect(Number.isNaN(expectedValue(0.6, 2.0, 1.5))).toBe(true);
  });

  it("returns NaN for a non-finite voidProbability", () => {
    expect(Number.isNaN(expectedValue(0.6, 2.0, NaN))).toBe(true);
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
