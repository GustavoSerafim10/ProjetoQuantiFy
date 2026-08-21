import type { DecisionClassification } from "./types";

import { GLOBAL_POLICY } from "./marketPolicies";

import { clamp, roundNumber } from "./helpers";

/* ==========================================
   STAKE
========================================== */

/*
 * O stake é apenas uma sugestão.
 *
 * A execução real deve ser confirmada fora
 * do decisionPipeline.
 */
export function calculateDecisionStake({
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

export function calculateKellyFraction(
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
