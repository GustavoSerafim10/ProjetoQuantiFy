import { describe, expect, it } from "vitest";

import {
  averageBookmakerOdds,
  devigConsensus,
  devigProportional
} from "./devig";

describe("averageBookmakerOdds", () => {
  it("averages valid odds from multiple bookmakers", () => {
    expect(averageBookmakerOdds([1.75, 1.80, 1.78])).toBeCloseTo(
      1.7767,
      3
    );
  });

  it("ignores invalid odds (<=1, non-finite)", () => {
    expect(averageBookmakerOdds([1.75, 1, NaN, -2])).toBe(1.75);
  });

  it("returns null when no valid odds remain", () => {
    expect(averageBookmakerOdds([1, 0, NaN])).toBeNull();
  });
});

describe("devigProportional", () => {
  /*
   * Fixture real: Análise de Apostas — Futebol (Lote 4),
   * AEK Athens x LASK, 08/09/2026. Odds médias multi-casas ->
   * probabilidade real reportada no PDF que o usuário validou
   * manualmente (resultado real bateu com a leitura do jogo).
   */
  it("reproduces the AEK x LASK 1X2 de-vig probabilities from the validated report", () => {
    const [home, draw, away] = devigProportional([1.68, 4.05, 4.45]);

    expect(home).toBeCloseTo(0.557, 2);
    expect(draw).toBeCloseTo(0.232, 2);
    expect(away).toBeCloseTo(0.211, 2);
    expect(home + draw + away).toBeCloseTo(1, 6);
  });

  it("reproduces the AEK x LASK over/under 2.5 de-vig probabilities", () => {
    const [over, under] = devigProportional([1.43, 2.72]);

    expect(over).toBeCloseTo(0.655, 2);
    expect(under).toBeCloseTo(0.345, 2);
  });

  it("returns zeros when every odd is invalid instead of inventing a value", () => {
    expect(devigProportional([0, NaN, -1])).toEqual([0, 0, 0]);
  });
});

describe("devigConsensus", () => {
  it("averages across bookmakers then removes the margin in one step", () => {
    const result = devigConsensus([
      [1.68, 1.70],
      [4.05, 4.00],
      [4.45, 4.50]
    ]);

    expect(result.bookmakerCount).toBe(2);
    expect(result.probabilities[0]).toBeGreaterThan(
      result.probabilities[1]
    );
    expect(
      result.probabilities.reduce((sum, p) => sum + p, 0)
    ).toBeCloseTo(1, 6);
  });

  it("still works with a single bookmaker", () => {
    const result = devigConsensus([[1.68], [4.05], [4.45]]);

    expect(result.bookmakerCount).toBe(1);
    expect(result.probabilities[0]).toBeCloseTo(0.557, 2);
  });
});
