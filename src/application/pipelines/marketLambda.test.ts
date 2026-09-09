import { describe, expect, it } from "vitest";

import { computeMarketLambda } from "./marketLambda";

describe("computeMarketLambda", () => {
  it("returns null when there are no fittable targets (e.g. only DNB odds)", () => {
    const result = computeMarketLambda({
      dnbHome: [1.85],
      dnbAway: [1.95]
    });

    expect(result).toBeNull();
  });

  it("returns a real fit when 1X2 odds are present", () => {
    const result = computeMarketLambda({
      home: [1.68],
      draw: [4.05],
      away: [4.45]
    });

    expect(result).not.toBeNull();
    expect(result?.lambdaHome).toBeGreaterThan(0);
    expect(result?.lambdaAway).toBeGreaterThan(0);
  });
});
