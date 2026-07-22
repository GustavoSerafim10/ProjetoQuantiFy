import {
  buildCombo
} from "../../domain/analysis/multiBetBuilder";

/* ==========================================
   DECISION PIPELINE — QUANTIFY V7
========================================== */

/*
 * Responsabilidade:
 *
 * - receber mercados já calculados;
 * - validar os resultados dos pipelines anteriores;
 * - aplicar critérios operacionais por mercado;
 * - classificar candidatos;
 * - selecionar a melhor entrada;
 * - produzir NO BET quando necessário;
 * - preparar watchlist, descartados e combo.
 *
 * Este arquivo não:
 *
 * - recalcula probabilidades;
 * - recalibra probabilidades;
 * - executa Monte Carlo;
 * - recalcula EV;
 * - recalcula risco;
 * - altera confidence;
 * - refaz ranking;
 * - registra apostas automaticamente.
 */

/* ==========================================
   CONTRATOS
========================================== */

export type DecisionClassification =
  | "SCALPER"
  | "ELITE"
  | "BET"
  | "WATCHLIST"
  | "NO BET";

export type CanonicalDecisionMarket =
  | "HOME"
  | "DRAW"
  | "AWAY"
  | "OVER_1_5"
  | "OVER_2_5"
  | "BTTS_YES"
  | "BTTS_NO"
  | "DOUBLE_CHANCE_1X"
  | "DOUBLE_CHANCE_X2";

export interface DecisionMarketPolicy {
  minimumOdd: number;

  watchlist: {
    minimumProbability: number;
    minimumEv: number;
    maximumRisk: number;
    minimumConfidence: number;
  };

  bet: {
    minimumProbability: number;
    minimumEv: number;
    maximumRisk: number;
    minimumConfidence: number;
  };

  elite: {
    minimumProbability: number;
    minimumEv: number;
    maximumRisk: number;
    minimumConfidence: number;
  };

  scalper?: {
    minimumProbability: number;
    minimumEv: number;
    maximumRisk: number;
    minimumConfidence: number;
  };
}

export interface DecisionGuardResult {
  valid: boolean;
  blockers: string[];
  warnings: string[];
}

export interface DecisionMarketDebug {
  valid: boolean;

  market:
    CanonicalDecisionMarket | null;

  policy:
    DecisionMarketPolicy | null;

  guards: {
    blockers: string[];
    warnings: string[];
  };

  metrics: {
    probability: number | null;
    odd: number | null;
    ev: number | null;
    probabilityEdge: number | null;
    risk: number | null;
    confidence: number | null;
    rankingScore: number | null;
    trapScore: number | null;
  };

  classification:
    DecisionClassification;

  stake:
    number;
}

export interface DecisionPipelineDebug {
  valid: boolean;

  inputMarkets: number;
  eligibleMarkets: number;
  actionableMarkets: number;

  eliteMarkets: number;
  scalperMarkets: number;
  betMarkets: number;
  watchlistMarkets: number;
  noBetMarkets: number;

  discardedMarkets: number;

  bestMarket: string | null;
  bestClassification:
    DecisionClassification | null;

  upstream: {
    probabilityValid: boolean;
    valueValid: boolean;
    riskValid: boolean;
    rankingValid: boolean;
    correlationValid: boolean;
  };

  reason: string;
}


export interface EvaluatedDecisionMarket {
  /*
   * Mantém compatibilidade com os campos produzidos
   * pelos pipelines anteriores, sem deixar os callbacks
   * de map/filter/find com parâmetro implicitamente any.
   */
  [key: string]: any;

  market?: string;

  probability?: number;
  odd?: number;
  ev?: number;
  probabilityEdge?: number;

  risk?: number;
  riskScore?: number;

  confidence?: number;

  rankingScore?: number;
  score?: number;
  rank?: number;

  kelly: number;
  stake: number;

  classification:
    DecisionClassification;

  decisionValid:
    boolean;

  decisionOriginalIndex:
    number;

  decisionBlockers:
    string[];

  decisionWarnings:
    string[];

  warnings:
    string[];

  discardedStage:
    string | null;

  discardedReason:
    string | null;
}

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

