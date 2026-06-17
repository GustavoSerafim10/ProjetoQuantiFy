import type { MarketDecision } from "./gameAnalyzer";

const CATEGORY_RISK: Record<string, number> = {
  CORE: 0.9,
  SEMI: 1.0,
  DERIVED: 1.15,
  ADVANCED: 1.35
};

function getOddQualityMultiplier(odd: number): number {
  if (odd < 1.35) return 0.55;
  if (odd < 1.45) return 0.70;
  if (odd < 1.55) return 0.88;

  if (odd > 3.20) return 0.70;
  if (odd > 2.70) return 0.85;

  return 1.00;
}

export function calculateEdgeScore(
  market: MarketDecision
): number {
  const ev = Number((market as any).ev ?? market.expectedValue ?? 0);
  const prob = Number(market.probability ?? 0);

  const odd = Number(
    (market as any).bookmakerOdd ??
    (market as any).odd ??
    (market as any).odds ??
    0
  );

  if (!Number.isFinite(ev) || !Number.isFinite(prob) || !Number.isFinite(odd) || odd <= 1) {
    return 0;
  }

  const categoryRisk =
    CATEGORY_RISK[(market as any).category] ?? 1.0;

  const oddQuality = getOddQualityMultiplier(odd);

  const evScore = Math.min(ev / 0.20, 1);
  const probScore = Math.min(prob / 0.80, 1);

  let rawScore =
    (evScore * 0.55) +
    (probScore * 0.25) +
    (oddQuality * 0.20);

  rawScore = rawScore / categoryRisk;

  const finalScore = Math.max(0, Math.min(rawScore * 10, 10));

  return Number(finalScore.toFixed(2));
}