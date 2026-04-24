/* ===============================
   🎯 GAME FILTER — QUANTIFY V2
   filtra o JOGO, não o mercado
================================ */

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
  return isNaN(num) ? fallback : num;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function gameFilter(data: any): GameFilterResult {
  const lambdaHome = safe(data?.lambdaHome, 1.2);
  const lambdaAway = safe(data?.lambdaAway, 1.0);
  const totalLambda = lambdaHome + lambdaAway;
  const lambdaDiff = Math.abs(lambdaHome - lambdaAway);

  const goalExpectationScore = safe(data?.goalExpectationScore, 0.5);

  const homeProb = safe(
    data?.monteCarlo?.homeWinProb ?? data?.result?.homeWinProb,
    0
  );
  const drawProb = safe(
    data?.monteCarlo?.drawProb ?? data?.result?.drawProb,
    0
  );
  const awayProb = safe(
    data?.monteCarlo?.awayWinProb ?? data?.result?.awayWinProb,
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

  /* ===============================
     LEANS PRINCIPAIS
  ================================ */

  const openGameLean =
    (clamp((totalLambda - 2.2) / 1.4, 0, 1) * 0.45) +
    (clamp((goalExpectationScore - 0.52) / 0.35, 0, 1) * 0.30) +
    (clamp((over25Prob - 0.50) / 0.25, 0, 1) * 0.25);

  const bttsLean =
    (clamp((bttsProb - 0.52) / 0.22, 0, 1) * 0.45) +
    (clamp((Math.min(lambdaHome, lambdaAway) - 0.95) / 0.65, 0, 1) * 0.30) +
    (clamp((goalExpectationScore - 0.50) / 0.30, 0, 1) * 0.25);

  const favoriteLean =
    (clamp((lambdaDiff - 0.45) / 1.0, 0, 1) * 0.50) +
    (clamp((favoriteProb - 0.46) / 0.24, 0, 1) * 0.35) +
    (clamp((1.15 - Math.min(lambdaHome, lambdaAway)) / 0.70, 0, 1) * 0.15);

  const lowGoalLean =
    (clamp((2.35 - totalLambda) / 1.0, 0, 1) * 0.45) +
    (clamp((0.56 - goalExpectationScore) / 0.30, 0, 1) * 0.25) +
    (clamp((0.62 - over25Prob) / 0.30, 0, 1) * 0.30);

  /* ===============================
     PERFIS DE JOGO
  ================================ */

const isOpenGoalsGame =
  totalLambda >= 2.9 &&
  goalExpectationScore >= 0.60 &&
  over25Prob >= 0.55;

const isBttsGame =
  Math.min(lambdaHome, lambdaAway) >= 1.08 &&
  bttsProb >= 0.60 &&
  goalExpectationScore >= 0.56 &&
  lambdaDiff <= 0.85;

  const isClearFavoriteGame =
    lambdaDiff >= 0.55 &&
    favoriteProb >= 0.48;

const isLowGoalGame =
  totalLambda <= 2.25 &&
  over15Prob <= 0.75 &&
  over25Prob <= 0.48;

  const isHybridGame =
    lambdaDiff >= 0.22 &&
    lambdaDiff <= 0.58 &&
    goalExpectationScore >= 0.46 &&
    goalExpectationScore <= 0.63 &&
    totalLambda >= 2.10 &&
    totalLambda <= 2.95;

  const isMuddyGame =
    lambdaDiff < 0.22 &&
    totalLambda >= 2.10 &&
    totalLambda <= 2.85 &&
    goalExpectationScore >= 0.44 &&
    goalExpectationScore <= 0.60;

  const isChaoticGame =
    totalLambda > 3.55 &&
    drawProb > 0.22 &&
    homeProb > 0.24 &&
    awayProb > 0.24;

  /* ===============================
     SCORE GERAL DO JOGO
  ================================ */

const gameScore =
  (openGameLean * 0.30) +
  (bttsLean * 0.25) +
  (favoriteLean * 0.25) +
  (lowGoalLean * 0.20);

let level: "WEAK" | "GOOD" | "STRONG" = "WEAK";

if (gameScore >= 0.72) {
  level = "STRONG";
} else if (
  gameScore >= 0.58 ||
  (isOpenGoalsGame && openGameLean >= 0.55) ||
  (isBttsGame && bttsLean >= 0.58) ||
  (isClearFavoriteGame && favoriteLean >= 0.58)
) {
  level = "GOOD";
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
    lowGoalLean: Number(lowGoalLean.toFixed(4))
  };

  /* ===============================
     BLOQUEIOS DUROS
  ================================ */

  if (isMuddyGame) {
    return {
      allowed: false,
      reason: "MUDDY_GAME",
      profile: "MUDDY",
      score: Number(gameScore.toFixed(4)),
      level,
      diagnostics
    };
  }

  if (isHybridGame && gameScore < 0.62) {
    return {
      allowed: false,
      reason: "HYBRID_GAME_WITHOUT_CLEAR_EDGE",
      profile: "HYBRID",
      score: Number(gameScore.toFixed(4)),
      level,
      diagnostics
    };
  }

  if (
    isChaoticGame &&
    favoriteLean < 0.55 &&
    bttsLean < 0.62 &&
    openGameLean < 0.62
  ) {
    return {
      allowed: false,
      reason: "CHAOTIC_GAME_WITHOUT_DEFINED_MARKET",
      profile: "CHAOTIC",
      score: Number(gameScore.toFixed(4)),
      level,
      diagnostics
    };
  }

  /* ===============================
     LIBERAÇÃO
  ================================ */

  if (isOpenGoalsGame && openGameLean >= 0.62) {
    return {
      allowed: true,
      reason: "OPEN_GOALS_GAME",
      profile: "OPEN_GOALS",
      score: Number(gameScore.toFixed(4)),
      level,
      diagnostics
    };
  }

  if (isBttsGame && bttsLean >= 0.60) {
    return {
      allowed: true,
      reason: "BTTS_GAME",
      profile: "BTTS_GAME",
      score: Number(gameScore.toFixed(4)),
      level,
      diagnostics
    };
  }

  if (isClearFavoriteGame && favoriteLean >= 0.58) {
    return {
      allowed: true,
      reason: "CLEAR_FAVORITE_GAME",
      profile: "CLEAR_FAVORITE",
      score: Number(gameScore.toFixed(4)),
      level,
      diagnostics
    };
  }

  if (isLowGoalGame && lowGoalLean >= 0.58) {
    return {
      allowed: true,
      reason: "LOW_GOAL_GAME",
      profile: "LOW_GOAL_GAME",
      score: Number(gameScore.toFixed(4)),
      level,
      diagnostics
    };
  }

  /* ===============================
     FALLBACK: NO BET
  ================================ */

  return {
    allowed: false,
    reason: "NO_CLEAR_GAME_PROFILE",
    profile: "UNKNOWN",
    score: Number(gameScore.toFixed(4)),
    level,
    diagnostics
  };
}