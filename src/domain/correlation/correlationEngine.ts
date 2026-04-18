export function applyCorrelationAdjustments(markets: any[]) {
  if (!Array.isArray(markets)) return [];

  return markets.map((m: any) => {
    const market = String(m?.market ?? "").toUpperCase();

    let correlationFactor = 1;

    /* ===========================
       AJUSTES LEVES DE CORRELAÇÃO
       NÃO ALTERAR RADICALMENTE A PROB
    ============================ */

    // mercados compostos ofensivos
    if (market.includes("OVER") && market.includes("CORNERS")) {
      correlationFactor *= 1.03;
    }

    // mercado composto ofensivo forte
    if (market.includes("BTTS") && market.includes("OVER")) {
      correlationFactor *= 1.04;
    }

    // combinação estruturalmente conflitante
    if (market.includes("UNDER") && market.includes("BTTS_YES")) {
      correlationFactor *= 0.92;
    }

    // clamp leve
    correlationFactor = Math.max(0.92, Math.min(correlationFactor, 1.05));

    return {
      ...m,
      correlationFactor: Number(correlationFactor.toFixed(4))
    };
  });
}