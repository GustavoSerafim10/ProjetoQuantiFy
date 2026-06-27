
export type GameFilterResult = {
  allowed: boolean;
  reason: string;
  profile:
    | "OPEN_GOALS"
    | "BTTS_GAME"
    | "CLEAR_FAVORITE"
    | "LOW_GOAL_GAME"
    | "HYBRID"
    | "MUDDY"
    | "CHAOTIC"
    | "UNKNOWN";
  score: number;
  level: "WEAK" | "GOOD" | "STRONG";
  warnings: string[];
  diagnostics: {
    lambdaHome: number;
    lambdaAway: number;
    totalLambda: number;
    lambdaDiff: number;
    goalExpectationScore: number;
    bttsLean: number;
    openGameLean: number;
    favoriteLean: number;
    lowGoalLean: number;
  };
};

function safe(n: any, fallback = 0) {
  const num = Number(n);
  return Number.isFinite(num) ? num : fallback;
}

function clamp(n: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, n));
}

export function gameFilter(data: any): GameFilterResult {
  const lambdaHome = safe(data?.lambdaHome, 1.2);
  const lambdaAway = safe(data?.lambdaAway, 1.0);

  const totalLambda = lambdaHome + lambdaAway;
  const lambdaDiff = Math.abs(lambdaHome - lambdaAway);

  const goalExpectationScore = safe(data?.goalExpectationScore, 0.5);

  const homeProb = safe(
    data?.monteCarlo?.homeWinProb ?? data?.result?.homeWin,
    0
  );

  const drawProb = safe(
    data?.monteCarlo?.drawProb ?? data?.result?.draw,
    0
  );

  const awayProb = safe(
    data?.monteCarlo?.awayWinProb ?? data?.result?.awayWin,
    0
  );

  const bttsProb = safe(
    data?.monteCarlo?.bttsProb ?? data?.btts?.yes,
    0
  );

  const over25Prob = safe(
    data?.monteCarlo?.over25Prob ?? data?.goals?.over25,
    0
  );

  const over15Prob = safe(
    data?.monteCarlo?.over15Prob ?? data?.goals?.over15,
    0
  );

  const favoriteProb = Math.max(homeProb, awayProb);

  const openGameLean =
    clamp((totalLambda - 2.2) / 1.4) * 0.45 +
    clamp((goalExpectationScore - 0.52) / 0.35) * 0.30 +
    clamp((over25Prob - 0.50) / 0.25) * 0.25;

  const bttsLean =
    clamp((bttsProb - 0.52) / 0.22) * 0.45 +
    clamp((Math.min(lambdaHome, lambdaAway) - 0.95) / 0.65) * 0.30 +
    clamp((goalExpectationScore - 0.50) / 0.30) * 0.25;

  const favoriteLean =
    clamp((lambdaDiff - 0.45) / 1.0) * 0.50 +
    clamp((favoriteProb - 0.46) / 0.24) * 0.35 +
    clamp((1.15 - Math.min(lambdaHome, lambdaAway)) / 0.70) * 0.15;

  const lowGoalLean =
    clamp((2.35 - totalLambda) / 1.0) * 0.45 +
    clamp((0.56 - goalExpectationScore) / 0.30) * 0.25 +
    clamp((0.62 - over25Prob) / 0.30) * 0.30;

  const isOpenGoalsGame =
    totalLambda >= 2.75 &&
    goalExpectationScore >= 0.56 &&
    over25Prob >= 0.52;

  const isBttsGame =
    Math.min(lambdaHome, lambdaAway) >= 1.0 &&
    bttsProb >= 0.56 &&
    goalExpectationScore >= 0.52 &&
    lambdaDiff <= 1.05;

  const isClearFavoriteGame =
    lambdaDiff >= 0.50 &&
    favoriteProb >= 0.45;

  const isLowGoalGame =
    totalLambda <= 2.20 &&
    over15Prob <= 0.75 &&
    over25Prob <= 0.50;

  const isHybridGame =
    lambdaDiff >= 0.20 &&
    lambdaDiff <= 0.62 &&
    goalExpectationScore >= 0.44 &&
    goalExpectationScore <= 0.65 &&
    totalLambda >= 2.00 &&
    totalLambda <= 3.05;

  const isMuddyGame =
    lambdaDiff < 0.20 &&
    totalLambda >= 2.05 &&
    totalLambda <= 2.80 &&
    goalExpectationScore >= 0.42 &&
    goalExpectationScore <= 0.60;

  const isChaoticGame =
    totalLambda > 3.55 &&
    drawProb > 0.22 &&
    homeProb > 0.24 &&
    awayProb > 0.24;

  const gameScore =
    openGameLean * 0.30 +
    bttsLean * 0.25 +
    favoriteLean * 0.25 +
    lowGoalLean * 0.20;

  let level: "WEAK" | "GOOD" | "STRONG" = "WEAK";

  if (gameScore >= 0.72) {
    level = "STRONG";
  } else if (
    gameScore >= 0.55 ||
    (isOpenGoalsGame && openGameLean >= 0.52) ||
    (isBttsGame && bttsLean >= 0.54) ||
    (isClearFavoriteGame && favoriteLean >= 0.54)
  ) {
    level = "GOOD";
  }

  let profile: GameFilterResult["profile"] = "UNKNOWN";
  let reason = "NO_CLEAR_GAME_PROFILE";
  const warnings: string[] = [];

  if (isOpenGoalsGame && openGameLean >= 0.56) {
    profile = "OPEN_GOALS";
    reason = "OPEN_GOALS_GAME";
  } else if (isBttsGame && bttsLean >= 0.55) {
    profile = "BTTS_GAME";
    reason = "BTTS_GAME";
  } else if (isClearFavoriteGame && favoriteLean >= 0.54) {
    profile = "CLEAR_FAVORITE";
    reason = "CLEAR_FAVORITE_GAME";
  } else if (isLowGoalGame && lowGoalLean >= 0.54) {
    profile = "LOW_GOAL_GAME";
    reason = "LOW_GOAL_GAME";
  } else if (isChaoticGame) {
    profile = "CHAOTIC";
    reason = "CHAOTIC_GAME";
    warnings.push("CHAOTIC_GAME");
  } else if (isMuddyGame) {
    profile = "MUDDY";
    reason = "MUDDY_GAME";
    warnings.push("MUDDY_GAME");
  } else if (isHybridGame) {
    profile = "HYBRID";
    reason = "HYBRID_GAME";
    warnings.push("HYBRID_GAME");
  } else {
    warnings.push("UNKNOWN_GAME_PROFILE");
  }

  const diagnostics = {
    lambdaHome: Number(lambdaHome.toFixed(4)),
    lambdaAway: Number(lambdaAway.toFixed(4)),
    totalLambda: Number(totalLambda.toFixed(4)),
    lambdaDiff: Number(lambdaDiff.toFixed(4)),
    goalExpectationScore: Number(goalExpectationScore.toFixed(4)),
    bttsLean: Number(bttsLean.toFixed(4)),
    openGameLean: Number(openGameLean.toFixed(4)),
    favoriteLean: Number(favoriteLean.toFixed(4)),
    lowGoalLean: Number(lowGoalLean.toFixed(4)),
  };

  return {
    /*
      O gameFilter não deve matar o jogo.
      Ele classifica o perfil e passa warnings.
      A decisão final acontece no decisionPipeline.
    */
    allowed: true,
    reason,
    profile,
    score: Number(gameScore.toFixed(4)),
    level,
    warnings,
    diagnostics,
  };
}