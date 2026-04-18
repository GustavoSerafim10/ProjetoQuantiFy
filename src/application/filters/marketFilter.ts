/* ===============================
   🧹 MARKET FILTER (LIGHT PRE-FILTER)
   Remove apenas lixo evidente
================================ */

export function marketFilter(markets: any[]) {
  if (!Array.isArray(markets)) return [];

  return markets.filter((m: any) => {
    const odd = Number(m?.odd ?? 0);

    /* =========================
       SANIDADE BÁSICA
    ========================= */

    if (!m || !m.market) return false;

    if (!Number.isFinite(odd) || odd <= 1) {
      return false;
    }

    /* =========================
       REMOVER ODDS EXTREMAS
    ========================= */

    if (odd > 10) {
      return false; // ruído / baixa confiabilidade
    }

    /* =========================
       REMOVER MERCADOS INVÁLIDOS
    ========================= */

    const market = String(m.market).toUpperCase();

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

    if (!allowedMarkets.includes(market)) {
      return false;
    }

    return true;
  });
}