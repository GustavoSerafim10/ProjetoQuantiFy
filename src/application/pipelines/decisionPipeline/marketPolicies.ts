import type {
  CanonicalDecisionMarket,
  DecisionMarketPolicy
} from "./types";

/* ==========================================
   POLÍTICA OPERACIONAL
========================================== */

/*
 * Estes thresholds representam política de
 * decisão, e não cálculo matemático.
 *
 * Por isso pertencem a este arquivo.
 *
 * Devem ser ajustados futuramente apenas com
 * backtest e resultados fora da amostra.
 */

export const MARKET_POLICIES:
  Record<
    CanonicalDecisionMarket,
    DecisionMarketPolicy
  > = {
    HOME: {
      minimumOdd: 1.45,

      watchlist: {
        minimumProbability: 0.42,
        minimumEv: 0.04,
        maximumRisk: 0.68,
        minimumConfidence: 0.50
      },

      /*
       * bet.minimumProbability calibrado via sweep de backtest
       * (2026-08-22, 2500 partidas, backtest determinístico —
       * ver runBacktest.ts): 0.40/0.42 renderam ROI +11,4% contra
       * +9,03% do valor original (0.45). Ganho consistente ao
       * longo de toda a faixa testada (0.40-0.48), não é ruído de
       * amostra. 0.42 escolhido por ficar mais perto do centro do
       * platô que 0.40.
       */
      bet: {
        minimumProbability: 0.42,
        minimumEv: 0.08,
        maximumRisk: 0.62,
        minimumConfidence: 0.55
      },

      elite: {
        minimumProbability: 0.48,
        minimumEv: 0.12,
        maximumRisk: 0.56,
        minimumConfidence: 0.60
      }
    },

    DRAW: {
      minimumOdd: 2.60,

      watchlist: {
        minimumProbability: 0.29,
        minimumEv: 0.06,
        maximumRisk: 0.70,
        minimumConfidence: 0.52
      },

      /*
       * bet.minimumProbability NÃO foi recalibrado (2026-08-22).
       * Diagnóstico via backtest: a confidence real do mercado
       * DRAW nesta base sintética varia só entre 0.467 e 0.578,
       * nunca alcançando os 0.58 exigidos por este tier — ou seja,
       * minimumProbability nunca é o gargalo (testado 0.27-0.35
       * inteiro, zero variação no resultado do backtest). O
       * mercado está efetivamente travado por minimumConfidence
       * (e o EV mediano também é negativo), não pela
       * probabilidade. Recalibrar esse mercado de verdade exige
       * revisar minimumConfidence/minimumEv, não este campo —
       * fora do escopo desta sessão.
       */
      bet: {
        minimumProbability: 0.32,
        minimumEv: 0.12,
        maximumRisk: 0.62,
        minimumConfidence: 0.58
      },

      elite: {
        minimumProbability: 0.35,
        minimumEv: 0.18,
        maximumRisk: 0.56,
        minimumConfidence: 0.63
      }
    },

    AWAY: {
      minimumOdd: 1.45,

      watchlist: {
        minimumProbability: 0.42,
        minimumEv: 0.04,
        maximumRisk: 0.68,
        minimumConfidence: 0.50
      },

      /*
       * bet.minimumProbability testado em sweep de backtest
       * (2026-08-21): um primeiro sweep com amostra pequena
       * (~1500 partidas, ~130 apostas por ponto) sugeriu 0.35;
       * repetindo com amostra maior (2500 partidas, ~330
       * apostas por ponto) o valor original 0.45 se mostrou
       * o melhor ponto (ROI +9,03% e menor drawdown), então
       * o valor original foi mantido.
       */
      bet: {
        minimumProbability: 0.45,
        minimumEv: 0.08,
        maximumRisk: 0.62,
        minimumConfidence: 0.55
      },

      elite: {
        minimumProbability: 0.48,
        minimumEv: 0.12,
        maximumRisk: 0.56,
        minimumConfidence: 0.60
      }
    },

    OVER_1_5: {
      minimumOdd: 1.40,

      watchlist: {
        minimumProbability: 0.70,
        minimumEv: 0.04,
        maximumRisk: 0.62,
        minimumConfidence: 0.54
      },

      /*
       * bet.minimumProbability NÃO foi recalibrado (2026-08-22).
       * Diagnóstico via backtest: o EV real do mercado OVER_1_5
       * nesta base sintética varia até no máximo 0.095 (mediana
       * negativa), mal cruzando os 0.09 exigidos por este tier —
       * quase nenhuma partida passa do gate de EV, então testado
       * 0.68-0.78 inteiro deu zero variação no resultado do
       * backtest. minimumProbability não é o gargalo aqui;
       * minimumEv é. Fora do escopo desta sessão.
       */
      bet: {
        minimumProbability: 0.75,
        minimumEv: 0.09,
        maximumRisk: 0.55,
        minimumConfidence: 0.60
      },

      elite: {
        minimumProbability: 0.78,
        minimumEv: 0.14,
        maximumRisk: 0.50,
        minimumConfidence: 0.66
      },

      scalper: {
        minimumProbability: 0.82,
        minimumEv: 0.07,
        maximumRisk: 0.46,
        minimumConfidence: 0.68
      }
    },

    OVER_2_5: {
      minimumOdd: 1.55,

      watchlist: {
        minimumProbability: 0.58,
        minimumEv: 0.04,
        maximumRisk: 0.65,
        minimumConfidence: 0.52
      },

      /*
       * bet.minimumProbability calibrado via sweep de backtest
       * (2026-08-21), confirmado em duas amostras (~1500 e depois
       * ~2500 partidas): 0.63 caía para ROI +3,65% e ficava
       * negativo em 0.68. Toda a faixa 0.35-0.48 se manteve
       * consistente em +7,4% a +8,1% de ROI nas duas rodadas —
       * sinal robusto, não ruído de amostra pequena.
       */
      bet: {
        minimumProbability: 0.45,
        minimumEv: 0.08,
        maximumRisk: 0.58,
        minimumConfidence: 0.58
      },

      elite: {
        minimumProbability: 0.67,
        minimumEv: 0.13,
        maximumRisk: 0.53,
        minimumConfidence: 0.63
      }
    },

    BTTS_YES: {
      minimumOdd: 1.55,

      watchlist: {
        minimumProbability: 0.56,
        minimumEv: 0.04,
        maximumRisk: 0.68,
        minimumConfidence: 0.52
      },

      /*
       * bet.minimumProbability testado em sweep de backtest
       * (2026-08-21): um primeiro sweep com amostra pequena
       * sugeriu 0.55 sobre 0.60; repetindo com amostra maior
       * (2500 partidas) os dois valores deram exatamente o
       * mesmo ROI (+7,72%) — a diferença original era ruído
       * de amostra, então o valor original foi mantido.
       */
      bet: {
        minimumProbability: 0.60,
        minimumEv: 0.08,
        maximumRisk: 0.62,
        minimumConfidence: 0.58
      },

      elite: {
        minimumProbability: 0.64,
        minimumEv: 0.14,
        maximumRisk: 0.56,
        minimumConfidence: 0.63
      }
    },

    BTTS_NO: {
      minimumOdd: 1.50,

      watchlist: {
        minimumProbability: 0.56,
        minimumEv: 0.04,
        maximumRisk: 0.68,
        minimumConfidence: 0.52
      },

      /*
       * bet.minimumProbability confirmado via sweep de backtest
       * (2026-08-22, 2500 partidas, backtest determinístico):
       * 0.54-0.60 empatam em ROI +9,03% e pioram progressivamente
       * acima disso (0.62 → +8,36%, 0.64 → +7,90%). 0.60 já é o
       * ponto ótimo — valor original mantido.
       */
      bet: {
        minimumProbability: 0.60,
        minimumEv: 0.08,
        maximumRisk: 0.62,
        minimumConfidence: 0.58
      },

      elite: {
        minimumProbability: 0.64,
        minimumEv: 0.13,
        maximumRisk: 0.56,
        minimumConfidence: 0.63
      }
    },

    DOUBLE_CHANCE_1X: {
      minimumOdd: 1.30,

      watchlist: {
        minimumProbability: 0.62,
        minimumEv: 0.025,
        maximumRisk: 0.64,
        minimumConfidence: 0.52
      },

      /*
       * bet.minimumProbability confirmado via sweep de backtest
       * (2026-08-22, 2500 partidas, backtest determinístico):
       * platô suave entre 0.60 e 0.71 (ROI +8,8% a +9,5%, 317 a
       * 332 apostas). 0.67 (valor original) fica dentro desse
       * platô sem ganho claro em mudar — mantido.
       */
      bet: {
        minimumProbability: 0.67,
        minimumEv: 0.05,
        maximumRisk: 0.57,
        minimumConfidence: 0.58
      },

      elite: {
        minimumProbability: 0.71,
        minimumEv: 0.08,
        maximumRisk: 0.52,
        minimumConfidence: 0.63
      },

      scalper: {
        minimumProbability: 0.76,
        minimumEv: 0.05,
        maximumRisk: 0.46,
        minimumConfidence: 0.67
      }
    },

    DOUBLE_CHANCE_X2: {
      minimumOdd: 1.30,

      watchlist: {
        minimumProbability: 0.62,
        minimumEv: 0.025,
        maximumRisk: 0.64,
        minimumConfidence: 0.52
      },

      /*
       * bet.minimumProbability calibrado via sweep de backtest
       * (2026-08-21), confirmado em amostra maior (~2500
       * partidas): 0.67 rendeu ROI +7,15%, abaixo do platô
       * estável de +7,5% a +7,7% entre 0.45 e 0.62. Ganho mais
       * modesto do que a primeira estimativa (~8% em vez de
       * ~27%), mas consistente nas duas rodadas — 0.55 fica
       * no meio desse platô.
       */
      bet: {
        minimumProbability: 0.55,
        minimumEv: 0.05,
        maximumRisk: 0.57,
        minimumConfidence: 0.58
      },

      elite: {
        minimumProbability: 0.71,
        minimumEv: 0.08,
        maximumRisk: 0.52,
        minimumConfidence: 0.63
      },

      scalper: {
        minimumProbability: 0.76,
        minimumEv: 0.05,
        maximumRisk: 0.46,
        minimumConfidence: 0.67
      }
    }
  };

