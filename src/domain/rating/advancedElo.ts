export interface EloInput {
  homeRating: number
  awayRating: number
  homeAdvantage?: number
}

export interface EloLambdaOutput {
  lambdaHome: number
  lambdaAway: number
  expectedHomeScore: number
}

export function eloToLambda(
  input: EloInput
): EloLambdaOutput {

  const homeAdv = input.homeAdvantage ?? 80;

  const adjustedHome = input.homeRating + homeAdv;
  const adjustedAway = input.awayRating;

  const expectedHomeScore =
    1 / (1 + Math.pow(10, (adjustedAway - adjustedHome) / 400));

  // Base média de gols da liga
  const leagueAverageGoals = 2.6;

  const lambdaHome =
    leagueAverageGoals * expectedHomeScore;

  const lambdaAway =
    leagueAverageGoals * (1 - expectedHomeScore);

  return {
    lambdaHome,
    lambdaAway,
    expectedHomeScore
  };
}