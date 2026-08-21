import type {
  TeamStatsCompatibility,
  ContextualAttackFactors
} from "./types";

import {
  clamp,
  parseFiniteNumber
} from "./numericHelpers";

import {
  RECENT_FORM_MAX_ADJUSTMENT,
  VARIANCE_MAX_ADJUSTMENT,
  SHOT_QUALITY_MAX_ADJUSTMENT
} from "./constants";

/* ==========================================
   FATORES CONTEXTUAIS DE ATAQUE
   (parte de RESOLUÇÃO DAS FINALIZAÇÕES)
========================================== */

export function calculateRecentFormFactor({
  currentGoalsRate,
  recentGoalsPerGame,
  providedFactor
}: {
  currentGoalsRate: number;
  recentGoalsPerGame: number | null;
  providedFactor: number | null;
}): number {
  if (
    providedFactor !== null &&
    providedFactor > 0
  ) {
    return clamp(
      providedFactor,
      1 - RECENT_FORM_MAX_ADJUSTMENT,
      1 + RECENT_FORM_MAX_ADJUSTMENT
    );
  }

  if (
    recentGoalsPerGame === null ||
    currentGoalsRate <= 0
  ) {
    return 1;
  }

  const rawRatio =
    recentGoalsPerGame /
    currentGoalsRate;

  const compressed =
    1 +
    (
      rawRatio -
      1
    ) *
    0.35;

  return clamp(
    compressed,
    1 - RECENT_FORM_MAX_ADJUSTMENT,
    1 + RECENT_FORM_MAX_ADJUSTMENT
  );
}

export function calculateVarianceFactor(
  variance: number | null
): number {
  if (
    variance === null ||
    variance < 0
  ) {
    return 1;
  }

  const normalizedVariance =
    clamp(
      variance / 2.5,
      0,
      1
    );

  return (
    1 -
    normalizedVariance *
      VARIANCE_MAX_ADJUSTMENT
  );
}

export function calculateShotQualityFactor({
  goalsRate,
  shotsOnTarget,
  shots,
  bigChances,
  providedConversionRate
}: {
  goalsRate: number;
  shotsOnTarget: number | null;
  shots: number | null;
  bigChances: number | null;
  providedConversionRate: number | null;
}): {
  factor: number;
  conversionRate: number | null;
  valid: boolean;
} {
  const conversionRate =
    providedConversionRate !== null &&
    providedConversionRate >= 0
      ? providedConversionRate
      : shots !== null &&
        shots > 0
        ? goalsRate / shots
        : shotsOnTarget !== null &&
          shotsOnTarget > 0
          ? goalsRate /
            shotsOnTarget
          : null;

  const sotQuality =
    shotsOnTarget !== null
      ? clamp(
          shotsOnTarget / 5,
          0,
          1.6
        )
      : null;

  const bigChanceQuality =
    bigChances !== null
      ? clamp(
          bigChances / 2,
          0,
          1.6
        )
      : null;

  const conversionQuality =
    conversionRate !== null
      ? clamp(
          conversionRate / 0.12,
          0,
          1.6
        )
      : null;

  const components = [
    sotQuality,
    bigChanceQuality,
    conversionQuality
  ].filter(
    (
      value
    ): value is number =>
      value !== null
  );

  if (
    components.length === 0
  ) {
    return {
      factor: 1,
      conversionRate,
      valid: false
    };
  }

  const averageQuality =
    components.reduce(
      (
        sum,
        value
      ) =>
        sum +
        value,
      0
    ) /
    components.length;

  const compressed =
    1 +
    (
      averageQuality -
      1
    ) *
    SHOT_QUALITY_MAX_ADJUSTMENT;

  return {
    factor:
      clamp(
        compressed,
        1 - SHOT_QUALITY_MAX_ADJUSTMENT,
        1 + SHOT_QUALITY_MAX_ADJUSTMENT
      ),

    conversionRate,

    valid: true
  };
}

export function buildContextualAttackFactors({
  team,
  goalsRate,
  shotsOnTarget,
  shots,
  bigChances
}: {
  team: TeamStatsCompatibility;
  goalsRate: number;
  shotsOnTarget: number | null;
  shots: number | null;
  bigChances: number | null;
}): ContextualAttackFactors {
  const recentGoalsPerGame =
    parseFiniteNumber(
      team.recentGoalsPerGame
    );

  const providedRecentFormFactor =
    parseFiniteNumber(
      team.recentFormFactor
    );

  const goalVariance =
    parseFiniteNumber(
      team.goalVariance
    );

  const providedConversionRate =
    parseFiniteNumber(
      team.conversionRate
    );

  const recentFormFactor =
    calculateRecentFormFactor({
      currentGoalsRate:
        goalsRate,

      recentGoalsPerGame,

      providedFactor:
        providedRecentFormFactor
    });

  const varianceFactor =
    calculateVarianceFactor(
      goalVariance
    );

  const shotQuality =
    calculateShotQualityFactor({
      goalsRate,
      shotsOnTarget,
      shots,
      bigChances,
      providedConversionRate
    });

  return {
    recentFormFactor,
    varianceFactor,

    shotQualityFactor:
      shotQuality.factor,

    recentGoalsPerGame,
    goalVariance,
    bigChancesPerGame:
      bigChances,

    conversionRate:
      shotQuality.conversionRate,

    diagnostics: {
      recentFormAvailable:
        recentGoalsPerGame !== null ||
        providedRecentFormFactor !== null,

      varianceAvailable:
        goalVariance !== null,

      shotQualityAvailable:
        shotQuality.valid
    }
  };
}
