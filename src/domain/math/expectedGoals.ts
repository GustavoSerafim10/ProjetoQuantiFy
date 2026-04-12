export interface TeamStats {

  matches: number

  goalsScored: number
  goalsConceded: number

  goalsPerMatch: number
  goalsConcededPerMatch: number

  shotsPerMatch: number

  bigChancesCreated: number
  bigChancesMissed: number

  possession: number

  accuratePassesPerMatch: number

  savesPerMatch: number
}

export interface ExpectedGoalsResult {
  lambdaHome: number
  lambdaAway: number
}

export function calculateExpectedGoals(
  home: TeamStats,
  away: TeamStats
): ExpectedGoalsResult {

  const attackStrengthHome =
    home.goalsPerMatch / away.goalsConcededPerMatch;

  const attackStrengthAway =
    away.goalsPerMatch / home.goalsConcededPerMatch;

  const lambdaHome = attackStrengthHome;
  const lambdaAway = attackStrengthAway;

  return {
    lambdaHome,
    lambdaAway
  };
}