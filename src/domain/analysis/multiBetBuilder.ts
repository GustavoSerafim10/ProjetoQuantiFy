interface ComboMarketCandidate {
  market?: string;
  probability?: number;
  odd?: number;
}

interface ComboResult {
  legs: [string, string];
  prob: number;
  odd: number;
  ev: number;
}

export function buildCombo(markets: ComboMarketCandidate[]): ComboResult | null {

  if (markets.length < 2) return null;

  const combos: ComboResult[] = [];

  for (let i = 0; i < markets.length; i++) {
    for (let j = i + 1; j < markets.length; j++) {

      const a = markets[i];
      const b = markets[j];

      const aMarket = a.market ?? "";
      const bMarket = b.market ?? "";

      // 🚫 evitar correlação óbvia
      if (aMarket.includes("OVER") && bMarket.includes("UNDER")) continue;
      if (aMarket.includes("BTTS") && bMarket.includes("BTTS_NO")) continue;

      const combinedProb = (a.probability ?? 0) * (b.probability ?? 0);
      const combinedOdd = (a.odd ?? 0) * (b.odd ?? 0);

      const combinedEV = (combinedProb * combinedOdd) - 1;

      combos.push({
        legs: [aMarket, bMarket],
        prob: combinedProb,
        odd: combinedOdd,
        ev: combinedEV
      });
    }
  }

  return combos.sort((a, b) => b.ev - a.ev)[0] || null;
}