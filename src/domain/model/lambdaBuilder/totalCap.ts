import type {
  LimitedLambdas
} from "./types";

import {
  MAX_TOTAL_LAMBDA
} from "./constants";

/* ==========================================
   LIMITE SUPERIOR DO TOTAL
========================================== */

export function applyUpperTotalLimit(
  lambdaHome: number,
  lambdaAway: number,
  fallbackHome: number,
  fallbackAway: number
): LimitedLambdas {
  const total =
    lambdaHome +
    lambdaAway;

  if (
    !Number.isFinite(
      total
    ) ||
    total <= 0
  ) {
    return {
      home:
        fallbackHome,

      away:
        fallbackAway
    };
  }

  if (
    total <=
    MAX_TOTAL_LAMBDA
  ) {
    return {
      home:
        lambdaHome,

      away:
        lambdaAway
    };
  }

  const reductionFactor =
    MAX_TOTAL_LAMBDA /
    total;

  return {
    home:
      lambdaHome *
      reductionFactor,

    away:
      lambdaAway *
      reductionFactor
  };
}
