import {
  calculateRiskScore
} from "../../domain/risk/riskScore";

/* ==========================================
   RISK PIPELINE — QUANTIFY V7
========================================== */

/*
 * Responsabilidade:
 *
 * - receber os mercados já precificados;
 * - calcular o risco-base oficial;
 * - incorporar risco estrutural do contexto;
 * - incorporar incerteza estatística;
 * - incorporar correlationNet uma única vez;
 * - produzir risk e riskScore finais;
 * - registrar os componentes do risco.
 *
 * Este arquivo não:
 *
 * - recalcula probabilidades;
 * - altera EV;
 * - altera confiança;
 * - seleciona mercados;
 * - classifica entradas;
 * - toma a decisão final.
 */

/* ==========================================
   CONTRATOS
========================================== */

export type RiskMarketType =
  | "RESULT"
  | "DOUBLE_CHANCE"
  | "OVER_1_5"
  | "OVER_2_5"
  | "BTTS_YES"
  | "BTTS_NO"
  | "OTHER";

export interface RiskComponent {
  source: string;
  adjustment: number;
  warning?: string;
}

export interface RiskPipelineMarketDebug {
  valid: boolean;

  marketType:
    RiskMarketType;

  baseRisk: number;

  contextualAdjustment: number;
  uncertaintyAdjustment: number;
  correlationAdjustment: number;

  totalAdjustment: number;
  finalRisk: number;

  lambdaHome: number;
  lambdaAway: number;
  totalLambda: number;
  lambdaDifference: number;
  minimumLambda: number;

  components:
    RiskComponent[];

  warnings:
    string[];
}

export interface RiskPipelineDebug {
  valid: boolean;

  inputMarkets: number;
  outputMarkets: number;
  invalidMarkets: number;

  lambdaHome: number | null;
  lambdaAway: number | null;

  totalLambda: number | null;
  lambdaDifference: number | null;

  error?: string;

  note:
    "Risk is consolidated once from base risk, contextual structure, uncertainty and correlation.";
}

/* ==========================================
   CONFIGURAÇÃO PROVISÓRIA
========================================== */

/*
 * Estes valores preservam aproximadamente a
 * política operacional já existente.
 *
 * Eles devem futuramente ser validados por:
 *
 * - Brier Score;
 * - erro por mercado;
 * - drawdown;
 * - ROI;
 * - backtest fora da amostra.
 *
 * Enquanto não houver validação histórica,
 * ficam centralizados e auditáveis.
 */

const RISK_POLICY = {
  balancedResult:
    0.06,

  balancedDoubleChance:
    0.035,

  balancedBttsNo:
    0.035,

  lowGoalOver:
    0.07,

  veryLowGoalScoreOver:
    0.08,

  moderateGoalScoreOver:
    0.04,

  lowGoalScoreBttsYes:
    0.04,

  highGoalScoreBttsNo:
    0.04,

  highTotalLambdaSupportsOver:
    -0.04,

  highTotalLambdaBttsNo:
    0.05,

  highProbabilityLowOdd:
    0.035,

  highSamplingError:
    0.04,

  moderateSamplingError:
    0.02,

  highModelDivergence:
    0.05,

  moderateModelDivergence:
    0.025
} as const;

/* ==========================================
   LIMITES ESTRUTURAIS
========================================== */

const STRUCTURE_THRESHOLDS = {
  balancedLambdaDifference:
    0.25,

  lowGoalScore:
    0.45,

  moderateGoalScore:
    0.55,

  lowGoalScoreBtts:
    0.50,

  highGoalScoreBttsNo:
    0.65,

  highTotalLambda:
    3.20,

  highProbability:
    0.84,

  lowOdd:
    1.45,

  moderateSamplingError:
    0.006,

  highSamplingError:
    0.010,

  moderateModelDivergence:
    0.05,

  highModelDivergence:
    0.10
} as const;

/* ==========================================
   PIPELINE
========================================== */

