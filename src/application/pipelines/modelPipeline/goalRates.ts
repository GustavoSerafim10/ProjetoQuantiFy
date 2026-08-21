import {
  type RawTeamStats,
  type ResolvedNumber
} from "./types";

import {
  derivePerGameRate,
  resolveFirstNumber
} from "./numericHelpers";

/* ==========================================
   RESOLUÇÃO DAS TAXAS DE GOLS
========================================== */

export function resolveGoalsForRate(
  stats: RawTeamStats,
  venue: "HOME" | "AWAY",
  matches: number
): ResolvedNumber {
  const venueSpecific =
    venue === "HOME"
      ? stats.homeGoalsScoredPerMatch
      : stats.awayGoalsScoredPerMatch;

  return resolveFirstNumber(
    [
      {
        value:
          venueSpecific,

        source:
          venue === "HOME"
            ? "homeGoalsScoredPerMatch"
            : "awayGoalsScoredPerMatch"
      },

      {
        value:
          stats.goalsPerGame,

        source:
          "goalsPerGame"
      },

      {
        value:
          stats.goalsForPerGame,

        source:
          "goalsForPerGame"
      },

      {
        value:
          stats.avgGoals,

        source:
          "avgGoals"
      },

      {
        value:
          stats.goalsPerMatch,

        source:
          "goalsPerMatch"
      },

      {
        value:
          derivePerGameRate(
            stats.goalsFor,
            matches
          ),

        source:
          "goalsForDividedByMatches"
      }
    ],
    1.25,
    6
  );
}

export function resolveGoalsAgainstRate(
  stats: RawTeamStats,
  venue: "HOME" | "AWAY",
  matches: number
): ResolvedNumber {
  const venueSpecific =
    venue === "HOME"
      ? stats.homeGoalsConcededPerMatch
      : stats.awayGoalsConcededPerMatch;

  return resolveFirstNumber(
    [
      {
        value:
          venueSpecific,

        source:
          venue === "HOME"
            ? "homeGoalsConcededPerMatch"
            : "awayGoalsConcededPerMatch"
      },

      {
        value:
          stats.goalsConcededPerGame,

        source:
          "goalsConcededPerGame"
      },

      {
        value:
          stats.goalsAgainstPerGame,

        source:
          "goalsAgainstPerGame"
      },

      {
        value:
          stats.avgGoalsAgainst,

        source:
          "avgGoalsAgainst"
      },

      {
        value:
          stats.goalsConcededPerMatch,

        source:
          "goalsConcededPerMatch"
      },

      {
        value:
          derivePerGameRate(
            stats.goalsAgainst,
            matches
          ),

        source:
          "goalsAgainstDividedByMatches"
      }
    ],
    1.25,
    6
  );
}
