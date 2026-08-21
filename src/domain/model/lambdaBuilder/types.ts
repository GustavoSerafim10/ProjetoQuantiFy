/* ==========================================
   FONTES DOS DADOS
========================================== */

export type StatSource =
  | "homeGoalsScoredPerMatch"
  | "awayGoalsScoredPerMatch"

  | "homeGoalsConcededPerMatch"
  | "awayGoalsConcededPerMatch"

  | "goalsPerGame"
  | "goalsForPerGame"
  | "avgGoals"
  | "goalsPerMatch"

  | "goalsConcededPerGame"
  | "goalsAgainstPerGame"
  | "avgGoalsAgainst"
  | "goalsConcededPerMatch"

  | "goalsForDividedByMatches"
  | "goalsAgainstDividedByMatches"

  | "shotsOnTargetPerGame"
  | "avgShotsOnTarget"
  | "shotsOnTarget"
  | "shotsOnTargetPerMatch"

  | "shotsPerGame"
  | "avgShots"
  | "shots"
  | "shotsPerMatch"

  | "bigChancesPerGame"
  | "avgBigChances"
  | "bigChances"
  | "bigChancesPerMatch"

  | "recentGoalsPerGame"
  | "recentFormFactor"
  | "goalVariance"
  | "conversionRate"

  | "matchesPlayed"
  | "matches"

  | "leagueFallback"
  | "missing";

export interface ResolvedStat {
  value: number;
  source: StatSource;

  usedLeagueFallback:
    boolean;

  derivedFromTotals:
    boolean;
}

export interface ResolvedOptionalStat {
  value: number | null;
  source: StatSource;

  available:
    boolean;
}

/* ==========================================
   TIPOS INTERNOS
========================================== */

export interface LimitedLambdas {
  home: number;
  away: number;
}

export interface ContextualAttackFactors {
  recentFormFactor: number;
  varianceFactor: number;
  shotQualityFactor: number;

  recentGoalsPerGame: number | null;
  goalVariance: number | null;
  bigChancesPerGame: number | null;
  conversionRate: number | null;

  diagnostics: {
    recentFormAvailable: boolean;
    varianceAvailable: boolean;
    shotQualityAvailable: boolean;
  };
}

export interface TeamStatsCompatibility {
  /*
   * Amostra.
   */
  matchesPlayed?: number;
  matches?: number;

  /*
   * Totais.
   */
  goalsFor?: number;
  goalsAgainst?: number;

  /*
   * Contrato canônico atual.
   */
  goalsPerGame?: number;
  goalsForPerGame?: number;
  avgGoals?: number;

  goalsConcededPerGame?: number;
  goalsAgainstPerGame?: number;
  avgGoalsAgainst?: number;

  /*
   * Contratos antigos.
   */
  goalsPerMatch?: number;
  goalsConcededPerMatch?: number;

  homeGoalsScoredPerMatch?: number;
  homeGoalsConcededPerMatch?: number;

  awayGoalsScoredPerMatch?: number;
  awayGoalsConcededPerMatch?: number;

  /*
   * Finalizações no alvo.
   */
  shotsOnTargetPerGame?: number;
  avgShotsOnTarget?: number;
  shotsOnTarget?: number;
  shotsOnTargetPerMatch?: number;

  /*
   * Finalizações totais.
   */
  shotsPerGame?: number;
  avgShots?: number;
  shots?: number;
  shotsPerMatch?: number;

  bigChancesPerGame?: number;
  avgBigChances?: number;
  bigChances?: number;
  bigChancesPerMatch?: number;

  recentGoalsPerGame?: number;
  recentFormFactor?: number;
  goalVariance?: number;

  conversionRate?: number;
}
