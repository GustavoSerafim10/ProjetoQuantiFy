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

  let confidence = 0.45;

  /* ===========================
     BASE PROBABILÍSTICA
  ============================ */

  confidence += (safeProbability - 0.50) * 0.55;

  /* ===========================
     EDGE / EV
  ============================ */

  if (safeEv > 0 && safeProbability >= 0.58) {
    confidence += Math.min(0.06, safeEv * 0.18);
  }

  if (safeEv > 0.15 && safeProbability >= 0.65 && safeOdds >= 1.50) {
    confidence += 0.02;
  }

  /* ===========================
     KELLY
  ============================ */

  if (safeKelly > 0 && safeProbability >= 0.60) {
    confidence += Math.min(0.035, safeKelly * 0.20);
  }

  /* ===========================
     OVER / GOLS
  ============================ */

  if (marketName.includes("OVER")) {
    confidence += Math.max(
      -0.05,
      Math.min(0.05, (totalLambda - 2.45) * 0.08)
    );

    confidence += Math.max(
      -0.06,
      Math.min(0.06, (safeGoalScore - 0.55) * 0.22)
    );
  }

  /* ===========================
     BTTS
  ============================ */

  if (marketName.includes("BTTS")) {
    confidence += balance * 0.05;

    confidence += Math.max(
      -0.05,
      Math.min(0.05, (safeGoalScore - 0.50) * 0.16)
    );

    if (minLambda < 0.80) {
      confidence -= 0.07;
    }
  }

  /* ===========================
     RESULTADO / HOME / AWAY
  ============================ */

  if (
    marketName.includes("HOME_WIN") ||
    marketName.includes("AWAY_WIN")
  ) {
    confidence += Math.max(
      -0.04,
      Math.min(0.05, lambdaDiff * 0.06)
    );

    if (lambdaDiff < 0.30) {
      confidence -= 0.05;
    }

    if (safeProbability < 0.42) {
      confidence -= 0.04;
    }

    if (safeOdds > 3.20 && safeProbability < 0.45) {
      confidence -= 0.06;
    }
  }

  /* ===========================
     DOUBLE CHANCE
  ============================ */

  if (marketName.includes("DOUBLE_CHANCE")) {
    confidence += Math.max(
      -0.04,
      Math.min(0.05, lambdaDiff * 0.06)
    );

    if (safeOdds < 1.30) {
      confidence -= 0.08;
    }

    if (safeProbability < 0.65) {
      confidence -= 0.05;
    }

    if (safeOdds > 1.75) {
      confidence -= 0.04;
    }
  }

  /* ===========================
     DRAW
  ============================ */

  if (marketName.includes("DRAW")) {
    confidence += lambdaDiff < 0.25 ? 0.03 : -0.04;

    if (safeProbability < 0.25) {
      confidence -= 0.04;
    }

    if (safeOdds < 2.80) {
      confidence -= 0.03;
    }
  }

  /* ===========================
     CONTROLE DE ODDS
  ============================ */

  if (safeOdds < 1.35) {
    confidence -= 0.10;
  } else if (safeOdds < 1.45) {
    confidence -= 0.07;
  } else if (safeOdds < 1.50 && safeProbability >= 0.80) {
    confidence -= 0.05;
  }

  if (safeOdds > 4.5) {
    confidence -= 0.04;
  }

  if (
    safeOdds > 3.5 &&
    safeProbability < 0.60
  ) {
    confidence -= 0.05;
  }

  /* ===========================
     EXTREMOS DE PROBABILIDADE
  ============================ */

  if (safeProbability > 0.88) {
    confidence -= 0.04;
  }

  if (safeProbability > 0.92) {
    confidence -= 0.07;
  }

  /* ===========================
     GUARDS ESPECÍFICOS
  ============================ */

  if (
    marketName.includes("OVER_2_5") &&
    totalLambda < 2.5
  ) {
    confidence -= 0.06;
  }

  if (
    marketName.includes("OVER_1_5") &&
    safeOdds < 1.45
  ) {
    confidence -= 0.08;
  }

  /* ===========================
     NORMALIZAÇÃO FINAL
  ============================ */

  confidence = Math.max(0, Math.min(confidence, 1));

  return Number(confidence.toFixed(4));
}