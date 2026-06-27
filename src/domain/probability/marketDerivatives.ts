// src/domain/probability/marketDerivatives.ts

export interface MatrixCell {
  homeGoals: number;
  awayGoals: number;
  probability: number;
}

export interface DerivedMarket {
  name: string;
  probability: number;
  category?: string;
  source?: string;
}

function clamp(prob: number) {
  const num = Number(prob);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(1, num));
}

function normalizeMatrix(matrix: MatrixCell[]) {
  const total = matrix.reduce(
    (acc, cell) => acc + clamp(cell.probability),
    0
  );

  if (total <= 0) return matrix;

  return matrix.map(cell => ({
    ...cell,
    probability: clamp(cell.probability) / total
  }));
}

function sumProb(
  matrix: MatrixCell[],
  condition: (cell: MatrixCell) => boolean
): number {
  return clamp(
    matrix
      .filter(condition)
      .reduce((acc, cell) => acc + clamp(cell.probability), 0)
  );
}

function matchOutcome(matrix: MatrixCell[]) {
  const homeWin = sumProb(matrix, c => c.homeGoals > c.awayGoals);
  const draw = sumProb(matrix, c => c.homeGoals === c.awayGoals);
  const awayWin = sumProb(matrix, c => c.homeGoals < c.awayGoals);

  const total = homeWin + draw + awayWin;

  if (total <= 0) {
    return {
      homeWin: 0,
      draw: 0,
      awayWin: 0
    };
  }

  return {
    homeWin: clamp(homeWin / total),
    draw: clamp(draw / total),
    awayWin: clamp(awayWin / total)
  };
}

export function overUnderLine(
  matrix: MatrixCell[],
  line: number
) {
  const normalized = normalizeMatrix(matrix);

  const over = sumProb(
    normalized,
    cell => cell.homeGoals + cell.awayGoals > line
  );

  const under = 1 - over;

  return {
    over: clamp(over),
    under: clamp(under)
  };
}

function asianOver(
  matrix: MatrixCell[],
  line: number
) {
  const normalized = normalizeMatrix(matrix);

  const lowerLine = Math.floor(line);
  const upperLine = lowerLine + 0.5;

  const lowerOver = overUnderLine(normalized, lowerLine).over;
  const upperOver = overUnderLine(normalized, upperLine).over;

  return clamp((lowerOver + upperOver) / 2);
}

function asianHandicap025(
  matrix: MatrixCell[],
  side: "home" | "away"
) {
  const { homeWin, draw, awayWin } = matchOutcome(
    normalizeMatrix(matrix)
  );

  if (side === "home") {
    return clamp(homeWin + draw * 0.5);
  }

  return clamp(awayWin + draw * 0.5);
}

export function doubleChance(matrix: MatrixCell[]) {
  const { homeWin, draw, awayWin } = matchOutcome(
    normalizeMatrix(matrix)
  );

  return {
    "1X": clamp(homeWin + draw),
    "X2": clamp(draw + awayWin),
    "12": clamp(homeWin + awayWin)
  };
}

export function drawNoBet(matrix: MatrixCell[]) {
  const { homeWin, draw, awayWin } = matchOutcome(
    normalizeMatrix(matrix)
  );

  const denominator = 1 - draw;

  return {
    homeDNB: denominator > 0 ? clamp(homeWin / denominator) : 0,
    awayDNB: denominator > 0 ? clamp(awayWin / denominator) : 0
  };
}

export function teamTotalOver(
  matrix: MatrixCell[],
  team: "home" | "away",
  line: number
) {
  const normalized = normalizeMatrix(matrix);

  return sumProb(
    normalized,
    cell =>
      team === "home"
        ? cell.homeGoals > line
        : cell.awayGoals > line
  );
}

export function correctScoreTopN(
  matrix: MatrixCell[],
  topN: number = 5
) {
  return [...normalizeMatrix(matrix)]
    .sort((a, b) => b.probability - a.probability)
    .slice(0, topN)
    .map(cell => ({
      score: `${cell.homeGoals} x ${cell.awayGoals}`,
      probability: clamp(cell.probability)
    }));
}

export function firstHalfGoalProbability(
  lambdaHome: number,
  lambdaAway: number
) {
  const totalLambda = Math.max(0, Number(lambdaHome) + Number(lambdaAway));

  /*
    Aproximação profissional:
    Em média, o 1º tempo concentra cerca de 44% a 46% dos gols.
    Usar 50% tende a inflar demais o mercado de gol no 1º tempo.
  */
  const firstHalfLambda = totalLambda * 0.45;

  const probNoGoal = Math.exp(-firstHalfLambda);

  return clamp(1 - probNoGoal);
}

export function generateDerivedMarkets(
  matrix: MatrixCell[],
  lambdaHome: number,
  lambdaAway: number
): DerivedMarket[] {
  const normalized = normalizeMatrix(matrix);

  const markets: DerivedMarket[] = [];

  const add = (
    name: string,
    probability: number,
    category: string
  ) => {
    markets.push({
      name,
      probability: clamp(probability),
      category,
      source: "marketDerivatives"
    });
  };

  const over15 = overUnderLine(normalized, 1.5);
  const over25 = overUnderLine(normalized, 2.5);
  const over35 = overUnderLine(normalized, 3.5);

  add("OVER_1_5", over15.over, "GOALS");
  add("UNDER_1_5", over15.under, "GOALS");

  add("OVER_2_5", over25.over, "GOALS");
  add("UNDER_2_5", over25.under, "GOALS");

  add("OVER_3_5", over35.over, "GOALS");
  add("UNDER_3_5", over35.under, "GOALS");

  add("OVER_2_25", asianOver(normalized, 2.25), "GOALS");
  add("OVER_2_75", asianOver(normalized, 2.75), "GOALS");
  add("UNDER_2_75", 1 - asianOver(normalized, 2.75), "GOALS");

  add("HOME_MINUS_0_25", asianHandicap025(normalized, "home"), "HANDICAP");
  add("AWAY_PLUS_0_25", asianHandicap025(normalized, "away"), "HANDICAP");

  const dc = doubleChance(normalized);

  add("DOUBLE_CHANCE_1X", dc["1X"], "DOUBLE_CHANCE");
  add("DOUBLE_CHANCE_X2", dc["X2"], "DOUBLE_CHANCE");
  add("DOUBLE_CHANCE_12", dc["12"], "DOUBLE_CHANCE");

  const dnb = drawNoBet(normalized);

  add("HOME_DNB", dnb.homeDNB, "RESULT");
  add("AWAY_DNB", dnb.awayDNB, "RESULT");

  add("HOME_OVER_0_5", teamTotalOver(normalized, "home", 0.5), "TEAM_TOTAL");
  add("HOME_OVER_1_5", teamTotalOver(normalized, "home", 1.5), "TEAM_TOTAL");
  add("HOME_OVER_2_5", teamTotalOver(normalized, "home", 2.5), "TEAM_TOTAL");

  add("AWAY_OVER_0_5", teamTotalOver(normalized, "away", 0.5), "TEAM_TOTAL");
  add("AWAY_OVER_1_5", teamTotalOver(normalized, "away", 1.5), "TEAM_TOTAL");
  add("AWAY_OVER_2_5", teamTotalOver(normalized, "away", 2.5), "TEAM_TOTAL");

  add(
    "FIRST_HALF_GOAL",
    firstHalfGoalProbability(lambdaHome, lambdaAway),
    "GOALS"
  );

  return markets;
}