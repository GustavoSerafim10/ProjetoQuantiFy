export function buildCombo(markets: any[]) {

  if (markets.length < 2) return null;

  const combos: any[] = [];

  for (let i = 0; i < markets.length; i++) {
    for (let j = i + 1; j < markets.length; j++) {

      const a = markets[i];
      const b = markets[j];

      // 🚫 evitar correlação óbvia
      if (a.market.includes("OVER") && b.market.includes("UNDER")) continue;
      if (a.market.includes("BTTS") && b.market.includes("BTTS_NO")) continue;

      const combinedProb = a.probability * b.probability;
      const combinedOdd = a.odd * b.odd;

      const combinedEV = (combinedProb * combinedOdd) - 1;

      combos.push({
        legs: [a.market, b.market],
        prob: combinedProb,
        odd: combinedOdd,
        ev: combinedEV
      });
    }
  }

  return combos.sort((a, b) => b.ev - a.ev)[0] || null;
}