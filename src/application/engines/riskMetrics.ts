import type { MarketDecision } from "./gameAnalyzer";

function clamp(n: number, min = 0, max = 1) {
  return Math.max(min, Math.min(Number(n), max));
}

function safe(n: any, fallback = 0) {
  const num = Number(n);
  return Number.isFinite(num) ? num : fallback;
}

function getOddRisk(odd: number) {
  if (odd > 5.0) return 0.32;
  if (odd > 3.5) return 0.24;
  if (odd > 2.5) return 0.16;
  if (odd < 1.30) return 0.22;
  if (odd < 1.40) return 0.14;
  if (odd < 1.50) return 0.08;

  return 0.04;
}

function getMarketRisk(marketType: string) {
  if (marketType.includes("DOUBLE_CHANCE")) return 0.04;
  if (marketType.includes("OVER_1_5")) return 0.05;
  if (marketType.includes("OVER_2_5")) return 0.08;
  if (marketType.includes("BTTS")) return 0.09;

  if (
    marketType.includes("HOME_WIN") ||
    marketType.includes("AWAY_WIN")
  ) {
    return 0.11;
  }

  if (marketType === "DRAW") return 0.16;

  return 0.10;
}

export function calculateMarketRisk(
  market: MarketDecision
): number {
  const prob = clamp(safe(market.probability, 0.5));

  const odd = safe(
    (market as any).bookmakerOdd ??
    (market as any).odd ??
    (market as any).odds,
    0
  );

  const marketType = String(market.market ?? "").toUpperCase();

  if (!Number.isFinite(prob) || !Number.isFinite(odd) || odd <= 1) {
    return 1;
  }

  const probabilityRisk = 1 - prob;
  const oddRisk = getOddRisk(odd);
  const marketRisk = getMarketRisk(marketType);

  const riskScore =
    (probabilityRisk * 0.58) +
    (oddRisk * 0.22) +
    (marketRisk * 0.20);

  return Number(clamp(riskScore).toFixed(4));
}