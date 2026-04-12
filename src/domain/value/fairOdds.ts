export function fairOdd(probability: number): number {

  if (probability <= 0) {
    throw new Error("Probability must be greater than zero");
  }

  return 1 / probability;
}

export interface FairOdds {
  homeWin: number
  draw: number
  awayWin: number
}

export function fairOddsFromMatchProbabilities(
  homeWin: number,
  draw: number,
  awayWin: number
): FairOdds {

  return {
    homeWin: 1 / homeWin,
    draw: 1 / draw,
    awayWin: 1 / awayWin
  };
}