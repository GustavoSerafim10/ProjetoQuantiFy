export function simulationPipeline(model: any) {

  const { lambdaHome, lambdaAway } = model;

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

  /* ===========================
     🔥 PROB PRINCIPAL (CORE)
  ============================ */

  const mainProb = Math.max(
    over25Prob,
    bttsProb,
    homeWinProb,
    drawProb,
    awayWinProb
  );

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

      over15Prob,
      over25Prob,
      bttsProb,

      homeWinProb,
      drawProb,
      awayWinProb,

      mainProb, // 🔥 ESSENCIAL
      topScores
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