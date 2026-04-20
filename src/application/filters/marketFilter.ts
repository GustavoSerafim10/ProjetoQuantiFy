/* ===============================
   🧹 MARKET FILTER (LIGHT PRE-FILTER)
   Remove apenas lixo evidente
================================ */

export function marketFilter(markets: any[]) {
  if (!Array.isArray(markets)) return [];

  const allowedMarkets = [
    "OVER_1_5",
    "OVER_2_5",
    "BTTS_YES",
    "BTTS_NO",
    "HOME_WIN",
    "AWAY_WIN",
    "DOUBLE_CHANCE_1X",
    "DOUBLE_CHANCE_X2",
    "DRAW"
  ];

  return markets.filter((m: any) => {
    if (!m || !m.market) return false;

    const odd = Number(m?.odd ?? 0);
    const market = String(m.market).toUpperCase();

    /* =========================
       SANIDADE BÁSICA
    ========================= */

    if (!Number.isFinite(odd) || odd <= 1) {
      return false;
    }

    /* =========================
       REMOVER ODDS EXTREMAS
    ========================= */

    if (odd > 10) {
      return false;
    }

    /* =========================
       REMOVER MERCADOS INVÁLIDOS
    ========================= */

    if (!allowedMarkets.includes(market)) {
      return false;
    }

    return true;
  });
}