export function riskPipeline(
  data: any
) {
  const inputMarkets =
    Array.isArray(data?.markets)
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

  /*
   * Sem lambdas oficiais não devemos inventar
   * risco com valores como 1.20 ou 1.00.
   */
  if (
    lambdaHome === null ||
    lambdaAway === null
  ) {
    return createInvalidPipelineResult(
      data,
      inputMarkets,
      lambdaHome,
      lambdaAway,
      "INVALID_PIPELINE_LAMBDAS"
    );
  }

  const totalLambda =
    lambdaHome +
    lambdaAway;

  const lambdaDifference =
    Math.abs(
      lambdaHome -
      lambdaAway
    );

  const minimumLambda =
    Math.min(
      lambdaHome,
      lambdaAway
    );

  const goalExpectationScore =
    parseProbability(
      data?.goalExpectationScore
    );

  const samplingError =
    extractSamplingError(
      data
    );

  const modelDivergence =
    extractModelDivergence(
      data
    );

  let invalidMarkets =
    0;

  const markets =
    inputMarkets.map(
      (market: any) => {
        const result =
          calculateMarketRisk({
            market,

            data,

            lambdaHome,
            lambdaAway,

            totalLambda,
            lambdaDifference,
            minimumLambda,

            goalExpectationScore,
            samplingError,
            modelDivergence
          });

        if (!result.valid) {
          invalidMarkets++;
        }

        return result.market;
      }
    );

  const pipelineValid =
    markets.length > 0 &&
    invalidMarkets <
      markets.length;

  const debug:
    RiskPipelineDebug = {
      valid:
        pipelineValid,

      inputMarkets:
        inputMarkets.length,

      outputMarkets:
        markets.length,

      invalidMarkets,

      lambdaHome:
        roundNumber(
          lambdaHome
        ),

      lambdaAway:
        roundNumber(
          lambdaAway
        ),

      totalLambda:
        roundNumber(
          totalLambda
        ),

      lambdaDifference:
        roundNumber(
          lambdaDifference
        ),

      ...(
        pipelineValid
          ? {}
          : {
              error:
                "NO_VALID_RISK_MARKETS"
            }
      ),

      note:
        "Risk is consolidated once from base risk, contextual structure, uncertainty and correlation."
    };

  return {
    ...data,

    riskValid:
      pipelineValid,

    markets,

    debug: {
      ...(data?.debug ?? {}),

      riskPipeline:
        debug
    }
  };
}

/* ==========================================
   CÁLCULO POR MERCADO
========================================== */

