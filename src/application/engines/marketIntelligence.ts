
function safe(n: any, fallback = 0) {
  const num = Number(n);
  return Number.isFinite(num) ? num : fallback;
}

function clamp(n: number, min = 0, max = 1) {
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

  const totalShots = homeShots + awayShots;
  const totalSOT = homeSOT + awaySOT;
  const totalBig = homeBig + awayBig;

  const paceRaw =
    (totalShots / 24) * 0.35 +
    (totalSOT / 8) * 0.35 +
    (totalBig / 4) * 0.30;

  const gamePace = clamp(paceRaw);

  let paceLevel: "low" | "medium" | "high" = "medium";

  if (gamePace >= 0.68) paceLevel = "high";
  else if (gamePace <= 0.38) paceLevel = "low";

  const goalsProfile = clamp(
    goalScore * 0.35 +
    clamp(totalLambda / 3.0) * 0.30 +
    gamePace * 0.20 +
    ((homeOver15 + awayOver15) / 2) * 0.15
  );

  const over25Profile = clamp(
    goalScore * 0.30 +
    clamp(totalLambda / 3.1) * 0.30 +
    gamePace * 0.20 +
    ((homeOver25 + awayOver25) / 2) * 0.20
  );

  const bttsProfile = clamp(
    clamp(minLambda / 1.35) * 0.30 +
    ((homeBTTS + awayBTTS) / 2) * 0.25 +
    clamp((homeGF + awayGF) / 3.0) * 0.20 +
    clamp((homeGA + awayGA) / 3.0) * 0.15 +
    clamp(Math.min(homeBig, awayBig) / 2.0) * 0.10
  );

  const resultProfile = clamp(
    clamp(diffLambda / 1.4) * 0.35 +
    clamp(Math.abs(homeGF - awayGF) / 2.0) * 0.20 +
    clamp(Math.abs(homeGA - awayGA) / 2.0) * 0.15 +
    clamp(safe(data.pressureFactor, 1) / 1.3) * 0.15 +
    (1 - clamp(safe(data.result?.draw, 0.30) / 0.35)) * 0.15
  );

  const doubleChanceProfile = clamp(
    resultProfile * 0.45 +
    (1 - clamp(diffLambda / 2.0)) * 0.20 +
    clamp(Math.max(lambdaHome, lambdaAway) / 1.7) * 0.20 +
    (1 - clamp(goalScore)) * 0.15
  );

  let gameType: "open" | "balanced" | "closed" | "dominant" = "balanced";

  if (goalsProfile >= 0.68 && paceLevel !== "low") {
    gameType = "open";
  } else if (resultProfile >= 0.64 && diffLambda >= 0.55) {
    gameType = "dominant";
  } else if (goalsProfile <= 0.45 && paceLevel === "low") {
    gameType = "closed";
  }

  const dominantSide = lambdaHome >= lambdaAway ? "HOME" : "AWAY";

  const weights: Record<string, number> = {
    OVER_1_5:
      goalsProfile >= 0.62 ? 1.06 :
      goalsProfile <= 0.45 ? 0.94 :
      1.00,

    OVER_2_5:
      over25Profile >= 0.66 ? 1.10 :
      over25Profile <= 0.48 ? 0.92 :
      1.00,

    BTTS_YES:
      bttsProfile >= 0.64 ? 1.08 :
      bttsProfile <= 0.46 ? 0.92 :
      1.00,

    BTTS_NO:
      bttsProfile <= 0.42 ? 1.08 :
      bttsProfile >= 0.62 ? 0.92 :
      1.00,

    HOME:
      dominantSide === "HOME" && resultProfile >= 0.60 ? 1.08 :
      dominantSide !== "HOME" ? 0.95 :
      1.00,

    HOME_WIN:
      dominantSide === "HOME" && resultProfile >= 0.60 ? 1.08 :
      dominantSide !== "HOME" ? 0.95 :
      1.00,

    AWAY:
      dominantSide === "AWAY" && resultProfile >= 0.60 ? 1.08 :
      dominantSide !== "AWAY" ? 0.95 :
      1.00,

    AWAY_WIN:
      dominantSide === "AWAY" && resultProfile >= 0.60 ? 1.08 :
      dominantSide !== "AWAY" ? 0.95 :
      1.00,

    DRAW:
      diffLambda <= 0.25 && totalLambda <= 2.6 ? 1.08 :
      diffLambda >= 0.70 ? 0.92 :
      1.00,

    DOUBLE_CHANCE_1X:
      dominantSide === "HOME" && doubleChanceProfile >= 0.58 ? 1.06 :
      dominantSide === "AWAY" ? 0.96 :
      1.00,

    DOUBLE_CHANCE_X2:
      dominantSide === "AWAY" && doubleChanceProfile >= 0.58 ? 1.06 :
      dominantSide === "HOME" ? 0.96 :
      1.00,
  };

  const warnings: string[] = [];

  if (goalsProfile < 0.45 || totalLambda < 2.05 || paceLevel === "low") {
    warnings.push("WEAK_GOALS_STRUCTURE");
  }

  if (bttsProfile < 0.44 || minLambda < 0.80) {
    warnings.push("WEAK_BTTS_STRUCTURE");
  }

  if (resultProfile < 0.40 || diffLambda < 0.22) {
    warnings.push("WEAK_RESULT_STRUCTURE");
  }

  if (doubleChanceProfile < 0.44) {
    warnings.push("WEAK_DOUBLE_CHANCE_STRUCTURE");
  }

  return {
    gameType,
    paceLevel,
    gamePace: Number(gamePace.toFixed(4)),

    profiles: {
      goalsProfile: Number(goalsProfile.toFixed(4)),
      over25Profile: Number(over25Profile.toFixed(4)),
      bttsProfile: Number(bttsProfile.toFixed(4)),
      resultProfile: Number(resultProfile.toFixed(4)),
      doubleChanceProfile: Number(doubleChanceProfile.toFixed(4)),
    },

    weights,

    /*
      Mantido por compatibilidade, mas agora deve ser tratado como ALERTA,
      não como bloqueio automático.
    */
    isBadOverGame: warnings.includes("WEAK_GOALS_STRUCTURE"),
    isBadBTTSGame: warnings.includes("WEAK_BTTS_STRUCTURE"),
    isBadResultGame: warnings.includes("WEAK_RESULT_STRUCTURE"),
    isBadDoubleChanceGame: warnings.includes("WEAK_DOUBLE_CHANCE_STRUCTURE"),

    warnings,

    dominantSide,
    totalLambda: Number(totalLambda.toFixed(4)),
    diffLambda: Number(diffLambda.toFixed(4)),
    minLambda: Number(minLambda.toFixed(4)),

    debug: {
      marketIntelligence: {
        totalShots,
        totalSOT,
        totalBig,
        totalLambda,
        diffLambda,
        minLambda,
        goalScore,
        gamePace,
        paceLevel,
        gameType,
        dominantSide,
        warnings,
      },
    },
  };
}