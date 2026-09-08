/* ==========================================
   FALLBACK
========================================== */

export function emptyResponse() {
  return {
    blocked:
      true,

    blockReason:
      "INSUFFICIENT_DATA",

    lambdaHome:
      1.32,

    lambdaAway:
      1.23,

    totalLambda:
      2.55,

    goalExpectationScore:
      0.5,

    goalProfile:
      "UNKNOWN",

    isLowGoalGame:
      false,

    goals: {
      matrix:
        [],

      over15:
        0,

      over25:
        0,

      under15:
        0,

      under25:
        0,

      meta:
        {}
    },

    dixonColes: {
      matrix:
        [],

      rho:
        0,

      bttsYesProb:
        0,

      bttsNoProb:
        0
    },

    btts: {
      yes:
        0,

      no:
        0
    },

    result: {
      home:
        0,

      draw:
        0,

      away:
        0
    },

    doubleChance: {
      oneX:
        0,

      xTwo:
        0
    },

    markets: {
  home:
    0,

  draw:
    0,

  away:
    0,

  over15:
    0,

  over25:
    0,

  bttsYes:
    0,

  bttsNo:
    0,

  doubleChance1X:
    0,

  doubleChanceX2:
    0
},

    handicap: {},
    corners: {},
    cards: {},
    shots: {},
    engines: {},

    tempoFactor:
      1,

    pressureFactor:
      1,

    confidence:
      0,

    /*
     * Presente mesmo no fallback para manter o contrato de retorno
     * de modelPipeline/marketModelPipeline consistente (achado real
     * em 2026-09-08: sem isso, o tipo inferido de marketModelPipeline
     * vira uma união onde `leagueReliability` só existe em um dos
     * lados, e qualquer acesso direto — inclusive em teste — quebra
     * `tsc -b`, que é o que o build de produção realmente roda).
     */
    leagueReliability: {
      key: "UNKNOWN",
      requestedKey: "",
      found: false,
      usedDefault: true,
      resolution: "default" as const,
      dataReliability: 0.5
    },

    debug: {
      modelPipeline: {
        error:
          "INSUFFICIENT_DATA"
      }
    }
  };
}