function calculateMarketRisk({
  market,
  data,

  lambdaHome,
  lambdaAway,

  totalLambda,
  lambdaDifference,
  minimumLambda,

  goalExpectationScore,
  samplingError,
  modelDivergence
}: {
  market: any;
  data: any;

  lambdaHome: number;
  lambdaAway: number;

  totalLambda: number;
  lambdaDifference: number;
  minimumLambda: number;

  goalExpectationScore: number | null;
  samplingError: number | null;
  modelDivergence: number | null;
}): {
  valid: boolean;
  market: any;
} {
  const marketName =
    normalizeMarketName(
      market?.market
    );

  const marketType =
    getMarketType(
      marketName
    );

  const probability =
    parseProbability(
      market?.probability
    );

  const odd =
    parseOdd(
      market?.odd
    );

  const warnings =
    normalizeWarnings(
      market?.warnings
    );

  /*
   * Uma probabilidade inválida impede o
   * cálculo confiável de risco.
   */
  if (probability === null) {
    const invalidWarnings =
      normalizeWarnings([
        ...warnings,
        "INVALID_MARKET_PROBABILITY_FOR_RISK"
      ]);

    return {
      valid: false,

      market: {
        ...market,

        risk:
          1,

        riskScore:
          1,

        warnings:
          invalidWarnings,

        debug: {
          ...(market?.debug ?? {}),

          riskPipeline: {
            valid:
              false,

            marketType,

            baseRisk:
              1,

            contextualAdjustment:
              0,

            uncertaintyAdjustment:
              0,

            correlationAdjustment:
              0,

            totalAdjustment:
              0,

            finalRisk:
              1,

            lambdaHome,
            lambdaAway,
            totalLambda,
            lambdaDifference,
            minimumLambda,

            components:
              [],

            warnings:
              invalidWarnings
          } satisfies RiskPipelineMarketDebug
        }
      }
    };
  }

  const leagueAvgGoals =
    parsePositiveNumber(
      data?.leagueAvgGoals
    );

  const recentGoalStd =
    parseNonNegativeNumber(
      data?.recentGoalStd
    );

  const seasonGoalAvg =
    parsePositiveNumber(
      data?.seasonGoalAvg
    );

  /*
   * Mantemos compatibilidade com o contrato
   * atual do calculateRiskScore.
   *
   * Os fallbacks abaixo são utilizados apenas
   * para variáveis auxiliares do risco, não para
   * reconstruir lambdas.
   */
  const rawBaseRisk =
    calculateRiskScore({
      lambdaHome,
      lambdaAway,

      leagueAvgGoals:
        leagueAvgGoals ??
        totalLambda / 2,

      eventProbability:
        probability,

      recentGoalStd:
        recentGoalStd ??
        0,

      seasonGoalAvg:
        seasonGoalAvg ??
        totalLambda / 2
    });

  const parsedBaseRisk =
    parseProbability(
      rawBaseRisk
    );

  const baseRisk =
    parsedBaseRisk ??
    1;

  const components:
    RiskComponent[] = [];

  addContextualComponents({
    components,

    marketType,

    data,

    probability,
    odd,

    totalLambda,
    lambdaDifference,

    goalExpectationScore
  });

  addUncertaintyComponents({
    components,

    samplingError,
    modelDivergence
  });

  /*
   * O correlationEngine deve produzir apenas:
   *
   * correlationPenalty
   * correlationBoost
   * correlationNet
   *
   * O risco é alterado somente aqui.
   */
  addCorrelationComponent({
    components,
    market
  });

  const contextualAdjustment =
    sumComponentsByPrefix(
      components,
      "CONTEXT_"
    );

  const uncertaintyAdjustment =
    sumComponentsByPrefix(
      components,
      "UNCERTAINTY_"
    );

  const correlationAdjustment =
    sumComponentsByPrefix(
      components,
      "CORRELATION_"
    );

  const totalAdjustment =
    components.reduce(
      (
        total,
        component
      ) =>
        total +
        component.adjustment,

      0
    );

  const finalRisk =
    clampProbability(
      baseRisk +
      totalAdjustment
    );

  const componentWarnings =
    components
      .map(
        component =>
          component.warning
      )
      .filter(
        (
          warning
        ): warning is string =>
          Boolean(warning)
      );

  const finalWarnings =
    normalizeWarnings([
      ...warnings,
      ...componentWarnings
    ]);

  const debug:
    RiskPipelineMarketDebug = {
      valid:
        parsedBaseRisk !== null,

      marketType,

      baseRisk:
        roundNumber(
          baseRisk
        ),

      contextualAdjustment:
        roundNumber(
          contextualAdjustment
        ),

      uncertaintyAdjustment:
        roundNumber(
          uncertaintyAdjustment
        ),

      correlationAdjustment:
        roundNumber(
          correlationAdjustment
        ),

      totalAdjustment:
        roundNumber(
          totalAdjustment
        ),

      finalRisk:
        roundNumber(
          finalRisk
        ),

      lambdaHome:
        roundNumber(
          lambdaHome
        ),

      lambdaAway:
        roundNumber(
          lambdaAway
        ),

      totalLambda:
        roundNumber(
          totalLambda
        ),

      lambdaDifference:
        roundNumber(
          lambdaDifference
        ),

      minimumLambda:
        roundNumber(
          minimumLambda
        ),

      components:
        components.map(
          component => ({
            ...component,

            adjustment:
              roundNumber(
                component.adjustment
              )
          })
        ),

      warnings:
        finalWarnings
    };

  return {
    valid:
      parsedBaseRisk !== null,

    market: {
      ...market,

      risk:
        roundNumber(
          finalRisk
        ),

      riskScore:
        roundNumber(
          finalRisk
        ),

      warnings:
        finalWarnings,

      debug: {
        ...(market?.debug ?? {}),

        riskPipeline:
          debug
      }
    }
  };
}

/* ==========================================
   CONTEXTO DO MERCADO
========================================== */

