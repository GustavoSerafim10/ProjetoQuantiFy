import type { FormField } from "./types";

/* ==========================================
   FIELD GUARD
========================================== */

const FORM_FIELDS =
  new Set<FormField>([
    "homeTeam",
    "awayTeam",
    "league",

    "homeRating",
    "awayRating",

    "homeMatches",
    "awayMatches",

    "homeGoals",
    "awayGoals",

    "homeConceded",
    "awayConceded",

    "homeAssists",
    "awayAssists",

    "homeGoalsPG",
    "awayGoalsPG",

    "homeShotsOnTarget",
    "awayShotsOnTarget",

    "homeBigChances",
    "awayBigChances",

    "homeBigChancesMissed",
    "awayBigChancesMissed",

    "homePossession",
    "awayPossession",

    "homePasses",
    "awayPasses",

    "homeLongBalls",
    "awayLongBalls",

    "homeCleanSheets",
    "awayCleanSheets",

    "homeConcededPG",
    "awayConcededPG",

    "homeInterceptions",
    "awayInterceptions",

    "homeTackles",
    "awayTackles",

    "homeClearances",
    "awayClearances",

    "homeSaves",
    "awaySaves",

    "homeFouls",
    "awayFouls",

    "homeOffsides",
    "awayOffsides",

    "homeThrowIns",
    "awayThrowIns",

    "homeYellow",
    "awayYellow",

    "homeRed",
    "awayRed",

    "oddHome",
    "oddDraw",
    "oddAway",

    "oddOver15",
    "oddOver25",

    "oddUnder15",
    "oddUnder25",

    "oddBTTSYes",
    "oddBTTSNo",

    "odd1X",
    "oddX2",

    "oddDnbHome",
    "oddDnbAway"
  ]);

export function isFormField(
  value:
    string
): value is FormField {
  return FORM_FIELDS.has(
    value as FormField
  );
}
