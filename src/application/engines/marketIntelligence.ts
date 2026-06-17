/* ===========================
   🧠 MARKET INTELLIGENCE ENGINE
   Multi-market profile
=========================== */

function safe(n: any, fallback = 0) {
  const num = Number(n);
  return isNaN(num) ? fallback : num;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(n, max));
}

export function analyzeMarketContext(data: any) {
  const lambdaHome = safe(data.lambdaHome, 1);
  const lambdaAway = safe(data.lambdaAway, 1);

  const totalLambda = lambdaHome + lambdaAway;
  const diffLambda = Math.abs(lambdaHome - lambdaAway);
  const minLambda = Math.min(lambdaHome, lambdaAway);

  const goalScore = safe(data.goalExpectationScore, 0.5);

  const homeStats = data.homeStats ?? {};
  const awayStats = data.awayStats ?? {};

  /* ===========================
     INPUTS OFENSIVOS
  ============================ */

  const homeShots = safe(homeStats.shots, safe(homeStats.shotsPerMatch, 8));
  const awayShots = safe(awayStats.shots, safe(awayStats.shotsPerMatch, 8));

  const homeSOT = safe(homeStats.shotsOnTarget, safe(homeStats.shotsOnTargetPerMatch, 3));
  const awaySOT = safe(awayStats.shotsOnTarget, safe(awayStats.shotsOnTargetPerMatch, 3));

  const homeBig = safe(homeStats.bigChances, 1);
  const awayBig = safe(awayStats.bigChances, 1);

  const homeGF = safe(homeStats.goalsFor, safe(homeStats.goalsForPerMatch, 1.2));
  const awayGF = safe(awayStats.goalsFor, safe(awayStats.goalsForPerMatch, 1.1));

  const homeGA = safe(homeStats.goalsAgainst, safe(homeStats.goalsAgainstPerMatch, 1.1));
  const awayGA = safe(awayStats.goalsAgainst, safe(awayStats.goalsAgainstPerMatch, 1.1));

  const homeBTTS = safe(homeStats.btts, 0.5);
  const awayBTTS = safe(awayStats.btts, 0.5);

  const homeOver15 = safe(homeStats.over15, 0.68);
  const awayOver15 = safe(awayStats.over15, 0.68);

  const homeOver25 = safe(homeStats.over25, 0.48);
  const awayOver25 = safe(awayStats.over25, 0.48);

  /* ===========================
     GAME PACE
  ============================ */

  const totalShots = homeShots + awayShots;
  const totalSOT = homeSOT + awaySOT;
  const totalBig = homeBig + awayBig;

  const paceRaw =
    (totalShots / 24) * 0.35 +
    (totalSOT / 8) * 0.35 +
    (totalBig / 4) * 0.30;

  const gamePace = clamp(paceRaw, 0, 1);

  let paceLevel: "low" | "medium" | "high" = "medium";

  if (gamePace >= 0.68) paceLevel = "high";
  else if (gamePace <= 0.38) paceLevel = "low";

  /* ===========================
     SCORES POR MERCADO
  ============================ */

  const goalsProfile = clamp(
    goalScore * 0.35 +
    clamp(totalLambda / 3.0, 0, 1) * 0.30 +
    gamePace * 0.20 +
    ((homeOver15 + awayOver15) / 2) * 0.15,
    0,
    1
  );

  const over25Profile = clamp(
    goalScore * 0.30 +
    clamp(totalLambda / 3.1, 0, 1) * 0.30 +
    gamePace * 0.20 +
    ((homeOver25 + awayOver25) / 2) * 0.20,
    0,
    1
  );

  const bttsProfile = clamp(
    minLambda / 1.35 * 0.30 +
    ((homeBTTS + awayBTTS) / 2) * 0.25 +
    ((homeGF + awayGF) / 3.0) * 0.20 +
    ((homeGA + awayGA) / 3.0) * 0.15 +
    (Math.min(homeBig, awayBig) / 2.0) * 0.10,
    0,
    1
  );

  const resultProfile = clamp(
    diffLambda / 1.4 * 0.35 +
    Math.abs(homeGF - awayGF) / 2.0 * 0.20 +
    Math.abs(homeGA - awayGA) / 2.0 * 0.15 +
    safe(data.pressureFactor, 1) / 1.3 * 0.15 +
    (1 - Math.min(1, safe(data.result?.draw, 0.30) / 0.35)) * 0.15,
    0,
    1
  );

  const doubleChanceProfile = clamp(
    resultProfile * 0.45 +
    (1 - clamp(diffLambda / 2.0, 0, 1)) * 0.20 +
    clamp(Math.max(lambdaHome, lambdaAway) / 1.7, 0, 1) * 0.20 +
    (1 - clamp(goalScore, 0, 1)) * 0.15,
    0,
    1
  );

  /* ===========================
     CLASSIFICAÇÃO DO JOGO
  ============================ */

  let gameType: "open" | "balanced" | "closed" | "dominant" = "balanced";

  if (goalsProfile >= 0.68 && paceLevel !== "low") {
    gameType = "open";
  } else if (resultProfile >= 0.64 && diffLambda >= 0.55) {
    gameType = "dominant";
  } else if (goalsProfile <= 0.45 && paceLevel === "low") {
    gameType = "closed";
  }

  const dominantSide =
    lambdaHome >= lambdaAway ? "HOME" : "AWAY";

  /* ===========================
     PESOS POR MERCADO
  ============================ */

  const weights: Record<string, number> = {
    OVER_1_5:
      goalsProfile >= 0.62 ? 1.08 :
      goalsProfile <= 0.45 ? 0.90 :
      1.00,

    OVER_2_5:
      over25Profile >= 0.66 ? 1.14 :
      over25Profile <= 0.48 ? 0.88 :
      1.00,

    BTTS_YES:
      bttsProfile >= 0.64 ? 1.12 :
      bttsProfile <= 0.46 ? 0.86 :
      1.00,

    BTTS_NO:
      bttsProfile <= 0.42 ? 1.12 :
      bttsProfile >= 0.62 ? 0.88 :
      1.00,

    HOME:
      dominantSide === "HOME" && resultProfile >= 0.60 ? 1.12 :
      dominantSide !== "HOME" ? 0.92 :
      1.00,

    AWAY:
      dominantSide === "AWAY" && resultProfile >= 0.60 ? 1.12 :
      dominantSide !== "AWAY" ? 0.92 :
      1.00,

    DRAW:
      diffLambda <= 0.25 && totalLambda <= 2.6 ? 1.10 :
      diffLambda >= 0.70 ? 0.88 :
      1.00,

    DOUBLE_CHANCE_1X:
      dominantSide === "HOME" && doubleChanceProfile >= 0.58 ? 1.08 :
      dominantSide === "AWAY" ? 0.94 :
      1.00,

    DOUBLE_CHANCE_X2:
      dominantSide === "AWAY" && doubleChanceProfile >= 0.58 ? 1.08 :
      dominantSide === "HOME" ? 0.94 :
      1.00,
  };

  /* ===========================
     BLOQUEIOS / ALERTAS
  ============================ */

  const isBadOverGame =
    goalsProfile < 0.45 ||
    totalLambda < 2.15 ||
    paceLevel === "low";

  const isBadBTTSGame =
    bttsProfile < 0.46 ||
    minLambda < 0.85;

  const isBadResultGame =
    resultProfile < 0.42 ||
    diffLambda < 0.25;

  const isBadDoubleChanceGame =
    doubleChanceProfile < 0.46;

  return {
    gameType,
    paceLevel,
    gamePace,

    profiles: {
      goalsProfile: Number(goalsProfile.toFixed(4)),
      over25Profile: Number(over25Profile.toFixed(4)),
      bttsProfile: Number(bttsProfile.toFixed(4)),
      resultProfile: Number(resultProfile.toFixed(4)),
      doubleChanceProfile: Number(doubleChanceProfile.toFixed(4)),
    },

    weights,

    isBadOverGame,
    isBadBTTSGame,
    isBadResultGame,
    isBadDoubleChanceGame,

    dominantSide,
    totalLambda: Number(totalLambda.toFixed(4)),
    diffLambda: Number(diffLambda.toFixed(4)),
    minLambda: Number(minLambda.toFixed(4))
  };
}