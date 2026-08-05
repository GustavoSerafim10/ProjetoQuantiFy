import {
  buildCombo
} from "../../domain/analysis/multiBetBuilder";

/* ==========================================
   DECISION PIPELINE — QUANTIFY V7.2 ELITE
========================================== */

/*
 * Responsabilidade:
 *
 * - receber mercados já calculados;
 * - validar os resultados dos pipelines anteriores;
 * - aplicar critérios operacionais por mercado;
 * - receber sampleReliability, leagueTrust,
 *   globalConfidence e expectativa contextual;
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

/* ==========================================
   CONTEXTO OPERACIONAL DA DECISÃO
========================================== */

export interface DecisionContextMetrics {
  homeProbability: number | null;
  drawProbability: number | null;
  awayProbability: number | null;

  lambdaHome: number | null;
  lambdaAway: number | null;
  totalLambda: number | null;

  matchBalanceIndex: number | null;

  homeDominanceScore: number | null;
  awayDominanceScore: number | null;

  minimumSampleSize: number | null;

  sampleReliability: number | null;
  leagueTrust: number | null;

  globalConfidence: number | null;

  goalExpectationScore: number | null;
  contextualGoalExpectationScore: number | null;

  league: string;
}

export interface OperationalPolicyResult {
  blocked: boolean;

  maximumClassification:
    DecisionClassification | null;

  blockers: string[];
  warnings: string[];

  metrics: {
    requiredEv: number;

    matchBalanceIndex:
      number | null;

    dominanceScore:
      number | null;

    drawDependency:
      number | null;

    sampleReliability:
      number | null;

    leagueTrust:
      number | null;

    globalConfidence:
      number | null;

    goalExpectationScore:
      number | null;

    contextualGoalExpectationScore:
      number | null;
  };
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

    sampleReliability: number | null;
    leagueTrust: number | null;

    globalConfidence: number | null;

    goalExpectationScore: number | null;
    contextualGoalExpectationScore: number | null;
  };

  operationalPolicy: {
    blocked: boolean;

    maximumClassification:
      DecisionClassification | null;

    blockers: string[];
    warnings: string[];

    dynamicMinimumEv: number;

    matchBalanceIndex:
      number | null;

    dominanceScore:
      number | null;

    drawDependency:
      number | null;

    sampleReliability:
      number | null;

    leagueTrust:
      number | null;

    globalConfidence:
      number | null;

    goalExpectationScore:
      number | null;

    contextualGoalExpectationScore:
      number | null;
  };

  /*
   * Classificação produzida somente pelos
   * thresholds do mercado, antes das limitações
   * da política operacional.
   */
  baseClassification:
    DecisionClassification;

  thresholdDiagnostics: {
    watchlistProbabilityRequired: number | null;
    watchlistProbabilityActual: number | null;
    watchlistProbabilityShortfall: number | null;
    borderToleranceApplied: boolean;
  };

  /*
   * Classificação final após a aplicação de:
   *
   * - maximumClassification;
   * - blockers operacionais;
   * - limitações contextuais.
   */
  classification:
    DecisionClassification;

  /*
   * Indica de forma direta se a política operacional
   * limitou uma classificação superior.
   *
   * Exemplo:
   *
   * baseClassification = "BET"
   * classification = "WATCHLIST"
   * operationalDowngraded = true
   */
  operationalDowngraded:
    boolean;

  /*
   * Motivos operacionais que efetivamente explicam
   * uma eventual limitação.
   */
  operationalReasons:
    string[];

  stake:
    number;
}

export interface DecisionPipelineDebug {
  valid: boolean;

  version: "V7.2_ELITE";

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
    confidenceValid: boolean;
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

  baseClassification:
    DecisionClassification;

  operationalDowngraded:
    boolean;

  operationalLimit:
    DecisionClassification | null;

