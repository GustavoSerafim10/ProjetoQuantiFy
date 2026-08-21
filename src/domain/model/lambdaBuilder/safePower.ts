import {
  clamp
} from "./numericHelpers";

import {
  DOMINANCE_ELASTICITY
} from "./constants";

/* ==========================================
   POTÊNCIA SEGURA
========================================== */

export function calculateDominanceFactor(
  ownAttackStrength: number,
  opponentAttackStrength: number,
  opponentDefensiveFragility: number,
  ownDefensiveFragility: number
): number {
  const offensiveRatio =
    ownAttackStrength /
    Math.max(
      opponentAttackStrength,
      0.01
    );

  const matchupRatio =
    opponentDefensiveFragility /
    Math.max(
      ownDefensiveFragility,
      0.01
    );

  const combinedRatio =
    Math.sqrt(
      Math.max(
        offensiveRatio *
        matchupRatio,
        0.01
      )
    );

  return clamp(
    safePower(
      combinedRatio,
      DOMINANCE_ELASTICITY
    ),
    0.88,
    1.12
  );
}

export function safePower(
  base: number,
  exponent: number
): number {
  if (
    !Number.isFinite(
      base
    ) ||
    !Number.isFinite(
      exponent
    ) ||
    base <= 0
  ) {
    return 1;
  }

  const result =
    Math.pow(
      base,
      exponent
    );

  return Number.isFinite(
    result
  )
    ? result
    : 1;
}
