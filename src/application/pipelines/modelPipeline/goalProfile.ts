import {
  clamp
} from "./numericHelpers";

/* ==========================================
   PERFIL DE GOLS
========================================== */

export function calculateGoalExpectationScore(
  lambdaHome: number,
  lambdaAway: number
): number {
  const totalLambda =
    lambdaHome +
    lambdaAway;

  const weakerLambda =
    Math.min(
      lambdaHome,
      lambdaAway
    );

  /*
   * Mede expectativa conjunta de gols.
   *
   * Não altera lambda, probabilidade ou EV.
   */
  const totalComponent =
    clamp(
      totalLambda /
        3.25,
      0,
      1
    );

  const bilateralComponent =
    clamp(
      weakerLambda /
        1.15,
      0,
      1
    );

  return clamp(
    totalComponent *
      0.75 +
    bilateralComponent *
      0.25,
    0,
    1
  );
}

export function classifyGoalProfile(
  lambdaHome: number,
  lambdaAway: number
):
  | "LOW_GOAL"
  | "OPEN_GOALS"
  | "FAVORITE_EDGE"
  | "BALANCED" {
  const total =
    lambdaHome +
    lambdaAway;

  const minimumLambda =
    Math.min(
      lambdaHome,
      lambdaAway
    );

  const difference =
    Math.abs(
      lambdaHome -
      lambdaAway
    );

  if (
    total < 1.85 ||
    (
      lambdaHome < 0.85 &&
      lambdaAway < 0.85
    )
  ) {
    return "LOW_GOAL";
  }

  if (
    total >= 2.75 &&
    minimumLambda >= 0.95
  ) {
    return "OPEN_GOALS";
  }

  if (
    difference >= 0.75
  ) {
    return "FAVORITE_EDGE";
  }

  return "BALANCED";
}
