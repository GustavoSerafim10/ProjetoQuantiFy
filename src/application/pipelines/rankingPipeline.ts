/* ==========================================
   RANKING PIPELINE — QUANTIFY V7
========================================== */

/*
 * Responsabilidade:
 *
 * - receber mercados já precificados;
 * - receber risco já consolidado;
 * - calcular uma pontuação comparável;
 * - ordenar os mercados;
 * - registrar os componentes do ranking.
 *
 * Este arquivo não:
 *
 * - recalcula probabilidade;
 * - recalcula EV;
 * - recalcula risco;
 * - altera confiança;
 * - elimina mercados;
 * - toma a decisão final.
 */

/* ==========================================
   CONTRATOS
========================================== */

export interface RankingComponents {
  ev: number;
  probabilityEdge: number;
  safety: number;
  confidence: number;
  probability: number;
}

export interface RankingWeights {
  ev: number;
  probabilityEdge: number;
  safety: number;
  confidence: number;
  probability: number;
}

export interface RankingMarketDebug {
  valid: boolean;

  raw: {
    ev: number | null;
    probabilityEdge: number | null;
    risk: number | null;
    confidence: number | null;
    probability: number | null;
  };

  normalized: RankingComponents;

  weights: RankingWeights;

  contributions: RankingComponents;

  score: number;

  warnings: string[];
}

export interface RankingPipelineDebug {
  valid: boolean;

  inputMarkets: number;
  outputMarkets: number;

  validMarkets: number;
  invalidMarkets: number;

  topMarket: string | null;
  topScore: number | null;

  note:
    "Ranking orders candidates by value adjusted for risk; it does not make the final betting decision.";
}

/* ==========================================
   POLÍTICA DE RANKING
========================================== */

/*
 * O EV recebe o maior peso porque o objetivo
 * econômico do sistema é encontrar valor.
 *
 * O risco já inclui os componentes estruturais,
 * de incerteza e de correlação.
 *
 * Estes pesos devem futuramente ser validados
 * por backtest fora da amostra.
 */
const RANKING_WEIGHTS:
  RankingWeights = {
    ev:
      0.45,

    probabilityEdge:
      0.20,

    safety:
      0.20,

    confidence:
      0.10,

    probability:
      0.05
  };

/*
 * Escalas usadas somente para normalização
 * de ranking.
 *
 * Elas não modificam os valores originais.
 */
const NORMALIZATION_POLICY = {
  evMinimum:
    -0.10,

  evMaximum:
    0.30,

  probabilityEdgeMinimum:
    -0.10,

  probabilityEdgeMaximum:
    0.15
} as const;

/* ==========================================
   PIPELINE
========================================== */

