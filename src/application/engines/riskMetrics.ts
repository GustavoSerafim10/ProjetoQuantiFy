import type { MarketDecision } from "./gameAnalyzer";

export function calculateMarketRisk(
  market: MarketDecision
): number {
  const prob = Number(market.probability ?? 0);
  const odd = Number(market.bookmakerOdd ?? 0);
  const marketType = String(market.market ?? "").toUpperCase();

  if (!Number.isFinite(prob) || !Number.isFinite(odd) || odd <= 1) {
    return 10;
  }

  // Quanto menor a probabilidade, maior o risco
  const probabilityRisk = 1 - Math.max(0, Math.min(prob, 1));

  // Odds altas aumentam risco estrutural
  let oddRisk = 1;

  if (odd > 5) oddRisk = 1.30;
  else if (odd > 3.5) oddRisk = 1.20;
  else if (odd > 2.2) oddRisk = 1.10;

  // Ajuste por tipo de mercado
  let marketRisk = 1;

  if (marketType.includes("OVER_1_5")) marketRisk = 0.92;
  else if (marketType.includes("DOUBLE_CHANCE")) marketRisk = 0.94;
  else if (marketType.includes("OVER_2_5")) marketRisk = 1.02;
  else if (marketType.includes("BTTS")) marketRisk = 1.05;
  else if (
    marketType.includes("HOME_WIN") ||
    marketType.includes("AWAY_WIN") ||
    marketType === "DRAW"
  ) {
    marketRisk = 1.08;
  }

  const baseRisk = probabilityRisk * oddRisk * marketRisk;

  // Escala 0–10
  const riskScore = Math.max(0, Math.min(baseRisk * 10, 10));

  return Number(riskScore.toFixed(2));
}