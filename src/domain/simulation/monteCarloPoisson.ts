export interface MonteCarloMatchResult {
  homeWin: number;
  draw: number;
  awayWin: number;

  over15: number;
  over25: number;
  under25: number;

  bttsYes: number;
  bttsNo: number;
}

function safe(n: any, fallback = 1) {
  const num = Number(n);
  return isNaN(num) ? fallback : num;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(n, max));
}

function sanitizeLambda(lambda: number, fallback = 1.2) {
  return clamp(safe(lambda, fallback), 0.35, 2.15);
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

  const totalSimulations = Math.max(1000, Math.floor(safe(simulations, 100000)));

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

    /* ===========================
       RESULTADO
    =========================== */

    if (homeGoals > awayGoals) homeWin++;
    else if (homeGoals === awayGoals) draw++;
    else awayWin++;

    /* ===========================
       GOALS
    =========================== */

    if (totalGoals >= 2) over15++;
    if (totalGoals >= 3) over25++;

    /* ===========================
       BTTS
    =========================== */

    if (homeGoals > 0 && awayGoals > 0) bttsYes++;
  }

  return {
    homeWin: homeWin / totalSimulations,
    draw: draw / totalSimulations,
    awayWin: awayWin / totalSimulations,

    over15: over15 / totalSimulations,
    over25: over25 / totalSimulations,
    under25: 1 - over25 / totalSimulations,

    bttsYes: bttsYes / totalSimulations,
    bttsNo: 1 - bttsYes / totalSimulations
  };
}