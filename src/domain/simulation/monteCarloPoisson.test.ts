import { describe, expect, it } from "vitest";
import seedrandom from "seedrandom";

import { monteCarloPoisson } from "./monteCarloPoisson";

/*
 * under15/dnbHome/dnbAway foram adicionados (2026-09-04) para
 * fechar um gap real: confidenceEngine só concede o bônus/penalidade
 * de "concordância de modelo" quando monteCarloProb E poissonProb
 * estão disponíveis, e antes disso o adapter só simulava
 * under25/doubleChance1X/X2 — UNDER_1_5, DNB_HOME e DNB_AWAY nunca
 * recebiam validação cruzada nenhuma (nem bônus, nem o cap de
 * divergência). Estes testes travam a matemática das três
 * probabilidades derivadas.
 */
describe("monteCarloPoisson — under15/dnbHome/dnbAway", () => {
  it("under15 é o complemento exato de over15", () => {
    const result = monteCarloPoisson(1.3, 1.1, 20_000, {
      random: seedrandom("under15-complement")
    });

    expect(result.under15).toBeCloseTo(1 - result.over15, 10);
  });

  it("dnbHome e dnbAway somam 1 e refletem a proporção sem empates", () => {
    const result = monteCarloPoisson(1.6, 0.9, 20_000, {
      random: seedrandom("dnb-ratio")
    });

    expect(result.dnbHome + result.dnbAway).toBeCloseTo(1, 10);

    // Time da casa mais forte deve ficar com dnbHome > 0.5.
    expect(result.dnbHome).toBeGreaterThan(0.5);
  });

  it("dnbHome/dnbAway ficam em 0.5 neutro quando não há partidas sem empate", () => {
    // Lambdas extremamente baixos maximizam a chance de 0x0 em
    // poucas iterações, mas o fallback existe para o caso limite
    // de noDrawCount === 0 sem depender de sorte do RNG.
    const result = monteCarloPoisson(0.2, 0.2, 1, {
      random: () => 0.99999
    });

    if (result.homeWin + result.awayWin === 0) {
      expect(result.dnbHome).toBe(0.5);
      expect(result.dnbAway).toBe(0.5);
    }
  });

  it("expõe erro amostral e IC95 para under15/dnbHome/dnbAway", () => {
    const result = monteCarloPoisson(1.4, 1.2, 20_000, {
      random: seedrandom("dnb-under-sampling-error")
    });

    expect(result.samplingError.under15).toBeGreaterThan(0);
    expect(result.samplingError.dnbHome).toBeGreaterThan(0);
    expect(result.samplingError.dnbAway).toBeGreaterThan(0);

    expect(result.confidenceInterval95.under15.lower).toBeLessThanOrEqual(
      result.under15
    );
    expect(result.confidenceInterval95.under15.upper).toBeGreaterThanOrEqual(
      result.under15
    );
  });
});