  operationalReasons:
    string[];

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
   CONTEXTO OPERACIONAL — DECISION V2
========================================== */

function buildDecisionContextMetrics(
  data: any
): DecisionContextMetrics {
  const homeProbability =
    firstProbability([
      data?.probabilities?.HOME,
      data?.probs?.HOME,
      data?.result?.home,
      data?.homeProbability
    ]);

  const drawProbability =
    firstProbability([
      data?.probabilities?.DRAW,
      data?.probs?.DRAW,
      data?.result?.draw,
      data?.drawProbability
    ]);

  const awayProbability =
    firstProbability([
      data?.probabilities?.AWAY,
      data?.probs?.AWAY,
      data?.result?.away,
      data?.awayProbability
    ]);

  const lambdaHome =
    firstFiniteNumber([
      data?.lambdaHome,
      data?.model?.lambdaHome,
      data?.monteCarlo?.lambdaHome,
      data?.context?.lambdaHome
    ]);

  const lambdaAway =
    firstFiniteNumber([
      data?.lambdaAway,
      data?.model?.lambdaAway,
      data?.monteCarlo?.lambdaAway,
      data?.context?.lambdaAway
    ]);

  const totalLambdaFromData =
    firstFiniteNumber([
      data?.totalLambda,
      data?.monteCarlo?.totalLambda,
      data?.model?.totalLambda
    ]);

  const totalLambda =
    totalLambdaFromData ??
    (
      lambdaHome !== null &&
      lambdaAway !== null
        ? lambdaHome + lambdaAway
        : null
    );

  const homeSample =
    firstFiniteNumber([
      data?.homeStats?.matchesPlayed,
      data?.homeStats?.matches,
      data?.stats?.home?.matchesPlayed,
      data?.stats?.home?.matches
    ]);

  const awaySample =
    firstFiniteNumber([
      data?.awayStats?.matchesPlayed,
      data?.awayStats?.matches,
      data?.stats?.away?.matchesPlayed,
      data?.stats?.away?.matches
    ]);

  const minimumSampleSize =
    homeSample !== null &&
    awaySample !== null
      ? Math.max(
          0,
          Math.floor(
            Math.min(
              homeSample,
              awaySample
            )
          )
        )
      : null;

  /*
   * 20 partidas representam confiabilidade cheia.
   * Isso não altera a probabilidade; apenas informa
   * a política operacional.
   */
  /*
   * A decisão consome primeiro a qualidade já
   * consolidada pelo Confidence Pipeline V7.2.
   *
   * Somente na ausência dessa fonte usamos
   * compatibilidade e, por último, tamanho amostral.
   */
  const providedSampleReliability =
    firstProbability([
      data?.debug?.confidencePipeline?.sampleReliability,
      data?.effectiveSampleReliability,
      data?.sampleReliability,
      data?.dataQuality?.sampleReliability,
      data?.context?.sampleReliability,
      data?.debug?.dataNormalizer?.sampleReliability,
      data?.debug?.modelPipeline?.lambdaBuilder?.inputQuality?.inputQuality,
      data?.debug?.modelPipeline?.lambdaBuilder?.inputQuality
    ]);

  const sampleReliability =
    providedSampleReliability ??
    (
      minimumSampleSize !== null
        ? clamp(
            minimumSampleSize / 20,
            0,
            1
          )
        : null
    );

  /*
   * Fallback de liga neutralizado no Confidence
   * Pipeline deve chegar intacto à decisão.
   */
/*
   * Prioridade:
   * 1) valor já resolvido pelo ConfidencePipeline
   *    (não reconsulta a liga);
   * 2) fonte oficial leagueReliability;
   * 3) compatibilidade legada — removida no
   *    Commit 3.
   */
  const leagueTrust =
    firstProbability([
      data?.debug?.confidencePipeline?.leagueTrust,
      data?.leagueReliability?.dataReliability,
      data?.leagueTrust,
      data?.leagueConfig?.trust,
      data?.leagueConfig?.dataReliability,
      data?.dataQuality?.leagueTrust,
      data?.leagueStrength?.dataReliability,
      data?.debug?.leagueConfig?.trust,
      data?.debug?.leagueConfig?.dataReliability
    ]);

  const globalConfidence =
    firstProbability([
      data?.globalConfidence,
      data?.modelConfidence,
      data?.debug?.confidencePipeline?.globalConfidence,
      data?.debug?.globalConfidencePipeline?.confidence
    ]);

  const goalExpectationScore =
    firstProbability([
      data?.goalExpectationScore,
      data?.model?.goalExpectationScore,
      data?.debug?.modelPipeline?.goalExpectationScore
    ]);

  const contextualGoalExpectationScore =
    firstProbability([
      data?.contextualGoalExpectationScore,
      data?.marketContext?.contextualGoalExpectationScore,
      data?.context?.contextualGoalExpectationScore,
      data?.debug?.contextPipeline?.contextualGoalExpectationScore,
      data?.marketContext?.goalExpectationScore
    ]);

  const matchBalanceIndex =
    calculateMatchBalanceIndex({
      homeProbability,
      drawProbability,
      awayProbability
    });

  const dominance =
    calculateDominanceScores({
      homeProbability,
      awayProbability,
      lambdaHome,
      lambdaAway
    });

  const league =
    String(
      data?.league ??
      data?.context?.league ??
      data?.input?.league ??
      ""
    ).trim();

  return {
    homeProbability,
    drawProbability,
    awayProbability,

    lambdaHome,
    lambdaAway,
    totalLambda,

    matchBalanceIndex,

    homeDominanceScore:
      dominance.home,

    awayDominanceScore:
      dominance.away,

    minimumSampleSize,
    sampleReliability,
    leagueTrust,

    globalConfidence,

    goalExpectationScore,
    contextualGoalExpectationScore,

    league
  };
}

function calculateMatchBalanceIndex({
  homeProbability,
  drawProbability,
  awayProbability
}: {
  homeProbability: number | null;
  drawProbability: number | null;
  awayProbability: number | null;
}): number | null {
  if (
    homeProbability === null ||
    drawProbability === null ||
    awayProbability === null
  ) {
    return null;
  }

  const probabilities = [
    homeProbability,
    drawProbability,
    awayProbability
  ];

  const maximum =
    Math.max(
      ...probabilities
    );

  const minimum =
    Math.min(
      ...probabilities
    );

  const spread =
    maximum - minimum;

  /*
   * Próximo de 1:
   * jogo muito equilibrado.
   *
   * Próximo de 0:
   * existe dominância clara.
   */
  return roundNumber(
    clamp(
      1 - spread / 0.50,
      0,
      1
    )
  );
}

function calculateDominanceScores({
  homeProbability,
  awayProbability,
  lambdaHome,
  lambdaAway
}: {
  homeProbability: number | null;
  awayProbability: number | null;
  lambdaHome: number | null;
  lambdaAway: number | null;
}): {
  home: number | null;
  away: number | null;
} {
  if (
    homeProbability === null ||
    awayProbability === null
  ) {
    return {
      home: null,
      away: null
    };
  }

  const probabilityDifference =
    homeProbability -
    awayProbability;

  const probabilityComponent =
    clamp(
      0.50 +
      probabilityDifference * 1.50,
      0,
      1
    );

  const lambdaComponent =
    lambdaHome !== null &&
    lambdaAway !== null
      ? clamp(
          0.50 +
          (
            lambdaHome -
            lambdaAway
          ) * 0.30,
          0,
          1
        )
      : 0.50;

  const homeDominance =
    clamp(
      probabilityComponent * 0.70 +
      lambdaComponent * 0.30,
      0,
      1
    );

  return {
    home:
      roundNumber(
        homeDominance
      ),

    away:
      roundNumber(
        1 - homeDominance
      )
  };
}
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

