export function getMarketWeight(market: string) {

  if (market.includes("OVER_2_5")) return 1.05;
  if (market.includes("OVER_1_5")) return 0.95;

  if (market.includes("UNDER")) return 0.90;

  if (market.includes("BTTS")) return 1.00;

  if (market.includes("HOME") || market.includes("AWAY")) return 0.85;

  if (market.includes("CORNERS")) return 0.80;

  if (market.includes("CARDS")) return 0.75;

  return 1.0;
}