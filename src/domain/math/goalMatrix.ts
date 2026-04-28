import { poissonPMF } from "./poisson";
import { dixonColesAdjustment } from "./dixonColes";

export interface ScoreProbability {
  homeGoals: number;
  awayGoals: number;
  probability: number;
}

export interface MatchOutcome {
  homeWin: number;
  draw: number;
  awayWin: number;
}

export interface GoalMatrixOptions {
  maxGoals?: number;
  rho?: number;
}

const DEFAULT_MAX_GOALS = 10;
const DEFAULT_RHO = -0.12;

function clampLambda(lambda: number, fallback = 1.2): number {
  if (!Number.isFinite(lambda)) return fallback;
  return Math.max(0.05, Math.min(lambda, 4.5));
}

export function goalMatrix(
  lambdaHome: number,
  lambdaAway: number,
  options: GoalMatrixOptions = {}
): ScoreProbability[] {
  const safeLambdaHome = clampLambda(lambdaHome, 1.2);
  const safeLambdaAway = clampLambda(lambdaAway, 1.2);

  const maxGoals = options.maxGoals ?? DEFAULT_MAX_GOALS;
  const rho = options.rho ?? DEFAULT_RHO;

  const matrix: ScoreProbability[] = [];

  for (let home = 0; home <= maxGoals; home++) {
    for (let away = 0; away <= maxGoals; away++) {
      const probHome = poissonPMF(safeLambdaHome, home);
      const probAway = poissonPMF(safeLambdaAway, away);

      const baseProbability = probHome * probAway;

      const dcAdjustment = dixonColesAdjustment(
        home,
        away,
        safeLambdaHome,
        safeLambdaAway,
        rho
      );

      const adjustedProbability = Math.max(
        0,
        baseProbability * dcAdjustment
      );

      matrix.push({
        homeGoals: home,
        awayGoals: away,
        probability: adjustedProbability
      });
    }
  }

  return normalizeMatrix(matrix);
}

export function matchOutcomeProbabilities(
  matrix: ScoreProbability[]
): MatchOutcome {
  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;

  for (const score of matrix) {
    if (score.homeGoals > score.awayGoals) homeWin += score.probability;
    else if (score.homeGoals === score.awayGoals) draw += score.probability;
    else awayWin += score.probability;
  }

  return { homeWin, draw, awayWin };
}

function normalizeMatrix(matrix: ScoreProbability[]): ScoreProbability[] {
  const total = matrix.reduce(
    (acc, score) => acc + score.probability,
    0
  );

  if (!Number.isFinite(total) || total <= 0) {
    const fallbackProbability = 1 / matrix.length;

    return matrix.map(score => ({
      ...score,
      probability: fallbackProbability
    }));
  }

  return matrix.map(score => ({
    ...score,
    probability: score.probability / total
  }));
}

export function overUnderProbability(
  matrix: ScoreProbability[],
  line: number
) {
  let over = 0;
  let under = 0;

  for (const cell of matrix) {
    const totalGoals = cell.homeGoals + cell.awayGoals;

    if (totalGoals > line) over += cell.probability;
    else under += cell.probability;
  }

  return { over, under };
}

export function bttsProbability(matrix: ScoreProbability[]) {
  let yes = 0;
  let no = 0;

  for (const cell of matrix) {
    if (cell.homeGoals > 0 && cell.awayGoals > 0) {
      yes += cell.probability;
    } else {
      no += cell.probability;
    }
  }

  return { yes, no };
}