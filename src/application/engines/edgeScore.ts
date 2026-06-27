import type { MarketDecision } from "./gameAnalyzer";

const CATEGORY_RISK: Record<string, number> = {
  CORE: 0.95,
  SEMI: 1.0,
  DERIVED: 1.10,
  ADVANCED: 1.25,

  RESULT: 1.05,
  GOALS: 0.95,
  BTTS: 1.05,
  DOUBLE_CHANCE: 0.90,
};

function clamp(n: number, min = 0, max = 1) {
  return Math.max(min, Math.min(Number(n), max));
}

function getOddQualityMultiplier(odd: number): number {
  if (odd < 1.30) return 0.45;
  if (odd < 1.40) return 0.70;
  if (odd < 1.50) return 0.88;

  if (odd > 4.00) return 0.65;
  if (odd > 3.20) return 0.78;
  if (odd > 2.70) return 0.88;

  return 1.0;
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

  const risk = clamp(Number((market as any).risk ?? (market as any).riskScore ?? 0.5));

  if (
    !Number.isFinite(ev) ||
    !Number.isFinite(prob) ||
    !Number.isFinite(odd) ||
    prob <= 0 ||
    prob >= 1 ||
    odd <= 1
  ) {
    return 0;
  }

  const categoryRisk =
    CATEGORY_RISK[(market as any).category] ?? 1.0;

  const oddQuality = getOddQualityMultiplier(odd);

  const evScore = clamp(ev / 0.18);
  const probScore = clamp(prob / 0.78);
  const riskScore = 1 - risk;

  let rawScore =
    (evScore * 0.45) +
    (probScore * 0.25) +
    (riskScore * 0.20) +
    (oddQuality * 0.10);

  rawScore = rawScore / categoryRisk;

  const finalScore = Math.max(0, Math.min(rawScore * 10, 10));

  return Number(finalScore.toFixed(2));
}