const MARKET_POLICIES:
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

    DRAW: {
      minimumOdd: 2.60,

      watchlist: {
        minimumProbability: 0.29,
        minimumEv: 0.06,
        maximumRisk: 0.70,
        minimumConfidence: 0.52
      },

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

      bet: {
        minimumProbability: 0.63,
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
    }
  };

/* ==========================================
   LIMITES GLOBAIS
========================================== */

const GLOBAL_POLICY = {
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
   PIPELINE
========================================== */

export function decisionPipeline(
  data: any
) {
  const inputMarkets: any[] =
    Array.isArray(data?.markets)
      ? data.markets
      : [];

  const gameWarnings =
    normalizeWarnings(
      data?.warnings
    );

  const upstream = {
    probabilityValid:
      data?.probabilityValid !== false,

    valueValid:
      data?.valueValid !== false,

    riskValid:
      data?.riskValid !== false,

    rankingValid:
      data?.rankingValid !== false,

    correlationValid:
      data?.correlationValid !== false
  };

  /*
   * Bloqueios estruturais da partida devem
   * prevalecer sobre qualquer mercado.
   */
  if (data?.blocked === true) {
    const blockReason =
      String(
        data?.blockReason ??
        "GAME_FILTER_BLOCKED"
      );

    return createNoBetResult({
      data,
      inputMarkets,

      gameWarnings:
        normalizeWarnings([
          ...gameWarnings,
          blockReason
        ]),

      upstream,

      reason:
        blockReason
    });
  }

  if (inputMarkets.length === 0) {
    return createNoBetResult({
      data,
      inputMarkets,
      gameWarnings,
      upstream,

      reason:
        "NO_MARKETS_AVAILABLE"
    });
  }

  /*
   * Os pipelines matemáticos fundamentais
   * precisam estar válidos.
   *
   * correlationValid pode ser false sem invalidar
   * automaticamente a análise, mas isso gera warning.
   */
  if (
    !upstream.probabilityValid ||
    !upstream.valueValid ||
    !upstream.riskValid ||
    !upstream.rankingValid
  ) {
    return createNoBetResult({
      data,
      inputMarkets,

      gameWarnings:
        normalizeWarnings([
          ...gameWarnings,
          "INVALID_UPSTREAM_PIPELINE"
        ]),

      upstream,

      reason:
        "INVALID_UPSTREAM_PIPELINE"
    });
  }

  const evaluatedMarkets:
    EvaluatedDecisionMarket[] =
    inputMarkets.map(
      (
        market: any,
        index: number
      ) =>
        evaluateMarket(
          market,
          index,
          data
        )
    );

  /*
   * O ranking anterior é preservado.
   *
   * A ordenação abaixo serve apenas para garantir
   * estabilidade caso o array chegue fora de ordem.
   */
  const sortedMarkets =
    [...evaluatedMarkets].sort(
      compareDecisionMarkets
    );

  const actionableMarkets =
    sortedMarkets.filter(
      market =>
        market.decisionValid === true &&
        (
          market.classification ===
            "SCALPER" ||
          market.classification ===
            "ELITE" ||
          market.classification ===
            "BET"
        )
    );

  const watchlist =
    sortedMarkets
      .filter(
        market =>
          market.decisionValid === true &&
          market.classification ===
            "WATCHLIST"
      )
      .slice(
        0,
        GLOBAL_POLICY.maximumWatchlist
      );

  const discarded =
    sortedMarkets.filter(
      market =>
        market.decisionValid !== true ||
        market.classification ===
          "NO BET"
    );

  /*
   * A melhor entrada é o primeiro mercado
   * operacionalmente válido após o ranking.
   */
  const best =
    actionableMarkets[0] ??
    null;

  const elite =
    actionableMarkets.find(
      market =>
        market.classification ===
        "ELITE"
    ) ??
    null;

  const scalper =
    actionableMarkets.find(
      market =>
        market.classification ===
        "SCALPER"
    ) ??
    null;

  const operationalBets =
    actionableMarkets.filter(
      market =>
        market.classification ===
        "BET"
    );

  const secondary =
    actionableMarkets[1] ??
    watchlist[0] ??
    null;

  /*
   * Combo recebe somente entradas acionáveis.
   *
   * O próprio multiBetBuilder deverá validar
   * correlação entre as seleções finais.
   */
  const comboCandidates =
    actionableMarkets.slice(
      0,
      GLOBAL_POLICY.maximumComboMarkets
    );

  const combo =
    safeBuildCombo(
      comboCandidates
    );

  const noBet =
    best === null;

  const reason =
    best
      ? best.classification
      : watchlist.length > 0
        ? "WATCHLIST_ONLY"
        : discarded.length > 0
          ? "NO_MARKET_PASSED_DECISION_POLICY"
          : "NO_VALID_MARKET";

  const pipelineWarnings =
    normalizeWarnings([
      ...gameWarnings,

      ...(
        upstream.correlationValid
          ? []
          : [
              "CORRELATION_PIPELINE_INVALID"
            ]
      )
    ]);

  const debug:
    DecisionPipelineDebug = {
      valid:
        true,

      inputMarkets:
        inputMarkets.length,

      eligibleMarkets:
        evaluatedMarkets.filter(
          market =>
            market.decisionValid === true
        ).length,

      actionableMarkets:
        actionableMarkets.length,

      eliteMarkets:
        evaluatedMarkets.filter(
          market =>
            market.classification ===
            "ELITE"
        ).length,

      scalperMarkets:
        evaluatedMarkets.filter(
          market =>
            market.classification ===
            "SCALPER"
        ).length,

      betMarkets:
        evaluatedMarkets.filter(
          market =>
            market.classification ===
            "BET"
        ).length,

      watchlistMarkets:
        evaluatedMarkets.filter(
          market =>
            market.classification ===
            "WATCHLIST"
        ).length,

      noBetMarkets:
        evaluatedMarkets.filter(
          market =>
            market.classification ===
            "NO BET"
        ).length,

      discardedMarkets:
        discarded.length,

      bestMarket:
        best
          ? String(
              best.market ??
              ""
            )
          : null,

      bestClassification:
        best?.classification ??
        null,

      upstream,

      reason
    };

  return {
    ...data,

    decisionValid:
      true,

    elite,
    scalper,

    best,

    finalBest:
      best,

    operationalBets,

    watchlist,

    secondary,

    combo,

    markets:
      sortedMarkets,

    actionableMarkets,

    discarded,

    noBet,
    reason,

    warnings:
      pipelineWarnings,

    /*
     * A aposta não é registrada aqui.
     *
     * O front-end ou um executionPipeline deve
     * chamar trackingEngine somente após a
     * confirmação real da entrada.
     */
    trackingPending:
      Boolean(best),

    debug: {
      ...(data?.debug ?? {}),

      decisionPipeline:
        debug
    }
  };
}

/* ==========================================
   AVALIAÇÃO DO MERCADO
========================================== */

function evaluateMarket(
  market: any,
  originalIndex: number,
  data: any
): EvaluatedDecisionMarket {
  const marketName =
    parseDecisionMarket(
      market?.market
    );

  const probability =
    parseProbability(
      market?.probability
    );

  const odd =
    parseOdd(
      market?.odd ??
      market?.odds
    );

  const ev =
    parseFiniteNumber(
      market?.ev ??
      market?.expectedValue
    );

  const probabilityEdge =
    firstFiniteNumber([
      market?.probabilityEdge,
      market?.edge
    ]);

  const risk =
    firstProbability([
      market?.riskScore,
      market?.risk
    ]);

  const confidence =
    parseProbability(
      market?.confidence
    );

  const rankingScore =
    firstFiniteNumber([
      market?.rankingScore,
      market?.score
    ]);

  const trapScore =
    parseProbability(
      market?.trapScore
    );

  const structureValid =
    market?.structureValid !==
    false;

  const rankingValid =
    market?.rankingValid !==
    false;

  const warnings =
    normalizeWarnings(
      market?.warnings
    );

  const policy =
    marketName
      ? MARKET_POLICIES[
          marketName
        ]
      : null;

  const guards =
    evaluateDecisionGuards({
      marketName,
      policy,

      probability,
      odd,
      ev,
      probabilityEdge,
      risk,
      confidence,
      rankingScore,
      trapScore,

      structureValid,
      rankingValid,

      data
    });

  const classification:
    DecisionClassification =
    guards.valid &&
    marketName &&
    policy &&
    probability !== null &&
    odd !== null &&
    ev !== null &&
    risk !== null
      ? classifyMarket({
          policy,

          probability,
          ev,
          risk,

          confidence:
            confidence ??
            0.5
        })
      : "NO BET";

  const kelly =
    parseNonNegativeNumber(
      market?.kelly
    ) ??
    calculateKellyFraction(
      probability,
      odd
    );

  const stake =
    guards.valid &&
    (
      classification ===
        "SCALPER" ||
      classification ===
        "ELITE" ||
      classification ===
        "BET"
    )
      ? calculateDecisionStake({
          kelly,
          ev,
          risk,
          confidence:
            confidence ??
            0.5,

          classification
        })
      : 0;

  const finalWarnings =
    normalizeWarnings([
      ...warnings,
      ...guards.warnings,
      ...guards.blockers
    ]);

  const debug:
    DecisionMarketDebug = {
      valid:
        guards.valid,

      market:
        marketName,

      policy,

      guards: {
        blockers:
          guards.blockers,

        warnings:
          guards.warnings
      },

      metrics: {
        probability,
        odd,
        ev,
        probabilityEdge,
        risk,
        confidence,
        rankingScore,
        trapScore
      },

      classification,
      stake
    };

  return {
    ...market,

    /*
     * Mantemos os valores produzidos pelos
     * pipelines anteriores.
     */
    probability:
      probability ??
      market?.probability,

    odd:
      odd ??
      market?.odd,

    ev:
      ev ??
      market?.ev,

    probabilityEdge:
      probabilityEdge ??
      market?.probabilityEdge,

    risk:
      risk ??
      market?.risk,

    riskScore:
      risk ??
      market?.riskScore,

    confidence:
      confidence ??
      market?.confidence,

    rankingScore:
      rankingScore ??
      market?.rankingScore,

    score:
      rankingScore ??
      market?.score,

    kelly:
      roundNumber(
        kelly
      ),

    stake,

    classification,

    decisionValid:
      guards.valid,

    decisionOriginalIndex:
      originalIndex,

    decisionBlockers:
      guards.blockers,

    decisionWarnings:
      guards.warnings,

    warnings:
      finalWarnings,

    discardedStage:
      guards.valid
        ? null
        : "DECISION_GUARDS",

    discardedReason:
      guards.valid
        ? null
        : guards.blockers.join(
            ", "
          ),

    debug: {
      ...(market?.debug ?? {}),

      decisionPipeline:
        debug
    }
  };
}

/* ==========================================
   GUARDS
========================================== */

function evaluateDecisionGuards({
  marketName,
  policy,

  probability,
  odd,
  ev,
  probabilityEdge,
  risk,
  confidence,
  rankingScore,
  trapScore,

  structureValid,
  rankingValid,

  data
}: {
  marketName:
    CanonicalDecisionMarket | null;

  policy:
    DecisionMarketPolicy | null;

  probability:
    number | null;

  odd:
    number | null;

  ev:
    number | null;

  probabilityEdge:
    number | null;

  risk:
    number | null;

  confidence:
    number | null;

  rankingScore:
    number | null;

  trapScore:
    number | null;

  structureValid:
    boolean;

  rankingValid:
    boolean;

  data:
    any;
}): DecisionGuardResult {
  const blockers:
    string[] = [];

  const warnings:
    string[] = [];

  if (!marketName || !policy) {
    blockers.push(
      "UNSUPPORTED_MARKET"
    );
  }

  if (probability === null) {
    blockers.push(
      "INVALID_PROBABILITY"
    );
  } else {
    if (
      probability <
      GLOBAL_POLICY
        .hardMinimumProbability
    ) {
      blockers.push(
        "PROBABILITY_BELOW_GLOBAL_MINIMUM"
      );
    }
  }

  if (odd === null) {
    blockers.push(
      "INVALID_ODD"
    );
  } else if (
    odd <=
    GLOBAL_POLICY.hardMinimumOdd
  ) {
    blockers.push(
      "ODD_BELOW_GLOBAL_MINIMUM"
    );
  } else if (
    policy &&
    odd <
      policy.minimumOdd
  ) {
    blockers.push(
      "ODD_BELOW_MARKET_MINIMUM"
    );
  }

  if (ev === null) {
    blockers.push(
      "INVALID_EV"
    );
  } else if (
    ev <=
    GLOBAL_POLICY.hardMinimumEv
  ) {
    blockers.push(
      "NON_POSITIVE_EV"
    );
  }

  if (
    probabilityEdge === null
  ) {
    warnings.push(
      "PROBABILITY_EDGE_UNAVAILABLE"
    );
  } else if (
    probabilityEdge <= 0
  ) {
    blockers.push(
      "NON_POSITIVE_PROBABILITY_EDGE"
    );
  }

  if (risk === null) {
    blockers.push(
      "INVALID_RISK"
    );
  } else if (
    risk >
    GLOBAL_POLICY
      .hardMaximumRisk
  ) {
    blockers.push(
      "RISK_ABOVE_GLOBAL_MAXIMUM"
    );
  }

  if (confidence === null) {
    warnings.push(
      "CONFIDENCE_UNAVAILABLE"
    );
  }

  if (rankingScore === null) {
    blockers.push(
      "INVALID_RANKING_SCORE"
    );
  }

  if (!rankingValid) {
    blockers.push(
      "RANKING_MARKED_INVALID"
    );
  }

  if (!structureValid) {
    blockers.push(
      "INVALID_MARKET_STRUCTURE"
    );
  }

  if (
    trapScore !== null &&
    trapScore >
      GLOBAL_POLICY
        .maximumTrapScore
  ) {
    blockers.push(
      "TRAP_SCORE_ABOVE_MAXIMUM"
    );
  }

  if (
    data?.correlationValid ===
    false
  ) {
    warnings.push(
      "CORRELATION_NOT_VALIDATED"
    );
  }

  if (
    data?.simulationValid ===
    false
  ) {
    warnings.push(
      "SIMULATION_NOT_VALIDATED"
    );
  }

  return {
    valid:
      blockers.length === 0,

    blockers:
      normalizeWarnings(
        blockers
      ),

    warnings:
      normalizeWarnings(
        warnings
      )
  };
}

/* ==========================================
   CLASSIFICAÇÃO
========================================== */

function classifyMarket({
  policy,

  probability,
  ev,
  risk,
  confidence
}: {
  policy:
    DecisionMarketPolicy;

  probability:
    number;

  ev:
    number;

  risk:
    number;

  confidence:
    number;
}): DecisionClassification {
  if (
    policy.scalper &&
    passesLevel({
      probability,
      ev,
      risk,
      confidence,

      level:
        policy.scalper
    })
  ) {
    return "SCALPER";
  }

  if (
    passesLevel({
      probability,
      ev,
      risk,
      confidence,

      level:
        policy.elite
    })
  ) {
    return "ELITE";
  }

  if (
    passesLevel({
      probability,
      ev,
      risk,
      confidence,

      level:
        policy.bet
    })
  ) {
    return "BET";
  }

  if (
    passesLevel({
      probability,
      ev,
      risk,
      confidence,

      level:
        policy.watchlist
    })
  ) {
    return "WATCHLIST";
  }

  return "NO BET";
}

function passesLevel({
  probability,
  ev,
  risk,
  confidence,
  level
}: {
  probability:
    number;

  ev:
    number;

  risk:
    number;

  confidence:
    number;

  level: {
    minimumProbability: number;
    minimumEv: number;
    maximumRisk: number;
    minimumConfidence: number;
  };
}): boolean {
  return (
    probability >=
      level.minimumProbability &&

    ev >=
      level.minimumEv &&

    risk <=
      level.maximumRisk &&

    confidence >=
      level.minimumConfidence
  );
}

/* ==========================================
   STAKE
========================================== */

/*
 * O stake é apenas uma sugestão.
 *
 * A execução real deve ser confirmada fora
 * do decisionPipeline.
 */
function calculateDecisionStake({
  kelly,
  ev,
  risk,
  confidence,
  classification
}: {
  kelly: number;
  ev: number | null;
  risk: number | null;
  confidence: number;
  classification:
    DecisionClassification;
}): number {
  if (
    !Number.isFinite(kelly) ||
    kelly <= 0 ||
    ev === null ||
    ev <= 0 ||
    risk === null
  ) {
    return 0;
  }

  const fractionalKelly =
    kelly *
    GLOBAL_POLICY.kellyFraction;

  const riskFactor =
    clamp(
      1 - risk,
      0.20,
      1
    );

  const confidenceFactor =
    clamp(
      confidence,
      0.50,
      1
    );

  const classificationFactor =
    classification === "ELITE"
      ? 1
      : classification === "SCALPER"
        ? 0.90
        : classification === "BET"
          ? 0.75
          : 0;

  const evFactor =
    clamp(
      ev / 0.15,
      0.50,
      1.20
    );

  const stake =
    fractionalKelly *
    riskFactor *
    confidenceFactor *
    classificationFactor *
    evFactor;

  if (
    !Number.isFinite(stake) ||
    stake < 0.0025
  ) {
    return 0;
  }

  return roundNumber(
    Math.min(
      GLOBAL_POLICY.maximumStake,
      stake
    ),
    4
  );
}

function calculateKellyFraction(
  probability: number | null,
  odd: number | null
): number {
  if (
    probability === null ||
    odd === null ||
    odd <= 1
  ) {
    return 0;
  }

  const netOdd =
    odd - 1;

  const lossProbability =
    1 - probability;

  const kelly =
    (
      netOdd *
      probability -
      lossProbability
    ) /
    netOdd;

  if (
    !Number.isFinite(kelly) ||
    kelly <= 0
  ) {
    return 0;
  }

  return kelly;
}

/* ==========================================
   ORDENAÇÃO
========================================== */

function compareDecisionMarkets(
  first: EvaluatedDecisionMarket,
  second: EvaluatedDecisionMarket
): number {
  /*
   * Primeiro preservamos o ranking produzido
   * pelo rankingPipeline.
   */
  const firstRank =
    parsePositiveInteger(
      first?.rank
    );

  const secondRank =
    parsePositiveInteger(
      second?.rank
    );

  if (
    firstRank !== null &&
    secondRank !== null &&
    firstRank !==
      secondRank
  ) {
    return firstRank -
      secondRank;
  }

  const scoreDifference =
    safeFiniteNumber(
      second?.rankingScore ??
      second?.score,
      Number.NEGATIVE_INFINITY
    ) -
    safeFiniteNumber(
      first?.rankingScore ??
      first?.score,
      Number.NEGATIVE_INFINITY
    );

  if (
    Math.abs(
      scoreDifference
    ) >
    1e-12
  ) {
    return scoreDifference;
  }

  const classificationDifference =
    getClassificationPriority(
      second?.classification
    ) -
    getClassificationPriority(
      first?.classification
    );

  if (
    classificationDifference !==
    0
  ) {
    return classificationDifference;
  }

  const evDifference =
    safeFiniteNumber(
      second?.ev,
      Number.NEGATIVE_INFINITY
    ) -
    safeFiniteNumber(
      first?.ev,
      Number.NEGATIVE_INFINITY
    );

  if (
    Math.abs(
      evDifference
    ) >
    1e-12
  ) {
    return evDifference;
  }

  const riskDifference =
    safeFiniteNumber(
      first?.risk,
      1
    ) -
    safeFiniteNumber(
      second?.risk,
      1
    );

  if (
    Math.abs(
      riskDifference
    ) >
    1e-12
  ) {
    return riskDifference;
  }

  return (
    safeFiniteNumber(
      first?.decisionOriginalIndex,
      0
    ) -
    safeFiniteNumber(
      second?.decisionOriginalIndex,
      0
    )
  );
}

function getClassificationPriority(
  classification: unknown
): number {
  switch (
    String(
      classification ??
      ""
    )
  ) {
    case "SCALPER":
      return 5;

    case "ELITE":
      return 4;

    case "BET":
      return 3;

    case "WATCHLIST":
      return 2;

    case "NO BET":
      return 1;

    default:
      return 0;
  }
}

/* ==========================================
   COMBO
========================================== */

function safeBuildCombo(
  markets: EvaluatedDecisionMarket[]
) {
  if (
    !Array.isArray(markets) ||
    markets.length < 2
  ) {
    return null;
  }

  try {
    return buildCombo(
      markets
    );
  } catch {
    return null;
  }
}

/* ==========================================
   NO BET
========================================== */

function createNoBetResult({
  data,
  inputMarkets,
  gameWarnings,
  upstream,
  reason
}: {
  data: any;
  inputMarkets: any[];
  gameWarnings: string[];

  upstream: {
    probabilityValid: boolean;
    valueValid: boolean;
    riskValid: boolean;
    rankingValid: boolean;
    correlationValid: boolean;
  };

  reason: string;
}) {
  const debug:
    DecisionPipelineDebug = {
      valid:
        false,

      inputMarkets:
        inputMarkets.length,

      eligibleMarkets: 0,
      actionableMarkets: 0,

      eliteMarkets: 0,
      scalperMarkets: 0,
      betMarkets: 0,
      watchlistMarkets: 0,
      noBetMarkets:
        inputMarkets.length,

      discardedMarkets:
        inputMarkets.length,

      bestMarket:
        null,

      bestClassification:
        null,

      upstream,

      reason
    };

  return {
    ...data,

    decisionValid:
      false,

    elite:
      null,

    scalper:
      null,

    best:
      null,

    finalBest:
      null,

    operationalBets:
      [],

    watchlist:
      [],

    secondary:
      null,

    combo:
      null,

    actionableMarkets:
      [],

    discarded:
      inputMarkets,

    noBet:
      true,

    reason,

    warnings:
      gameWarnings,

    trackingPending:
      false,

    debug: {
      ...(data?.debug ?? {}),

      decisionPipeline:
        debug
    }
  };
}

/* ==========================================
   MERCADOS
========================================== */

function parseDecisionMarket(
  value: unknown
): CanonicalDecisionMarket | null {
  const market =
    String(
      value ??
      ""
    )
      .trim()
      .toUpperCase();

  switch (market) {
    case "HOME":
    case "HOME_WIN":
      return "HOME";

    case "DRAW":
      return "DRAW";

    case "AWAY":
    case "AWAY_WIN":
      return "AWAY";

    case "OVER_1_5":
    case "OVER15":
    case "OVER 1.5":
      return "OVER_1_5";

    case "OVER_2_5":
    case "OVER25":
    case "OVER 2.5":
      return "OVER_2_5";

    case "BTTS_YES":
    case "BTTS YES":
      return "BTTS_YES";

    case "BTTS_NO":
    case "BTTS NO":
      return "BTTS_NO";

    case "DOUBLE_CHANCE_1X":
    case "1X":
      return "DOUBLE_CHANCE_1X";

    case "DOUBLE_CHANCE_X2":
    case "X2":
      return "DOUBLE_CHANCE_X2";

    default:
      return null;
  }
}

/* ==========================================
   HELPERS
========================================== */

function firstFiniteNumber(
  values: unknown[]
): number | null {
  for (
    const value of values
  ) {
    const parsed =
      parseFiniteNumber(
        value
      );

    if (
      parsed !== null
    ) {
      return parsed;
    }
  }

  return null;
}

function firstProbability(
  values: unknown[]
): number | null {
  for (
    const value of values
  ) {
    const parsed =
      parseProbability(
        value
      );

    if (
      parsed !== null
    ) {
      return parsed;
    }
  }

  return null;
}

function parseProbability(
  value: unknown
): number | null {
  const parsed =
    Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed < 0 ||
    parsed > 1
  ) {
    return null;
  }

  return parsed;
}

