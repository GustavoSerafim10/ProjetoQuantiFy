import type {
  StatSource
} from "./types";

/* ==========================================
   PROVENIÊNCIA DE MANDO
========================================== */

/*
 * Um split de mando só é considerado verdadeiro
 * quando sua origem é explicitamente específica
 * de casa ou de fora.
 *
 * Médias gerais como goalsPerGame não podem ser
 * normalizadas contra leagueBaseHome ou
 * leagueBaseAway, pois isso favoreceria
 * artificialmente um dos lados.
 */
export function isTrueVenueAttackSource(
  source: StatSource
): boolean {
  return (
    source ===
      "homeGoalsScoredPerMatch" ||
    source ===
      "awayGoalsScoredPerMatch"
  );
}

export function isTrueVenueDefenseSource(
  source: StatSource
): boolean {
  return (
    source ===
      "homeGoalsConcededPerMatch" ||
    source ===
      "awayGoalsConcededPerMatch"
  );
}
