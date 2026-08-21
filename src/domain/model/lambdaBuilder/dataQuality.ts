import type {
  StatSource,
  ResolvedStat,
  ResolvedOptionalStat
} from "./types";

import {
  clamp
} from "./numericHelpers";

import {
  MIN_RELIABLE_MATCHES
} from "./constants";

/* ==========================================
   QUALIDADE DOS DADOS
========================================== */

export function getSourceQuality(
  source: StatSource
): number {
  switch (
    source
  ) {
    /*
     * Splits específicos e reais de mando.
     */
    case "homeGoalsScoredPerMatch":
    case "awayGoalsScoredPerMatch":
    case "homeGoalsConcededPerMatch":
    case "awayGoalsConcededPerMatch":
      return 1;

    /*
     * Médias gerais por partida.
     *
     * São dados reais, mas menos específicos
     * para o contexto casa/fora.
     */
    case "goalsPerGame":
    case "goalsForPerGame":
    case "avgGoals":
    case "goalsPerMatch":
    case "goalsConcededPerGame":
    case "goalsAgainstPerGame":
    case "avgGoalsAgainst":
    case "goalsConcededPerMatch":
      return 0.78;

    /*
     * Médias derivadas de totais.
     */
    case "goalsForDividedByMatches":
    case "goalsAgainstDividedByMatches":
      return 0.72;

    /*
     * Amostra.
     */
    case "matchesPlayed":
    case "matches":
      return 0.90;

    /*
     * Dados opcionais de finalização.
     */
    case "shotsOnTargetPerGame":
    case "avgShotsOnTarget":
    case "shotsOnTargetPerMatch":
    case "shotsOnTarget":
    case "shotsPerGame":
    case "avgShots":
    case "shotsPerMatch":
    case "shots":
    case "bigChancesPerGame":
    case "avgBigChances":
    case "bigChancesPerMatch":
    case "bigChances":
      return 0.75;

    /*
     * Contexto recente.
     */
    case "recentGoalsPerGame":
    case "recentFormFactor":
    case "goalVariance":
    case "conversionRate":
      return 0.70;

    /*
     * Ausência ou fallback.
     */
    case "leagueFallback":
    case "missing":
      return 0;

    default:
      return 0.65;
  }
}

export function calculateInputQuality(
  sources:
    ResolvedStat[]
): number {
  if (
    sources.length === 0
  ) {
    return 0;
  }

  const totalQuality =
    sources.reduce(
      (
        total,
        resolved
      ) => {
        if (
          resolved
            .usedLeagueFallback
        ) {
          return total;
        }

        const sourceQuality =
          getSourceQuality(
            resolved.source
          );

        /*
         * Proteção adicional caso algum campo
         * derivado de totais tenha origem antiga
         * ou incompatível.
         */
        const adjustedQuality =
          resolved
            .derivedFromTotals
            ? Math.min(
                sourceQuality,
                0.72
              )
            : sourceQuality;

        return (
          total +
          adjustedQuality
        );
      },
      0
    );

  return clamp(
    totalQuality /
      sources.length,
    0,
    1
  );
}

export function calculateSampleReliability(
  homeMatches: number,
  awayMatches: number
): number {
  const homeReliability =
    clamp(
      homeMatches /
        MIN_RELIABLE_MATCHES,
      0,
      1
    );

  const awayReliability =
    clamp(
      awayMatches /
        MIN_RELIABLE_MATCHES,
      0,
      1
    );

  return (
    homeReliability +
    awayReliability
  ) / 2;
}

export function buildWarnings({
  homeMatches,
  awayMatches,
  homeGoals,
  awayGoals,
  homeConceded,
  awayConceded,
  homeShotsOnTarget,
  awayShotsOnTarget,
  leagueAverageGoals
}: {
  homeMatches:
    ResolvedStat;

  awayMatches:
    ResolvedStat;

  homeGoals:
    ResolvedStat;

  awayGoals:
    ResolvedStat;

  homeConceded:
    ResolvedStat;

  awayConceded:
    ResolvedStat;

  homeShotsOnTarget:
    ResolvedOptionalStat;

  awayShotsOnTarget:
    ResolvedOptionalStat;

  leagueAverageGoals:
    number;
}): string[] {
  const warnings:
    string[] = [];

  if (
    homeMatches.source ===
    "missing"
  ) {
    warnings.push(
      "MISSING_HOME_MATCHES"
    );
  }

  if (
    awayMatches.source ===
    "missing"
  ) {
    warnings.push(
      "MISSING_AWAY_MATCHES"
    );
  }

  if (
    homeMatches.value <
    MIN_RELIABLE_MATCHES
  ) {
    warnings.push(
      "LOW_HOME_SAMPLE"
    );
  }

  if (
    awayMatches.value <
    MIN_RELIABLE_MATCHES
  ) {
    warnings.push(
      "LOW_AWAY_SAMPLE"
    );
  }

  if (
    homeGoals.usedLeagueFallback
  ) {
    warnings.push(
      "HOME_ATTACK_USING_LEAGUE_FALLBACK"
    );
  }

  if (
    awayGoals.usedLeagueFallback
  ) {
    warnings.push(
      "AWAY_ATTACK_USING_LEAGUE_FALLBACK"
    );
  }

  if (
    homeConceded.usedLeagueFallback
  ) {
    warnings.push(
      "HOME_DEFENSE_USING_LEAGUE_FALLBACK"
    );
  }

  if (
    awayConceded.usedLeagueFallback
  ) {
    warnings.push(
      "AWAY_DEFENSE_USING_LEAGUE_FALLBACK"
    );
  }

  if (
    !homeShotsOnTarget.available
  ) {
    warnings.push(
      "MISSING_HOME_SHOTS_ON_TARGET"
    );
  }

  if (
    !awayShotsOnTarget.available
  ) {
    warnings.push(
      "MISSING_AWAY_SHOTS_ON_TARGET"
    );
  }

  /*
   * Diagnóstico importante para impedir que uma
   * configuração anormal da liga passe despercebida.
   */
  if (
    leagueAverageGoals >
    3.8
  ) {
    warnings.push(
      "SUSPICIOUS_LEAGUE_AVERAGE_GOALS"
    );
  }

  return [
    ...new Set(
      warnings
    )
  ];
}
