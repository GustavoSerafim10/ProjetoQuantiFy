import {
  calculateMarketConfidence
} from "../../domain/analysis/confidenceEngine";

/* ==========================================
   CONFIDENCE PIPELINE — QUANTIFY V7
========================================== */

/*
 * Responsabilidade:
 *
 * - receber mercados já precificados;
 * - receber risco já consolidado;
 * - calcular confiança específica por mercado;
 * - incorporar confiança global apenas como moderador;
 * - preservar probability, EV, risk e ranking;
 * - registrar diagnóstico detalhado.
 *
 * Este arquivo não:
 *
 * - recalcula probabilidade;
 * - recalcula EV;
 * - recalcula risco;
 * - altera odds;
 * - classifica entrada;
 * - escolhe o melhor mercado;
 * - toma decisão final.
 */

/* ==========================================
   CONTRATOS
========================================== */

export interface ConfidencePipelineMarketDebug {
  valid: boolean;

  market:
    string;

  probability:
    number | null;

  odd:
    number | null;

  ev:
    number | null;

  risk:
    number | null;

  kelly:
    number | null;

  lambdaHome:
    number | null;

  lambdaAway:
    number | null;

  goalExpectationScore:
    number | null;

  globalConfidence:
    number | null;

  monteCarloProbability:
    number | null;

  poissonProbability:
    number | null;

  confidence:
    number;

  warnings:
    string[];
}

export interface ConfidencePipelineDebug {
  valid: boolean;

  inputMarkets:
    number;

  outputMarkets:
    number;

  validMarkets:
    number;

  invalidMarkets:
    number;

  globalConfidence:
    number | null;

  error?:
    string;

  note:
    "Confidence is calculated per market after risk and before ranking.";
}

/* ==========================================
   PIPELINE
========================================== */

