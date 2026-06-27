
export function calculateConfidence({
  probability,
  odds,
  ev,
  kelly,
  lambdaHome,
  lambdaAway,
  market,
  goalExpectationScore
}: any) {
  const safeProbability = Math.max(0, Math.min(Number(probability ?? 0.5), 1));
  const safeOdds = Number(odds ?? 0);
  const safeEv = Number(ev ?? 0);
  const safeKelly = Number(kelly ?? 0);
  const safeLambdaHome = Number(lambdaHome ?? 1);
  const safeLambdaAway = Number(lambdaAway ?? 1);
  const safeGoalScore = Number(goalExpectationScore ?? 0.5);
  const marketName = String(market ?? "").toUpperCase();

  const totalLambda = safeLambdaHome + safeLambdaAway;
  const lambdaDiff = Math.abs(safeLambdaHome - safeLambdaAway);
  const minLambda = Math.min(safeLambdaHome, safeLambdaAway);
  const balance = Math.max(0, 1 - lambdaDiff);

  let confidence = 0.52;

  confidence += (safeProbability - 0.50) * 0.45;

  if (safeEv > 0 && safeProbability >= 0.55) {
    confidence += Math.min(0.08, safeEv * 0.20);
  }

  if (safeEv > 0.15 && safeProbability >= 0.58 && safeOdds >= 1.50) {
    confidence += 0.035;
  }

  if (safeKelly > 0 && safeProbability >= 0.55) {
    confidence += Math.min(0.04, safeKelly * 0.18);
  }

  if (marketName.includes("OVER")) {
    confidence += Math.max(
      -0.04,
      Math.min(0.07, (totalLambda - 2.45) * 0.09)
    );

    confidence += Math.max(
      -0.04,
      Math.min(0.08, (safeGoalScore - 0.55) * 0.24)
    );
  }

if (marketName.includes("BTTS")) {
  confidence += balance * 0.045;

  confidence += Math.max(
    -0.035,
    Math.min(0.085, (safeGoalScore - 0.50) * 0.20)
  );

  if (totalLambda >= 2.85) {
    confidence += 0.035;
  }

  if (minLambda >= 1.0) {
    confidence += 0.035;
  }

  if (safeEv >= 0.12 && safeOdds >= 1.70) {
    confidence += 0.025;
  }

  if (safeKelly >= 0.08) {
    confidence += 0.015;
  }

  if (minLambda < 0.80) {
    confidence -= 0.06;
  }

  if (lambdaDiff > 1.20) {
    confidence -= 0.035;
  }
}

  if (
    marketName.includes("HOME_WIN") ||
    marketName.includes("AWAY_WIN")
  ) {
    confidence += Math.max(
      -0.035,
      Math.min(0.055, lambdaDiff * 0.06)
    );

    if (lambdaDiff < 0.30) confidence -= 0.04;
    if (safeProbability < 0.42) confidence -= 0.035;
    if (safeOdds > 3.20 && safeProbability < 0.45) confidence -= 0.05;
  }

if (marketName.includes("DOUBLE_CHANCE")) {
  confidence += Math.max(
    -0.035,
    Math.min(0.05, lambdaDiff * 0.06)
  );

  if (safeOdds < 1.30) confidence -= 0.07;
  if (safeProbability < 0.62) confidence -= 0.04;

  /*
    Double Chance normalmente é mercado de proteção.
    Odds muito altas indicam risco estrutural maior.
  */
  if (safeOdds > 1.85) confidence -= 0.035;

  if (safeOdds > 2.20) {
    confidence -= 0.08;
  }

  if (safeOdds > 2.60) {
    confidence -= 0.12;
  }
}

  if (marketName.includes("DRAW")) {
    confidence += lambdaDiff < 0.25 ? 0.03 : -0.035;

    if (safeProbability < 0.25) confidence -= 0.035;
    if (safeOdds < 2.80) confidence -= 0.03;
  }

  if (safeOdds < 1.30) {
    confidence -= 0.09;
  } else if (safeOdds < 1.40) {
    confidence -= 0.055;
  } else if (safeOdds < 1.50 && safeProbability >= 0.80) {
    confidence -= 0.04;
  }

  if (safeOdds > 4.5) confidence -= 0.04;

  if (safeOdds > 3.5 && safeProbability < 0.56) {
    confidence -= 0.045;
  }

  if (safeProbability > 0.90) confidence -= 0.04;
  if (safeProbability > 0.94) confidence -= 0.06;

  if (
    marketName.includes("OVER_2_5") &&
    totalLambda < 2.35
  ) {
    confidence -= 0.05;
  }

  if (
    marketName.includes("OVER_1_5") &&
    safeOdds < 1.40
  ) {
    confidence -= 0.07;
  }

  confidence = Math.max(0, Math.min(confidence, 1));

  return Number(confidence.toFixed(4));
}