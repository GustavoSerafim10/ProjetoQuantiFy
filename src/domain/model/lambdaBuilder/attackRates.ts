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
   RESOLUÇÃO DAS TAXAS DE ATAQUE
========================================== */

export function resolveHomeGoalsScored(
  team: TeamStatsCompatibility,
  fallback: number,
  matchesPlayed: number
): ResolvedStat {
  const derivedFromTotals =
    deriveRateFromTotals(
      team.goalsFor,
      matchesPlayed
    );

  const resolved =
    resolveFirstStat(
      [
        {
          value:
            team.homeGoalsScoredPerMatch,

          source:
            "homeGoalsScoredPerMatch"
        },

        {
          value:
            team.goalsPerGame,

          source:
            "goalsPerGame"
        },

        {
          value:
            team.goalsForPerGame,

          source:
            "goalsForPerGame"
        },

        {
          value:
            team.avgGoals,

          source:
            "avgGoals"
        },

        {
          value:
            team.goalsPerMatch,

          source:
            "goalsPerMatch"
        },

        {
          value:
            derivedFromTotals,

          source:
            "goalsForDividedByMatches"
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

export function resolveAwayGoalsScored(
  team: TeamStatsCompatibility,
  fallback: number,
  matchesPlayed: number
): ResolvedStat {
  const derivedFromTotals =
    deriveRateFromTotals(
      team.goalsFor,
      matchesPlayed
    );

  const resolved =
    resolveFirstStat(
      [
        {
          value:
            team.awayGoalsScoredPerMatch,

          source:
            "awayGoalsScoredPerMatch"
        },

        {
          value:
            team.goalsPerGame,

          source:
            "goalsPerGame"
        },

        {
          value:
            team.goalsForPerGame,

          source:
            "goalsForPerGame"
        },

        {
          value:
            team.avgGoals,

          source:
            "avgGoals"
        },

        {
          value:
            team.goalsPerMatch,

          source:
            "goalsPerMatch"
        },

        {
          value:
            derivedFromTotals,

          source:
            "goalsForDividedByMatches"
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
