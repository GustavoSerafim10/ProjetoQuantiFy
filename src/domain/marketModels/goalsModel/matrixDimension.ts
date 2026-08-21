import { MIN_MAX_GOALS, MAX_MAX_GOALS } from "./constants";
import { clamp } from "./numericHelpers";

/* ==========================================
   DIMENSÃO DINÂMICA
========================================== */

export function calculateMaxGoals(
  lambdaHome: number,
  lambdaAway: number
): number {
  const maximumLambda =
    Math.max(
      lambdaHome,
      lambdaAway
    );

  /*
   * Cauda conservadora:
   * média + 6 desvios-padrão.
   */
  const estimatedLimit =
    Math.ceil(
      maximumLambda +
      6 * Math.sqrt(maximumLambda)
    );

  return Math.round(
    clamp(
      estimatedLimit,
      MIN_MAX_GOALS,
      MAX_MAX_GOALS
    )
  );
}
