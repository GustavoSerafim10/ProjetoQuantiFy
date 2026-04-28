export type SkellamResult = {
  homeWinProb: number;
  drawProb: number;
  awayWinProb: number;
  doubleChance1X: number;
  doubleChanceX2: number;
  doubleChance12: number;
  confidence: number;
  distribution: {
    goalDifference: number;
    probability: number;
  }[];
};

/**
 * Modified Bessel function of the first kind I_n(x)
 * Aproximação numérica via série.
 */
function modifiedBesselFirstKind(order: number, x: number): number {
  const n = Math.abs(Math.trunc(order));
  const MAX_TERMS = 60;
  const EPSILON = 1e-12;

  let sum = 0;

  for (let k = 0; k < MAX_TERMS; k++) {
    const numerator = Math.pow(x / 2, 2 * k + n);
    const denominator = factorial(k) * factorial(k + n);

    const term = numerator / denominator;
    sum += term;

    if (Math.abs(term) < EPSILON) break;
  }

  return sum;
}

function factorial(n: number): number {
  if (n < 0) return 0;
  if (n === 0 || n === 1) return 1;

  let result = 1;

  for (let i = 2; i <= n; i++) {
    result *= i;
  }

  return result;
}

/**
 * Skellam PMF:
 * P(K = k), onde K = HomeGoals - AwayGoals
 */
export function skellamPMF(
  k: number,
  lambdaHome: number,
  lambdaAway: number
): number {
  const lh = Math.max(0.05, lambdaHome);
  const la = Math.max(0.05, lambdaAway);

  const expPart = Math.exp(-(lh + la));
  const ratioPart = Math.pow(lh / la, k / 2);
  const besselPart = modifiedBesselFirstKind(
    Math.abs(k),
    2 * Math.sqrt(lh * la)
  );

  const prob = expPart * ratioPart * besselPart;

  if (!Number.isFinite(prob) || prob < 0) return 0;

  return prob;
}

function calculateResultConfidence(
  homeWinProb: number,
  drawProb: number,
  awayWinProb: number
): number {
  const maxProb = Math.max(homeWinProb, drawProb, awayWinProb);
  const secondProb = [homeWinProb, drawProb, awayWinProb]
    .sort((a, b) => b - a)[1];

  const separation = maxProb - secondProb;

  return Math.max(0, Math.min(1, separation * 2.5));
}

export function calculateSkellamProbabilities(
  lambdaHome: number,
  lambdaAway: number,
  maxGoalDifference = 12
): SkellamResult {
  let homeWinProb = 0;
  let drawProb = 0;
  let awayWinProb = 0;

  const distribution: {
    goalDifference: number;
    probability: number;
  }[] = [];

  for (let diff = -maxGoalDifference; diff <= maxGoalDifference; diff++) {
    const probability = skellamPMF(diff, lambdaHome, lambdaAway);

    distribution.push({
      goalDifference: diff,
      probability
    });

    if (diff > 0) homeWinProb += probability;
    else if (diff === 0) drawProb += probability;
    else awayWinProb += probability;
  }

  const total = homeWinProb + drawProb + awayWinProb;

  if (total > 0) {
    homeWinProb /= total;
    drawProb /= total;
    awayWinProb /= total;
  }

  const doubleChance1X = homeWinProb + drawProb;
  const doubleChanceX2 = awayWinProb + drawProb;
  const doubleChance12 = homeWinProb + awayWinProb;

  const confidence = calculateResultConfidence(
    homeWinProb,
    drawProb,
    awayWinProb
  );

  return {
    homeWinProb,
    drawProb,
    awayWinProb,
    doubleChance1X,
    doubleChanceX2,
    doubleChance12,
    confidence,
    distribution
  };
}