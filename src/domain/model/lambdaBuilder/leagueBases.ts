import {
  clamp,
  safePositiveNumber
} from "./numericHelpers";

/* ==========================================
   BASES DA LIGA
========================================== */

export function resolveLeagueGoalBases(
  averageGoals: number,
  averageHomeGoals: number,
  averageAwayGoals: number
) {
  const safeAverageGoals =
    clamp(
      safePositiveNumber(
        averageGoals,
        2.55
      ),
      1.20,
      5
    );

  let safeHomeGoals =
    clamp(
      safePositiveNumber(
        averageHomeGoals,
        safeAverageGoals / 2
      ),
      0.30,
      3
    );

  let safeAwayGoals =
    clamp(
      safePositiveNumber(
        averageAwayGoals,
        safeAverageGoals / 2
      ),
      0.30,
      3
    );

  const configuredTotal =
    safeHomeGoals +
    safeAwayGoals;

  /*
   * Preserva a relação casa/fora configurada,
   * garantindo que a soma corresponda à média
   * total oficial da liga.
   */
  if (
    Number.isFinite(
      configuredTotal
    ) &&
    configuredTotal > 0
  ) {
    const correctionFactor =
      safeAverageGoals /
      configuredTotal;

    safeHomeGoals *=
      correctionFactor;

    safeAwayGoals *=
      correctionFactor;
  } else {
    safeHomeGoals =
      safeAverageGoals / 2;

    safeAwayGoals =
      safeAverageGoals / 2;
  }

  return {
    leagueAverageGoals:
      safeAverageGoals,

    leagueBaseHome:
      safeHomeGoals,

    leagueBaseAway:
      safeAwayGoals
  };
}
