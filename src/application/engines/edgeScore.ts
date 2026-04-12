import type { MarketDecision } from "./gameAnalyzer";

const CATEGORY_RISK: Record<string, number> = {
  CORE: 0.8,
  SEMI: 1.0,
  DERIVED: 1.2,
  ADVANCED: 1.5
};

export function calculateEdgeScore(
  market: MarketDecision
): number {

  const ev = market.expectedValue;
  const prob = market.probability;
  const odd = market.bookmakerOdd;

  // Penalização para odds muito altas
  const oddRisk =
    odd > 4 ? 1.3 :
    odd > 3 ? 1.15 :
    1;

  const categoryRisk =
    CATEGORY_RISK[market.category] ?? 1.0;

  const weightedEV = ev * 100;
  const weightedProb = prob * 10;

  let rawScore =
    (weightedEV * 0.6) +
    (weightedProb * 0.4);

  rawScore = rawScore / (categoryRisk * oddRisk);

  // Normalização 0–10
  const finalScore =
    Math.max(0, Math.min(rawScore, 10));

  return Number(finalScore.toFixed(2));
}