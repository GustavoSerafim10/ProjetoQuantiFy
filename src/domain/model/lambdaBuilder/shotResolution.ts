import type {
  TeamStatsCompatibility,
  ResolvedOptionalStat
} from "./types";

import {
  resolveOptionalStat
} from "./numericHelpers";

/* ==========================================
   RESOLUÇÃO DAS FINALIZAÇÕES
========================================== */

export function resolveShotsOnTarget(
  team:
    TeamStatsCompatibility
): ResolvedOptionalStat {
  return resolveOptionalStat([
    {
      value:
        team.shotsOnTargetPerGame,

      source:
        "shotsOnTargetPerGame"
    },

    {
      value:
        team.avgShotsOnTarget,

      source:
        "avgShotsOnTarget"
    },

    {
      value:
        team.shotsOnTarget,

      source:
        "shotsOnTarget"
    },

    {
      value:
        team.shotsOnTargetPerMatch,

      source:
        "shotsOnTargetPerMatch"
    }
  ]);
}

export function resolveShots(
  team:
    TeamStatsCompatibility
): ResolvedOptionalStat {
  return resolveOptionalStat([
    {
      value:
        team.shotsPerGame,

      source:
        "shotsPerGame"
    },

    {
      value:
        team.avgShots,

      source:
        "avgShots"
    },

    {
      value:
        team.shots,

      source:
        "shots"
    },

    {
      value:
        team.shotsPerMatch,

      source:
        "shotsPerMatch"
    }
  ]);
}

export function resolveBigChances(
  team:
    TeamStatsCompatibility
): ResolvedOptionalStat {
  return resolveOptionalStat([
    {
      value:
        team.bigChancesPerGame,

      source:
        "bigChancesPerGame"
    },

    {
      value:
        team.avgBigChances,

      source:
        "avgBigChances"
    },

    {
      value:
        team.bigChances,

      source:
        "bigChances"
    },

    {
      value:
        team.bigChancesPerMatch,

      source:
        "bigChancesPerMatch"
    }
  ]);
}
