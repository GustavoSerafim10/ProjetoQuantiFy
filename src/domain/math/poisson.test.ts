import { describe, expect, it } from "vitest";

import { poissonCDF, poissonPMF, poissonTable } from "./poisson";

describe("poissonPMF", () => {
  it("matches the closed-form Poisson formula for a known value", () => {
    // lambda = 1, k = 0 -> P(X=0) = e^-1
    expect(poissonPMF(1, 0)).toBeCloseTo(Math.exp(-1), 10);
  });

  it("matches lambda * e^-lambda for k = 1", () => {
    const lambda = 2;

    expect(poissonPMF(lambda, 1)).toBeCloseTo(
      lambda * Math.exp(-lambda),
      10
    );
  });

  it("throws for a non-positive lambda instead of returning NaN/Infinity", () => {
    expect(() => poissonPMF(0, 1)).toThrow();
    expect(() => poissonPMF(-1, 1)).toThrow();
  });

  it("throws for a negative or non-integer k", () => {
    expect(() => poissonPMF(1, -1)).toThrow();
    expect(() => poissonPMF(1, 1.5)).toThrow();
  });
});

describe("poissonCDF", () => {
  it("sums PMF from 0 to k", () => {
    const lambda = 1.5;

    let expectedSum = 0;
    for (let i = 0; i <= 3; i++) {
      expectedSum += poissonPMF(lambda, i);
    }

    expect(poissonCDF(lambda, 3)).toBeCloseTo(expectedSum, 10);
  });

  it("is non-decreasing and bounded in [0, 1]", () => {
    const lambda = 2.2;

    let previous = 0;
    for (let k = 0; k <= 10; k++) {
      const cdf = poissonCDF(lambda, k);

      expect(cdf).toBeGreaterThanOrEqual(previous);
      expect(cdf).toBeLessThanOrEqual(1);

      previous = cdf;
    }
  });
});

describe("poissonTable", () => {
  it("returns a normalized distribution that sums to ~1", () => {
    const table = poissonTable(1.3, 10);

    const sum = table.reduce((a, b) => a + b, 0);

    expect(sum).toBeCloseTo(1, 6);
  });

  it("returns maxGoals + 1 entries", () => {
    expect(poissonTable(1.3, 6)).toHaveLength(7);
  });

  it("weights lower goal counts more heavily for a low lambda", () => {
    const table = poissonTable(0.5, 10);

    // For a low-scoring expectation, P(0 goals) should be the single
    // largest probability in the distribution.
    const maxIndex = table.indexOf(Math.max(...table));

    expect(maxIndex).toBe(0);
  });
});
