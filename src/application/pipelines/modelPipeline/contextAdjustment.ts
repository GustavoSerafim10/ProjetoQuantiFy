import {
  clamp,
  safeNumber
} from "./numericHelpers";

import {
  isObjectRecord
} from "./objectHelpers";

/* ==========================================
   AJUSTE CONTEXTUAL
========================================== */

export function applyBoundedContextAdjustment(
  baseLambdaHome: number,
  baseLambdaAway: number,
  contextAdjusted: unknown
) {
  const MIN_CONTEXT_FACTOR =
    0.92;

  const MAX_CONTEXT_FACTOR =
    1.08;

  const adjusted =
    isObjectRecord(
      contextAdjusted
    )
      ? contextAdjusted
      : {};

  const proposedHome =
    safeNumber(
      adjusted.lambdaHome,
      baseLambdaHome
    );

  const proposedAway =
    safeNumber(
      adjusted.lambdaAway,
      baseLambdaAway
    );

  const lambdaHome =
    clamp(
      proposedHome,
      baseLambdaHome *
        MIN_CONTEXT_FACTOR,
      baseLambdaHome *
        MAX_CONTEXT_FACTOR
    );

  const lambdaAway =
    clamp(
      proposedAway,
      baseLambdaAway *
        MIN_CONTEXT_FACTOR,
      baseLambdaAway *
        MAX_CONTEXT_FACTOR
    );

  return {
    lambdaHome,
    lambdaAway,

    minContextFactor:
      MIN_CONTEXT_FACTOR,

    maxContextFactor:
      MAX_CONTEXT_FACTOR
  };
}