function parseOdd(
  value: unknown
): number | null {
  const parsed =
    Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed <= 1
  ) {
    return null;
  }

  return parsed;
}

function parseFiniteNumber(
  value: unknown
): number | null {
  const parsed =
    Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function parseNonNegativeNumber(
  value: unknown
): number | null {
  const parsed =
    Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed < 0
  ) {
    return null;
  }

  return parsed;
}

function parsePositiveInteger(
  value: unknown
): number | null {
  const parsed =
    Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed <= 0
  ) {
    return null;
  }

  return parsed;
}

function safeFiniteNumber(
  value: unknown,
  fallback: number
): number {
  const parsed =
    Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
}

function normalizeWarnings(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const warnings =
    value
      .map(
        warning =>
          String(
            warning ??
            ""
          ).trim()
      )
      .filter(Boolean);

  return [
    ...new Set(
      warnings
    )
  ];
}

function clamp(
  value: number,
  minimum: number,
  maximum: number
): number {
  if (!Number.isFinite(value)) {
    return minimum;
  }

  return Math.max(
    minimum,
    Math.min(
      value,
      maximum
    )
  );
}

function roundNumber(
  value: number,
  decimals = 6
): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const factor =
    10 ** decimals;

  return (
    Math.round(
      value *
      factor
    ) /
    factor
  );
}