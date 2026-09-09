import { describe, expect, it } from "vitest";

import { contextEngine } from "./contextEngine";

describe("contextEngine — tempo/pressure com dados ausentes", () => {
  it("nao pena o lambda quando shots e cornersAvg nao foram informados (regressao: 0 tratado como dado real)", () => {
    const result = contextEngine({
      homeStats: {
        last5GoalsFor: 1.2
      },
      awayStats: {
        last5GoalsFor: 1.2
      },
      baseLambdaHome: 1.1649,
      baseLambdaAway: 1.0506
    });

    expect(result.tempoFactor).toBeCloseTo(1, 5);
    expect(result.pressureFactor).toBeCloseTo(1, 5);
  });

  it("ainda aplica o piso quando shots/cornersAvg vem realmente baixos (nao e so um zero de dado ausente)", () => {
    const result = contextEngine({
      homeStats: {
        last5GoalsFor: 1.2,
        shots: 0,
        cornersAvg: 0
      },
      awayStats: {
        last5GoalsFor: 1.2,
        shots: 0,
        cornersAvg: 0
      },
      baseLambdaHome: 1.1649,
      baseLambdaAway: 1.0506
    });

    /*
     * Atualizado em 2026-09-09: piso alargado de 0.94 para 0.82
     * (ver MIN_TEMPO_FACTOR/MIN_PRESSURE_FACTOR) — a faixa antiga
     * saturava em praticamente todo jogo real testado no mesmo dia.
     */
    expect(result.tempoFactor).toBeCloseTo(0.82, 5);
    expect(result.pressureFactor).toBeCloseTo(0.82, 5);
  });

  it("usa shots/cornersAvg reais quando informados, sem cair no piso", () => {
    const result = contextEngine({
      homeStats: {
        last5GoalsFor: 1.2,
        shots: 12,
        cornersAvg: 5,
        shotsOnTarget: 4
      },
      awayStats: {
        last5GoalsFor: 1.2,
        shots: 13,
        cornersAvg: 6,
        shotsOnTarget: 4.8
      },
      baseLambdaHome: 1.1649,
      baseLambdaAway: 1.0506
    });

    expect(result.tempoFactor).toBeGreaterThan(0.94);
  });
});

describe("contextEngine — recentGoalsFactor (regressao 2026-09-09)", () => {
  it("premia sequencia artilheira (last5GoalsFor alto) em vez de penalizar", () => {
    // Antes da correcao, a heuristica "raw > 5 ? raw/5 : raw" tratava
    // 5.4 (uma media por jogo real e valida, teto 6 em sanitize.ts)
    // como se fosse um total de 5 jogos, dividindo por 5 -> 1.08 ->
    // formFactor abaixo do neutro (penalidade) para o time mais
    // artilheiro do jogo.
    const hotStreak = contextEngine({
      homeStats: {
        last5GoalsFor: 5.4,
        shots: 12,
        cornersAvg: 5,
        shotsOnTarget: 4.3
      },
      awayStats: {
        last5GoalsFor: 1.2,
        shots: 12,
        cornersAvg: 5,
        shotsOnTarget: 4.3
      },
      baseLambdaHome: 1.2,
      baseLambdaAway: 1.2
    });

    const neutral = contextEngine({
      homeStats: {
        last5GoalsFor: 1.2,
        shots: 12,
        cornersAvg: 5,
        shotsOnTarget: 4.3
      },
      awayStats: {
        last5GoalsFor: 1.2,
        shots: 12,
        cornersAvg: 5,
        shotsOnTarget: 4.3
      },
      baseLambdaHome: 1.2,
      baseLambdaAway: 1.2
    });

    expect(hotStreak.lambdaHome).toBeGreaterThan(neutral.lambdaHome);
  });

  it("usa goalsPerGame como fallback (nunca o total goalsFor da temporada) quando last5GoalsFor esta ausente", () => {
    const withFallback = contextEngine({
      homeStats: {
        goalsPerGame: 2.0,
        shots: 12,
        cornersAvg: 5,
        shotsOnTarget: 4.3
      },
      awayStats: {
        last5GoalsFor: 1.2,
        shots: 12,
        cornersAvg: 5,
        shotsOnTarget: 4.3
      },
      baseLambdaHome: 1.2,
      baseLambdaAway: 1.2
    });

    const neutral = contextEngine({
      homeStats: {
        last5GoalsFor: 1.2,
        shots: 12,
        cornersAvg: 5,
        shotsOnTarget: 4.3
      },
      awayStats: {
        last5GoalsFor: 1.2,
        shots: 12,
        cornersAvg: 5,
        shotsOnTarget: 4.3
      },
      baseLambdaHome: 1.2,
      baseLambdaAway: 1.2
    });

    expect(withFallback.lambdaHome).toBeGreaterThan(neutral.lambdaHome);
  });
});

/*
 * Achado real em 2026-09-09: 3 jogos reais da Série B analisados no
 * mesmo dia (Botafogo x Novorinzontino, Fortaleza x Avaí, Operário x
 * CRB) bateram no limite antigo (0.94/1.08/1.10) em tempoFactor e/ou
 * pressureFactor — nenhum deles era um jogo estatisticamente extremo,
 * só um pouco acima/abaixo da média. Trava os dados reais desses
 * jogos para confirmar que a faixa alargada (±18%, ver
 * MIN/MAX_TEMPO_FACTOR e MIN/MAX_PRESSURE_FACTOR) deixa de saturar
 * neles.
 */
describe("contextEngine — jogos reais que saturavam antes da correcao de 2026-09-09", () => {
  it("Operario x CRB (tempo e pressao batiam nos dois tetos)", () => {
    const result = contextEngine({
      homeStats: {
        shots: 14.3,
        cornersAvg: 5.0,
        shotsOnTarget: 4.3,
        last5GoalsFor: 1.3
      },
      awayStats: {
        shots: 16.1,
        cornersAvg: 5.1,
        shotsOnTarget: 6.1,
        last5GoalsFor: 1.5
      },
      baseLambdaHome: 1.2,
      baseLambdaAway: 1.0
    });

    /*
     * Proporção bruta de tempo (~1.191) ainda passa do novo teto
     * (1.18) — e está certo que passe: esse jogo tinha volume de
     * finalização genuinamente alto dos dois lados. O que importa é
     * que agora satura num teto mais alto (mais sinal real chega
     * antes do clamp) em vez do 1.08 antigo. Pressão (~1.102) já
     * fica dentro da faixa nova, sem saturar mais.
     */
    expect(result.tempoFactor).toBeGreaterThan(1.08);
    expect(result.pressureFactor).toBeLessThan(1.18);
  });

  it("Fortaleza x Avai (pressao batia no piso)", () => {
    const result = contextEngine({
      homeStats: {
        shots: 14.6,
        cornersAvg: 5.7,
        shotsOnTarget: 4.2,
        last5GoalsFor: 1.1
      },
      awayStats: {
        shots: 12.0,
        cornersAvg: 4.0,
        shotsOnTarget: 3.5,
        last5GoalsFor: 1.1
      },
      baseLambdaHome: 1.2,
      baseLambdaAway: 1.0
    });

    expect(result.pressureFactor).toBeGreaterThan(0.82);
  });
});
