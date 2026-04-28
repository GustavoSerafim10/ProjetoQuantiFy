import {
  goalMatrix,
  matchOutcomeProbabilities,
  overUnderProbability,
  bttsProbability
} from "../math/goalMatrix";

export interface DixonColesModelOutput {
  matrix: ReturnType<typeof goalMatrix>;

  homeWinProb: number;
  drawProb: number;
  awayWinProb: number;

  over15Prob: number;
  under15Prob: number;
  over25Prob: number;
  under25Prob: number;

  bttsYesProb: number;
  bttsNoProb: number;

  doubleChance1X: number;
  doubleChanceX2: number;
  doubleChance12: number;
}

export function dixonColesModel(
  lambdaHome: number,
  lambdaAway: number,
  rho = -0.12
): DixonColesModelOutput {
  const matrix = goalMatrix(lambdaHome, lambdaAway, {
    maxGoals: 10,
    rho
  });

  const result = matchOutcomeProbabilities(matrix);
  const ou15 = overUnderProbability(matrix, 1.5);
  const ou25 = overUnderProbability(matrix, 2.5);
  const btts = bttsProbability(matrix);

  return {
    matrix,

    homeWinProb: result.homeWin,
    drawProb: result.draw,
    awayWinProb: result.awayWin,

    over15Prob: ou15.over,
    under15Prob: ou15.under,
    over25Prob: ou25.over,
    under25Prob: ou25.under,

    bttsYesProb: btts.yes,
    bttsNoProb: btts.no,

    doubleChance1X: result.homeWin + result.draw,
    doubleChanceX2: result.awayWin + result.draw,
    doubleChance12: result.homeWin + result.awayWin
  };
}