export function confidencePipeline(
  data: any
) {
  const inputMarkets =
    Array.isArray(
      data?.markets
    )
      ? data.markets
      : [];

  const lambdaHome =
    parsePositiveNumber(
      data?.lambdaHome
    );

  const lambdaAway =
    parsePositiveNumber(
      data?.lambdaAway
    );

  const globalConfidence =
    firstProbability([
      data?.globalConfidence,
      data?.confidence,
      data?.modelConfidence
    ]);

  const goalExpectationScore =
    firstProbability([
      data?.goalExpectationScore,
      data?.marketContext
        ?.goalExpectationScore
    ]);

  if (
    inputMarkets.length ===
    0
  ) {
    const debug:
      ConfidencePipelineDebug = {
        valid:
          false,

        inputMarkets:
          0,

        outputMarkets:
          0,

        validMarkets:
          0,

        invalidMarkets:
          0,

        globalConfidence,

        error:
          "NO_MARKETS_FOR_CONFIDENCE",

        note:
          "Confidence is calculated per market after risk and before ranking."
      };

    return {
      ...data,

      confidenceValid:
        false,

      markets:
        [],

      debug: {
        ...(data?.debug ?? {}),

        confidencePipeline:
          debug
      }
    };
  }

  if (
    lambdaHome === null ||
    lambdaAway === null
  ) {
    return createInvalidPipelineResult(
      data,
      inputMarkets,
      globalConfidence,
      "INVALID_CONFIDENCE_LAMBDAS"
    );
  }

  let validMarkets =
    0;

  let invalidMarkets =
    0;

  const markets =
    inputMarkets.map(
      (
        market: any
      ) => {
        const probability =
          parseProbability(
            market?.probability
          );

        const odd =
          parseOdd(
            market?.odd
          );

        const ev =
          parseFiniteNumber(
            market?.ev
          );

        const risk =
          firstProbability([
            market?.riskScore,
            market?.risk
          ]);

        const kelly =
          parseNonNegativeNumber(
            market?.kelly
          );

        const trapScore =
          parseProbability(
            market?.trapScore
          );

        const marketName =
          String(
            market?.market ??
            ""
          )
            .trim()
            .toUpperCase();

        const monteCarloProbability =
          extractMonteCarloProbability(
            data,
            marketName
          );

        const poissonProbability =
          extractPoissonProbability(
            data,
            marketName,
            probability
          );

        if (
          probability === null ||
          odd === null ||
          ev === null ||
          risk === null ||
          !marketName
        ) {
          invalidMarkets++;

          const warnings =
            normalizeWarnings([
              ...normalizeWarnings(
                market?.warnings
              ),

              "INVALID_CONFIDENCE_INPUT"
            ]);

          return {
            ...market,

            confidence:
              0,

            confidenceValid:
              false,

            warnings,

            debug: {
              ...(market?.debug ?? {}),

              confidencePipeline: {
                valid:
                  false,

                market:
                  marketName,

                probability,

                odd,

                ev,

                risk,

                kelly,

                lambdaHome,

                lambdaAway,

                goalExpectationScore,

                globalConfidence,

                monteCarloProbability,

                poissonProbability,

                confidence:
                  0,

                warnings
              } satisfies ConfidencePipelineMarketDebug
            }
          };
        }

        const result =
          calculateMarketConfidence({
            probability,
            odds:
              odd,

            ev,

            kelly,

            lambdaHome,
            lambdaAway,

            market:
              marketName,

            goalExpectationScore,

            riskScore:
              risk,

            trapScore,

            monteCarloProb:
              monteCarloProbability,

            poissonProb:
              poissonProbability,

            globalConfidence
          });

        if (
          result.valid
        ) {
          validMarkets++;
        } else {
          invalidMarkets++;
        }

        const warnings =
          normalizeWarnings([
            ...normalizeWarnings(
              market?.warnings
            ),

            ...result.warnings
          ]);

        const debug:
          ConfidencePipelineMarketDebug = {
            valid:
              result.valid,

            market:
              marketName,

            probability,

            odd,

            ev,

            risk,

            kelly,

            lambdaHome,

            lambdaAway,

            goalExpectationScore,

            globalConfidence,

            monteCarloProbability,

            poissonProbability,

            confidence:
              result.confidence,

            warnings
          };

        return {
          ...market,

          confidence:
            result.confidence,

          confidenceValid:
            result.valid,

          warnings,

          debug: {
            ...(market?.debug ?? {}),

            confidencePipeline: {
              ...debug,

              engine:
                result
            }
          }
        };
      }
    );

  const pipelineValid =
    validMarkets > 0;

  const debug:
    ConfidencePipelineDebug = {
      valid:
        pipelineValid,

      inputMarkets:
        inputMarkets.length,

      outputMarkets:
        markets.length,

      validMarkets,

      invalidMarkets,

      globalConfidence,

      ...(
        pipelineValid
          ? {}
          : {
              error:
                "NO_VALID_CONFIDENCE_MARKETS"
            }
      ),

      note:
        "Confidence is calculated per market after risk and before ranking."
    };

  return {
    ...data,

    confidenceValid:
      pipelineValid,

    markets,

    debug: {
      ...(data?.debug ?? {}),

      confidencePipeline:
        debug
    }
  };
}

/* ==========================================
   RESULTADO INVÁLIDO
========================================== */

function createInvalidPipelineResult(
  data:
    any,

  inputMarkets:
    any[],

  globalConfidence:
    number | null,

  error:
    string
) {
  const markets =
    inputMarkets.map(
      (
        market: any
      ) => {
        const warnings =
          normalizeWarnings([
            ...normalizeWarnings(
              market?.warnings
            ),

            error
          ]);

        return {
          ...market,

          confidence:
            0,

          confidenceValid:
            false,

          warnings,

          debug: {
            ...(market?.debug ?? {}),

            confidencePipeline: {
              valid:
                false,

              confidence:
                0,

              error,

              warnings
            }
          }
        };
      }
    );

  const debug:
    ConfidencePipelineDebug = {
      valid:
        false,

      inputMarkets:
        inputMarkets.length,

      outputMarkets:
        markets.length,

      validMarkets:
        0,

      invalidMarkets:
        markets.length,

      globalConfidence,

      error,

      note:
        "Confidence is calculated per market after risk and before ranking."
    };

  return {
    ...data,

    confidenceValid:
      false,

    markets,

    debug: {
      ...(data?.debug ?? {}),

      confidencePipeline:
        debug
    }
  };
}

/* ==========================================
   MONTE CARLO
========================================== */