function addContextualComponents({
  components,

  marketType,

  data,

  probability,
  odd,

  totalLambda,
  lambdaDifference,

  goalExpectationScore
}: {
  components: RiskComponent[];

  marketType: RiskMarketType;

  data: any;

  probability: number;
  odd: number | null;

  totalLambda: number;
  lambdaDifference: number;

  goalExpectationScore: number | null;
}) {
  if (
    Boolean(
      data?.isLowGoalGame
    ) &&
    (
      marketType ===
        "OVER_1_5" ||
      marketType ===
        "OVER_2_5"
    )
  ) {
    components.push({
      source:
        "CONTEXT_LOW_GOAL_GAME_OVER",

      adjustment:
        RISK_POLICY.lowGoalOver,

      warning:
        "LOW_GOAL_GAME_OVER_RISK"
    });
  }

  if (
    goalExpectationScore !== null
  ) {
    if (
      marketType ===
        "OVER_1_5" ||
      marketType ===
        "OVER_2_5"
    ) {
      if (
        goalExpectationScore <
        STRUCTURE_THRESHOLDS.lowGoalScore
      ) {
        components.push({
          source:
            "CONTEXT_VERY_LOW_GOAL_SCORE_OVER",

          adjustment:
            RISK_POLICY
              .veryLowGoalScoreOver,

          warning:
            "LOW_GOAL_SCORE_OVER_RISK"
        });
      } else if (
        goalExpectationScore <
        STRUCTURE_THRESHOLDS
          .moderateGoalScore
      ) {
        components.push({
          source:
            "CONTEXT_MODERATE_GOAL_SCORE_OVER",

          adjustment:
            RISK_POLICY
              .moderateGoalScoreOver,

          warning:
            "MODERATE_GOAL_SCORE_OVER_RISK"
        });
      }
    }

    if (
      marketType ===
        "BTTS_YES" &&
      goalExpectationScore <
        STRUCTURE_THRESHOLDS
          .lowGoalScoreBtts
    ) {
      components.push({
        source:
          "CONTEXT_LOW_GOAL_SCORE_BTTS_YES",

        adjustment:
          RISK_POLICY
            .lowGoalScoreBttsYes,

        warning:
          "LOW_GOAL_SCORE_BTTS_YES_RISK"
      });
    }

    if (
      marketType ===
        "BTTS_NO" &&
      goalExpectationScore >
        STRUCTURE_THRESHOLDS
          .highGoalScoreBttsNo
    ) {
      components.push({
        source:
          "CONTEXT_HIGH_GOAL_SCORE_BTTS_NO",

        adjustment:
          RISK_POLICY
            .highGoalScoreBttsNo,

        warning:
          "HIGH_GOAL_SCORE_BTTS_NO_RISK"
      });
    }
  }

  if (
    lambdaDifference <
    STRUCTURE_THRESHOLDS
      .balancedLambdaDifference
  ) {
    if (
      marketType ===
      "RESULT"
    ) {
      components.push({
        source:
          "CONTEXT_BALANCED_RESULT",

        adjustment:
          RISK_POLICY
            .balancedResult,

        warning:
          "BALANCED_GAME_RESULT_RISK"
      });
    }

    if (
      marketType ===
      "DOUBLE_CHANCE"
    ) {
      components.push({
        source:
          "CONTEXT_BALANCED_DOUBLE_CHANCE",

        adjustment:
          RISK_POLICY
            .balancedDoubleChance,

        warning:
          "BALANCED_GAME_DOUBLE_RISK"
      });
    }

    if (
      marketType ===
      "BTTS_NO"
    ) {
      components.push({
        source:
          "CONTEXT_BALANCED_BTTS_NO",

        adjustment:
          RISK_POLICY
            .balancedBttsNo,

        warning:
          "BALANCED_GAME_BTTS_NO_RISK"
      });
    }
  }

  if (
    totalLambda >
    STRUCTURE_THRESHOLDS
      .highTotalLambda
  ) {
    if (
      marketType ===
        "OVER_1_5" ||
      marketType ===
        "OVER_2_5"
    ) {
      components.push({
        source:
          "CONTEXT_HIGH_TOTAL_LAMBDA_OVER",

        adjustment:
          RISK_POLICY
            .highTotalLambdaSupportsOver,

        warning:
          "HIGH_TOTAL_LAMBDA_SUPPORTS_OVER"
      });
    }

    if (
      marketType ===
      "BTTS_NO"
    ) {
      components.push({
        source:
          "CONTEXT_HIGH_TOTAL_LAMBDA_BTTS_NO",

        adjustment:
          RISK_POLICY
            .highTotalLambdaBttsNo,

        warning:
          "HIGH_TOTAL_LAMBDA_BTTS_NO_RISK"
      });
    }
  }

  /*
   * Alta probabilidade em odd baixa é sensível
   * a pequenos erros de estimação.
   *
   * O risco não invalida o EV; apenas registra
   * a fragilidade operacional.
   */
  if (
    odd !== null &&
    probability >
      STRUCTURE_THRESHOLDS
        .highProbability &&
    odd <
      STRUCTURE_THRESHOLDS
        .lowOdd
  ) {
    components.push({
      source:
        "CONTEXT_HIGH_PROBABILITY_LOW_ODD",

      adjustment:
        RISK_POLICY
          .highProbabilityLowOdd,

      warning:
        "HIGH_PROB_LOW_ODD_SENSITIVITY"
    });
  }
}