    confidenceValid:
      data?.confidenceValid !== false,

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
    !upstream.confidenceValid ||
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

const decisionContext =
  buildDecisionContextMetrics(
    data
  );

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
        data,
        decisionContext
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

      version:
        "V7.2_ELITE",

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
  data: any,
  decisionContext:
    DecisionContextMetrics
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
    parseProbability(
      market?.rankingScore
    );

  const trapScore =
    parseProbability(
      market?.trapScore
    );

  const sampleReliability =
    firstProbability([
      market?.debug?.confidencePipeline?.sampleReliability,
      market?.effectiveSampleReliability,
      market?.sampleReliability,
      decisionContext.sampleReliability
    ]);

  const leagueTrust =
    firstProbability([
      market?.debug?.confidencePipeline?.leagueTrust,
      market?.leagueTrust,
      market?.dataReliability,
      decisionContext.leagueTrust
    ]);

  const globalConfidence =
    firstProbability([
      market?.debug?.confidencePipeline?.globalConfidence,
      market?.globalConfidence,
      decisionContext.globalConfidence
    ]);

  const goalExpectationScore =
    firstProbability([
      market?.goalExpectationScore,
      decisionContext.goalExpectationScore
    ]);

  const contextualGoalExpectationScore =
    firstProbability([
      market?.contextualGoalExpectationScore,
      decisionContext.contextualGoalExpectationScore
    ]);

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

const operationalPolicy =
  evaluateOperationalPolicy({
    marketName,

    probability,
    odd,
    ev,
    probabilityEdge,
    risk,
    confidence,

    sampleReliability,
    leagueTrust,
    globalConfidence,
    goalExpectationScore,
    contextualGoalExpectationScore,

    context:
      decisionContext
  });

const baseClassification:
  DecisionClassification =
  guards.valid &&
  marketName &&
  policy &&
  probability !== null &&
  odd !== null &&
  ev !== null &&
  risk !== null &&
  confidence !== null
    ? classifyMarket({
        policy,

        probability,
        ev,
        risk,

        confidence:
          confidence as number,

        odd,
        probabilityEdge,
        rankingScore
      })
    : "NO BET";

const thresholdDiagnostics =
  buildThresholdDiagnostics({
    marketName,
    policy,
    probability,
    odd,
    ev,
    risk,
    confidence,
    probabilityEdge,
    rankingScore,
    baseClassification
  });

const classification:
  DecisionClassification =
  operationalPolicy.blocked
    ? "NO BET"
    : capClassification(
        baseClassification,
        operationalPolicy
          .maximumClassification
      );

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
            confidence as number,

