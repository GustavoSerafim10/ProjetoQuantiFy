
interface RiskInput {
  lambdaHome: number;
  lambdaAway: number;

  eventProbability: number;

  leagueAvgGoals: number;
  recentGoalStd: number;
  seasonGoalAvg: number;

  goalExpectationScore?: number;
  totalLambda?: number;
  marketType?: string;
}

function safe(v: any, fallback: number) {
  const num = Number(v);
  return Number.isFinite(num) ? num : fallback;
}

function clamp(n: number, min = 0.05, max = 0.95) {
  return Math.max(min, Math.min(n, max));
}

function normalizeMarketName(market: string) {
  return String(market ?? "")
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/\./g, "_");
}

function resolveMarketGroup(market: string) {
  const m = normalizeMarketName(market);

  if (m.includes("OVER")) return "OVER";
  if (m.includes("BTTS")) return "BTTS";
  if (m.includes("DOUBLE_CHANCE") || m.includes("1X") || m.includes("X2")) return "DOUBLE";
  if (
    m.includes("HOME") ||
    m.includes("AWAY") ||
    m === "DRAW" ||
    m === "RESULT"
  ) {
    return "RESULT";
  }

  return "OTHER";
}

export function calculateRiskScore(input: RiskInput): number {
  const lambdaHome = safe(input.lambdaHome, 1.2);
  const lambdaAway = safe(input.lambdaAway, 1.0);

  const prob = clamp(safe(input.eventProbability, 0.5), 0.0001, 0.9999);

  const leagueAvgGoals = safe(input.leagueAvgGoals, 2.4);
  const recentStd = safe(input.recentGoalStd, 1.0);
  const seasonAvg = safe(input.seasonGoalAvg, 1.2);

  const goalScore = safe(input.goalExpectationScore, 0.5);
  const totalLambda = safe(input.totalLambda, lambdaHome + lambdaAway);

  const marketName = normalizeMarketName(input.marketType ?? "OTHER");
  const marketGroup = resolveMarketGroup(marketName);

  const lambdaDiff = Math.abs(lambdaHome - lambdaAway);
  const minLambda = Math.min(lambdaHome, lambdaAway);

  const probabilityRisk = 1 - prob;

  const lambdaVarianceRisk = clamp(
    Math.sqrt(totalLambda) / 2.25,
    0,
    1
  );

  const volatilityRatio = recentStd / Math.max(seasonAvg, 0.5);

  const volatilityRisk = clamp(
    Math.abs(volatilityRatio - 1) * 0.55,
    0,
    1
  );

  const leagueRisk = clamp(
    Math.abs(leagueAvgGoals - 2.55) * 0.12,
    0,
    0.18
  );

  let risk =
    probabilityRisk * 0.42 +
    lambdaVarianceRisk * 0.24 +
    volatilityRisk * 0.18 +
    leagueRisk * 0.16;

  /*
    Ajustes por mercado exato.
  */

  if (marketGroup === "OVER") {
    if (marketName.includes("OVER_1_5")) {
      if (totalLambda >= 2.35) risk -= 0.025;
      if (goalScore >= 0.58) risk -= 0.020;

      if (totalLambda < 2.00) risk += 0.055;
      if (goalScore < 0.45) risk += 0.045;
    }

    else if (marketName.includes("OVER_2_5")) {
      if (totalLambda >= 2.85) risk -= 0.035;
      if (goalScore >= 0.65) risk -= 0.030;

      if (totalLambda < 2.35) risk += 0.065;
      if (goalScore < 0.52) risk += 0.055;
    }

    else {
      if (goalScore > 0.65) risk -= 0.035;
      if (totalLambda > 2.85) risk -= 0.025;

      if (goalScore < 0.50) risk += 0.045;
      if (totalLambda < 2.25) risk += 0.055;
    }
  }

  if (marketGroup === "BTTS") {
    if (marketName.includes("BTTS_YES")) {
      if (minLambda >= 1.0 && goalScore >= 0.55) risk -= 0.035;

      if (minLambda < 0.85) risk += 0.055;
      if (lambdaDiff > 1.15) risk += 0.045;
      if (totalLambda < 2.15) risk += 0.040;
    }

    else if (marketName.includes("BTTS_NO")) {
      if (goalScore <= 0.48) risk -= 0.030;
      if (minLambda < 0.90) risk -= 0.020;

      if (totalLambda > 2.90) risk += 0.060;
      if (minLambda >= 1.05 && goalScore >= 0.58) risk += 0.045;
    }

    else {
      if (minLambda >= 1.0 && goalScore >= 0.55) risk -= 0.030;
      if (minLambda < 0.85) risk += 0.050;
      if (lambdaDiff > 1.15) risk += 0.040;
    }
  }

  if (marketGroup === "RESULT") {
    if (marketName === "DRAW") {
      risk += 0.070;

      if (lambdaDiff < 0.25) risk -= 0.030;
      if (lambdaDiff > 0.70) risk += 0.055;
    }

    else {
      if (lambdaDiff >= 0.55) risk -= 0.030;
      if (lambdaDiff < 0.30) risk += 0.055;

      if (prob < 0.42) risk += 0.040;
    }
  }

  if (marketGroup === "DOUBLE") {
    if (prob >= 0.66) risk -= 0.040;
    if (lambdaDiff >= 0.45) risk -= 0.018;

    if (prob < 0.60) risk += 0.040;
  }

  if (prob >= 0.70) risk -= 0.025;
  if (prob < 0.52) risk += 0.040;

  risk = clamp(risk);

  return Number(risk.toFixed(4));
}