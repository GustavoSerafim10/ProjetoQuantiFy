import {
  type RawTeamStats,
  type SanitizedStats
} from "./types";

import {
  clamp,
  normalizePercent,
  normalizeStrings,
  parseNonNegativeNumber,
  resolveMatches,
  resolveOptionalNumber,
  safeNumber
} from "./numericHelpers";

import {
  resolveGoalsAgainstRate,
  resolveGoalsForRate
} from "./goalRates";

/* ==========================================
   SANITIZAÇÃO
========================================== */

export function sanitizeStats(
  rawStats: RawTeamStats = {},
  venue: "HOME" | "AWAY"
): SanitizedStats {
  const missingFields:
    string[] = [];

  const warnings:
    string[] = [];

  const matchesResult =
    resolveMatches(
      rawStats
    );

  const matches =
    matchesResult.value;

  const goalsForRateResult =
    resolveGoalsForRate(
      rawStats,
      venue,
      matches
    );

  const goalsAgainstRateResult =
    resolveGoalsAgainstRate(
      rawStats,
      venue,
      matches
    );

  /*
   * Totais permanecem como totais.
   *
   * Nunca atribuímos:
   *
   * goalsFor = goalsPerGame
   * goalsAgainst = goalsConcededPerGame
   */
  const goalsForTotal =
    parseNonNegativeNumber(
      rawStats.goalsFor
    );

  const goalsAgainstTotal =
    parseNonNegativeNumber(
      rawStats.goalsAgainst
    );

  const shotsResult =
    resolveOptionalNumber(
      [
        {
          value:
            rawStats.shotsPerGame,

          source:
            "shotsPerGame"
        },

        {
          value:
            rawStats.avgShots,

          source:
            "avgShots"
        },

        {
          value:
            rawStats.shotsPerMatch,

          source:
            "shotsPerMatch"
        },

        {
          value:
            rawStats.shots,

          source:
            "shots"
        }
      ],
      40
    );

  const shotsOnTargetResult =
    resolveOptionalNumber(
      [
        {
          value:
            rawStats.shotsOnTargetPerGame,

          source:
            "shotsOnTargetPerGame"
        },

        {
          value:
            rawStats.avgShotsOnTarget,

          source:
            "avgShotsOnTarget"
        },

        {
          value:
            rawStats.shotsOnTargetPerMatch,

          source:
            "shotsOnTargetPerMatch"
        },

        {
          value:
            rawStats.shotsOnTarget,

          source:
            "shotsOnTarget"
        }
      ],
      25
    );

  const shots =
    shotsResult.available
      ? shotsResult.value
      : undefined;

  const cornersResult =
    resolveOptionalNumber(
      [
        {
          value:
            rawStats.cornersAvg,

          source:
            "cornersAvg"
        },

        {
          value:
            rawStats.cornersPerGame,

          source:
            "cornersPerGame"
        }
      ],
      20
    );

  const cornersAvg =
    cornersResult.available
      ? cornersResult.value
      : undefined;

  const rawShotsOnTarget =
    shotsOnTargetResult.available
      ? shotsOnTargetResult.value
      : undefined;

  /*
   * Se chutes totais existirem, garantimos:
   *
   * shotsOnTarget <= shots.
   *
   * Se chutes totais estiverem ausentes,
   * preservamos chutes no alvo.
   *
   * Antes:
   *
   * Math.min(4, 0) = 0
   *
   * Agora:
   *
   * shots ausente + shotsOnTarget 4 = 4
   */
  const shotsOnTarget =
    rawShotsOnTarget === undefined
      ? undefined
      : shots !== undefined &&
          shots > 0
        ? Math.min(
            rawShotsOnTarget,
            shots
          )
        : rawShotsOnTarget;

  if (
    !matchesResult.available
  ) {
    missingFields.push(
      "matches"
    );
  }

  if (
    !goalsForRateResult.available
  ) {
    missingFields.push(
      "goalsForRate"
    );

    warnings.push(
      "GOALS_FOR_RATE_USING_NEUTRAL_FALLBACK"
    );
  }

  if (
    !goalsAgainstRateResult.available
  ) {
    missingFields.push(
      "goalsAgainstRate"
    );

    warnings.push(
      "GOALS_AGAINST_RATE_USING_NEUTRAL_FALLBACK"
    );
  }

  if (
    !shotsResult.available
  ) {
    missingFields.push(
      "shots"
    );
  }

  if (
    !shotsOnTargetResult.available
  ) {
    missingFields.push(
      "shotsOnTarget"
    );
  }

  if (
    goalsForRateResult
      .derivedFromTotals
  ) {
    warnings.push(
      "GOALS_FOR_RATE_DERIVED_FROM_TOTALS"
    );
  }

  if (
    goalsAgainstRateResult
      .derivedFromTotals
  ) {
    warnings.push(
      "GOALS_AGAINST_RATE_DERIVED_FROM_TOTALS"
    );
  }

  /*
   * Detecta divergência entre total/média quando
   * ambos estiverem disponíveis.
   */
  if (
    goalsForTotal !== null &&
    matches > 0
  ) {
    const derived =
      goalsForTotal /
      matches;

    if (
      Math.abs(
        derived -
        goalsForRateResult.value
      ) > 0.2
    ) {
      warnings.push(
        "GOALS_FOR_TOTAL_RATE_INCONSISTENCY"
      );
    }
  }

  if (
    goalsAgainstTotal !== null &&
    matches > 0
  ) {
    const derived =
      goalsAgainstTotal /
      matches;

    if (
      Math.abs(
        derived -
        goalsAgainstRateResult.value
      ) > 0.2
    ) {
      warnings.push(
        "GOALS_AGAINST_TOTAL_RATE_INCONSISTENCY"
      );
    }
  }

  const goalsForRate =
    goalsForRateResult.value;

  const goalsAgainstRate =
    goalsAgainstRateResult.value;

  const last5GoalsFor =
    clamp(
      safeNumber(
        rawStats.last5GoalsFor,
        goalsForRate
      ),
      0,
      6
    );

  const last5GoalsAgainst =
    clamp(
      safeNumber(
        rawStats.last5GoalsAgainst,
        goalsAgainstRate
      ),
      0,
      6
    );

  const realCoreFields =
    [
      matchesResult,
      goalsForRateResult,
      goalsAgainstRateResult
    ].filter(
      result =>
        result.available &&
        !result.usedFallback
    ).length;

  const inputQuality =
    realCoreFields /
    3;

  const sanitized:
    SanitizedStats = {
      matches,
      matchesPlayed:
        matches,

      goalsPerGame:
        goalsForRate,

      goalsForPerGame:
        goalsForRate,

      avgGoals:
        goalsForRate,

      goalsPerMatch:
        goalsForRate,

      goalsConcededPerGame:
        goalsAgainstRate,

      goalsAgainstPerGame:
        goalsAgainstRate,

      avgGoalsAgainst:
        goalsAgainstRate,

      goalsConcededPerMatch:
        goalsAgainstRate,

      bigChancesPerMatch:
        clamp(
          safeNumber(
            rawStats.bigChancesPerMatch ??
            rawStats.bigChancesPerGame ??
            rawStats.bigChances,
            0
          ),
          0,
          10
        ),

      foulsPerMatch:
        clamp(
          safeNumber(
            rawStats.foulsPerMatch ??
            rawStats.foulsPerGame ??
            rawStats.fouls,
            0
          ),
          0,
          40
        ),

      yellowCardsPerMatch:
        clamp(
          safeNumber(
            rawStats.yellowCardsPerMatch ??
            rawStats.yellowCardsPerGame ??
            rawStats.yellowCards,
            0
          ),
          0,
          15
        ),

      over05:
        normalizePercent(
          rawStats.over05
        ),

      over15:
        normalizePercent(
          rawStats.over15
        ),

      over25:
        normalizePercent(
          rawStats.over25
        ),

      over35:
        normalizePercent(
          rawStats.over35
        ),

      btts:
        normalizePercent(
          rawStats.btts
        ),

      last5GoalsFor,
      last5GoalsAgainst,

      missingFields:
        normalizeStrings(
          missingFields
        ),

      warnings:
        normalizeStrings(
          warnings
        ),

      sources: {
        matches:
          matchesResult.source,

        goalsForRate:
          goalsForRateResult.source,

        goalsAgainstRate:
          goalsAgainstRateResult.source,

        shots:
          shotsResult.source,

        shotsOnTarget:
          shotsOnTargetResult.source,

        cornersAvg:
          cornersResult.source
      },

      inputQuality:
        clamp(
          inputQuality,
          0,
          1
        )
    };

  /*
   * Só adicionamos totais quando realmente existem.
   */
  if (
    goalsForTotal !== null
  ) {
    sanitized.goalsFor =
      goalsForTotal;
  }

  if (
    goalsAgainstTotal !== null
  ) {
    sanitized.goalsAgainst =
      goalsAgainstTotal;
  }

/*
 * Splits específicos de mando só são preservados
 * quando realmente existem na entrada original.
 *
 * Não transformamos médias gerais em splits
 * artificiais de casa ou fora.
 */
if (
  venue === "HOME"
) {
  const realHomeGoalsScored =
    parseNonNegativeNumber(
      rawStats
        .homeGoalsScoredPerMatch
    );

  const realHomeGoalsConceded =
    parseNonNegativeNumber(
      rawStats
        .homeGoalsConcededPerMatch
    );

  if (
    realHomeGoalsScored !== null
  ) {
    sanitized
      .homeGoalsScoredPerMatch =
      clamp(
        realHomeGoalsScored,
        0,
        6
      );
  }

  if (
    realHomeGoalsConceded !== null
  ) {
    sanitized
      .homeGoalsConcededPerMatch =
      clamp(
        realHomeGoalsConceded,
        0,
        6
      );
  }
} else {
  const realAwayGoalsScored =
    parseNonNegativeNumber(
      rawStats
        .awayGoalsScoredPerMatch
    );

  const realAwayGoalsConceded =
    parseNonNegativeNumber(
      rawStats
        .awayGoalsConcededPerMatch
    );

  if (
    realAwayGoalsScored !== null
  ) {
    sanitized
      .awayGoalsScoredPerMatch =
      clamp(
        realAwayGoalsScored,
        0,
        6
      );
  }

  if (
    realAwayGoalsConceded !== null
  ) {
    sanitized
      .awayGoalsConcededPerMatch =
      clamp(
        realAwayGoalsConceded,
        0,
        6
      );
  }
}

  /*
   * Finalizações são opcionais.
   *
   * Não produzimos zeros falsos para o
   * lambdaBuilder quando o dado está ausente.
   */
  if (
    shots !== undefined
  ) {
    sanitized.shots =
      shots;

    sanitized.shotsPerGame =
      shots;

    sanitized.avgShots =
      shots;

    sanitized.shotsPerMatch =
      shots;
  }

  if (
    shotsOnTarget !== undefined
  ) {
    sanitized.shotsOnTarget =
      shotsOnTarget;

    sanitized.shotsOnTargetPerGame =
      shotsOnTarget;

    sanitized.avgShotsOnTarget =
      shotsOnTarget;

    sanitized.shotsOnTargetPerMatch =
      shotsOnTarget;
  }

  /*
   * Escanteios são opcionais, mesma razão dos
   * chutes acima: 0 aqui significaria "jogo sem
   * escanteios" para o contextEngine, quando na
   * verdade é só ausência de dado.
   */
  if (
    cornersAvg !== undefined
  ) {
    sanitized.cornersAvg =
      cornersAvg;
  }

  return sanitized;
}
