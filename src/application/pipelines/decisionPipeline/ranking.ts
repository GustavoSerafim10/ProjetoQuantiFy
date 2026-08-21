import type { EvaluatedDecisionMarket } from "./types";

import { parsePositiveInteger, safeFiniteNumber } from "./helpers";

/* ==========================================
   ORDENAÇÃO
========================================== */

export function compareDecisionMarkets(
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

export function getClassificationPriority(
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
