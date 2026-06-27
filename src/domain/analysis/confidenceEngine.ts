export function calculateConfidence({
  probability,
  odds,
  ev,
  kelly,
  lambdaHome,
  lambdaAway,
  market,
  goalExpectationScore,
  riskScore,
  trapScore,
  monteCarloProb,
  poissonProb
}: any) {
  const clamp = (value: number, min = 0, max = 1) =>
    Math.max(min, Math.min(value, max));

  const safeProbability = clamp(Number(probability ?? 0.5));
  const safeOdds = Number(odds ?? 0);
  const safeEv = Number(ev ?? 0);
  const safeKelly = Number(kelly ?? 0);
  const safeLambdaHome = Number(lambdaHome ?? 1);
  const safeLambdaAway = Number(lambdaAway ?? 1);
  const safeGoalScore = Number(goalExpectationScore ?? 0.5);
  const safeRisk = Number(riskScore ?? 0.5);
  const safeTrap = Number(trapScore ?? 0.5);
  const marketName = String(market ?? "").toUpperCase();

  const totalLambda = safeLambdaHome + safeLambdaAway;
  const lambdaDiff = Math.abs(safeLambdaHome - safeLambdaAway);
  const minLambda = Math.min(safeLambdaHome, safeLambdaAway);
  const balance = clamp(1 - lambdaDiff, 0, 1);

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

  /*
    BOOST ESTRUTURAL:
    só aumenta quando o jogo tem bons sinais juntos.
  */
  const strongValueSetup =
    safeEv >= 0.10 &&
    safeRisk <= 0.42 &&
    safeTrap <= 0.28 &&
    totalLambda >= 2.75;

  if (strongValueSetup) {
    confidence += 0.055;
  }

  if (safeRisk <= 0.35) confidence += 0.035;
  else if (safeRisk <= 0.45) confidence += 0.02;
  else if (safeRisk >= 0.65) confidence -= 0.07;

  if (safeTrap <= 0.20) confidence += 0.03;
  else if (safeTrap <= 0.30) confidence += 0.015;
  else if (safeTrap >= 0.60) confidence -= 0.06;

  /*
    Alinhamento Monte Carlo x Poisson.
    Se ambos dizem algo parecido, a confiança sobe.
  */
  if (
    typeof monteCarloProb === "number" &&
    typeof poissonProb === "number"
  ) {
    const diff = Math.abs(monteCarloProb - poissonProb);

    if (diff <= 0.04) confidence += 0.055;
    else if (diff <= 0.07) confidence += 0.035;
    else if (diff <= 0.10) confidence += 0.015;
    else if (diff >= 0.16) confidence -= 0.06;
  }

  if (marketName.includes("OVER")) {
    confidence += Math.max(
      -0.04,
      Math.min(0.08, (totalLambda - 2.45) * 0.10)
    );

    confidence += Math.max(
      -0.04,
      Math.min(0.08, (safeGoalScore - 0.55) * 0.24)
    );

    if (
      marketName.includes("OVER_1_5") &&
      safeProbability >= 0.78 &&
      totalLambda >= 2.75 &&
      safeEv >= 0.08 &&
      safeRisk <= 0.45
    ) {
      confidence += 0.055;
    }

    if (
      marketName.includes("OVER_2_5") &&
      safeProbability >= 0.63 &&
      totalLambda >= 2.85 &&
      safeEv >= 0.10 &&
      safeRisk <= 0.50
    ) {
      confidence += 0.04;
    }
  }

  if (marketName.includes("BTTS")) {
    confidence += balance * 0.045;

    confidence += Math.max(
      -0.035,
      Math.min(0.085, (safeGoalScore - 0.50) * 0.20)
    );

    if (totalLambda >= 2.85) confidence += 0.035;
    if (minLambda >= 1.0) confidence += 0.035;
    if (safeEv >= 0.12 && safeOdds >= 1.70) confidence += 0.025;
    if (safeKelly >= 0.08) confidence += 0.015;

    if (
      safeProbability >= 0.60 &&
      totalLambda >= 2.70 &&
      minLambda >= 1.0 &&
      safeRisk <= 0.45 &&
      safeTrap <= 0.35
    ) {
      confidence += 0.045;
    }

    if (minLambda < 0.80) confidence -= 0.06;
    if (lambdaDiff > 1.20) confidence -= 0.035;
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

    if (safeOdds > 1.85) confidence -= 0.035;
    if (safeOdds > 2.20) confidence -= 0.08;
    if (safeOdds > 2.60) confidence -= 0.12;

    if (
      safeProbability >= 0.66 &&
      safeEv >= 0.07 &&
      safeRisk <= 0.50 &&
      safeOdds >= 1.35 &&
      safeOdds <= 1.85
    ) {
      confidence += 0.04;
    }
  }

  if (marketName.includes("DRAW")) {
    confidence += lambdaDiff < 0.25 ? 0.03 : -0.035;

    if (safeProbability < 0.25) confidence -= 0.035;
    if (safeOdds < 2.80) confidence -= 0.03;
  }

  /*
    Penalizações gerais.
  */
  if (safeOdds < 1.30) {
    confidence -= 0.09;
  } else if (safeOdds < 1.40) {
    confidence -= 0.055;
  } else if (safeOdds < 1.50 && safeProbability >= 0.80) {
    confidence -= 0.025;
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

  /*
    Teto defensivo:
    entrada boa pode subir, mas não vira 0.95 fácil.
  */
  const defensiveCap =
    safeRisk > 0.55 ||
    safeTrap > 0.45 ||
    safeEv < 0.06;

  if (defensiveCap) {
    confidence = Math.min(confidence, 0.72);
  }

  confidence = clamp(confidence, 0, 0.88);

  return Number(confidence.toFixed(4));
}