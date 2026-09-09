import type { FormState, TeamStatsPayload } from "./types";
import { readNumber } from "./parsers";
import { removeInvalidTeamStats } from "./objectHelpers";

/* ==========================================
   TEAM STATS PAYLOAD
========================================== */

export function buildTeamStats(
  form: FormState,
  side:
    | "home"
    | "away"
): TeamStatsPayload {
  const prefix =
    side === "home"
      ? "home"
      : "away";

  const matches =
    readNumber(
      form,
      `${prefix}Matches`
    );

  const goalsFor =
    readNumber(
      form,
      `${prefix}Goals`
    );

  const goalsAgainst =
    readNumber(
      form,
      `${prefix}Conceded`
    );

  const goalsPerGame =
    readNumber(
      form,
      `${prefix}GoalsPG`
    );

  const goalsConcededPerGame =
    readNumber(
      form,
      `${prefix}ConcededPG`
    );

  const shotsOnTargetPerGame =
    readNumber(
      form,
      `${prefix}ShotsOnTarget`
    );

  const shotsPerGame =
    readNumber(
      form,
      `${prefix}Shots`
    );

  const cornersAvg =
    readNumber(
      form,
      `${prefix}Corners`
    );

  return removeInvalidTeamStats({
    rating:
      readNumber(
        form,
        `${prefix}Rating`
      ),

    matches,

    matchesPlayed:
      matches,

    goalsFor,

    goalsAgainst,

    /*
     * Contrato canônico e aliases.
     */
    avgGoals:
      goalsPerGame,

    goalsPerGame,

    goalsForPerGame:
      goalsPerGame,

    avgGoalsAgainst:
      goalsConcededPerGame,

    goalsConcededPerGame,

    goalsAgainstPerGame:
      goalsConcededPerGame,

    assists:
      readNumber(
        form,
        `${prefix}Assists`
      ),

    /*
     * Chutes no alvo:
     *
     * O InputPanel envia todos os aliases
     * temporariamente para impedir perda de
     * dados em módulos antigos.
     */
    avgShotsOnTarget:
      shotsOnTargetPerGame,

    shotsOnTarget:
      shotsOnTargetPerGame,

    shotsOnTargetPerGame,

    /*
     * Finalizações totais e escanteios:
     *
     * alimentam o ajuste de ritmo/pressão do
     * contextEngine. Enviados apenas quando
     * realmente preenchidos.
     */
    avgShots:
      shotsPerGame,

    shots:
      shotsPerGame,

    shotsPerGame,

    cornersAvg,

    bigChances:
      readNumber(
        form,
        `${prefix}BigChances`
      ),

    bigChancesMissed:
      readNumber(
        form,
        `${prefix}BigChancesMissed`
      ),

    possession:
      readNumber(
        form,
        `${prefix}Possession`
      ),

    passes:
      readNumber(
        form,
        `${prefix}Passes`
      ),

    longBalls:
      readNumber(
        form,
        `${prefix}LongBalls`
      ),

    cleanSheets:
      readNumber(
        form,
        `${prefix}CleanSheets`
      ),

    interceptions:
      readNumber(
        form,
        `${prefix}Interceptions`
      ),

    tackles:
      readNumber(
        form,
        `${prefix}Tackles`
      ),

    clearances:
      readNumber(
        form,
        `${prefix}Clearances`
      ),

    saves:
      readNumber(
        form,
        `${prefix}Saves`
      ),

    fouls:
      readNumber(
        form,
        `${prefix}Fouls`
      ),

    offsides:
      readNumber(
        form,
        `${prefix}Offsides`
      ),

    throwIns:
      readNumber(
        form,
        `${prefix}ThrowIns`
      ),

    yellowCards:
      readNumber(
        form,
        `${prefix}Yellow`
      ),

    redCards:
      readNumber(
        form,
        `${prefix}Red`
      )
  });
}

