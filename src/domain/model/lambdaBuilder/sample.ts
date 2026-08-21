import type {
  TeamStatsCompatibility,
  ResolvedStat
} from "./types";

import {
  clamp,
  parseFiniteNumber
} from "./numericHelpers";

/* ==========================================
   AMOSTRA
========================================== */

export function resolveMatchesPlayed(
  team:
    TeamStatsCompatibility
): ResolvedStat {
  const matchesPlayed =
    parseFiniteNumber(
      team.matchesPlayed
    );

  if (
    matchesPlayed !== null &&
    matchesPlayed >= 0
  ) {
    return {
      value:
        clamp(
          matchesPlayed,
          0,
          100
        ),

      source:
        "matchesPlayed",

      usedLeagueFallback:
        false,

      derivedFromTotals:
        false
    };
  }

  const matches =
    parseFiniteNumber(
      team.matches
    );

  if (
    matches !== null &&
    matches >= 0
  ) {
    return {
      value:
        clamp(
          matches,
          0,
          100
        ),

      source:
        "matches",

      usedLeagueFallback:
        false,

      derivedFromTotals:
        false
    };
  }

  return {
    value:
      0,

    source:
      "missing",

    usedLeagueFallback:
      false,

    derivedFromTotals:
      false
  };
}

/* ==========================================
   MÉDIAS DERIVADAS DOS TOTAIS
========================================== */

export function deriveRateFromTotals(
  total: unknown,
  matchesPlayed: number
): number | null {
  const safeTotal =
    parseFiniteNumber(
      total
    );

  if (
    safeTotal === null ||
    safeTotal < 0 ||
    !Number.isFinite(
      matchesPlayed
    ) ||
    matchesPlayed <= 0
  ) {
    return null;
  }

  const rate =
    safeTotal /
    matchesPlayed;

  return Number.isFinite(
    rate
  )
    ? rate
    : null;
}
