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

const MAX_GOALS = 5; // 🔒 FIXO PARA ESTABILIDADE

export function goalMatrix(
  lambdaHome: number,
  lambdaAway: number
): ScoreProbability[] {

  // 🔒 Proteção contra valores inválidos
  if (!isFinite(lambdaHome) || !isFinite(lambdaAway)) {
    lambdaHome = 1.2;
    lambdaAway = 1.2;
  }

  if (lambdaHome < 0) lambdaHome = 0.5;
  if (lambdaAway < 0) lambdaAway = 0.5;

  const matrix: ScoreProbability[] = [];

  const rho = -0.08;

  for (let home = 0; home <= MAX_GOALS; home++) {
    for (let away = 0; away <= MAX_GOALS; away++) {

      const probHome = poissonPMF(lambdaHome, home);
      const probAway = poissonPMF(lambdaAway, away);

      const base = probHome * probAway;

      const tau = dixonColesAdjustment(
        home,
        away,
        lambdaHome,
        lambdaAway,
        rho
      );

      const adjusted = Math.max(0, base * tau);

      matrix.push({
        homeGoals: home,
        awayGoals: away,
        probability: adjusted
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
    if (score.homeGoals === score.awayGoals) draw += score.probability;
    if (score.homeGoals < score.awayGoals) awayWin += score.probability;
  }

  return { homeWin, draw, awayWin };
}

function normalizeMatrix(
  matrix: ScoreProbability[]
): ScoreProbability[] {

  const total = matrix.reduce((acc, s) => acc + s.probability, 0);

  if (!isFinite(total) || total === 0) {
    return matrix.map(s => ({
      ...s,
      probability: 1 / matrix.length
    }));
  }

  return matrix.map(s => ({
    ...s,
    probability: s.probability / total
  }));
}

export function overUnderProbability(
  matrix: ScoreProbability[],
  line: number
) {
  let over = 0;
  let under = 0;

  for (const cell of matrix) {
    const total = cell.homeGoals + cell.awayGoals;
    if (total > line) over += cell.probability;
    else under += cell.probability;
  }

  return { over, under };
}

export function bttsProbability(
  matrix: ScoreProbability[]
) {
  let yes = 0;
  let no = 0;

  for (const cell of matrix) {
    if (cell.homeGoals > 0 && cell.awayGoals > 0) yes += cell.probability;
    else no += cell.probability;
  }

  return { yes, no };
}