          classification
        })
      : 0;

const finalWarnings =
  normalizeWarnings([
    ...warnings,

    ...guards.warnings,
    ...guards.blockers,

    ...(
      thresholdDiagnostics.borderToleranceApplied
        ? [
            "WATCHLIST_BORDER_TOLERANCE_APPLIED"
          ]
        : []
    ),

    ...operationalPolicy
      .warnings,

    ...operationalPolicy
      .blockers
  ]);

const debug:
  DecisionMarketDebug = {
    valid:
      guards.valid &&
      !operationalPolicy.blocked,

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
      trapScore,

      sampleReliability,
      leagueTrust,

      globalConfidence,

      goalExpectationScore,
      contextualGoalExpectationScore
    },

    operationalPolicy: {
      blocked:
        operationalPolicy.blocked,

      maximumClassification:
        operationalPolicy
          .maximumClassification,

      blockers:
        operationalPolicy.blockers,

      warnings:
        operationalPolicy.warnings,

      dynamicMinimumEv:
        operationalPolicy
          .metrics
          .requiredEv,

      matchBalanceIndex:
        operationalPolicy
          .metrics
          .matchBalanceIndex,

      dominanceScore:
        operationalPolicy
          .metrics
          .dominanceScore,

      drawDependency:
        operationalPolicy
          .metrics
          .drawDependency,

      sampleReliability:
        operationalPolicy
          .metrics
          .sampleReliability,

      leagueTrust:
        operationalPolicy
          .metrics
          .leagueTrust,

      globalConfidence:
        operationalPolicy
          .metrics
          .globalConfidence,

      goalExpectationScore:
        operationalPolicy
          .metrics
          .goalExpectationScore,

      contextualGoalExpectationScore:
        operationalPolicy
          .metrics
          .contextualGoalExpectationScore
    },

    baseClassification,

    thresholdDiagnostics,

    classification,

    operationalDowngraded:
      getClassificationPriority(
        baseClassification
      ) >
      getClassificationPriority(
        classification
      ),

    operationalReasons:
      normalizeWarnings([
        ...operationalPolicy.warnings,
        ...operationalPolicy.blockers
      ]),

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

    kelly:
      roundNumber(
        kelly
      ),

    stake,

    /*
     * Classificação antes das limitações
     * da política operacional.
     */
    baseClassification,

    /*
     * Classificação final.
     */
    classification,

    /*
     * Indica se a política operacional reduziu
     * a classificação original.
     */
    operationalDowngraded:
      getClassificationPriority(
        baseClassification
      ) >
      getClassificationPriority(
        classification
      ),

    /*
     * Limite imposto pela política operacional.
     */
    operationalLimit:
      operationalPolicy
        .maximumClassification,

    /*
     * Motivos que explicam o limite ou bloqueio.
     */
    operationalReasons:
      normalizeWarnings([
        ...operationalPolicy.warnings,
        ...operationalPolicy.blockers
      ]),

    decisionValid:
      guards.valid &&
      !operationalPolicy.blocked,

    decisionOriginalIndex:
      originalIndex,

    decisionBlockers:
      normalizeWarnings([
        ...guards.blockers,
        ...operationalPolicy.blockers
      ]),

    decisionWarnings:
      normalizeWarnings([
        ...guards.warnings,
        ...operationalPolicy.warnings
      ]),

    warnings:
      finalWarnings,

    discardedStage:
      !guards.valid
        ? "DECISION_GUARDS"
        : operationalPolicy.blocked
          ? "OPERATIONAL_POLICY"
          : null,

    discardedReason:
      !guards.valid
        ? guards.blockers.join(
            ", "
          )
        : operationalPolicy.blocked
          ? operationalPolicy
              .blockers
              .join(", ")
          : null,

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
    blockers.push(
      "INVALID_CONFIDENCE"
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
  confidence,

  odd,
  probabilityEdge,
  rankingScore
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

  odd:
    number;

  probabilityEdge:
    number | null;

  rankingScore:
    number | null;
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

  /*
   * V7.2 — tolerância de fronteira.
   *
   * Uma diferença de até 1 ponto percentual na
   * probabilidade mínima não elimina automaticamente
   * um mercado que apresenta forte sustentação em:
   *
   * - EV;
   * - edge;
   * - risco;
   * - confiança;
   * - ranking.
   *
   * Essa tolerância pode gerar somente WATCHLIST.
   * Nunca promove diretamente a BET, ELITE ou SCALPER.
   */
  if (
    passesWatchlistBorderTolerance({
      policy,
      probability,
      ev,
      risk,
      confidence,
      odd,
      probabilityEdge,
      rankingScore
    })
  ) {
    return "WATCHLIST";
  }

  return "NO BET";
}

