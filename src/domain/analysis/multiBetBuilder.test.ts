import { describe, expect, it } from "vitest";

import { buildCombo } from "./multiBetBuilder";

describe("buildCombo — with score matrix (lambdas available)", () => {
  const matchContext = {
    lambdaHome: 1.6,
    lambdaAway: 1.3
  };

  it("returns null for a match with fewer than two candidate markets", () => {
    expect(
      buildCombo(
        [{ market: "HOME", probability: 0.5, odd: 2 }],
        matchContext
      )
    ).toBeNull();
  });

  it("assigns zero joint probability to mutually exclusive legs and discards them", () => {
    const result = buildCombo(
      [
        { market: "OVER_2_5", probability: 0.55, odd: 1.9 },
        { market: "UNDER_2_5", probability: 0.45, odd: 2.0 }
      ],
      matchContext
    );

    expect(result).toBeNull();
  });

  it("discards mutually exclusive legs regardless of input order (regression: order-dependent bug)", () => {
    const forward = buildCombo(
      [
        { market: "BTTS_YES", probability: 0.55, odd: 1.8 },
        { market: "BTTS_NO", probability: 0.45, odd: 2.0 }
      ],
      matchContext
    );

    const reversed = buildCombo(
      [
        { market: "BTTS_NO", probability: 0.45, odd: 2.0 },
        { market: "BTTS_YES", probability: 0.55, odd: 1.8 }
      ],
      matchContext
    );

    expect(forward).toBeNull();
    expect(reversed).toBeNull();
  });

  it("gives a positively-correlated pair (BTTS Yes + Over 1.5) a joint probability higher than the naive independent product", () => {
    const result = buildCombo(
      [
        { market: "BTTS_YES", probability: 0.55, odd: 1.8 },
        { market: "OVER_1_5", probability: 0.75, odd: 1.3 }
      ],
      matchContext
    );

    expect(result).not.toBeNull();
    expect(result?.correlationModel).toBe("JOINT_MATRIX");

    const naiveIndependentProduct = 0.55 * 0.75;

    expect(result?.prob).toBeGreaterThan(naiveIndependentProduct);
  });

  it("falls back to the independent approximation for markets without a matrix condition (e.g. DNB)", () => {
    const result = buildCombo(
      [
        { market: "DNB_HOME", probability: 0.6, odd: 1.5 },
        { market: "OVER_1_5", probability: 0.75, odd: 1.3 }
      ],
      matchContext
    );

    expect(result).not.toBeNull();
    expect(result?.correlationModel).toBe("INDEPENDENT_APPROXIMATION");
    expect(result?.prob).toBeCloseTo(0.6 * 0.75, 6);
  });
});

describe("buildCombo — without a score matrix (lambdas unavailable)", () => {
  it("falls back to the independent approximation", () => {
    const result = buildCombo([
      { market: "HOME", probability: 0.5, odd: 2.0 },
      { market: "OVER_2_5", probability: 0.55, odd: 1.9 }
    ]);

    expect(result).not.toBeNull();
    expect(result?.correlationModel).toBe("INDEPENDENT_APPROXIMATION");
    expect(result?.prob).toBeCloseTo(0.5 * 0.55, 6);
  });

  it("still discards mutually exclusive legs via the string-based fallback check", () => {
    const result = buildCombo([
      { market: "UNDER_1_5", probability: 0.4, odd: 2.5 },
      { market: "OVER_1_5", probability: 0.6, odd: 1.6 }
    ]);

    expect(result).toBeNull();
  });
});
