export function simulationPipeline(model: any) {
  const safe = (n: any, fallback = 0) => {
    const num = Number(n);
    return isNaN(num) ? fallback : num;
  };

  const clamp = (n: number, min: number, max: number) =>
    Math.max(min, Math.min(n, max));

  let lambdaHome = clamp(safe(model?.lambdaHome, 1.2), 0.35, 3.4);
  let lambdaAway = clamp(safe(model?.lambdaAway, 1.0), 0.35, 3.4);

  const simulations = 10000;
  const scoreMap: Record<string, number> = {};

  let over25Hits = 0;
  let over15Hits = 0;
  let bttsHits = 0;
  let homeWinHits = 0;
  let drawHits = 0;
  let awayWinHits = 0;

  for (let i = 0; i < simulations; i++) {
    const homeGoals = samplePoisson(lambdaHome);
    const awayGoals = samplePoisson(lambdaAway);

    const totalGoals = homeGoals + awayGoals;

    /* ===========================
       🎯 MERCADOS
    ============================ */

    if (totalGoals >= 3) over25Hits++;
    if (totalGoals >= 2) over15Hits++;

    if (homeGoals > 0 && awayGoals > 0) bttsHits++;

    if (homeGoals > awayGoals) homeWinHits++;
    else if (homeGoals === awayGoals) drawHits++;
    else awayWinHits++;

    /* ===========================
       📊 SCORE MAP
    ============================ */

    const key = `${homeGoals}-${awayGoals}`;
    scoreMap[key] = (scoreMap[key] || 0) + 1;
  }

  /* ===========================
     📊 PROBABILIDADES
  ============================ */

  const over25Prob = over25Hits / simulations;
  const over15Prob = over15Hits / simulations;
  const bttsProb = bttsHits / simulations;

  const homeWinProb = homeWinHits / simulations;
  const drawProb = drawHits / simulations;
  const awayWinProb = awayWinHits / simulations;

  const doubleChance1X = homeWinProb + drawProb;
  const doubleChanceX2 = drawProb + awayWinProb;
  const doubleChance12 = homeWinProb + awayWinProb;

  const totalLambda = Number((lambdaHome + lambdaAway).toFixed(4));

  /* ===========================
     🔥 PROB PRINCIPAL (CORE)
  ============================ */

  const marketCandidates = [
    { market: "OVER_2.5", prob: over25Prob },
    { market: "BTTS_YES", prob: bttsProb },
    { market: "HOME_WIN", prob: homeWinProb },
    { market: "DRAW", prob: drawProb },
    { market: "AWAY_WIN", prob: awayWinProb }
  ].sort((a, b) => b.prob - a.prob);

  const mainMarket = marketCandidates[0]?.market || null;
  const mainProb = marketCandidates[0]?.prob || 0;

  /* ===========================
     🔥 TOP SCORES
  ============================ */

  const topScores = Object.entries(scoreMap)
    .map(([score, count]) => ({
      score,
      prob: count / simulations
    }))
    .sort((a, b) => b.prob - a.prob)
    .slice(0, 5);

  return {
    ...model,

    monteCarlo: {
      iterations: simulations,

      lambdaHome,
      lambdaAway,
      totalLambda,

      over15Prob,
      over25Prob,
      bttsProb,

      homeWinProb,
      drawProb,
      awayWinProb,

      doubleChance1X,
      doubleChanceX2,
      doubleChance12,

      mainMarket,
      mainProb,
      topScores,

      debug: {
        source: "simulationPipeline",
        lambdaHome,
        lambdaAway,
        totalLambda
      }
    }
  };
}

/* ===========================
   🎲 POISSON RANDOM
=========================== */

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