function passesWatchlistBorderTolerance({
  policy,
  probability,
  ev,
  risk,
  confidence,
  odd,
  probabilityEdge,
  rankingScore
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

  odd:
    number;

  probabilityEdge:
    number | null;

  rankingScore:
    number | null;
}): boolean {
  const level =
    policy.watchlist;

  const tolerance =
    getProbabilityBorderTolerance(
      odd
    );

  const shortfall =
    level.minimumProbability -
    probability;

  if (
    shortfall <= 0 ||
    shortfall > tolerance
  ) {
    return false;
  }

  const strongEv =
    ev >= Math.max(
      level.minimumEv * 2,
      0.08
    );

  const strongEdge =
    probabilityEdge !== null &&
    probabilityEdge >= 0.03;

  const comfortableRisk =
    risk <= Math.max(
      0,
      level.maximumRisk - 0.04
    );

  const confidencePassed =
    confidence >=
      level.minimumConfidence;

  const rankingPassed =
    rankingScore !== null &&
    rankingScore >= 0.60;

  return (
    strongEv &&
    strongEdge &&
    comfortableRisk &&
    confidencePassed &&
    rankingPassed
  );
}

function getProbabilityBorderTolerance(
  odd: number
): number {
  /*
   * Odds altas naturalmente trabalham com
   * probabilidades menores e maior variância.
   *
   * O limite permanece pequeno e serve apenas
   * para WATCHLIST.
   */
  if (odd >= 4) {
    return 0.015;
  }

  if (odd >= 2) {
    return 0.010;
  }

  return 0.0075;
}

