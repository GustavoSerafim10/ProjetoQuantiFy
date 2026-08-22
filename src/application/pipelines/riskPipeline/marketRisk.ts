import {
  calculateRiskScoreDetailed
} from "../../../domain/risk/riskScore";

import type {
  RiskComponent,
  RiskPipelineMarketDebug,
  ResolvedNumber,
  MonteCarloMetadata
} from "./types";

import { normalizeMarketName, getMarketType } from "./marketCode";

import {
  extractMarketSamplingError,
  extractMarketModelSimulationDivergence
} from "./uncertaintyExtraction";

import { addMarketFragilityComponents } from "./fragility";
import { addUncertaintyComponents } from "./uncertainty";
import { addSimulationQualityComponents } from "./simulationQuality";
import { addMarketDisagreementComponents } from "./divergence";
import { addCorrelationComponent } from "./correlation";
import { sumComponentsByCategory } from "./componentSummary";
import { createInvalidMarketRisk } from "./invalidResults";

import { STRUCTURE_THRESHOLDS } from "./policy";

import {
  normalizeWarnings,
  parseProbability,
  parseOdd,
  clamp,
  clampProbability,
  roundNumber,
  roundNullableNumber
} from "./helpers";

import type { PipelineRecord } from "../pipelineRecord";

/* ==========================================
   CÁLCULO POR MERCADO
========================================== */

