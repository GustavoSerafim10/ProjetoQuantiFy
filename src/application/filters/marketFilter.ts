
const MARKET_ALIASES: Record<string, string> = {
  HOME: "HOME_WIN",
  AWAY: "AWAY_WIN",
  OVER_1_5: "OVER_1_5",
  OVER_2_5: "OVER_2_5",
  BTTS_YES: "BTTS_YES",
  BTTS_NO: "BTTS_NO",
  HOME_WIN: "HOME_WIN",
  AWAY_WIN: "AWAY_WIN",
  DRAW: "DRAW",
  DOUBLE_CHANCE_1X: "DOUBLE_CHANCE_1X",
  DOUBLE_CHANCE_X2: "DOUBLE_CHANCE_X2",
};

const ALLOWED_MARKETS = new Set(Object.values(MARKET_ALIASES));

function normalizeMarket(market: string) {
  return String(market ?? "")
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/\./g, "_");
}

export function marketFilter(markets: any[]) {
  if (!Array.isArray(markets)) return [];

  return markets
    .map((m: any) => {
      const rawMarket = normalizeMarket(m?.market);
      const normalizedMarket = MARKET_ALIASES[rawMarket] ?? rawMarket;

      return {
        ...m,
        market: normalizedMarket,
      };
    })
    .filter((m: any) => {
      if (!m || !m.market) return false;

      const odd = Number(m?.odd ?? m?.odds ?? m?.bookmakerOdd ?? 0);
      const market = normalizeMarket(m.market);

      if (!Number.isFinite(odd) || odd <= 1.01) return false;
      if (odd > 15) return false;
      if (!ALLOWED_MARKETS.has(market)) return false;

      return true;
    });
}