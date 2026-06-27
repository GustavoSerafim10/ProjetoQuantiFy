export interface MonteCarloMatchResult {
  homeWin: number;
  draw: number;
  awayWin: number;

  over15: number;
  over25: number;
  under25: number;

  bttsYes: number;
  bttsNo: number;

  doubleChance1X: number;
  doubleChanceX2: number;
  doubleChance12: number;

  iterations: number;
  lambdaHome: number;
  lambdaAway: number;
  totalLambda: number;
}

function safe(n: any, fallback = 1) {
  const num = Number(n);
  return Number.isFinite(num) ? num : fallback;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(n, max));
}

function sanitizeLambda(lambda: number, fallback = 1.2) {
  return clamp(safe(lambda, fallback), 0.35, 2.25);
}

function samplePoisson(lambda: number): number {
  const L = Math.exp(-lambda);
  let p = 1;
  let k = 0;

  do {
    k++;
    p *= Math.random();
  } while (p > L);

  return k - 1;
}

export function monteCarloPoisson(
  lambdaHome: number,
  lambdaAway: number,
  simulations: number = 50000
): MonteCarloMatchResult {
  const safeLambdaHome = sanitizeLambda(lambdaHome, 1.2);
  const safeLambdaAway = sanitizeLambda(lambdaAway, 1.0);

  const totalSimulations = Math.max(
    1000,
    Math.floor(safe(simulations, 50000))
  );

  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;

  let over15 = 0;
  let over25 = 0;
  let bttsYes = 0;

  for (let i = 0; i < totalSimulations; i++) {
    const homeGoals = samplePoisson(safeLambdaHome);
    const awayGoals = samplePoisson(safeLambdaAway);

    const totalGoals = homeGoals + awayGoals;

    if (homeGoals > awayGoals) homeWin++;
    else if (homeGoals === awayGoals) draw++;
    else awayWin++;

    if (totalGoals >= 2) over15++;
    if (totalGoals >= 3) over25++;

    if (homeGoals > 0 && awayGoals > 0) bttsYes++;
  }

  const homeWinProb = homeWin / totalSimulations;
  const drawProb = draw / totalSimulations;
  const awayWinProb = awayWin / totalSimulations;

  const over15Prob = over15 / totalSimulations;
  const over25Prob = over25 / totalSimulations;
  const bttsYesProb = bttsYes / totalSimulations;

  return {
    homeWin: homeWinProb,
    draw: drawProb,
    awayWin: awayWinProb,

    over15: over15Prob,
    over25: over25Prob,
    under25: 1 - over25Prob,

    bttsYes: bttsYesProb,
    bttsNo: 1 - bttsYesProb,

    doubleChance1X: homeWinProb + drawProb,
    doubleChanceX2: drawProb + awayWinProb,
    doubleChance12: homeWinProb + awayWinProb,

    iterations: totalSimulations,
    lambdaHome: safeLambdaHome,
    lambdaAway: safeLambdaAway,
    totalLambda: Number((safeLambdaHome + safeLambdaAway).toFixed(4)),
  };
}