export function rankingPipeline(
  data: any
) {
  const inputMarkets =
    Array.isArray(data?.markets)
      ? data.markets
      : [];

  let validMarkets =
    0;

  let invalidMarkets =
    0;

  const rankedMarkets =
    inputMarkets.map(
      (
        market: any,
        originalIndex: number
      ) => {
        const ranked =
          rankMarket(
            market,
            originalIndex
          );

        if (
          ranked.rankingValid
        ) {
          validMarkets++;
        } else {
          invalidMarkets++;
        }

        return ranked;
      }
    );

  /*
   * Ordenação determinística:
   *
   * 1. score
   * 2. EV
   * 3. menor risco
   * 4. maior probabilidade
   * 5. posição original
   */
  rankedMarkets.sort(
    (
      first: any,
      second: any
    ) => {
      const scoreDifference =
        safeFiniteNumber(
          second?.score,
          Number.NEGATIVE_INFINITY
        ) -
        safeFiniteNumber(
          first?.score,
          Number.NEGATIVE_INFINITY
        );

      if (
        Math.abs(
          scoreDifference
        ) > 1e-12
      ) {
        return scoreDifference;
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
        ) > 1e-12
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
        ) > 1e-12
      ) {
        return riskDifference;
      }

      const probabilityDifference =
        safeFiniteNumber(
          second?.probability,
          0
        ) -
        safeFiniteNumber(
          first?.probability,
          0
        );

      if (
        Math.abs(
          probabilityDifference
        ) > 1e-12
      ) {
        return probabilityDifference;
      }

      return (
        safeFiniteNumber(
          first?.rankingOriginalIndex,
          0
        ) -
        safeFiniteNumber(
          second?.rankingOriginalIndex,
          0
        )
      );
    }
  );

  /*
   * Após ordenar, registramos a posição final.
   */
  const markets =
    rankedMarkets.map(
      (
        market: any,
        index: number
      ) => ({
        ...market,

        rank:
          index + 1
      })
    );

  const topMarket =
    markets[0] ?? null;

  const pipelineValid =
    markets.length > 0 &&
    validMarkets > 0;

  const debug:
    RankingPipelineDebug = {
      valid:
        pipelineValid,

      inputMarkets:
        inputMarkets.length,

      outputMarkets:
        markets.length,

      validMarkets,
      invalidMarkets,

      topMarket:
        topMarket
          ? String(
              topMarket.market ??
              ""
            )
          : null,

      topScore:
        topMarket &&
        Number.isFinite(
          Number(
            topMarket.score
          )
        )
          ? roundNumber(
              Number(
                topMarket.score
              )
            )
          : null,

      note:
        "Ranking orders candidates by value adjusted for risk; it does not make the final betting decision."
    };

  return {
    ...data,

    rankingValid:
      pipelineValid,

    markets,

    debug: {
      ...(data?.debug ?? {}),

      rankingPipeline:
        debug
    }
  };
}

/* ==========================================
   RANKING POR MERCADO
========================================== */

