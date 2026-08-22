import type { FormState, TeamStatsPayload, OddsPayload } from "./types";
import { readNumber } from "./parsers";
import { removeInvalidTeamStats, removeInvalidOdds } from "./objectHelpers";

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

  /*
   * Split real de mando (opcional).
   *
   * homeGoalsScoredHome/homeGoalsConcededHome só se
   * aplicam ao lado "home" (como o mandante joga
   * especificamente em casa). awayGoalsScoredAway/
   * awayGoalsConcededAway só se aplicam ao lado "away"
   * (como o visitante joga especificamente fora). Não
   * são um par simétrico do mesmo campo — por isso lidos
   * condicionalmente por side, não via `${prefix}`.
   */
  const venueGoalsScored =
    side === "home"
      ? readNumber(
          form,
          "homeGoalsScoredHome"
        )
      : readNumber(
          form,
          "awayGoalsScoredAway"
        );

  const venueGoalsConceded =
    side === "home"
      ? readNumber(
          form,
          "homeGoalsConcededHome"
        )
      : readNumber(
          form,
          "awayGoalsConcededAway"
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

    homeGoalsScoredPerMatch:
      side === "home"
        ? venueGoalsScored
        : null,

    homeGoalsConcededPerMatch:
      side === "home"
        ? venueGoalsConceded
        : null,

    awayGoalsScoredPerMatch:
      side === "away"
        ? venueGoalsScored
        : null,

    awayGoalsConcededPerMatch:
      side === "away"
        ? venueGoalsConceded
        : null,

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

/* ==========================================
   ODDS PAYLOAD
========================================== */

export function buildOddsPayload(
  form:
    FormState
): OddsPayload {
  return removeInvalidOdds({
    home:
      readNumber(
        form,
        "oddHome"
      ),

    draw:
      readNumber(
        form,
        "oddDraw"
      ),

    away:
      readNumber(
        form,
        "oddAway"
      ),

    over15:
      readNumber(
        form,
        "oddOver15"
      ),

    over25:
      readNumber(
        form,
        "oddOver25"
      ),

    bttsYes:
      readNumber(
        form,
        "oddBTTSYes"
      ),

    bttsNo:
      readNumber(
        form,
        "oddBTTSNo"
      ),

    homeOrDraw:
      readNumber(
        form,
        "odd1X"
      ),

    awayOrDraw:
      readNumber(
        form,
        "oddX2"
      )
  });
}
