import type { PipelineRecord } from "./pipelineRecord";

/* ==========================================
   RANKING PIPELINE — QUANTIFY V7.1
========================================== */

/*
 * Responsabilidade:
 *
 * - receber mercados já precificados;
 * - receber risco e confiança já consolidados;
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
 * - classifica entradas;
 * - calcula stake;
 * - toma a decisão final.
 *
 * Princípio:
 *
 * Ranking ordena qualidade relativa.
 * Decision define elegibilidade.
 * BestOnly apenas escolhe entre candidatos aprovados.
 */

/* ==========================================
   CONTRATOS
========================================== */

export interface RankingComponents {
  valueQuality: number;
  safety: number;
  confidence: number;
  probability: number;
}

export interface RankingWeights {
  valueQuality: number;
  safety: number;
  confidence: number;
  probability: number;
}

export interface RankingValueBreakdown {
  ev: number;
  probabilityEdge: number;
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

  valueBreakdown: RankingValueBreakdown;

  weights: RankingWeights;

  contributions: RankingComponents;

  rankingScore: number | null;

  missingFields: string[];

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
    "Ranking orders valid candidates by value quality, safety, confidence and probability; it does not make the final betting decision.";
}

/* ==========================================
   POLÍTICA DE RANKING
========================================== */

/*
 * EV e probabilityEdge pertencem à mesma dimensão:
 *
 * valor econômico.
 *
 * Eles são combinados primeiro em valueQuality
 * para evitar dupla contagem excessiva.
 *
 * Os pesos devem ser calibrados futuramente por:
 *
 * - ROI por faixa;
 * - hit rate por faixa;
 * - drawdown;
 * - estabilidade fora da amostra;
 * - análise por mercado e por liga.
 */

const RANKING_WEIGHTS:
  RankingWeights = {
    valueQuality:
      0.40,

    safety:
      0.25,

    confidence:
      0.20,

    probability:
      0.15
  };

/*
 * Peso interno da dimensão econômica.
 *
 * EV continua sendo a principal medida de valor,
 * mas probabilityEdge atua como confirmação.
 */
const VALUE_QUALITY_WEIGHTS = {
  ev:
    0.65,

  probabilityEdge:
    0.35
} as const;

/*
 * Tetos defensivos de normalização.
 *
 * EV e edge iguais ou menores que zero não recebem
 * contribuição positiva.
 *
 * Os valores originais são preservados.
 */
const NORMALIZATION_POLICY = {
  evPositiveMaximum:
    0.25,

  probabilityEdgePositiveMaximum:
    0.12
} as const;

/* ==========================================
   PIPELINE
========================================== */

