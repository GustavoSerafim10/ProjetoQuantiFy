export function applyCorrelationAdjustments(
  markets: any[],
  context: any
) {
  if (!Array.isArray(markets)) return [];

  const { lambdaHome, lambdaAway, goalExpectationScore } = context;

  const totalLambda = (lambdaHome ?? 1) + (lambdaAway ?? 1);
  const diffLambda = Math.abs(lambdaHome - lambdaAway);

  return markets.map((m: any) => {

    const name = String(m?.market ?? "").toUpperCase();

    let penalty = 0;
    let boost = 0;

    /* =========================
       ⚔️ OVER 2.5 x BTTS YES
       (CORRELAÇÃO ALTA)
    ========================= */

    if (name === "OVER_2_5") {
      if (markets.some(x => x.market === "BTTS_YES")) {
        penalty += 0.05;
      }
    }

    if (name === "BTTS_YES") {
      if (markets.some(x => x.market === "OVER_2_5")) {
        penalty += 0.05;
      }
    }

    /* =========================
       🧱 OVER x BTTS NO (CONFLITO)
    ========================= */

    if (name === "OVER_2_5") {
      if (markets.some(x => x.market === "BTTS_NO")) {
        penalty += 0.08;
      }
    }

    if (name === "BTTS_NO") {
      if (markets.some(x => x.market === "OVER_2_5")) {
        penalty += 0.08;
      }
    }

    /* =========================
       🧊 UNDER LOGIC VIA CONTEXTO
       (BTTS NO sinergia com jogo travado)
    ========================= */

    if (name === "BTTS_NO") {
      if (goalExpectationScore < 0.45) {
        boost += 0.05;
      }
    }

    /* =========================
       🏠 RESULT x DOUBLE CHANCE
    ========================= */

    if (name === "HOME_WIN") {
      if (markets.some(x => x.market === "DOUBLE_CHANCE_1X")) {
        penalty += 0.06;
      }
    }

    if (name === "AWAY_WIN") {
      if (markets.some(x => x.market === "DOUBLE_CHANCE_X2")) {
        penalty += 0.06;
      }
    }

    if (name === "DOUBLE_CHANCE_1X") {
      if (markets.some(x => x.market === "HOME_WIN")) {
        penalty += 0.06;
      }
    }

    if (name === "DOUBLE_CHANCE_X2") {
      if (markets.some(x => x.market === "AWAY_WIN")) {
        penalty += 0.06;
      }
    }

    /* =========================
       ⚖️ EQUILÍBRIO DE JOGO
    ========================= */

    if (
      ["HOME_WIN", "AWAY_WIN"].includes(name) &&
      diffLambda < 0.35
    ) {
      penalty += 0.07;
    }

    /* =========================
       🔥 CONTEXTO DE GOLS
    ========================= */

    if (name === "OVER_2_5" && goalExpectationScore < 0.60) {
      penalty += 0.06;
    }

    if (name === "OVER_1_5" && totalLambda < 2.2) {
      penalty += 0.05;
    }

    if (name === "BTTS_YES" && totalLambda < 2.4) {
      penalty += 0.06;
    }

    /* =========================
       🎯 APLICAÇÃO FINAL
    ========================= */

    let newProb = m.probability;
    let newRisk = m.riskScore ?? 0.5;
    let newConfidence = m.confidence ?? 0.6;

    newProb = newProb * (1 - penalty + boost);
    newRisk = Math.min(1, newRisk + penalty - boost);
    newConfidence = Math.max(0, newConfidence - penalty + boost);

    return {
      ...m,
      probability: Number(newProb.toFixed(4)),
      riskScore: Number(newRisk.toFixed(4)),
      confidence: Number(newConfidence.toFixed(4)),
      correlationAdjusted: true
    };

  });
}