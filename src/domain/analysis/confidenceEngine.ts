export function calculateConfidence({
  probability,
  odds,
  ev,
  kelly,
  lambdaHome,
  lambdaAway,
  market,
  goalExpectationScore // 🔥 NOVO
}: any) {

  /* ===========================
     🔥 1. BASE
  ============================ */

  let confidence = probability;

  /* ===========================
     🔥 2. EDGE (MAIS SUAVE)
  ============================ */

  confidence += (ev - 0.03) * 0.4;

  /* ===========================
     🔥 3. KELLY (FORÇA REAL)
  ============================ */

  confidence += (kelly - 0.02) * 0.6;

  /* ===========================
     🔥 4. LAMBDA INTELIGENTE
  ============================ */

  const totalLambda = lambdaHome + lambdaAway;
  const balance = 1 - Math.abs(lambdaHome - lambdaAway);

  // Over depende de volume
  if (market.includes("OVER")) {
    confidence += (totalLambda - 2.4) * 0.15;
  }

  // BTTS depende de equilíbrio
  if (market.includes("BTTS")) {
    confidence += balance * 0.10;
  }

  /* ===========================
     🔥 5. GOAL EXPECTATION SCORE (NOVO CORE)
  ============================ */

  if (goalExpectationScore !== undefined) {
    if (market.includes("OVER")) {
      confidence += (goalExpectationScore - 0.55) * 0.5;
    }

    if (market.includes("BTTS")) {
      confidence += (goalExpectationScore - 0.50) * 0.3;
    }
  }

  /* ===========================
     🔥 6. CONTROLE DE ODDS
  ============================ */

  if (odds < 1.30) confidence -= 0.04;
  else if (odds > 3.5) confidence -= 0.03;

  /* ===========================
     🔥 7. EXTREMOS
  ============================ */

  if (probability > 0.90) confidence -= 0.05;
  if (probability < 0.55) confidence -= 0.05;

  /* ===========================
     🔥 8. NORMALIZAÇÃO FINAL
  ============================ */

  if (confidence > 1) confidence = 1;
  if (confidence < 0) confidence = 0;

  return Number(confidence.toFixed(4));
}