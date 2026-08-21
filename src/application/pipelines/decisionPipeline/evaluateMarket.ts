import type {
  DecisionContextMetrics,
  EvaluatedDecisionMarket,
  DecisionClassification,
  DecisionMarketDebug
} from "./types";

import {
  firstFiniteNumber,
  firstProbability,
  parseProbability,
  parseOdd,
  parseFiniteNumber,
  parseNonNegativeNumber,
  normalizeWarnings,
  roundNumber
} from "./helpers";

import { resolveMarketPolicy } from "./marketPolicies";

import { evaluateDecisionGuards } from "./guards";

import { evaluateOperationalPolicy } from "./operationalPolicy";

import { classifyMarket, buildThresholdDiagnostics } from "./classification";

import { capClassification } from "./classificationLimiter";

import { calculateDecisionStake, calculateKellyFraction } from "./stake";

import { getClassificationPriority } from "./ranking";

import { parseDecisionMarket } from "./marketCode";

/* ==========================================
   AVALIAÇÃO DO MERCADO
========================================== */

export function evaluateMarket(
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
      ? resolveMarketPolicy(
          marketName,
          data?.marketPolicyOverrides
        )
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

    evFloorOverride:
      Number.isFinite(data?.evFloor)
        ? Number(data.evFloor)
        : 0,

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
