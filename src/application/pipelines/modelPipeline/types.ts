/* ==========================================
   CONTRATOS DE ENTRADA
========================================== */

export interface RawTeamStats {
  matches?: unknown;
  matchesPlayed?: unknown;

  goalsFor?: unknown;
  goalsAgainst?: unknown;

  goalsPerGame?: unknown;
  goalsForPerGame?: unknown;
  avgGoals?: unknown;
  goalsPerMatch?: unknown;

  goalsConcededPerGame?: unknown;
  goalsAgainstPerGame?: unknown;
  avgGoalsAgainst?: unknown;
  goalsConcededPerMatch?: unknown;

  homeGoalsScoredPerMatch?: unknown;
  homeGoalsConcededPerMatch?: unknown;

  awayGoalsScoredPerMatch?: unknown;
  awayGoalsConcededPerMatch?: unknown;

  shots?: unknown;
  shotsPerGame?: unknown;
  avgShots?: unknown;
  shotsPerMatch?: unknown;

  shotsOnTarget?: unknown;
  shotsOnTargetPerGame?: unknown;
  avgShotsOnTarget?: unknown;
  shotsOnTargetPerMatch?: unknown;

  cornersAvg?: unknown;
  cornersPerGame?: unknown;

  bigChances?: unknown;
  bigChancesPerGame?: unknown;
  bigChancesPerMatch?: unknown;

  fouls?: unknown;
  foulsPerGame?: unknown;
  foulsPerMatch?: unknown;

  yellowCards?: unknown;
  yellowCardsPerGame?: unknown;
  yellowCardsPerMatch?: unknown;

  over05?: unknown;
  over15?: unknown;
  over25?: unknown;
  over35?: unknown;
  btts?: unknown;

  last5GoalsFor?: unknown;
  last5GoalsAgainst?: unknown;

  [key: string]: unknown;
}

/* ==========================================
   FONTES DAS ESTATÍSTICAS
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

  | "shotsPerGame"
  | "avgShots"
  | "shotsPerMatch"
  | "shots"

  | "shotsOnTargetPerGame"
  | "avgShotsOnTarget"
  | "shotsOnTargetPerMatch"
  | "shotsOnTarget"

  | "cornersAvg"
  | "cornersPerGame"

  | "matchesPlayed"
  | "matches"

  | "neutralFallback"
  | "missing";

export interface ResolvedNumber {
  value: number;
  source: StatSource;

  available: boolean;
  usedFallback: boolean;
  derivedFromTotals: boolean;
}

/* ==========================================
   CONTRATO SANITIZADO
========================================== */

export interface SanitizedStats {
  matches: number;
  matchesPlayed: number;

  goalsFor?: number;
  goalsAgainst?: number;

  goalsPerGame: number;
  goalsForPerGame: number;
  avgGoals: number;
  goalsPerMatch: number;

  goalsConcededPerGame: number;
  goalsAgainstPerGame: number;
  avgGoalsAgainst: number;
  goalsConcededPerMatch: number;

  homeGoalsScoredPerMatch?: number;
  homeGoalsConcededPerMatch?: number;

  awayGoalsScoredPerMatch?: number;
  awayGoalsConcededPerMatch?: number;

  shots?: number;
  shotsPerGame?: number;
  avgShots?: number;
  shotsPerMatch?: number;

  shotsOnTarget?: number;
  shotsOnTargetPerGame?: number;
  avgShotsOnTarget?: number;
  shotsOnTargetPerMatch?: number;

  cornersAvg?: number;
  bigChancesPerMatch: number;

  foulsPerMatch: number;
  yellowCardsPerMatch: number;

  over05: number;
  over15: number;
  over25: number;
  over35: number;
  btts: number;

  last5GoalsFor: number;
  last5GoalsAgainst: number;

  missingFields: string[];
  warnings: string[];

  sources: {
    matches: StatSource;
    goalsForRate: StatSource;
    goalsAgainstRate: StatSource;
    shots: StatSource;
    shotsOnTarget: StatSource;
    cornersAvg: StatSource;
  };

  inputQuality: number;

  [key: string]: unknown;
}
export interface MatrixMarkets {
  home: number;
  draw: number;
  away: number;

  over15: number;
  over25: number;

  bttsYes: number;
  bttsNo: number;

  doubleChance1X: number;
  doubleChanceX2: number;
}
