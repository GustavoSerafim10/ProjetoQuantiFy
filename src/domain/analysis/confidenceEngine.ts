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

  /* ===========================
     1. BASE
  ============================ */

  let confidence = safeProbability;

  /* ===========================
     2. EDGE
  ============================ */

  confidence += (safeEv - 0.03) * 0.35;

  /* ===========================
     3. KELLY
  ============================ */

  confidence += (safeKelly - 0.02) * 0.45;

  /* ===========================
     4. LAMBDA / ESTRUTURA
  ============================ */

  const totalLambda = safeLambdaHome + safeLambdaAway;
  const balance = 1 - Math.abs(safeLambdaHome - safeLambdaAway);

  if (marketName.includes("OVER")) {
    confidence += (totalLambda - 2.4) * 0.12;
  }

  if (marketName.includes("BTTS")) {
    confidence += balance * 0.08;
  }

  /* ===========================
     5. GOAL EXPECTATION SCORE
  ============================ */

  if (marketName.includes("OVER")) {
    confidence += (safeGoalScore - 0.55) * 0.35;
  }

  if (marketName.includes("BTTS")) {
    confidence += (safeGoalScore - 0.50) * 0.20;
  }

  /* ===========================
     6. CONTROLE SUAVE DE ODDS
  ============================ */

  if (safeOdds > 4.5) {
    confidence -= 0.03;
  }

  /* ===========================
     7. EXTREMOS
  ============================ */

  if (safeProbability > 0.92) {
    confidence -= 0.02;
  }

  if (safeProbability < 0.45) {
    confidence -= 0.03;
  }

  /* ===========================
     8. NORMALIZAÇÃO FINAL
  ============================ */

  confidence = Math.max(0, Math.min(confidence, 1));

  return Number(confidence.toFixed(4));
}