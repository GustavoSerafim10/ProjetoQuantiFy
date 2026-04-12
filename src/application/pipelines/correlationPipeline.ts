import { applyCorrelationAdjustments } from "../../domain/correlation/correlationEngine";

export function correlationPipeline(data: any) {

  const markets = data.markets ?? [];

  /* ===========================
     🔥 AJUSTE BASE
  ============================ */

  const adjustedMarkets = applyCorrelationAdjustments(markets);

  /* ===========================
     🚫 FILTRO DE CONFLITO AVANÇADO
  ============================ */

  const filteredMarkets = adjustedMarkets.filter((m: any) => {

    const name = m.market;

    /* ===========================
       🔴 1. BTTS vs UNDER
    ============================ */
    if (
      name.includes("BTTS_YES") &&
      hasMarket(adjustedMarkets, "UNDER")
    ) {
      return false;
    }

    /* ===========================
       🔴 2. OVER vs BTTS NO
    ============================ */
    if (
      name.includes("OVER") &&
      hasMarket(adjustedMarkets, "BTTS_NO")
    ) {
      return false;
    }

    /* ===========================
       🔴 3. RESULT vs BTTS CONFLITO
    ============================ */
    if (
      name.includes("HOME_WIN") &&
      hasMarket(adjustedMarkets, "BTTS_NO") &&
      data.lambdaAway > 1
    ) {
      return false;
    }

    /* ===========================
       🔴 4. CORNERS vs BAIXA PRESSÃO
    ============================ */
    if (
      name.includes("CORNERS_OVER") &&
      (data.lambdaHome + data.lambdaAway) < 2.2
    ) {
      return false;
    }

    /* ===========================
       🔴 5. ASSIMETRIA FORTE
    ============================ */
    const diff = Math.abs(data.lambdaHome - data.lambdaAway);

    if (diff > 1.5 && name.includes("BTTS_YES")) {
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
    rawMarkets: adjustedMarkets
  };
}

/* ===========================
   🛠 HELPERS
=========================== */

function hasMarket(markets: any[], keyword: string) {
  return markets.some(m => m.market.includes(keyword));
}