function rankMarket(
  market: any,
  originalIndex: number
) {
  const warnings =
    normalizeWarnings(
      market?.warnings
    );

  const probability =
    parseProbability(
      market?.probability
    );

  const ev =
    parseFiniteNumber(
      market?.ev
    );

  /*
   * O novo valuePipeline usa:
   *
   * probabilityEdge
   *
   * O campo edge fica como fallback temporário
   * para compatibilidade.
   */
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

  const missingFields:
    string[] = [];

  if (probability === null) {
    missingFields.push(
      "probability"
    );
  }

  if (ev === null) {
    missingFields.push(
      "ev"
    );
  }

  if (
    probabilityEdge === null
  ) {
    missingFields.push(
      "probabilityEdge"
    );
  }

  if (risk === null) {
    missingFields.push(
      "risk"
    );
  }

  /*
   * Confidence pode não existir em alguns
   * mercados antigos.
   *
   * Nesse caso usamos valor neutro apenas no
   * ranking, sem alterar o mercado original.
   */
  const effectiveConfidence =
    confidence ??
    0.5;

  const rankingValid =
    probability !== null &&
    ev !== null &&
    probabilityEdge !== null &&
    risk !== null;

  if (!rankingValid) {
    const invalidWarnings =
      normalizeWarnings([
        ...warnings,

        "INVALID_RANKING_INPUT"
      ]);

    const debug:
      RankingMarketDebug = {
        valid:
          false,

        raw: {
          ev,
          probabilityEdge,
          risk,
          confidence,
          probability
        },

        normalized: {
          ev: 0,
          probabilityEdge: 0,
          safety: 0,
          confidence:
            effectiveConfidence,
          probability:
            probability ?? 0
        },

        weights: {
          ...RANKING_WEIGHTS
        },

        contributions: {
          ev: 0,
          probabilityEdge: 0,
          safety: 0,
          confidence: 0,
          probability: 0
        },

        score: 0,

        warnings:
          invalidWarnings
      };

    return {
      ...market,

      score:
        Number.NEGATIVE_INFINITY,

      rankingScore:
        Number.NEGATIVE_INFINITY,

      rankingValid:
        false,

      rankingOriginalIndex:
        originalIndex,

      warnings:
        invalidWarnings,

      debug: {
        ...(market?.debug ?? {}),

        rankingPipeline: {
          ...debug,

          missingFields
        }
      }
    };
  }

  const normalizedEv =
    normalizeRange(
      ev,
      NORMALIZATION_POLICY
        .evMinimum,
      NORMALIZATION_POLICY
        .evMaximum
    );

  const normalizedProbabilityEdge =
    normalizeRange(
      probabilityEdge,
      NORMALIZATION_POLICY
        .probabilityEdgeMinimum,
      NORMALIZATION_POLICY
        .probabilityEdgeMaximum
    );

  const safety =
    1 - risk;

  const normalized:
    RankingComponents = {
      ev:
        normalizedEv,

      probabilityEdge:
        normalizedProbabilityEdge,

      safety:
        safety,

      confidence:
        effectiveConfidence,

      probability
    };

  const contributions:
    RankingComponents = {
      ev:
        normalized.ev *
        RANKING_WEIGHTS.ev,

      probabilityEdge:
        normalized.probabilityEdge *
        RANKING_WEIGHTS
          .probabilityEdge,

      safety:
        normalized.safety *
        RANKING_WEIGHTS.safety,

      confidence:
        normalized.confidence *
        RANKING_WEIGHTS.confidence,

      probability:
        normalized.probability *
        RANKING_WEIGHTS.probability
    };

  const rawScore =
    contributions.ev +
    contributions.probabilityEdge +
    contributions.safety +
    contributions.confidence +
    contributions.probability;

  const score =
    clampProbability(
      rawScore
    );

  const finalWarnings =
    confidence === null
      ? normalizeWarnings([
          ...warnings,

          "RANKING_CONFIDENCE_FALLBACK"
        ])
      : warnings;

  const debug:
    RankingMarketDebug = {
      valid:
        true,

      raw: {
        ev,
        probabilityEdge,
        risk,
        confidence,
        probability
      },

      normalized: {
        ev:
          roundNumber(
            normalized.ev
          ),

        probabilityEdge:
          roundNumber(
            normalized
              .probabilityEdge
          ),

        safety:
          roundNumber(
            normalized.safety
          ),

        confidence:
          roundNumber(
            normalized.confidence
          ),

        probability:
          roundNumber(
            normalized.probability
          )
      },

      weights: {
        ...RANKING_WEIGHTS
      },

      contributions: {
        ev:
          roundNumber(
            contributions.ev
          ),

        probabilityEdge:
          roundNumber(
            contributions
              .probabilityEdge
          ),

        safety:
          roundNumber(
            contributions.safety
          ),

        confidence:
          roundNumber(
            contributions.confidence
          ),

        probability:
          roundNumber(
            contributions.probability
          )
      },

      score:
        roundNumber(
          score
        ),

      warnings:
        finalWarnings
    };

  return {
    ...market,

    score:
      roundNumber(
        score
      ),

    rankingScore:
      roundNumber(
        score
      ),

    rankingValid:
      true,

    rankingOriginalIndex:
      originalIndex,

    warnings:
      finalWarnings,

    debug: {
      ...(market?.debug ?? {}),

      rankingPipeline:
        debug
    }
  };
}

/* ==========================================
   NORMALIZAÇÃO
========================================== */

/*
 * Converte uma variável de intervalo conhecido
 * para a escala 0–1.
 *
 * Não altera o valor original do mercado.
 */
function normalizeRange(
  value: number,
  minimum: number,
  maximum: number
): number {
  if (
    !Number.isFinite(value) ||
    !Number.isFinite(minimum) ||
    !Number.isFinite(maximum) ||
    maximum <= minimum
  ) {
    return 0;
  }

  const normalized =
    (
      value -
      minimum
    ) /
    (
      maximum -
      minimum
    );

  return clampProbability(
    normalized
  );
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

    if (parsed !== null) {
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

    if (parsed !== null) {
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

function parseFiniteNumber(
  value: unknown
): number | null {
  const parsed =
    Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
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
            warning ?? ""
          ).trim()
      )
      .filter(Boolean);

  return [
    ...new Set(
      warnings
    )
  ];
}

function clampProbability(
  value: number
): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(
      value,
      1
    )
  );
}

function roundNumber(
  value: number,
  decimals = 6
): number {
  if (!Number.isFinite(value)) {
    return value;
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