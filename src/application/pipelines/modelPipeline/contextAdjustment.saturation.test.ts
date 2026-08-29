import { describe, expect, it } from "vitest";
import seedrandom from "seedrandom";

import { contextEngine } from "../../../domain/context/contextEngine";
import { applyBoundedContextAdjustment } from "./contextAdjustment";

/*
 * Alarme de saturação — mesma ideia do
 * contextEngine.saturation.test.ts, aplicado ao clamp final que
 * applyBoundedContextAdjustment aplica em cima do que o contextEngine
 * já calculou.
 *
 * Achado real em 2026-08-29: essa função tinha seu próprio clamp de
 * ±8%, mais apertado que o ±18% que o contextEngine já aplica
 * internamente, sem nenhum comentário explicando a diferença. Medido
 * com amostra realista: 81% das análises batiam nesse clamp (72% no
 * teto) — ou seja, o ajuste contextual praticamente sempre virava um
 * +8% fixo, não importa o que os fatores de tempo/pressão calculassem.
 * Alargado para ±18% (igual ao contextEngine) por decisão do usuário.
 *
 * Este teste garante que, se alguém reintroduzir um clamp mais
 * apertado aqui no futuro, a saturação alta reaparece e o teste falha
 * — em vez de passar silenciosamente até alguém notar num jogo real.
 */

const SEED = "quantify-context-adjustment-saturation-v1";
const SAMPLE_SIZE = 500;

function randomInRange(
  rng: () => number,
  min: number,
  max: number
) {
  return min + rng() * (max - min);
}

describe("applyBoundedContextAdjustment — alarme de saturação (integrado com contextEngine)", () => {
  it("nao satura no mesmo limite do clamp para a maioria de uma amostra realista de jogos", () => {
    const rng = seedrandom(SEED);

    let atFloor = 0;
    let atCeiling = 0;

    for (let i = 0; i < SAMPLE_SIZE; i++) {
      const baseLambdaHome = randomInRange(rng, 0.6, 2.2);
      const baseLambdaAway = randomInRange(rng, 0.5, 2.0);

      const contextAdjusted = contextEngine({
        homeStats: {
          shots: randomInRange(rng, 6, 20),
          cornersAvg: randomInRange(rng, 2, 9),
          shotsOnTarget: randomInRange(rng, 2, 8),
          last5GoalsFor: baseLambdaHome
        },
        awayStats: {
          shots: randomInRange(rng, 6, 20),
          cornersAvg: randomInRange(rng, 2, 9),
          shotsOnTarget: randomInRange(rng, 2, 8),
          last5GoalsFor: baseLambdaAway
        },
        baseLambdaHome,
        baseLambdaAway
      });

      const result = applyBoundedContextAdjustment(
        baseLambdaHome,
        baseLambdaAway,
        contextAdjusted
      );

      const homeAtFloor =
        Math.abs(result.lambdaHome - baseLambdaHome * result.minContextFactor) < 1e-9;

      const homeAtCeiling =
        Math.abs(result.lambdaHome - baseLambdaHome * result.maxContextFactor) < 1e-9;

      const awayAtFloor =
        Math.abs(result.lambdaAway - baseLambdaAway * result.minContextFactor) < 1e-9;

      const awayAtCeiling =
        Math.abs(result.lambdaAway - baseLambdaAway * result.maxContextFactor) < 1e-9;

      if (homeAtFloor || awayAtFloor) atFloor++;
      if (homeAtCeiling || awayAtCeiling) atCeiling++;
    }

    const rate = (n: number) => n / SAMPLE_SIZE;

    /*
     * 60% e o mesmo teto generoso usado no alarme do contextEngine —
     * o bug real produzia 81% concentrado no teto sozinho.
     */
    expect(rate(atFloor)).toBeLessThan(0.6);
    expect(rate(atCeiling)).toBeLessThan(0.6);
  });
});
