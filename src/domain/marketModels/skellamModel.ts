import { calculateSkellamProbabilities } from "../math/skellam";

export function skellamModel(lambdaHome: number, lambdaAway: number) {
  const result = calculateSkellamProbabilities(lambdaHome, lambdaAway, 12);

  return {
    homeWinProb: result.homeWinProb,
    drawProb: result.drawProb,
    awayWinProb: result.awayWinProb,
    doubleChance1X: result.doubleChance1X,
    doubleChanceX2: result.doubleChanceX2,
    doubleChance12: result.doubleChance12,
    confidence: result.confidence,
    distribution: result.distribution,

    // compatibilidade antiga
    homeWin: result.homeWinProb,
    draw: result.drawProb,
    awayWin: result.awayWinProb
  };
}