function extractMonteCarloProbability(
  data:
    any,

  market:
    string
): number | null {
  const probabilities =
    firstObject([
      data?.monteCarlo
        ?.probabilities,

      data?.simulation
        ?.probabilities,

      data?.monteCarloResult
        ?.probabilities,

      data?.debug
        ?.simulationPipeline
        ?.probabilities,

      data?.debug
        ?.simulationPipeline
        ?.monteCarlo
        ?.probabilities
    ]);

  if (!probabilities) {
    return null;
  }

  const aliases =
    getProbabilityAliases(
      market
    );

  for (
    const alias of aliases
  ) {
    const probability =
      parseProbability(
        probabilities[
          alias
        ]
      );

    if (
      probability !== null
    ) {
      return probability;
    }
  }

  return null;
}

/* ==========================================
   POISSON / MODELO ANALÍTICO
========================================== */

function extractPoissonProbability(
  data:
    any,

  market:
    string,

  fallbackProbability:
    number | null
): number | null {
  const aliases =
    getProbabilityAliases(
      market
    );

  const candidates = [
    data?.analyticalProbabilities,
    data?.modelProbabilities,
    data?.probabilities,
    data?.probs,
    data?.model?.probabilities,
    data?.debug
      ?.modelPipeline
      ?.probabilities
  ];

  for (
    const candidate of candidates
  ) {
    if (
      !candidate ||
      typeof candidate !==
        "object"
    ) {
      continue;
    }

    for (
      const alias of aliases
    ) {
      const probability =
        parseProbability(
          candidate[
            alias
          ]
        );

      if (
        probability !== null
      ) {
        return probability;
      }
    }
  }

  /*
   * A probabilidade oficial do mercado veio do
   * modelo analítico já calibrado.
   *
   * Ela pode ser usada como fallback de Poisson
   * para comparação, sem inventar outro número.
   */
  return fallbackProbability;
}

/* ==========================================
   ALIASES
========================================== */

function getProbabilityAliases(
  market:
    string
): string[] {
  switch (
    market
  ) {
    case "HOME":
    case "HOME_WIN":
      return [
        "HOME",
        "home",
        "homeWin",
        "homeWinProb"
      ];

    case "DRAW":
      return [
        "DRAW",
        "draw",
        "drawProb"
      ];

    case "AWAY":
    case "AWAY_WIN":
      return [
        "AWAY",
        "away",
        "awayWin",
        "awayWinProb"
      ];

    case "OVER_1_5":
      return [
        "OVER_1_5",
        "over15",
        "over1_5"
      ];

    case "OVER_2_5":
      return [
        "OVER_2_5",
        "over25",
        "over2_5"
      ];

    case "BTTS_YES":
      return [
        "BTTS_YES",
        "bttsYes",
        "yes"
      ];

    case "BTTS_NO":
      return [
        "BTTS_NO",
        "bttsNo",
        "no"
      ];

    case "DOUBLE_CHANCE_1X":
    case "1X":
      return [
        "DOUBLE_CHANCE_1X",
        "doubleChance1X",
        "homeOrDraw"
      ];

    case "DOUBLE_CHANCE_X2":
    case "X2":
      return [
        "DOUBLE_CHANCE_X2",
        "doubleChanceX2",
        "awayOrDraw"
      ];

    default:
      return [];
  }
}

/* ==========================================
   HELPERS
========================================== */

function firstProbability(
  values:
    unknown[]
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

function firstObject(
  values:
    unknown[]
): Record<string, any> | null {
  for (
    const value of values
  ) {
    if (
      value !== null &&
      typeof value ===
        "object" &&
      !Array.isArray(
        value
      )
    ) {
      return value as
        Record<string, any>;
    }
  }

  return null;
}

function parseProbability(
  value:
    unknown
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

function parseOdd(
  value:
    unknown
): number | null {
  const parsed =
    Number(value);

  if (
    !Number.isFinite(
      parsed
    ) ||
    parsed <= 1
  ) {
    return null;
  }

  return parsed;
}

function parseFiniteNumber(
  value:
    unknown
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

function parsePositiveNumber(
  value:
    unknown
): number | null {
  const parsed =
    Number(value);

  if (
    !Number.isFinite(
      parsed
    ) ||
    parsed <= 0
  ) {
    return null;
  }

  return parsed;
}

function parseNonNegativeNumber(
  value:
    unknown
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
    parsed < 0
  ) {
    return null;
  }

  return parsed;
}

function normalizeWarnings(
  value:
    unknown
): string[] {
  if (
    !Array.isArray(
      value
    )
  ) {
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