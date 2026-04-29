import { applyCorrelationAdjustments } from "../../domain/correlation/correlationEngine";

export function correlationPipeline(data: any) {

  const markets = data.markets ?? [];

  /* ===========================
     🔥 STEP 1 — APPLY ENGINE
  ============================ */

  const adjustedMarkets = applyCorrelationAdjustments(
    markets,
    {
      lambdaHome: data.lambdaHome,
      lambdaAway: data.lambdaAway,
      goalExpectationScore: data.goalExpectationScore
    }
  );

  /* ===========================
     🚫 STEP 2 — HARD CONFLICT FILTER
  ============================ */

  const filteredMarkets = adjustedMarkets.filter((m: any) => {

    const name = m.market.toUpperCase();

    /* =========================
       🔴 OVER 2.5 x BTTS NO (ABSURDO)
    ========================= */

    if (
      name === "OVER_2_5" &&
      hasExactMarket(adjustedMarkets, "BTTS_NO")
    ) {
      return false;
    }

    if (
      name === "BTTS_NO" &&
      hasExactMarket(adjustedMarkets, "OVER_2_5")
    ) {
      return false;
    }

    /* =========================
       🔴 RESULT x DOUBLE CHANCE (duplicação)
    ========================= */

    if (
      name === "HOME_WIN" &&
      hasExactMarket(adjustedMarkets, "DOUBLE_CHANCE_1X")
    ) {
      return false;
    }

    if (
      name === "AWAY_WIN" &&
      hasExactMarket(adjustedMarkets, "DOUBLE_CHANCE_X2")
    ) {
      return false;
    }

    /* =========================
       🔴 BTTS YES x jogo desequilibrado
    ========================= */

    const diff = Math.abs(
      (data.lambdaHome ?? 1) - (data.lambdaAway ?? 1)
    );

    if (
      name === "BTTS_YES" &&
      diff > 1.4
    ) {
      return false;
    }

    return true;
  });

  /* ===========================
     🏁 OUTPUT
  ============================ */

  return {
    ...data,
    markets: filteredMarkets,
    rawMarkets: adjustedMarkets,
    correlationApplied: true
  };
}

/* ===========================
   🛠 HELPERS PRO
=========================== */

function hasExactMarket(markets: any[], target: string) {
  return markets.some(
    m => m.market.toUpperCase() === target
  );
}