export function rankingPipeline(
  data: PipelineRecord
) {
  const inputMarkets =
    Array.isArray(data?.markets)
      ? data.markets
      : [];

  let validMarkets = 0;
  let invalidMarkets = 0;

  const rankedMarkets =
    inputMarkets.map(
      (
        market: PipelineRecord,
        originalIndex: number
      ) => {
        const ranked =
          rankMarket(
            market,
            originalIndex
          );

        if (ranked.rankingValid) {
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
   * 1. mercados válidos;
   * 2. maior rankingScore;
   * 3. maior EV;
   * 4. maior probabilityEdge;
   * 5. menor risco;
   * 6. maior confiança;
   * 7. maior probabilidade;
   * 8. posição original.
   */
  rankedMarkets.sort(
    (
      first: PipelineRecord,
      second: PipelineRecord
    ) =>
      compareRankedMarkets(
        first,
        second
      )
  );

  /*
   * Mercados inválidos permanecem no array,
   * mas não recebem posição numérica.
   */
  let currentValidRank = 0;

  const markets: PipelineRecord[] =
    rankedMarkets.map(
      (market: PipelineRecord): PipelineRecord => {
        if (!market?.rankingValid) {
          return {
            ...market,

            rank:
              null
          };
        }

        currentValidRank++;

        return {
          ...market,

          rank:
            currentValidRank
        };
      }
    );

  const topMarket =
    markets.find(
      (market: PipelineRecord) =>
        market?.rankingValid === true
    ) ?? null;

  const pipelineValid =
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
          ? normalizeMarketLabel(
              topMarket?.market
            )
          : null,

      topScore:
        topMarket
          ? parseProbability(
              topMarket?.rankingScore
            )
          : null,

      note:
        "Ranking orders valid candidates by value quality, safety, confidence and probability; it does not make the final betting decision."
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
  market: PipelineRecord,
  originalIndex: number
) {
  const originalWarnings =
    normalizeWarnings(
      market?.warnings
    );

  const probability =
    firstProbability([
      market?.probability,
      market?.calibratedProbability,
      market?.modelProbability
    ]);

  const ev =
    parseFiniteNumber(
      market?.ev
    );

  const canonicalProbabilityEdge =
    parseFiniteNumber(
      market?.probabilityEdge
    );

  const legacyEdge =
    canonicalProbabilityEdge === null
      ? parseFiniteNumber(
          market?.edge
        )
      : null;

  const probabilityEdge =
    canonicalProbabilityEdge ??
    legacyEdge;

  const risk =
    getMarketRisk(
      market
    );

  const confidence =
    firstProbability([
      market?.confidence,
      market?.marketConfidence
    ]);

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

  if (probabilityEdge === null) {
    missingFields.push(
      "probabilityEdge"
    );
  }

  if (risk === null) {
    missingFields.push(
      "risk"
    );
  }

  if (confidence === null) {
    missingFields.push(
      "confidence"
    );
  }

  const legacyWarnings =
    legacyEdge !== null
      ? [
          "RANKING_LEGACY_EDGE_FALLBACK"
        ]
      : [];

  const rankingValid =
    missingFields.length === 0;

  if (!rankingValid) {
    const warnings =
      normalizeWarnings([
        ...originalWarnings,

        ...legacyWarnings,

        "INVALID_RANKING_INPUT",

        ...missingFields.map(
          field =>
            `MISSING_RANKING_${field.toUpperCase()}`
        )
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
          valueQuality:
            0,

          safety:
            0,

          confidence:
            0,

          probability:
            0
        },

        valueBreakdown: {
          ev:
            0,

          probabilityEdge:
            0
        },

        weights: {
          ...RANKING_WEIGHTS
        },

        contributions: {
          valueQuality:
            0,

          safety:
            0,

          confidence:
            0,

          probability:
            0
        },

        rankingScore:
          null,

        missingFields,

        warnings
      };

    return {
      ...market,

      /*
       * rankingScore nulo diferencia:
       *
       * mercado inválido
       *
       * de
       *
       * mercado válido com score baixo.
       */
      rankingScore:
        null,

      rankingValid:
        false,

      rankingOriginalIndex:
        originalIndex,

      rank:
        null,

      warnings,

      debug: {
        ...(market?.debug ?? {}),

        rankingPipeline:
          debug
      }
    };
  }

  /*
   * Após rankingValid, estes valores são números.
   */
  const validProbability =
    probability as number;

  const validEv =
    ev as number;

  const validProbabilityEdge =
    probabilityEdge as number;

  const validRisk =
    risk as number;

  const validConfidence =
    confidence as number;

  const normalizedEv =
    normalizePositiveSignal(
      validEv,
      NORMALIZATION_POLICY
        .evPositiveMaximum
    );

  const normalizedProbabilityEdge =
    normalizePositiveSignal(
      validProbabilityEdge,
      NORMALIZATION_POLICY
        .probabilityEdgePositiveMaximum
    );

  const valueQuality =
    (
      normalizedEv *
      VALUE_QUALITY_WEIGHTS.ev
    ) +
    (
      normalizedProbabilityEdge *
      VALUE_QUALITY_WEIGHTS
        .probabilityEdge
    );

  const safety =
    clampProbability(
      1 -
      validRisk
    );

  const normalized:
    RankingComponents = {
      valueQuality:
        clampProbability(
          valueQuality
        ),

      safety,

      confidence:
        validConfidence,

      probability:
        validProbability
    };

  const contributions:
    RankingComponents = {
      valueQuality:
        normalized.valueQuality *
        RANKING_WEIGHTS.valueQuality,

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

  const rawRankingScore =
    contributions.valueQuality +
    contributions.safety +
    contributions.confidence +
    contributions.probability;

  const rankingScore =
    clampProbability(
      rawRankingScore
    );

  const warnings =
    normalizeWarnings([
      ...originalWarnings,

      ...legacyWarnings,

      ...buildRankingDiagnosticWarnings({
        ev:
          validEv,

        probabilityEdge:
          validProbabilityEdge,

        risk:
          validRisk,

        confidence:
          validConfidence,

        probability:
          validProbability
      })
    ]);

  const debug:
    RankingMarketDebug = {
      valid:
        true,

      raw: {
        ev:
          validEv,

        probabilityEdge:
          validProbabilityEdge,

        risk:
          validRisk,

        confidence:
          validConfidence,

        probability:
          validProbability
      },

      normalized: {
        valueQuality:
          roundNumber(
            normalized.valueQuality
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

      valueBreakdown: {
        ev:
          roundNumber(
            normalizedEv
          ),

        probabilityEdge:
          roundNumber(
            normalizedProbabilityEdge
          )
      },

      weights: {
        ...RANKING_WEIGHTS
      },

      contributions: {
        valueQuality:
          roundNumber(
            contributions.valueQuality
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

      rankingScore:
        roundNumber(
          rankingScore
        ),

      missingFields:
        [],

      warnings
    };

  return {
    ...market,

    /*
     * rankingScore é o campo canônico.
     *
     * O alias genérico score não é mais escrito para
     * evitar colisão semântica com outros módulos.
     */
    rankingScore:
      roundNumber(
        rankingScore
      ),

    rankingValid:
      true,

    rankingOriginalIndex:
      originalIndex,

    warnings,

    debug: {
      ...(market?.debug ?? {}),

      rankingPipeline:
        debug
    }
  };
}

/* ==========================================
   COMPARAÇÃO
========================================== */

function compareRankedMarkets(
  first: PipelineRecord,
  second: PipelineRecord
): number {
  const firstValid =
    first?.rankingValid === true;

  const secondValid =
    second?.rankingValid === true;

  if (
    firstValid !==
    secondValid
  ) {
    return firstValid
      ? -1
      : 1;
  }

  if (
    !firstValid &&
    !secondValid
  ) {
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

  const edgeDifference =
    getMarketProbabilityEdge(
      second,
      Number.NEGATIVE_INFINITY
    ) -
    getMarketProbabilityEdge(
      first,
      Number.NEGATIVE_INFINITY
    );

  if (
    Math.abs(
      edgeDifference
    ) >
    1e-12
  ) {
    return edgeDifference;
  }

  const riskDifference =
    getMarketRisk(
      first,
      1
    ) -
    getMarketRisk(
      second,
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

  const confidenceDifference =
    safeFiniteNumber(
      second?.confidence,
      0
    ) -
    safeFiniteNumber(
      first?.confidence,
      0
    );

  if (
    Math.abs(
      confidenceDifference
    ) >
    1e-12
  ) {
    return confidenceDifference;
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
    ) >
    1e-12
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

/* ==========================================
   DIAGNÓSTICOS
========================================== */

/*
 * Estes warnings são informativos.
 *
 * Eles não eliminam o mercado e não modificam
 * rankingScore.
 */
function buildRankingDiagnosticWarnings({
  ev,
  probabilityEdge,
  risk,
  confidence,
  probability
}: {
  ev: number;
  probabilityEdge: number;
  risk: number;
  confidence: number;
  probability: number;
}): string[] {
  const warnings:
    string[] = [];

  if (ev <= 0) {
    warnings.push(
      "RANKING_NON_POSITIVE_EV"
    );
  }

  if (probabilityEdge <= 0) {
    warnings.push(
      "RANKING_NON_POSITIVE_EDGE"
    );
  }

  if (risk >= 0.65) {
    warnings.push(
      "RANKING_HIGH_RISK"
    );
  }

  if (confidence < 0.50) {
    warnings.push(
      "RANKING_LOW_CONFIDENCE"
    );
  }

  if (probability < 0.45) {
    warnings.push(
      "RANKING_LOW_PROBABILITY"
    );
  }

  return warnings;
}

/* ==========================================
   NORMALIZAÇÃO
========================================== */

/*
 * Sinais econômicos iguais ou menores que zero
 * recebem contribuição zero.
 *
 * Isso não elimina o mercado e não altera EV/edge.
 */
function normalizePositiveSignal(
  value: number,
  positiveMaximum: number
): number {
  if (
    !Number.isFinite(value) ||
    !Number.isFinite(
      positiveMaximum
    ) ||
    positiveMaximum <= 0 ||
    value <= 0
  ) {
    return 0;
  }

  return clampProbability(
    value /
    positiveMaximum
  );
}

/* ==========================================
   EXTRAÇÃO DE MÉTRICAS
========================================== */

function getMarketRisk(
  market: PipelineRecord
): number | null;

function getMarketRisk(
  market: PipelineRecord,
  fallback: number
): number;

function getMarketRisk(
  market: PipelineRecord,
  fallback?: number
): number | null {
  const parsed =
    firstProbability([
      market?.riskScore,
      market?.risk
    ]);

  if (parsed !== null) {
    return parsed;
  }

  return fallback ??
    null;
}

function getMarketProbabilityEdge(
  market: PipelineRecord,
  fallback:
    number
): number {
  const parsed =
    firstFiniteNumber([
      market?.probabilityEdge,
      market?.edge
    ]);

  return parsed ??
    fallback;
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
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value ===
      "boolean"
  ) {
    return null;
  }

  const parsed =
    Number(value);

  if (
    !Number.isFinite(
      parsed
    ) ||
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
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value ===
      "boolean"
  ) {
    return null;
  }

  const parsed =
    Number(value);

  return Number.isFinite(
    parsed
  )
    ? parsed
    : null;
}

function safeFiniteNumber(
  value: unknown,
  fallback: number
): number {
  const parsed =
    parseFiniteNumber(
      value
    );

  return parsed ??
    fallback;
}

function normalizeWarnings(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .map(
          warning =>
            String(
              warning ??
              ""
            ).trim()
        )
        .filter(Boolean)
    )
  ];
}

function normalizeMarketLabel(
  value: unknown
): string {
  return String(
    value ??
    ""
  )
    .trim()
    .toUpperCase();
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
    return 0;
  }

  const factor =
    10 **
    decimals;

  return (
    Math.round(
      value *
      factor
    ) /
    factor
  );
}
