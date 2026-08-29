import { describe, expect, it } from "vitest";
import seedrandom from "seedrandom";

import { contextEngine } from "./contextEngine";

/*
 * Alarme de saturação.
 *
 * Bug real encontrado em 2026-08-29: os denominadores de
 * tempoFactor/pressureFactor estavam calibrados contra valores
 * de fallback (dado ausente), não contra jogos reais — então
 * TODO jogo real batia sempre no mesmo limite do clamp (piso
 * 0.94 quando os dados vinham de "?? 0", depois teto 1.08/1.10
 * quando os campos de chutes/escanteios passaram a existir de
 * verdade). Nenhum teste unitário pegou isso, porque cada teste
 * olhava um cenário isolado, nunca a distribuição de resultados
 * sobre uma amostra de jogos plausíveis.
 *
 * Este teste gera uma amostra de estatísticas de jogo dentro de
 * faixas realistas de futebol profissional e mede que fração
 * das partidas sintéticas bate exatamente em cada limite do
 * clamp. Se essa fração for alta demais, é sinal de que a
 * fórmula não está variando com o jogo — está sempre saturando
 * pro mesmo lado, do jeito que causou o bug de hoje.
 *
 * Faixas usadas (chutes totais, escanteios, chutes no alvo, por
 * time, por jogo) refletem volumes típicos de futebol
 * profissional, não uma liga específica.
 */

const SEED = "quantify-saturation-audit-v1";
const SAMPLE_SIZE = 500;
const EPSILON = 0.0005;

function randomInRange(
  rng: () => number,
  min: number,
  max: number
) {
  return min + rng() * (max - min);
}

function isAtBound(
  value: number,
  bound: number
) {
  return Math.abs(value - bound) < EPSILON;
}

describe("contextEngine — alarme de saturação de tempo/pressao", () => {
  it("nao satura no mesmo limite do clamp para a maioria de uma amostra realista de jogos", () => {
    const rng = seedrandom(SEED);

    let tempoAtFloor = 0;
    let tempoAtCeiling = 0;
    let pressureAtFloor = 0;
    let pressureAtCeiling = 0;

    for (let i = 0; i < SAMPLE_SIZE; i++) {
      const homeShots = randomInRange(rng, 6, 20);
      const awayShots = randomInRange(rng, 6, 20);
      const homeCorners = randomInRange(rng, 2, 9);
      const awayCorners = randomInRange(rng, 2, 9);
      const homeShotsOnTarget = randomInRange(rng, 2, 8);
      const awayShotsOnTarget = randomInRange(rng, 2, 8);

      const result = contextEngine({
        homeStats: {
          shots: homeShots,
          cornersAvg: homeCorners,
          shotsOnTarget: homeShotsOnTarget,
          last5GoalsFor: 1.2
        },
        awayStats: {
          shots: awayShots,
          cornersAvg: awayCorners,
          shotsOnTarget: awayShotsOnTarget,
          last5GoalsFor: 1.1
        },
        baseLambdaHome: 1.2,
        baseLambdaAway: 1.0
      });

      if (isAtBound(result.tempoFactor, 0.94)) tempoAtFloor++;
      if (isAtBound(result.tempoFactor, 1.08)) tempoAtCeiling++;
      if (isAtBound(result.pressureFactor, 0.94)) pressureAtFloor++;
      if (isAtBound(result.pressureFactor, 1.10)) pressureAtCeiling++;
    }

    const rate = (n: number) => n / SAMPLE_SIZE;

    /*
     * Nenhum limite isolado deveria concentrar a maioria da
     * amostra. 60% e um teto generoso — o bug real produzia
     * 100% no mesmo limite; qualquer recalibracao saudavel
     * deve manter cada limite bem abaixo disso.
     */
    expect(rate(tempoAtFloor)).toBeLessThan(0.6);
    expect(rate(tempoAtCeiling)).toBeLessThan(0.6);
    expect(rate(pressureAtFloor)).toBeLessThan(0.6);
    expect(rate(pressureAtCeiling)).toBeLessThan(0.6);
  });
});