/* ==========================================
   INCERTEZA ESTATÍSTICA
========================================== */

function addUncertaintyComponents({
  components,
  samplingError,
  modelDivergence
}: {
  components: RiskComponent[];
  samplingError: number | null;
  modelDivergence: number | null;
}) {
  if (
    samplingError !== null
  ) {
    if (
      samplingError >=
      STRUCTURE_THRESHOLDS
        .highSamplingError
    ) {
      components.push({
        source:
          "UNCERTAINTY_HIGH_MONTE_CARLO_ERROR",

        adjustment:
          RISK_POLICY
            .highSamplingError,

        warning:
          "HIGH_MONTE_CARLO_SAMPLING_ERROR"
      });
    } else if (
      samplingError >=
      STRUCTURE_THRESHOLDS
        .moderateSamplingError
    ) {
      components.push({
        source:
          "UNCERTAINTY_MODERATE_MONTE_CARLO_ERROR",

        adjustment:
          RISK_POLICY
            .moderateSamplingError,

        warning:
          "MODERATE_MONTE_CARLO_SAMPLING_ERROR"
      });
    }
  }

  if (
    modelDivergence !== null
  ) {
    if (
      modelDivergence >=
      STRUCTURE_THRESHOLDS
        .highModelDivergence
    ) {
      components.push({
        source:
          "UNCERTAINTY_HIGH_MODEL_DIVERGENCE",

        adjustment:
          RISK_POLICY
            .highModelDivergence,

        warning:
          "HIGH_MODEL_PROBABILITY_DIVERGENCE"
      });
    } else if (
      modelDivergence >=
      STRUCTURE_THRESHOLDS
        .moderateModelDivergence
    ) {
      components.push({
        source:
          "UNCERTAINTY_MODERATE_MODEL_DIVERGENCE",

        adjustment:
          RISK_POLICY
            .moderateModelDivergence,

        warning:
          "MODERATE_MODEL_PROBABILITY_DIVERGENCE"
      });
    }
  }
}

/* ==========================================
   CORRELAÇÃO
========================================== */

function addCorrelationComponent({
  components,
  market
}: {
  components: RiskComponent[];
  market: any;
}) {
  const correlationNet =
    parseFiniteNumber(
      market?.correlationNet
    );

  if (
    correlationNet === null ||
    Math.abs(
      correlationNet
    ) <= 1e-9
  ) {
    return;
  }

  /*
   * Proteção contra um engine mal configurado.
   *
   * A correlação não pode dominar todo o risco.
   */
  const boundedAdjustment =
    clamp(
      correlationNet,
      -0.15,
      0.15
    );

  components.push({
    source:
      "CORRELATION_ENGINE_NET",

    adjustment:
      boundedAdjustment,

    warning:
      boundedAdjustment > 0
        ? "CORRELATION_INCREASES_RISK"
        : "CORRELATION_SUPPORTS_MARKET"
  });
}

/* ==========================================
   RESULTADO INVÁLIDO
========================================== */

