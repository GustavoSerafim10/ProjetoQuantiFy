import { describe, expect, it } from "vitest";

import { goalsModel } from "../marketModels/goalsModel";
import { devigProportional } from "../odds/devig";

import { fitMarketImpliedLambda } from "./marketImpliedLambda";

describe("fitMarketImpliedLambda", () => {
  it("recovers a known lambda pair from its own goalsModel output (round-trip)", () => {
    const knownHome = 1.6;
    const knownAway = 1.1;

    const generated = goalsModel(knownHome, knownAway);

    const fitted = fitMarketImpliedLambda({
      home: generated.homeWin,
      draw: generated.draw,
      away: generated.awayWin,
      over25: generated.over25,
      bttsYes: generated.bttsYes
    });

    expect(fitted.lambdaHome).toBeCloseTo(knownHome, 1);
    expect(fitted.lambdaAway).toBeCloseTo(knownAway, 1);
    expect(fitted.fitError).toBeLessThan(0.0005);
  });

  it("fits well against the real de-vig targets from the validated AEK x LASK report", () => {
    const [home, draw, away] = devigProportional([1.68, 4.05, 4.45]);
    const [over25, under25] = devigProportional([1.43, 2.72]);

    const fitted = fitMarketImpliedLambda({
      home,
      draw,
      away,
      over25,
      under25
    });

    /*
     * 5 alvos para 2 parâmetros é um sistema sobredeterminado —
     * mercados reais de bookmakers não são perfeitamente
     * consistentes entre si, então o ajuste é uma aproximação, não
     * uma reprodução exata. `fitError` (erro quadrático médio) é a
     * régua de qualidade do ajuste; checagem por mercado usa
     * tolerância larga (5pp) só para garantir a direção certa.
     */
    const reproduced = goalsModel(fitted.lambdaHome, fitted.lambdaAway);

    expect(reproduced.homeWin).toBeCloseTo(home, 1);
    expect(reproduced.draw).toBeCloseTo(draw, 1);
    expect(reproduced.awayWin).toBeCloseTo(away, 1);
    expect(reproduced.over25).toBeCloseTo(over25, 1);
    expect(fitted.fitError).toBeLessThan(0.001);
  });

  it("falls back to neutral lambdas when no targets are provided, without inventing data", () => {
    const fitted = fitMarketImpliedLambda({});

    expect(fitted.diagnostics.targetCount).toBe(0);
    expect(fitted.lambdaHome).toBeGreaterThan(0);
    expect(fitted.lambdaAway).toBeGreaterThan(0);
  });

  it("works with only a partial set of markets (1X2 only)", () => {
    const [home, draw, away] = devigProportional([1.90, 3.40, 4.00]);

    const fitted = fitMarketImpliedLambda({ home, draw, away });

    expect(fitted.diagnostics.targetCount).toBe(3);

    const reproduced = goalsModel(fitted.lambdaHome, fitted.lambdaAway);
    expect(reproduced.homeWin).toBeCloseTo(home, 2);
  });
});
