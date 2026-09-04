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
       * NÃO recalibrado (2026-08-22, investigado em duas rodadas).
       * 1) minimumProbability não é o gargalo: sweep 0.27-0.35
       *    inteiro deu zero variação no backtest.
       * 2) minimumConfidence sozinho também não é: a confidence
       *    real do DRAW nesta base sintética nunca passa de ~0.58
       *    (fórmula em confidenceEngine.ts pune probabilidade
       *    abaixo de 0.50, e DRAW nunca passa disso), mas sweep de
       *    0.50-0.58 também deu zero variação.
       * 3) Teste decisivo: com TODOS os campos do tier bet
       *    abertos ao máximo (probability≥0, ev≥-1, risk≤1,
       *    confidence≥0) simultaneamente, DRAW só venceu o
       *    ranking em 6 de 2500 partidas. O gargalo real não é
       *    threshold nenhum — é que DRAW quase nunca supera outros
       *    mercados na comparação de ranking desta base sintética.
       *    Threshold nenhum "calibra" isso; a amostra de 6 apostas
       *    é ruído demais pra confiar em qualquer ROI medido. Se
       *    isso for revisitado, o lugar certo pra olhar é a fórmula
       *    de ranking/score em rankingPipeline, não este arquivo.
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
       * NÃO recalibrado (2026-08-22, investigado em duas rodadas).
       * 1) minimumProbability não é o gargalo: sweep 0.68-0.78
       *    inteiro deu zero variação no backtest.
       * 2) minimumEv sozinho também não é: o EV real do OVER_1_5
       *    nesta base sintética raramente passa de ~0.095 (a
       *    margem de 5% aplicada uniformemente às odds em
       *    matchGenerator.ts deixa pouca vantagem pra qualquer
       *    mercado onde o modelo não diverge muito da probabilidade
       *    "verdadeira"), mas sweep de 0.00-0.09 também deu zero
       *    variação.
       * 3) Teste decisivo: com TODOS os campos do tier bet
       *    abertos ao máximo simultaneamente, OVER_1_5 só venceu o
       *    ranking em 9 de 2500 partidas. Mesma conclusão do DRAW
       *    (ver comentário lá): o gargalo real é a comparação de
       *    ranking contra outros mercados, não um threshold
       *    isolado — 9 apostas é ruído demais pra calibrar por ROI.
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
    },

    /*
     * NÃO recalibrado — investigado via sweep de backtest
     * (2026-09-03, 5000 partidas, backtest determinístico).
     * Ao contrário de UNDER_2_5/DNB_HOME/DNB_AWAY, aqui o
     * gate real (minimumConfidence) bloqueia por um bom
     * motivo: abrindo minimumConfidence de 0.60 para 0.50
     * (mantendo os outros campos), o mercado passa a gerar
     * apostas (48/5000) mas com ROI -6,5%, winRate 37,5% vs.
     * odd média 2,80 (breakeven ~35,7%) e erro de calibração
     * real de 4,8pp (o modelo superestima a probabilidade
     * frente ao resultado observado). Mesmo padrão já
     * documentado para DRAW/OVER_1_5 em
     * project-backtest-determinism-and-calibration-gaps: o
     * modelo de viés de bookmaker do matchGenerator.ts não dá
     * vantagem real a este mercado nesta base sintética — não
     * é um bug de threshold nem de fórmula de confiança.
     * Threshold mantido; revisitar apenas se o modelo de viés
     * do gerador sintético for revisado, ou com dados reais.
     */
    UNDER_1_5: {
      minimumOdd: 2.00,

      watchlist: {
        minimumProbability: 0.28,
        minimumEv: 0.04,
        maximumRisk: 0.62,
        minimumConfidence: 0.54
      },

      bet: {
        minimumProbability: 0.32,
        minimumEv: 0.09,
        maximumRisk: 0.55,
        minimumConfidence: 0.60
      },

      elite: {
        minimumProbability: 0.38,
        minimumEv: 0.14,
        maximumRisk: 0.50,
        minimumConfidence: 0.66
      }
    },

    /*
     * PLACEHOLDER NÃO CALIBRADO (2026-08-22).
     * Mesma lógica do UNDER_1_5 acima, espelhando OVER_2_5.
     */
    UNDER_2_5: {
      minimumOdd: 1.70,

      watchlist: {
        minimumProbability: 0.40,
        minimumEv: 0.04,
        maximumRisk: 0.65,
        minimumConfidence: 0.52
      },

      bet: {
        minimumProbability: 0.45,
        minimumEv: 0.08,
        maximumRisk: 0.58,
        minimumConfidence: 0.58
      },

      elite: {
        minimumProbability: 0.55,
        minimumEv: 0.13,
        maximumRisk: 0.53,
        minimumConfidence: 0.63
      }
    },

    /*
     * bet.minimumProbability/minimumConfidence calibrados via
     * sweep de backtest (2026-09-03, 2500 partidas,
     * determinístico). O placeholder original (herdado de
     * DOUBLE_CHANCE_1X) travava o mercado em zero apostas: nem
     * abrir só probabilidade nem só confidence (mantendo o
     * outro em produção) destravava nada — precisava dos dois
     * juntos. Antes de baixar o threshold, corrigido um gap
     * real na fórmula (addDnbStructure em confidenceEngine.ts
     * não tinha o bônus de "jogo equilibrado" que
     * DOUBLE_CHANCE_1X/X2 já tem). Com prob 0.50 + confidence
     * 0.50: 21 apostas, ROI +12,9%, winRate 52,9%, erro de
     * calibração 0,015 (baixíssimo — probabilidade do modelo
     * bate com o resultado real).
     */
    DNB_HOME: {
      minimumOdd: 1.35,

      watchlist: {
        minimumProbability: 0.55,
        minimumEv: 0.025,
        maximumRisk: 0.64,
        minimumConfidence: 0.52
      },

      bet: {
        minimumProbability: 0.50,
        minimumEv: 0.05,
        maximumRisk: 0.57,
        minimumConfidence: 0.50
      },

      elite: {
        minimumProbability: 0.65,
        minimumEv: 0.08,
        maximumRisk: 0.52,
        minimumConfidence: 0.63
      }
    },

    /*
     * bet.minimumConfidence calibrado via sweep de backtest
     * (2026-09-03, 5000 partidas, determinístico) — mesmo
     * gate/mesma causa raiz do DNB_HOME (ver comentário lá).
     * minimumProbability manteve o valor original (0.50): o
     * sweep de probabilidade sozinho nunca destravou nada, o
     * gate real era só confidence. Com confidence 0.50: 18
     * apostas, ROI +12,6%, winRate 55,6%, erro de calibração
     * 0,013.
     */
    DNB_AWAY: {
      minimumOdd: 1.35,

      watchlist: {
        minimumProbability: 0.55,
        minimumEv: 0.025,
        maximumRisk: 0.64,
        minimumConfidence: 0.52
      },

      bet: {
        minimumProbability: 0.50,
        minimumEv: 0.05,
        maximumRisk: 0.57,
        minimumConfidence: 0.50
      },

      elite: {
        minimumProbability: 0.65,
        minimumEv: 0.08,
        maximumRisk: 0.52,
        minimumConfidence: 0.63
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