function createInvalidPipelineResult(
  data: any,
  inputMarkets: any[],
  lambdaHome: number | null,
  lambdaAway: number | null,
  error: string
) {
  const markets =
    inputMarkets.map(
      (market: any) => {
        const warnings =
          normalizeWarnings([
            ...normalizeWarnings(
              market?.warnings
            ),

            "RISK_NOT_CALCULATED"
          ]);

        return {
          ...market,

          risk:
            1,

          riskScore:
            1,

          warnings,

          debug: {
            ...(market?.debug ?? {}),

            riskPipeline: {
              valid:
                false,

              error,

              finalRisk:
                1,

              warnings
            }
          }
        };
      }
    );

  const debug:
    RiskPipelineDebug = {
      valid:
        false,

      inputMarkets:
        inputMarkets.length,

      outputMarkets:
        markets.length,

      invalidMarkets:
        markets.length,

      lambdaHome,
      lambdaAway,

      totalLambda:
        null,

      lambdaDifference:
        null,

      error,

      note:
        "Risk is consolidated once from base risk, contextual structure, uncertainty and correlation."
    };

  return {
    ...data,

    riskValid:
      false,

    markets,

    debug: {
      ...(data?.debug ?? {}),

      riskPipeline:
        debug
    }
  };
}

/* ==========================================
   MERCADO
========================================== */

function normalizeMarketName(
  market: unknown
): string {
  return String(
    market ?? ""
  )
    .trim()
    .toUpperCase();
}

function getMarketType(
  market: string
): RiskMarketType {
  switch (market) {
    case "HOME":
    case "HOME_WIN":
    case "DRAW":
    case "AWAY":
    case "AWAY_WIN":
      return "RESULT";

    case "DOUBLE_CHANCE_1X":
    case "DOUBLE_CHANCE_X2":
    case "1X":
    case "X2":
      return "DOUBLE_CHANCE";

    case "OVER_1_5":
    case "OVER15":
      return "OVER_1_5";

    case "OVER_2_5":
    case "OVER25":
      return "OVER_2_5";

    case "BTTS_YES":
      return "BTTS_YES";

    case "BTTS_NO":
      return "BTTS_NO";

    default:
      return "OTHER";
  }
}

/* ==========================================
   EXTRAÇÃO DE INCERTEZA
========================================== */

function extractSamplingError(
  data: any
): number | null {
  const candidates = [
    data?.maxSamplingError,

    data?.simulation
      ?.maxSamplingError,

    data?.monteCarlo
      ?.maxSamplingError,

    data?.debug
      ?.simulationPipeline
      ?.maxSamplingError
  ];

  for (
    const candidate of candidates
  ) {
    const parsed =
      parseNonNegativeNumber(
        candidate
      );

    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
}

function extractModelDivergence(
  data: any
): number | null {
  const candidates = [
    data?.modelDivergence
      ?.maximum,

    data?.modelDivergence
      ?.average,

    data?.simulationDivergence
      ?.maximum,

    data?.simulationDivergence
      ?.average,

    data?.debug
      ?.simulationPipeline
      ?.divergence
      ?.maximum,

    data?.debug
      ?.simulationPipeline
      ?.divergence
      ?.average
  ];

  for (
    const candidate of candidates
  ) {
    const parsed =
      parseNonNegativeNumber(
        candidate
      );

    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
}

/* ==========================================
   HELPERS
========================================== */

function sumComponentsByPrefix(
  components: RiskComponent[],
  prefix: string
): number {
  return components
    .filter(
      component =>
        component.source
          .startsWith(
            prefix
          )
    )
    .reduce(
      (
        total,
        component
      ) =>
        total +
        component.adjustment,

      0
    );
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

function parsePositiveNumber(
  value: unknown
): number | null {
  const parsed =
    Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed <= 0
  ) {
    return null;
  }

  return parsed;
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

function parseFiniteNumber(
  value: unknown
): number | null {
  const parsed =
    Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
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

function clampProbability(
  value: number
): number {
  return clamp(
    value,
    0,
    1
  );
}

function clamp(
  value: number,
  minimum: number,
  maximum: number
): number {
  if (!Number.isFinite(value)) {
    return maximum;
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