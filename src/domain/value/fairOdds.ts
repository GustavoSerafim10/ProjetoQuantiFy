/* ===================================================
   FAIR ODDS ENGINE
   Quantify Sports
=================================================== */

export interface FairOdds {
  homeWin: number;
  draw: number;
  awayWin: number;
}

function clampProbability(probability: number): number {
  if (!Number.isFinite(probability)) return 0.5;

  return Math.max(0.01, Math.min(0.99, probability));
}

/* ===================================================
   FAIR ODD
=================================================== */

export function fairOdd(probability: number): number {

  const p = clampProbability(probability);

  return Number((1 / p).toFixed(3));
}

/* ===================================================
   IMPLIED PROBABILITY
=================================================== */

export function impliedProbability(odd: number): number {

  if (!Number.isFinite(odd) || odd <= 1) {
    return 0;
  }

  return Number((1 / odd).toFixed(4));
}

/* ===================================================
   EDGE (%)
=================================================== */

export function edgePercentage(
  probability: number,
  odd: number
): number {

  const fair = fairOdd(probability);

  return Number((((odd / fair) - 1) * 100).toFixed(2));
}

/* ===================================================
   VALUE (%)
=================================================== */

export function valuePercentage(
  probability: number,
  odd: number
): number {

  const implied = impliedProbability(odd);

  return Number(((probability - implied) * 100).toFixed(2));
}

/* ===================================================
   MATCH FAIR ODDS
=================================================== */

export function fairOddsFromMatchProbabilities(
  homeWin: number,
  draw: number,
  awayWin: number
): FairOdds {

  return {

    homeWin: fairOdd(homeWin),

    draw: fairOdd(draw),

    awayWin: fairOdd(awayWin)

  };

}