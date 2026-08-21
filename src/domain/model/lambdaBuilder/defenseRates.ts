import type {
  TeamStatsCompatibility,
  ResolvedStat
} from "./types";

import {
  clamp,
  resolveFirstStat
} from "./numericHelpers";

import {
  deriveRateFromTotals
} from "./sample";

/* ==========================================
   RESOLUÇÃO DAS TAXAS DEFENSIVAS
========================================== */

export function resolveHomeGoalsConceded(
  team: TeamStatsCompatibility,
  fallback: number,
  matchesPlayed: number
): ResolvedStat {
  const derivedFromTotals =
    deriveRateFromTotals(
      team.goalsAgainst,
      matchesPlayed
    );

  const resolved =
    resolveFirstStat(
      [
        {
          value:
            team.homeGoalsConcededPerMatch,

          source:
            "homeGoalsConcededPerMatch"
        },

        {
          value:
            team.goalsConcededPerGame,

          source:
            "goalsConcededPerGame"
        },

        {
          value:
            team.goalsAgainstPerGame,

          source:
            "goalsAgainstPerGame"
        },

        {
          value:
            team.avgGoalsAgainst,

          source:
            "avgGoalsAgainst"
        },

        {
          value:
            team.goalsConcededPerMatch,

          source:
            "goalsConcededPerMatch"
        },

        {
          value:
            derivedFromTotals,

          source:
            "goalsAgainstDividedByMatches"
        }
      ],
      fallback
    );

  return {
    ...resolved,

    value:
      clamp(
        resolved.value,
        0,
        6
      )
  };
}

export function resolveAwayGoalsConceded(
  team: TeamStatsCompatibility,
  fallback: number,
  matchesPlayed: number
): ResolvedStat {
  const derivedFromTotals =
    deriveRateFromTotals(
      team.goalsAgainst,
      matchesPlayed
    );

  const resolved =
    resolveFirstStat(
      [
        {
          value:
            team.awayGoalsConcededPerMatch,

          source:
            "awayGoalsConcededPerMatch"
        },

        {
          value:
            team.goalsConcededPerGame,

          source:
            "goalsConcededPerGame"
        },

        {
          value:
            team.goalsAgainstPerGame,

          source:
            "goalsAgainstPerGame"
        },

        {
          value:
            team.avgGoalsAgainst,

          source:
            "avgGoalsAgainst"
        },

        {
          value:
            team.goalsConcededPerMatch,

          source:
            "goalsConcededPerMatch"
        },

        {
          value:
            derivedFromTotals,

          source:
            "goalsAgainstDividedByMatches"
        }
      ],
      fallback
    );

  return {
    ...resolved,

    value:
      clamp(
        resolved.value,
        0,
        6
      )
  };
}
