import {
  type RiskScoreResult
} from "../../../domain/risk/riskScore";

import type {
  RiskMarketType,
  RiskPipelineMarketDebug,
  RiskPipelineDebug
} from "./types";

import {
  normalizeWarnings,
  roundNumber,
  roundNullableNumber
} from "./helpers";

import type { PipelineRecord } from "../pipelineRecord";

/* ==========================================
   RESULTADO INVÁLIDO DO MERCADO
========================================== */

export function createInvalidMarketRisk({
  market,

  marketName,
  marketType,

  probability,
  odd,

  lambdaHome,
  lambdaAway,
  totalLambda,
  lambdaDifference,
  minimumLambda,

  goalExpectationScore,
  samplingError,
  modelSimulationDivergence,

  warnings,
  error,

  baseRiskDetails
}: {
  market: PipelineRecord;

  marketName: string;
  marketType: RiskMarketType;

  probability: number | null;
  odd: number | null;

  lambdaHome: number;
  lambdaAway: number;
  totalLambda: number;
  lambdaDifference: number;
  minimumLambda: number;

  goalExpectationScore:
    number | null;

  samplingError:
    number | null;

  modelSimulationDivergence:
    number | null;

  warnings:
    string[];

  error:
    string;

  baseRiskDetails?:
    RiskScoreResult;
}): {
  valid: false;
  market: PipelineRecord;
} {
  const finalWarnings =
    normalizeWarnings(
      warnings
    );

  const fallbackBaseRiskDetails =
    baseRiskDetails ??
    createUnavailableBaseRiskDetails();

  const debug:
    RiskPipelineMarketDebug = {
      valid:
        false,

      marketName,

      marketType,

      probability:
        roundNullableNumber(
          probability
        ),

      odd:
        roundNullableNumber(
          odd
        ),

      impliedProbability:
        odd !== null
          ? roundNumber(
              1 /
              odd
            )
          : null,

      probabilityEdge:
        null,

      absoluteMarketDisagreement:
        null,

      baseRisk:
        0.95,

      contextualAdjustment:
        0,

      uncertaintyAdjustment:
        0,

      simulationQualityAdjustment:
        0,

      marketDisagreementAdjustment:
        0,

      correlationAdjustment:
        0,

      totalAdjustment:
        0,

      unclampedRisk:
        0.95,

      finalRisk:
        0.95,

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

      goalExpectationScore:
        roundNullableNumber(
          goalExpectationScore
        ),

      samplingError:
        roundNullableNumber(
          samplingError
        ),

      samplingErrorSource:
        "unavailable",

      modelSimulationDivergence:
        roundNullableNumber(
          modelSimulationDivergence
        ),

      divergenceSource:
        "unavailable",

      dataQualitySource:
        "unavailable",

      monteCarloValid:
        null,

      monteCarloConverged:
        null,

      simulationQuality:
        null,

      baseRiskDetails:
        fallbackBaseRiskDetails,

      components:
        [],

      warnings:
        finalWarnings,

      error
    };

  return {
    valid:
      false,

    market: {
      ...market,

      risk:
        0.95,

      riskScore:
        0.95,

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
   RESULTADO INVÁLIDO DO PIPELINE
========================================== */

export function createInvalidPipelineResult({
  data,
  inputMarkets,
  lambdaHome,
  lambdaAway,
  error
}: {
  data: PipelineRecord;
  inputMarkets: PipelineRecord[];
  lambdaHome: number | null;
  lambdaAway: number | null;
  error: string;
}) {
  const markets =
    inputMarkets.map(
      (market: PipelineRecord) => {
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
            0.95,

          riskScore:
            0.95,

          warnings,

          debug: {
            ...(market?.debug ?? {}),

            riskPipeline: {
              valid:
                false,

              error,

              finalRisk:
                0.95,

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

      version:
        "V7.2_ELITE",

      inputMarkets:
        inputMarkets.length,

      outputMarkets:
        markets.length,

      validMarkets:
        0,

      invalidMarkets:
        markets.length,

      lambdaHome:
        roundNullableNumber(
          lambdaHome
        ),

      lambdaAway:
        roundNullableNumber(
          lambdaAway
        ),

      totalLambda:
        null,

      lambdaDifference:
        null,

      leagueAvgGoals:
        null,

      recentGoalStd:
        null,

      seasonGoalAvg:
        null,

      dataQualityScore:
        null,

      dataQualitySource:
        "unavailable",

      samplingError:
        null,

      samplingErrorSource:
        "unavailable",

      modelSimulationDivergence:
        null,

      divergenceSource:
        "unavailable",

      monteCarloValid:
        null,

      monteCarloConverged:
        null,

      simulationQuality:
        null,

      error,

      note:
        "Risk is consolidated once from statistical base risk, market fragility, uncertainty, market disagreement and correlation."
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
   RESULTADO-BASE INDISPONÍVEL
========================================== */

export function createUnavailableBaseRiskDetails():
  RiskScoreResult {
  return {
    valid:
      false,

    risk:
      0.95,

    riskScore:
      0.95,

    components: {
      eventLossRisk:
        1,

      goalDispersionRisk:
        1,

      volatilityRisk:
        1,

      lambdaAnomalyRisk:
        1,

      dataQualityRisk:
        1
    },

    weightedComponents: {
      eventLossRisk:
        0,

      goalDispersionRisk:
        0,

      volatilityRisk:
        0,

      lambdaAnomalyRisk:
        0,

      dataQualityRisk:
        0
    },

    weights: {
      eventLossRisk:
        0,

      goalDispersionRisk:
        0,

      volatilityRisk:
        0,

      lambdaAnomalyRisk:
        0,

      dataQualityRisk:
        0
    },

    debug: {
      valid:
        false,

      lambdaHome:
        null,

      lambdaAway:
        null,

      totalLambda:
        null,

      eventProbability:
        null,

      leagueAvgGoals:
        null,

      recentGoalStd:
        null,

      seasonGoalAvg:
        null,

      dataQualityScore:
        null,

      expectedGoalStd:
        null,

      volatilityRatio:
        null,

      lambdaToLeagueRatio:
        null,

      missingFields:
        [],

      warnings: [
        "BASE_RISK_DETAILS_UNAVAILABLE"
      ],

      error:
        "BASE_RISK_DETAILS_UNAVAILABLE"
    }
  };
}
