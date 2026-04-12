export function applyCorrelationAdjustments(markets: any[]) {

  return markets.map((m: any) => {

    let adjustedProb = m.probability;

    // 🔥 Over gols + corners → reforça
    if (
      m.market.includes("OVER") &&
      m.market.includes("CORNERS")
    ) {
      adjustedProb *= 1.05;
    }

    // 🔥 BTTS + Over → reforça
    if (
      m.market.includes("BTTS_YES") &&
      m.market.includes("OVER")
    ) {
      adjustedProb *= 1.07;
    }

    // 🔴 Under + BTTS YES → penaliza
    if (
      m.market.includes("UNDER") &&
      m.market.includes("BTTS_YES")
    ) {
      adjustedProb *= 0.90;
    }

    return {
      ...m,
      probability: Math.min(adjustedProb, 0.95)
    };
  });
}