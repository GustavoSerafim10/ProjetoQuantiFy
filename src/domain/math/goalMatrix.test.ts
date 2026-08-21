import { describe, expect, it } from "vitest";

import {
  bttsProbability,
  goalMatrix,
  matchOutcomeProbabilities,
  overUnderProbability
} from "./goalMatrix";

describe("goalMatrix", () => {
  it("returns a matrix of scores whose probabilities sum to ~1", () => {
    const matrix = goalMatrix(1.4, 1.1);

    const total = matrix.reduce(
      (sum, cell) => sum + cell.probability,
      0
    );

    expect(total).toBeCloseTo(1, 6);
  });

  it("gives the higher-lambda side the larger win probability, all else equal", () => {
    const matrix = goalMatrix(2.0, 0.8);
    const outcome = matchOutcomeProbabilities(matrix);

    expect(outcome.homeWin).toBeGreaterThan(outcome.awayWin);
  });

  it("produces a symmetric 50/50-ish split for equal lambdas", () => {
    const matrix = goalMatrix(1.3, 1.3);
    const outcome = matchOutcomeProbabilities(matrix);

    expect(
      Math.abs(outcome.homeWin - outcome.awayWin)
    ).toBeLessThan(0.02);
  });
});

describe("matchOutcomeProbabilities", () => {
  it("returns home/draw/away probabilities that sum to ~1", () => {
    const matrix = goalMatrix(1.5, 1.2);
    const outcome = matchOutcomeProbabilities(matrix);

    expect(
      outcome.homeWin + outcome.draw + outcome.awayWin
    ).toBeCloseTo(1, 6);
  });
});

describe("overUnderProbability", () => {
  it("returns over/under probabilities that sum to ~1", () => {
    const matrix = goalMatrix(1.4, 1.1);
    const result = overUnderProbability(matrix, 2.5);

    expect(result.over + result.under).toBeCloseTo(1, 6);
  });

  it("gives a higher-scoring matchup a larger over-2.5 probability", () => {
    const highScoring = overUnderProbability(
      goalMatrix(2.2, 2.0),
      2.5
    );

    const lowScoring = overUnderProbability(
      goalMatrix(0.8, 0.6),
      2.5
    );

    expect(highScoring.over).toBeGreaterThan(lowScoring.over);
  });
});

describe("bttsProbability", () => {
  it("returns yes/no probabilities that sum to ~1", () => {
    const matrix = goalMatrix(1.4, 1.1);
    const result = bttsProbability(matrix);

    expect(result.yes + result.no).toBeCloseTo(1, 6);
  });

  it("gives two strong attacks a higher BTTS-yes probability than two weak ones", () => {
    const strongAttacks = bttsProbability(
      goalMatrix(2.0, 1.8)
    );

    const weakAttacks = bttsProbability(
      goalMatrix(0.4, 0.3)
    );

    expect(strongAttacks.yes).toBeGreaterThan(weakAttacks.yes);
  });
});
