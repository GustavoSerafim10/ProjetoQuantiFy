export function simulationPipeline(model: any) {
  const safe = (n: any, fallback = 0) => {
    const num = Number(n);
    return Number.isFinite(num) ? num : fallback;
  };

  const clamp = (n: number, min: number, max: number) =>
    Math.max(min, Math.min(n, max));

  const lambdaHome = clamp(safe(model?.lambdaHome, 1.2), 0.35, 2.25);
  const lambdaAway = clamp(safe(model?.lambdaAway, 1.0), 0.35, 2.25);

  const simulations = 20000;
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

    if (totalGoals >= 3) over25Hits++;
    if (totalGoals >= 2) over15Hits++;
    if (homeGoals > 0 && awayGoals > 0) bttsHits++;

    if (homeGoals > awayGoals) homeWinHits++;
    else if (homeGoals === awayGoals) drawHits++;
    else awayWinHits++;

    const key = `${homeGoals}-${awayGoals}`;
    scoreMap[key] = (scoreMap[key] || 0) + 1;
  }

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

  const modelComparison = {
    OVER_1_5: {
      model: model?.goals?.over15 ?? null,
      monteCarlo: over15Prob,
      diff: diff(model?.goals?.over15, over15Prob),
    },
    OVER_2_5: {
      model: model?.goals?.over25 ?? null,
      monteCarlo: over25Prob,
      diff: diff(model?.goals?.over25, over25Prob),
    },
    BTTS_YES: {
      model: model?.btts?.yes ?? null,
      monteCarlo: bttsProb,
      diff: diff(model?.btts?.yes, bttsProb),
    },
    HOME_WIN: {
      model: model?.result?.homeWin ?? null,
      monteCarlo: homeWinProb,
      diff: diff(model?.result?.homeWin, homeWinProb),
    },
    DRAW: {
      model: model?.result?.draw ?? null,
      monteCarlo: drawProb,
      diff: diff(model?.result?.draw, drawProb),
    },
    AWAY_WIN: {
      model: model?.result?.awayWin ?? null,
      monteCarlo: awayWinProb,
      diff: diff(model?.result?.awayWin, awayWinProb),
    },
  };

  const marketCandidates = [
    { market: "OVER_1_5", prob: over15Prob },
    { market: "OVER_2_5", prob: over25Prob },
    { market: "BTTS_YES", prob: bttsProb },
    { market: "HOME_WIN", prob: homeWinProb },
    { market: "DRAW", prob: drawProb },
    { market: "AWAY_WIN", prob: awayWinProb },
    { market: "DOUBLE_CHANCE_1X", prob: doubleChance1X },
    { market: "DOUBLE_CHANCE_X2", prob: doubleChanceX2 },
  ].sort((a, b) => b.prob - a.prob);

  const mainMarket = marketCandidates[0]?.market || null;
  const mainProb = marketCandidates[0]?.prob || 0;

  const topScores = Object.entries(scoreMap)
    .map(([score, count]) => ({
      score,
      prob: count / simulations,
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
      modelComparison,

      debug: {
        source: "simulationPipeline",
        lambdaHome,
        lambdaAway,
        totalLambda,
        modelComparison,
      },
    },

    debug: {
      ...(model.debug || {}),
      simulationPipeline: {
        iterations: simulations,
        lambdaHome,
        lambdaAway,
        totalLambda,
        mainMarket,
        mainProb,
        topScores,
        modelComparison,
      },
    },
  };
}

function diff(modelProb: any, monteCarloProb: number) {
  const modelNumber = Number(modelProb);

  if (!Number.isFinite(modelNumber)) return null;

  return Number(Math.abs(modelNumber - monteCarloProb).toFixed(4));
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