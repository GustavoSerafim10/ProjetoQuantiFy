export interface MonteCarloMatchResult {
  homeWin: number;
  draw: number;
  awayWin: number;

  over15: number;   // 🔥 NOVO
  over25: number;
  under25: number;

  bttsYes: number;
  bttsNo: number;
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
  simulations: number = 100000
): MonteCarloMatchResult {

  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;

  let over15 = 0;   // 🔥 NOVO
  let over25 = 0;

  let bttsYes = 0;

  for (let i = 0; i < simulations; i++) {

    const homeGoals = samplePoisson(lambdaHome);
    const awayGoals = samplePoisson(lambdaAway);

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

    if (totalGoals >= 2) over15++;   // 🔥 CORRETO (Over 1.5)
    if (totalGoals >= 3) over25++;   // 🔥 MAIS PRECISO (>=3)

    /* ===========================
       BTTS
    =========================== */

    if (homeGoals > 0 && awayGoals > 0) bttsYes++;
  }

  const total = simulations;

  return {
    homeWin: homeWin / total,
    draw: draw / total,
    awayWin: awayWin / total,

    over15: over15 / total, // 🔥 NOVO
    over25: over25 / total,
    under25: 1 - (over25 / total),

    bttsYes: bttsYes / total,
    bttsNo: 1 - (bttsYes / total)
  };
}