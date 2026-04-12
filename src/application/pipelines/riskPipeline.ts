import { calculateRiskScore } from "../../domain/risk/riskScore";

/* ===============================
   🔥 HELPERS
=============================== */

function getMarketType(market: string) {
  const m = market.toLowerCase();

  if (m.includes("over")) return "OVER";

  if (m === "btts_yes") return "BTTS_YES";
  if (m === "btts_no") return "BTTS_NO";

  if (
    m.includes("home") ||
    m.includes("away") ||
    m.includes("draw")
  ) {
    return "RESULT";
  }

  if (m.includes("1x") || m.includes("x2")) {
    return "DOUBLE";
  }

  return "OTHER";
}

/* ===============================
   PIPELINE
=============================== */

export function riskPipeline(data: any) {
  const totalLambda =
    (data.lambdaHome ?? 1) +
    (data.lambdaAway ?? 1);

  const balance = Math.abs(
    (data.lambdaHome ?? 1) -
    (data.lambdaAway ?? 1)
  );

  const markets = data.markets.map((m: any) => {
    let risk = calculateRiskScore({
      lambdaHome: data.lambdaHome,
      lambdaAway: data.lambdaAway,
      leagueAvgGoals: data.leagueAvgGoals ?? 1.3,
      eventProbability: m.probability ?? 0.5,
      recentGoalStd: data.recentGoalStd ?? 1,
      seasonGoalAvg: data.seasonGoalAvg ?? 1.2
    });

    const type = getMarketType(m.market);

    /* =========================================
       🔥 AJUSTES CONTEXTUAIS
    ========================================= */

    // 1️⃣ JOGO FRACO → OVER mais arriscado
    if (data?.isLowGoalGame && type === "OVER") {
      risk *= 1.25;
    }

    // 2️⃣ SCORE DE GOLS / EXPECTATIVA
    if (data?.goalExpectationScore !== undefined) {
      const score = data.goalExpectationScore;

      if (type === "OVER") {
        if (score < 0.45) risk *= 1.30;
        else if (score < 0.55) risk *= 1.15;
      }

      if (type === "BTTS_YES") {
        if (score < 0.50) risk *= 1.15;
      }

      if (type === "BTTS_NO") {
        if (score > 0.65) risk *= 1.15;
      }
    }

    // 3️⃣ JOGO EQUILIBRADO
    if (balance < 0.25) {

      if (type === "RESULT") {
        risk *= 1.20;
      }

      if (type === "DOUBLE") {
        risk *= 1.15;
      }

      if (type === "BTTS_NO") {
        risk *= 1.10;
      }

      if (type === "OVER") {
        risk *= 1.03;
      }
    }

    // 4️⃣ MUITOS GOLS ESPERADOS
    if (totalLambda > 3.2) {

      if (type === "OVER") {
        risk *= 0.90;
      }

      if (type === "BTTS_NO") {
        risk *= 1.15;
      }
    }

    // 5️⃣ PROBABILIDADE EXTREMA
    if (m.probability > 0.80) {
      risk *= 1.10;
    }

    /* =========================================
       🔒 LIMITES
    ========================================= */

    risk = Math.max(0.05, Math.min(risk, 0.95));

    return {
      ...m,
      risk
    };
  });

  return {
    ...data,
    markets
  };
}