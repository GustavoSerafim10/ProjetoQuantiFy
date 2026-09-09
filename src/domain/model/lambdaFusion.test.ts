import { describe, expect, it } from "vitest";

import { fuseLambdas } from "./lambdaFusion";

describe("fuseLambdas", () => {
  it("stays essentially at the market lambda when stats agree with it", () => {
    const result = fuseLambdas({
      statsLambdaHome: 1.6,
      statsLambdaAway: 1.2,

      marketLambdaHome: 1.6,
      marketLambdaAway: 1.2,

      bookmakerCount: 3,
      fitError: 0,

      missingDataPenalty: 0
    });

    expect(result.lambdaHome).toBeCloseTo(1.6, 5);
    expect(result.lambdaAway).toBeCloseTo(1.2, 5);
  });

  it("pulls noticeably toward stats when they disagree and stats data is complete", () => {
    const result = fuseLambdas({
      statsLambdaHome: 2.4,
      statsLambdaAway: 0.8,

      marketLambdaHome: 1.6,
      marketLambdaAway: 1.2,

      bookmakerCount: 1,
      fitError: 0,

      missingDataPenalty: 0
    });

    // Base market weight with 1 bookmaker is 0.70, so stats get up
    // to 30% pull — enough to move the number, never enough to flip
    // which side the market considers stronger.
    expect(result.lambdaHome).toBeGreaterThan(1.6);
    expect(result.lambdaAway).toBeLessThan(1.2);

    expect(result.lambdaHome).toBeLessThanOrEqual(1.6 * 1.15);
    expect(result.lambdaAway).toBeGreaterThanOrEqual(1.2 * 0.85);
  });

  it("barely moves when stats disagree but the stats data is poor quality", () => {
    const result = fuseLambdas({
      statsLambdaHome: 2.4,
      statsLambdaAway: 0.8,

      marketLambdaHome: 1.6,
      marketLambdaAway: 1.2,

      bookmakerCount: 3,
      fitError: 0,

      // worst-case missing data penalty (modelPipeline caps it at 0.20)
      missingDataPenalty: 0.2
    });

    expect(result.lambdaHome).toBeCloseTo(1.6, 5);
    expect(result.lambdaAway).toBeCloseTo(1.2, 5);
    expect(result.statsWeight).toBeCloseTo(0, 5);
  });

  it("never drifts beyond the bounded pull range around the market lambda", () => {
    const result = fuseLambdas({
      statsLambdaHome: 3.2,
      statsLambdaAway: 0.2,

      marketLambdaHome: 1.0,
      marketLambdaAway: 1.0,

      bookmakerCount: 1,
      fitError: 0,

      missingDataPenalty: 0
    });

    expect(result.lambdaHome).toBeLessThanOrEqual(1.0 * 1.15);
    expect(result.lambdaAway).toBeGreaterThanOrEqual(1.0 * 0.85);
  });

  it("gives more room to stats when more bookmakers agree is not the driver — fewer bookmakers means more stats room", () => {
    const oneBook = fuseLambdas({
      statsLambdaHome: 2.0,
      statsLambdaAway: 1.0,
      marketLambdaHome: 1.5,
      marketLambdaAway: 1.5,
      bookmakerCount: 1,
      fitError: 0,
      missingDataPenalty: 0
    });

    const threeBooks = fuseLambdas({
      statsLambdaHome: 2.0,
      statsLambdaAway: 1.0,
      marketLambdaHome: 1.5,
      marketLambdaAway: 1.5,
      bookmakerCount: 3,
      fitError: 0,
      missingDataPenalty: 0
    });

    expect(oneBook.statsWeight).toBeGreaterThan(threeBooks.statsWeight);
    expect(oneBook.lambdaHome).toBeGreaterThan(threeBooks.lambdaHome);
  });
});
