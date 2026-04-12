import type { MarketDecision } from "./gameAnalyzer";

export function calculateMarketRisk(
  market: MarketDecision
): number {

  const prob = market.probability;
  const odd = market.bookmakerOdd;

  // Quanto menor a probabilidade, maior risco
  const probabilityRisk = 1 - prob;

  // Odds altas aumentam risco estrutural
  const oddRisk =
    odd > 4 ? 1.4 :
    odd > 3 ? 1.2 :
    odd > 2 ? 1.1 :
    1;

  const baseRisk =
    probabilityRisk * oddRisk;

  // Normalização 0–10
  const riskScore =
    Math.max(0, Math.min(baseRisk * 10, 10));

  return Number(riskScore.toFixed(2));
}