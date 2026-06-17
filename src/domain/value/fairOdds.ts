export function fairOdd(probability: number): number {

  if (
    !Number.isFinite(probability) ||
    probability <= 0 ||
    probability >= 1
  ) {
    throw new Error(
      "Probability must be greater than 0 and less than 1"
    );
  }

  return Number((1 / probability).toFixed(3));
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

  const probabilities = [homeWin, draw, awayWin];

  probabilities.forEach(p => {
    if (
      !Number.isFinite(p) ||
      p <= 0 ||
      p >= 1
    ) {
      throw new Error(
        "All probabilities must be between 0 and 1"
      );
    }
  });

  return {
    homeWin: Number((1 / homeWin).toFixed(3)),
    draw: Number((1 / draw).toFixed(3)),
    awayWin: Number((1 / awayWin).toFixed(3))
  };
}