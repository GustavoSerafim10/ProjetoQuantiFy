// src/domain/probability/marketDerivatives.ts

export interface MatrixCell {
  homeGoals: number;
  awayGoals: number;
  probability: number;
}

export interface DerivedMarket {
  name: string;
  probability: number;
}

/* =========================================
   UTIL
========================================= */

function sumProb(
  matrix: MatrixCell[],
  condition: (cell: MatrixCell) => boolean
): number {
  return matrix
    .filter(condition)
    .reduce((acc, cell) => acc + cell.probability, 0);
}

function clamp(prob: number) {
  return Math.max(0, Math.min(1, prob));
}

/* =========================================
   RESULTADO BASE
========================================= */

function matchOutcome(matrix: MatrixCell[]) {
  const homeWin = sumProb(matrix, c => c.homeGoals > c.awayGoals);
  const draw = sumProb(matrix, c => c.homeGoals === c.awayGoals);
  const awayWin = sumProb(matrix, c => c.homeGoals < c.awayGoals);

  return { homeWin, draw, awayWin };
}

/* =========================================
   OVER / UNDER GENÉRICO
========================================= */

export function overUnderLine(
  matrix: MatrixCell[],
  line: number
) {
  const over = sumProb(
    matrix,
    cell => cell.homeGoals + cell.awayGoals > line
  );

  const under = 1 - over;

  return { over: clamp(over), under: clamp(under) };
}

/* =========================================
   ASIAN OVER (linhas quebradas)
========================================= */

function asianOver(
  matrix: MatrixCell[],
  line: number
) {
  const fullOver = overUnderLine(matrix, Math.floor(line + 0.01)).over;
  const halfOver = overUnderLine(matrix, line).over;

  return clamp((fullOver + halfOver) / 2);
}

/* =========================================
   ASIAN HANDICAP -0.25 / +0.25
========================================= */

function asianHandicap025(
  matrix: MatrixCell[],
  side: "home" | "away"
) {
  const { homeWin, draw, awayWin } = matchOutcome(matrix);

  if (side === "home") {
    return clamp(homeWin + draw * 0.5);
  }

  return clamp(awayWin + draw * 0.5);
}

/* =========================================
   DOUBLE CHANCE
========================================= */

export function doubleChance(matrix: MatrixCell[]) {
  const { homeWin, draw, awayWin } = matchOutcome(matrix);

  return {
    "1X": clamp(homeWin + draw),
    "X2": clamp(draw + awayWin),
    "12": clamp(homeWin + awayWin)
  };
}

/* =========================================
   DRAW NO BET
========================================= */

export function drawNoBet(matrix: MatrixCell[]) {
  const { homeWin, draw, awayWin } = matchOutcome(matrix);

  const denominator = 1 - draw;

  return {
    homeDNB: denominator > 0 ? clamp(homeWin / denominator) : 0,
    awayDNB: denominator > 0 ? clamp(awayWin / denominator) : 0
  };
}

/* =========================================
   TEAM TOTALS
========================================= */

export function teamTotalOver(
  matrix: MatrixCell[],
  team: "home" | "away",
  line: number
) {
  return clamp(
    sumProb(
      matrix,
      cell =>
        team === "home"
          ? cell.homeGoals > line
          : cell.awayGoals > line
    )
  );
}

/* =========================================
   CORRECT SCORE TOP N
========================================= */

export function correctScoreTopN(
  matrix: MatrixCell[],
  topN: number = 5
) {
  return [...matrix]
    .sort((a, b) => b.probability - a.probability)
    .slice(0, topN)
    .map(cell => ({
      score: `${cell.homeGoals} x ${cell.awayGoals}`,
      probability: cell.probability
    }));
}

/* =========================================
   FIRST HALF GOAL (Poisson approx)
========================================= */

export function firstHalfGoalProbability(
  lambdaHome: number,
  lambdaAway: number
) {
  const firstHalfLambda = (lambdaHome + lambdaAway) / 2;
  const probNoGoal = Math.exp(-firstHalfLambda);
  return clamp(1 - probNoGoal);
}

/* =========================================
   GERADOR PRINCIPAL EXPANDIDO
========================================= */

export function generateDerivedMarkets(
  matrix: MatrixCell[],
  lambdaHome: number,
  lambdaAway: number
): DerivedMarket[] {

  const markets: DerivedMarket[] = [];

  /* ---------- Over/Under Clássico ---------- */

  [1.5, 2.5, 3.5].forEach(line => {
    const { over, under } = overUnderLine(matrix, line);

    markets.push({ name: `OVER ${line}`, probability: over });
    markets.push({ name: `UNDER ${line}`, probability: under });
  });

  /* ---------- Asian Totals ---------- */

  markets.push({
    name: "OVER 2.25",
    probability: asianOver(matrix, 2.25)
  });

  markets.push({
    name: "OVER 2.75",
    probability: asianOver(matrix, 2.75)
  });

  markets.push({
    name: "UNDER 2.75",
    probability: 1 - asianOver(matrix, 2.75)
  });

  /* ---------- Asian Handicap ---------- */

  markets.push({
    name: "HOME -0.25",
    probability: asianHandicap025(matrix, "home")
  });

  markets.push({
    name: "AWAY +0.25",
    probability: asianHandicap025(matrix, "away")
  });

  /* ---------- Double Chance ---------- */

  const dc = doubleChance(matrix);
  Object.entries(dc).forEach(([name, prob]) => {
    markets.push({
      name: `DOUBLE CHANCE ${name}`,
      probability: prob
    });
  });

  /* ---------- Draw No Bet ---------- */

  const dnb = drawNoBet(matrix);

  markets.push({
    name: "HOME DNB",
    probability: dnb.homeDNB
  });

  markets.push({
    name: "AWAY DNB",
    probability: dnb.awayDNB
  });

  /* ---------- Team Totals ---------- */

  markets.push({
    name: "HOME OVER 0.5",
    probability: teamTotalOver(matrix, "home", 0.5)
  });

  markets.push({
    name: "HOME OVER 1.5",
    probability: teamTotalOver(matrix, "home", 1.5)
  });

  markets.push({
    name: "HOME OVER 2.5",
    probability: teamTotalOver(matrix, "home", 2.5)
  });

  markets.push({
    name: "AWAY OVER 0.5",
    probability: teamTotalOver(matrix, "away", 0.5)
  });

  markets.push({
    name: "AWAY OVER 1.5",
    probability: teamTotalOver(matrix, "away", 1.5)
  });

  markets.push({
    name: "AWAY OVER 2.5",
    probability: teamTotalOver(matrix, "away", 2.5)
  });

  /* ---------- First Half ---------- */

  markets.push({
    name: "1ST HALF GOAL",
    probability: firstHalfGoalProbability(
      lambdaHome,
      lambdaAway
    )
  });

  return markets;
}