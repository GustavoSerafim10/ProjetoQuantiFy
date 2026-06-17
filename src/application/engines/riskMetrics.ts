import type { MarketDecision } from "./gameAnalyzer";

export function calculateMarketRisk(
  market: MarketDecision
): number {
  const prob = Number(market.probability ?? 0);

  const odd = Number(
    (market as any).bookmakerOdd ??
    (market as any).odd ??
    (market as any).odds ??
    0
  );

  const marketType = String(market.market ?? "").toUpperCase();

  if (!Number.isFinite(prob) || !Number.isFinite(odd) || odd <= 1) {
    return 1;
  }

  const probabilityRisk = 1 - Math.max(0, Math.min(prob, 1));

  let oddRisk = 1;

  if (odd > 5) oddRisk = 1.35;
  else if (odd > 3.5) oddRisk = 1.25;
  else if (odd > 2.2) oddRisk = 1.15;
  else if (odd < 1.35) oddRisk = 1.20;
  else if (odd < 1.45) oddRisk = 1.12;

  let marketRisk = 1;

  if (marketType.includes("OVER_1_5")) marketRisk = 1.00;
  else if (marketType.includes("DOUBLE_CHANCE")) marketRisk = 0.98;
  else if (marketType.includes("OVER_2_5")) marketRisk = 1.00;
  else if (marketType.includes("BTTS")) marketRisk = 1.04;
  else if (
    marketType.includes("HOME_WIN") ||
    marketType.includes("AWAY_WIN") ||
    marketType === "DRAW"
  ) {
    marketRisk = 1.08;
  }

  const baseRisk = probabilityRisk * oddRisk * marketRisk;

  const riskScore = Math.max(0, Math.min(baseRisk, 1));

  return Number(riskScore.toFixed(4));
}