export function calculateMarketRisk({
  market,
  data,

  lambdaHome,
  lambdaAway,

  totalLambda,
  lambdaDifference,
  minimumLambda,

  leagueAvgGoals,
  recentGoalStd,
  seasonGoalAvg,
  dataQualityScore,
  dataQualitySource,

  goalExpectationScore,

  globalSamplingError,

  globalModelSimulationDivergence,

  monteCarloMetadata
}: {
  market: PipelineRecord;
  data: PipelineRecord;

  lambdaHome: number;
  lambdaAway: number;

  totalLambda: number;
  lambdaDifference: number;
  minimumLambda: number;

  leagueAvgGoals: number | null;
  recentGoalStd: number | null;
  seasonGoalAvg: number | null;
  dataQualityScore: number | null;
  dataQualitySource: string;

  goalExpectationScore:
    number | null;

  globalSamplingError:
    ResolvedNumber;

  globalModelSimulationDivergence:
    ResolvedNumber;

  monteCarloMetadata:
    MonteCarloMetadata;
}): {
  valid: boolean;
  market: PipelineRecord;
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

  const existingWarnings =
    normalizeWarnings(
      market?.warnings
    );

  const marketSamplingError =
    extractMarketSamplingError({
      data,
      market,
      marketName,
      fallback:
        globalSamplingError
    });

  const marketModelSimulationDivergence =
    extractMarketModelSimulationDivergence({
      data,
      market,
      marketName,
      fallback:
        globalModelSimulationDivergence
    });

  const samplingError =
    marketSamplingError.value;

  const modelSimulationDivergence =
    marketModelSimulationDivergence.value;

  /*
   * Mercados não reconhecidos não devem
   * receber risco aparentemente válido.
   */
  if (
    marketType === "OTHER"
  ) {
    return createInvalidMarketRisk({
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

      warnings: [
        ...existingWarnings,
        "UNSUPPORTED_RISK_MARKET"
      ],

      error:
        "UNSUPPORTED_RISK_MARKET"
    });
  }

  if (
    probability === null
  ) {
    return createInvalidMarketRisk({
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

      warnings: [
        ...existingWarnings,
        "INVALID_MARKET_PROBABILITY_FOR_RISK"
      ],

      error:
        "INVALID_MARKET_PROBABILITY_FOR_RISK"
    });
  }

  /*
   * O risco-base estatístico não conhece:
   *
   * - mercado;
   * - odd;
   * - EV;
   * - correlação;
   * - contexto operacional.
   */
  const baseRiskDetails =
    calculateRiskScoreDetailed({
      lambdaHome,
      lambdaAway,

      eventProbability:
        probability,

      leagueAvgGoals,

      recentGoalStd,

      seasonGoalAvg,

      dataQualityScore
    });

  if (!baseRiskDetails.valid) {
    return createInvalidMarketRisk({
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

      warnings: [
        ...existingWarnings,
        ...baseRiskDetails
          .debug
          .warnings,
        "INVALID_STATISTICAL_BASE_RISK"
      ],

      error:
        "INVALID_STATISTICAL_BASE_RISK",

      baseRiskDetails
    });
  }

  const baseRisk =
    baseRiskDetails.risk;

  const impliedProbability =
    odd !== null
      ? clampProbability(
          1 /
          odd
        )
      : null;

  const probabilityEdge =
    impliedProbability !== null
      ? (
          probability -
          impliedProbability
        )
      : null;

  /*
   * A divergência utilizada como risco é
   * absoluta.
   *
   * A direção continua preservada em
   * probabilityEdge para diagnóstico.
   */
  const absoluteMarketDisagreement =
    probabilityEdge !== null
      ? Math.abs(
          probabilityEdge
        )
      : null;

  const components:
    RiskComponent[] = [];

  addMarketFragilityComponents({
    components,

    marketType,

    data,

    probability,

    totalLambda,
    lambdaDifference,

    goalExpectationScore
  });

  addUncertaintyComponents({
    components,

    samplingError,

    modelSimulationDivergence,

    goalExpectationScore
  });

  addSimulationQualityComponents({
    components,
    metadata:
      monteCarloMetadata
  });

  addMarketDisagreementComponents({
    components,

    probability,

    odd,

    impliedProbability,

    probabilityEdge,

    absoluteMarketDisagreement
  });

  /*
   * O correlationEngine deve produzir apenas:
   *
   * correlationPenalty
   * correlationBoost
   * correlationNet
   *
   * O risco é modificado uma única vez aqui.
   */
  addCorrelationComponent({
    components,
    market
  });

  const contextualAdjustment =
    sumComponentsByCategory(
      components,
      "CONTEXT"
    );

  const uncertaintyAdjustment =
    sumComponentsByCategory(
      components,
      "UNCERTAINTY"
    );

  const simulationQualityAdjustment =
    sumComponentsByCategory(
      components,
      "SIMULATION_QUALITY"
    );

  const marketDisagreementAdjustment =
    sumComponentsByCategory(
      components,
      "MARKET_DISAGREEMENT"
    );

  const correlationAdjustment =
    sumComponentsByCategory(
      components,
      "CORRELATION"
    );

  const rawTotalAdjustment =
    components.reduce(
      (
        total,
        component
      ) =>
        total +
        component.adjustment,

      0
    );

  /*
   * Proteção contra concentração excessiva de
   * ajustes no pipeline.
   *
   * O risco-base continua sendo a autoridade
   * estatística principal.
   */
  const totalAdjustment =
    clamp(
      rawTotalAdjustment,

      STRUCTURE_THRESHOLDS
        .maximumNegativePipelineAdjustment,

      STRUCTURE_THRESHOLDS
        .maximumPositivePipelineAdjustment
    );

  const unclampedRisk =
    baseRisk +
    totalAdjustment;

  const finalRisk =
    clamp(
      unclampedRisk,

      STRUCTURE_THRESHOLDS
        .minimumRisk,

      STRUCTURE_THRESHOLDS
        .maximumRisk
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
      ...existingWarnings,

      ...baseRiskDetails
        .debug
        .warnings,

      ...componentWarnings
    ]);

  const debug:
    RiskPipelineMarketDebug = {
      valid:
        true,

      marketName,

      marketType,

      probability:
        roundNumber(
          probability
        ),

      odd:
        roundNullableNumber(
          odd
        ),

      impliedProbability:
        roundNullableNumber(
          impliedProbability
        ),

      probabilityEdge:
        roundNullableNumber(
          probabilityEdge
        ),

      absoluteMarketDisagreement:
        roundNullableNumber(
          absoluteMarketDisagreement
        ),

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

      simulationQualityAdjustment:
        roundNumber(
          simulationQualityAdjustment
        ),

      marketDisagreementAdjustment:
        roundNumber(
          marketDisagreementAdjustment
        ),

      correlationAdjustment:
        roundNumber(
          correlationAdjustment
        ),

      totalAdjustment:
        roundNumber(
          totalAdjustment
        ),

      unclampedRisk:
        roundNumber(
          unclampedRisk
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

      goalExpectationScore:
        roundNullableNumber(
          goalExpectationScore
        ),

      samplingError:
        roundNullableNumber(
          samplingError
        ),

      samplingErrorSource:
        marketSamplingError.source,

      modelSimulationDivergence:
        roundNullableNumber(
          modelSimulationDivergence
        ),

      divergenceSource:
        marketModelSimulationDivergence.source,

      dataQualitySource,

      monteCarloValid:
        monteCarloMetadata.valid,

      monteCarloConverged:
        monteCarloMetadata.converged,

      simulationQuality:
        monteCarloMetadata.simulationQuality,

      baseRiskDetails,

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
      true,

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
