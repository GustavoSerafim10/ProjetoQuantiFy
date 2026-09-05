import { describe, expect, it } from "vitest";

import { calculateRobustness } from "./robustness";

describe("calculateRobustness", () => {
  it("aposta com EV folgado permanece robusta (score 1) sob pequenas perturbações de λ", () => {
    // Favorito claro com odd generosa — o EV real não deveria
    // desaparecer com variações de ±5-10% em nenhum dos lambdas.
    const result = calculateRobustness({
      market: "HOME",
      lambdaHome: 2.2,
      lambdaAway: 0.6,
      odd: 1.6
    });

    expect(result.valid).toBe(true);
    expect(result.scenarios).toHaveLength(8);
    expect(result.robustnessScore).toBe(1);
    expect(result.weakestScenario?.positive).toBe(true);
  });

  it("aposta no limiar (EV levemente positivo) tem robustnessScore menor que 1", () => {
    // Usa a odd justa (fairOdd) do modelo como base e reduz uma
    // fração pequena da margem — isso garante um EV positivo mas
    // estreito o suficiente para que ALGUMA perturbação o derrube,
    // em vez de depender de tentativa e erro em cima de um número
    // mágico de odd.
    const lambdaHome = 1.3;
    const lambdaAway = 1.25;

    const baseline = calculateRobustness({
      market: "DRAW",
      lambdaHome,
      lambdaAway,
      odd: 2
    });

    const fairOdd = 1 / (baseline.baselineProbability as number);
    const marginalOdd = fairOdd * 1.03;

    const result = calculateRobustness({
      market: "DRAW",
      lambdaHome,
      lambdaAway,
      odd: marginalOdd
    });

    expect(result.valid).toBe(true);
    expect(result.baselineEv).toBeGreaterThan(0);
    expect(result.robustnessScore).not.toBeNull();
    expect(result.robustnessScore as number).toBeLessThan(1);
    expect(result.weakestScenario?.positive).toBe(false);
  });

  it("perturba lambdaHome e lambdaAway separadamente, nunca os dois ao mesmo tempo", () => {
    const result = calculateRobustness({
      market: "OVER_2_5",
      lambdaHome: 1.5,
      lambdaAway: 1.3,
      odd: 1.9
    });

    for (const scenario of result.scenarios) {
      const homeChanged = scenario.lambdaHome !== 1.5;
      const awayChanged = scenario.lambdaAway !== 1.3;

      // XOR: exatamente um dos dois lambdas muda por cenário.
      expect(homeChanged !== awayChanged).toBe(true);
    }
  });

  it("DNB_HOME é a probabilidade condicional (exclui empates) do goalsModel", () => {
    const result = calculateRobustness({
      market: "DNB_HOME",
      lambdaHome: 1.6,
      lambdaAway: 0.9,
      odd: 1.4
    });

    expect(result.valid).toBe(true);
    expect(result.baselineProbability).toBeGreaterThan(0.5);
    expect(result.baselineProbability).toBeLessThan(1);
  });

  it("lambda inválido retorna resultado inválido sem lançar exceção", () => {
    const result = calculateRobustness({
      market: "HOME",
      lambdaHome: -1,
      lambdaAway: 1.2,
      odd: 1.8
    });

    expect(result.valid).toBe(false);
    expect(result.warnings).toContain("INVALID_ROBUSTNESS_LAMBDAS");
  });

  it("mercado desconhecido retorna resultado inválido sem lançar exceção", () => {
    const result = calculateRobustness({
      market: "NOT_A_MARKET",
      lambdaHome: 1.4,
      lambdaAway: 1.1,
      odd: 1.8
    });

    expect(result.valid).toBe(false);
    expect(result.warnings).toContain("UNSUPPORTED_ROBUSTNESS_MARKET");
  });
});