function buildThresholdDiagnostics({
  policy,
  probability,
  baseClassification
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

  risk:
    number | null;

  confidence:
    number | null;

  probabilityEdge:
    number | null;

  rankingScore:
    number | null;

  baseClassification:
    DecisionClassification;
}): DecisionMarketDebug["thresholdDiagnostics"] {
  const required =
    policy?.watchlist
      ?.minimumProbability ??
    null;

  const shortfall =
    required !== null &&
    probability !== null
      ? Math.max(
          0,
          required -
          probability
        )
      : null;

  return {
    watchlistProbabilityRequired:
      required,

    watchlistProbabilityActual:
      probability,

    watchlistProbabilityShortfall:
      shortfall === null
        ? null
        : roundNumber(
            shortfall
          ),

    borderToleranceApplied:
      baseClassification ===
        "WATCHLIST" &&
      shortfall !== null &&
      shortfall > 0
  };
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
   POLÍTICA OPERACIONAL DINÂMICA — V2
========================================== */

function evaluateOperationalPolicy({
  marketName,

  probability,
  odd,
  ev,
  probabilityEdge,
  risk,
  confidence,

  sampleReliability,
  leagueTrust,
  globalConfidence,
  goalExpectationScore,
  contextualGoalExpectationScore,

  context
}: {
  marketName:
    CanonicalDecisionMarket | null;

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

  sampleReliability:
    number | null;

  leagueTrust:
    number | null;

  globalConfidence:
    number | null;

  goalExpectationScore:
    number | null;

  contextualGoalExpectationScore:
    number | null;

  context:
    DecisionContextMetrics;
}): OperationalPolicyResult {
  const blockers:
    string[] = [];

  const warnings:
    string[] = [];

  const requiredEv =
    getDynamicMinimumEv(
      marketName,
      odd
    );

  let maximumClassification:
    DecisionClassification | null =
      null;

const isDoubleChance =
  marketName ===
    "DOUBLE_CHANCE_1X" ||
  marketName ===
    "DOUBLE_CHANCE_X2";

const isGoalMarket =
  marketName === "OVER_1_5" ||
  marketName === "OVER_2_5" ||
  marketName === "BTTS_YES" ||
  marketName === "BTTS_NO";


  const dominanceScore =
    getMarketDominanceScore(
      marketName,
      context
    );

  const drawDependency =
    calculateDrawDependency({
      marketName,
      marketProbability:
        probability,

      drawProbability:
        context.drawProbability
    });

  /*
   * EV dinâmico.
   *
   * Não transforma automaticamente o mercado
   * em inválido; limita no máximo a WATCHLIST.
   */
  if (
    ev !== null &&
    ev < requiredEv
  ) {
    warnings.push(
      "EV_BELOW_DYNAMIC_MINIMUM"
    );

    maximumClassification =
      restrictClassification(
        maximumClassification,
        "WATCHLIST"
      );
  }

  /*
   * Confrontos extremamente equilibrados são
   * perigosos para mercados de resultado.
   *
   * Mercados de gols e BTTS não recebem este
   * bloqueio automaticamente.
   */
 const isDirectionalResultMarket =
  marketName === "HOME" ||
  marketName === "AWAY";

if (
  isDirectionalResultMarket &&
  context.matchBalanceIndex !== null &&
  context.matchBalanceIndex >= 0.82
) {
  warnings.push(
    "EXTREMELY_BALANCED_DIRECTIONAL_MARKET"
  );

  maximumClassification =
    restrictClassification(
      maximumClassification,
      "WATCHLIST"
    );
}

  /*
   * Vitória seca sem dominância mínima.
   */
  if (
    (
      marketName === "HOME" ||
      marketName === "AWAY"
    ) &&
    dominanceScore !== null &&
    dominanceScore < 0.54
  ) {
    warnings.push(
      "INSUFFICIENT_SIDE_DOMINANCE"
    );

    maximumClassification =
      restrictClassification(
        maximumClassification,
        "WATCHLIST"
      );
  }

  /*
   * Detecta dupla chance sustentada em excesso
   * pelo empate e sem força clara do lado principal.
   */
if (
  isDoubleChance &&
  probability !== null &&
  dominanceScore !== null &&
  drawDependency !== null &&
  context.matchBalanceIndex !== null &&
  dominanceScore < 0.50 &&
  drawDependency > 0.50 &&
  context.matchBalanceIndex > 0.78
) {
  warnings.push(
    "FRAGILE_DOUBLE_CHANCE"
  );

  maximumClassification =
    restrictClassification(
      maximumClassification,
      "WATCHLIST"
    );
}


  /*
   * Amostra muito pequena:
   * no máximo WATCHLIST.
   *
   * Não aplicamos penalidade por liga ainda,
   * pois isso exige evidência acumulada.
   */
  if (
    sampleReliability !== null &&
    sampleReliability < 0.50
  ) {
    warnings.push(
      "LOW_SAMPLE_RELIABILITY"
    );

    maximumClassification =
      restrictClassification(
        maximumClassification,
        "WATCHLIST"
      );
  }

  /*
   * Liga com baixa confiança histórica:
   * limita a entrada a WATCHLIST.
   *
   * Isso não altera probabilidade, EV, risco
   * ou confidence; apenas limita a decisão.
   */
  if (
    leagueTrust !== null &&
    leagueTrust < 0.50
  ) {
    warnings.push(
      "LOW_LEAGUE_TRUST"
    );

    maximumClassification =
      restrictClassification(
        maximumClassification,
        "WATCHLIST"
      );
  }

  /*
   * Confiança global muito baixa indica que o
   * conjunto do modelo está pouco consistente.
   */
  if (
    globalConfidence !== null &&
    globalConfidence < 0.45
  ) {
    warnings.push(
      "LOW_GLOBAL_MODEL_CONFIDENCE"
    );

    maximumClassification =
      restrictClassification(
        maximumClassification,
        "WATCHLIST"
      );
  }

  /*
   * Divergência relevante entre a expectativa
   * oficial e a contextual limita agressividade.
   */
if (
  isGoalMarket &&
  goalExpectationScore !== null &&
  contextualGoalExpectationScore !== null &&
  Math.abs(
    goalExpectationScore -
    contextualGoalExpectationScore
  ) >= 0.25
) {
  warnings.push(
    "GOAL_EXPECTATION_CONTEXT_DIVERGENCE"
  );

  maximumClassification =
    restrictClassification(
      maximumClassification,
      "WATCHLIST"
    );
}

  /*
   * Ausência de confiança explícita não deve
   * permitir BET/ELITE automaticamente.
   */
  if (confidence === null) {
    warnings.push(
      "OPERATIONAL_CONFIDENCE_UNAVAILABLE"
    );

    maximumClassification =
      restrictClassification(
        maximumClassification,
        "WATCHLIST"
      );
  }

  /*
   * Edge ausente continua sendo warning.
   * Edge não positivo já é tratado pelos guards.
   */
  if (
    probabilityEdge === null
  ) {
    warnings.push(
      "OPERATIONAL_EDGE_UNAVAILABLE"
    );
  }

  /*
   * Proteção adicional. Normalmente o guard
   * já captura esses casos.
   */
  if (
    probability === null ||
    odd === null ||
    ev === null ||
    risk === null ||
    marketName === null
  ) {
    blockers.push(
      "OPERATIONAL_POLICY_MISSING_METRICS"
    );
  }

  return {
    blocked:
      blockers.length > 0,

    maximumClassification,

    blockers:
      normalizeWarnings(
        blockers
      ),

    warnings:
      normalizeWarnings(
        warnings
      ),

    metrics: {
      requiredEv,

      matchBalanceIndex:
        context.matchBalanceIndex,

      dominanceScore,

      drawDependency,

      sampleReliability,

      leagueTrust,

      globalConfidence,

      goalExpectationScore,

      contextualGoalExpectationScore
    }
  };
}

function getDynamicMinimumEv(
  market:
    CanonicalDecisionMarket | null,

  odd:
    number | null
): number {
  if (
    market === null ||
    odd === null
  ) {
    return 0;
  }

  const isDoubleChance =
    market ===
      "DOUBLE_CHANCE_1X" ||
    market ===
      "DOUBLE_CHANCE_X2";

  const isResultMarket =
    market === "HOME" ||
    market === "DRAW" ||
    market === "AWAY";

  if (isDoubleChance) {
    if (odd < 1.40) return 0.08;
    if (odd < 1.70) return 0.07;
    if (odd < 2.20) return 0.09;

    return 0.12;
  }

  if (isResultMarket) {
    if (odd < 1.70) return 0.08;
    if (odd < 2.20) return 0.09;
    if (odd < 3.00) return 0.11;

    return 0.14;
  }

  /*
   * Over e BTTS.
   */
  if (odd < 1.60) return 0.07;
  if (odd < 2.20) return 0.08;

  return 0.10;
}

function getMarketDominanceScore(
  market:
    CanonicalDecisionMarket | null,

  context:
    DecisionContextMetrics
): number | null {
  switch (market) {
    case "HOME":
    case "DOUBLE_CHANCE_1X":
      return context
        .homeDominanceScore;

    case "AWAY":
    case "DOUBLE_CHANCE_X2":
      return context
        .awayDominanceScore;

    default:
      return null;
  }
}

function calculateDrawDependency({
  marketName,
  marketProbability,
  drawProbability
}: {
  marketName:
    CanonicalDecisionMarket | null;

  marketProbability:
    number | null;

  drawProbability:
    number | null;
}): number | null {
  const isDoubleChance =
    marketName ===
      "DOUBLE_CHANCE_1X" ||
    marketName ===
      "DOUBLE_CHANCE_X2";

  if (
    !isDoubleChance ||
    marketProbability === null ||
    marketProbability <= 0 ||
    drawProbability === null
  ) {
    return null;
  }

  return roundNumber(
    clamp(
      drawProbability /
      marketProbability,
      0,
      1
    )
  );
}

/* ==========================================
   LIMITADOR DE CLASSIFICAÇÃO
========================================== */

function capClassification(
  classification:
    DecisionClassification,

  maximumAllowed:
    DecisionClassification | null
): DecisionClassification {
  if (
    maximumAllowed === null
  ) {
    return classification;
  }

  const currentPriority =
    getClassificationPriority(
      classification
    );

  const maximumPriority =
    getClassificationPriority(
      maximumAllowed
    );

  /*
   * Se a classificação original já for mais
   * conservadora, ela é preservada.
   *
   * Exemplo:
   * original = NO BET
   * limite = WATCHLIST
   * resultado = NO BET
   */
  if (
    currentPriority <=
    maximumPriority
  ) {
    return classification;
  }

  return maximumAllowed;
}

function restrictClassification(
  currentLimit:
    DecisionClassification | null,

  newLimit:
    DecisionClassification
): DecisionClassification {
  if (
    currentLimit === null
  ) {
    return newLimit;
  }

  const currentPriority =
    getClassificationPriority(
      currentLimit
    );

  const newPriority =
    getClassificationPriority(
      newLimit
    );

  /*
   * Mantém sempre o limite mais conservador.
   */
  return newPriority <
    currentPriority
      ? newLimit
      : currentLimit;
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
      second?.rankingScore,
      Number.NEGATIVE_INFINITY
    ) -
    safeFiniteNumber(
      first?.rankingScore,
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
    confidenceValid: boolean;
    rankingValid: boolean;
    correlationValid: boolean;
  };

  reason: string;
}) {
  const debug:
    DecisionPipelineDebug = {
      valid:
        false,

      version:
        "V7.2_ELITE",

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
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value === "boolean"
  ) {
    return null;
  }

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
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value === "boolean"
  ) {
    return null;
  }

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
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value === "boolean"
  ) {
    return null;
  }

  const parsed =
    Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function parseNonNegativeNumber(
  value: unknown
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value === "boolean"
  ) {
    return null;
  }

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
    parseFiniteNumber(value);

  if (
    parsed === null ||
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
    parseFiniteNumber(value);

  return parsed ??
    fallback;
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