/* ==========================================
   LIMITES GLOBAIS
========================================== */

export const GLOBAL_POLICY = {
  maximumTrapScore:
    0.65,

  hardMaximumRisk:
    0.78,

  hardMinimumProbability:
    0.25,

  hardMinimumOdd:
    1.01,

  hardMinimumEv:
    0,

  maximumStake:
    0.03,

  kellyFraction:
    0.25,

  maximumWatchlist:
    5,

  maximumComboMarkets:
    4
} as const;

/* ==========================================
   OVERRIDES (CALIBRAÇÃO)
========================================== */

/*
 * Permite sobrescrever, por mercado e por nível
 * (watchlist/bet/elite/scalper), os thresholds de
 * MARKET_POLICIES sem alterar a política padrão —
 * usado para experimentos de calibração via backtest
 * (ex.: varrer minimumProbability e medir ROI/drawdown).
 * Sem overrides, resolveMarketPolicy() retorna
 * exatamente MARKET_POLICIES[market].
 */
export type DecisionMarketPolicyOverride = {
  minimumOdd?: number;

  watchlist?:
    Partial<DecisionMarketPolicy["watchlist"]>;

  bet?:
    Partial<DecisionMarketPolicy["bet"]>;

  elite?:
    Partial<DecisionMarketPolicy["elite"]>;

  scalper?:
    Partial<
      NonNullable<
        DecisionMarketPolicy["scalper"]
      >
    >;
};

export type MarketPolicyOverrides =
  Partial<
    Record<
      CanonicalDecisionMarket,
      DecisionMarketPolicyOverride
    >
  >;

export function resolveMarketPolicy(
  market: CanonicalDecisionMarket,
  overrides?: MarketPolicyOverrides
): DecisionMarketPolicy {
  const base =
    MARKET_POLICIES[market];

  const override =
    overrides?.[market];

  if (!override) {
    return base;
  }

  return {
    minimumOdd:
      override.minimumOdd ??
      base.minimumOdd,

    watchlist: {
      ...base.watchlist,
      ...override.watchlist
    },

    bet: {
      ...base.bet,
      ...override.bet
    },

    elite: {
      ...base.elite,
      ...override.elite
    },

    scalper:
      base.scalper ||
      override.scalper
        ? {
            ...(base.scalper ?? {
              minimumProbability: base.watchlist.minimumProbability,
              minimumEv: base.watchlist.minimumEv,
              maximumRisk: base.watchlist.maximumRisk,
              minimumConfidence: base.watchlist.minimumConfidence
            }),
            ...override.scalper
          }
        : undefined
  };
}
