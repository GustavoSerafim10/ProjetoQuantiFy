import type { MarketDecision } from "./gameAnalyzer";

function normalizeMarketName(market: string): string {
  return String(market ?? "")
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/\./g, "_");
}

function clamp(n: number, min = 0, max = 1) {
  return Math.max(min, Math.min(n, max));
}

function getMarketContextScore(market: string): number {
  const m = normalizeMarketName(market);

  switch (m) {
    case "OVER_1_5": return 7.3;
    case "BTTS_YES": return 7.1;
    case "OVER_2_5": return 7.0;
    case "BTTS_NO": return 6.8;

    case "DOUBLE_CHANCE_1X":
    case "DOUBLE_CHANCE_X2":
      return 6.7;

    case "HOME":
    case "AWAY":
    case "HOME_WIN":
    case "AWAY_WIN":
      return 6.9;

    case "DRAW":
      return 5.5;

    default:
      return 5;
  }
}

function getMarketStabilityScore(m: MarketDecision): number {
  const market = normalizeMarketName(m.market);

  const probability = Number(m.probability ?? 0);
  const risk = Number((m as any).riskScore ?? (m as any).risk ?? 0.5);
  const confidence = Number(m.confidence ?? 0.5);
  const structureScore = Number((m as any).structureScore ?? 0.5);
  const odd = Number((m as any).odd ?? (m as any).odds ?? (m as any).bookmakerOdd ?? 0);

  let stability =
    probability * 0.25 +
    (1 - risk) * 0.30 +
    confidence * 0.25 +
    structureScore * 0.20;

  if (market === "OVER_1_5") stability += 0.04;
  if (market === "BTTS_YES") stability += 0.025;
  if (market === "OVER_2_5") stability -= 0.01;
  if (market === "DRAW") stability -= 0.06;

  if (market.includes("DOUBLE_CHANCE")) {
    stability += 0.01;

    if (odd > 1.90) stability -= 0.07;
    if (odd > 2.20) stability -= 0.12;
    if (odd > 2.50) stability -= 0.18;
  }

  return Number(clamp(stability).toFixed(4));
}

function getCoherenceScore(m: MarketDecision): number {
  const market = normalizeMarketName(m.market);

  const odd = Number((m as any).odd ?? (m as any).odds ?? (m as any).bookmakerOdd ?? 0);
  const probability = Number(m.probability ?? 0);
  const risk = Number((m as any).riskScore ?? (m as any).risk ?? 0.5);
  const confidence = Number(m.confidence ?? 0.5);
  const structureScore = Number((m as any).structureScore ?? 0.5);
  const ev = Number((m as any).ev ?? m.expectedValue ?? 0);

  let coherence = 0.55;

  coherence += structureScore * 0.22;
  coherence += confidence * 0.18;
  coherence += (1 - risk) * 0.20;
  coherence += probability * 0.15;

  if (ev > 0.08) coherence += 0.04;
  if (ev > 0.15) coherence += 0.04;

  if (market.includes("DOUBLE_CHANCE")) {
    if (odd > 1.85) coherence -= 0.08;
    if (odd > 2.20) coherence -= 0.14;
    if (odd > 2.50) coherence -= 0.20;

    if (probability < 0.62) coherence -= 0.08;
    if (confidence < 0.50) coherence -= 0.08;
  }

  if (market === "BTTS_YES") {
    if (probability >= 0.56 && ev >= 0.07) coherence += 0.05;
    if (confidence >= 0.58) coherence += 0.04;
  }

  if (market === "OVER_1_5") {
    if (probability >= 0.75) coherence += 0.05;
    if (odd < 1.35) coherence -= 0.08;
  }

  if (market === "OVER_2_5") {
    if (probability < 0.55) coherence -= 0.04;
    if (ev <= 0.02) coherence -= 0.10;
  }

  return Number(clamp(coherence).toFixed(4));
}

function getOperationalWarningPenalty(m: MarketDecision): number {
  const warnings = [
    ...(((m as any).warnings as string[]) ?? []),
    ...(((m as any).rankingWarnings as string[]) ?? []),
  ];

  let penalty = 0;

  if (warnings.includes("NEGATIVE_OR_ZERO_EV")) penalty += 3;
  if (warnings.some(w => w.includes("LOW_ODD"))) penalty += 1.5;
  if (warnings.some(w => w.includes("VERY_HIGH_ODD"))) penalty += 1.5;
  if (warnings.some(w => w.includes("CORRELATION"))) penalty += 0.8;
  if (warnings.some(w => w.includes("WEAK"))) penalty += 0.8;
  if (warnings.some(w => w.includes("LOW_CONFIDENCE"))) penalty += 1.0;
  if (warnings.some(w => w.includes("HIGH_RISK"))) penalty += 1.0;

  return penalty;
}

function getOperationalScore(m: MarketDecision): number {
  const contextScore = getMarketContextScore(m.market);
  const stabilityScore = getMarketStabilityScore(m);
  const coherenceScore = getCoherenceScore(m);
  const penalty = getOperationalWarningPenalty(m);

  const ev = Number((m as any).ev ?? m.expectedValue ?? 0);
  const probability = Number(m.probability ?? 0);
  const risk = Number((m as any).riskScore ?? (m as any).risk ?? 0.5);
  const confidence = Number(m.confidence ?? 0.5);
  const kelly = Number(m.kelly ?? 0);
  const signalScore = Number((m as any).signalScore ?? 0);
  const edgeScore = Number((m as any).edgeScore ?? 0);
  const marketWeight = Number((m as any).marketWeight ?? 1);

  const score =
    contextScore +
    coherenceScore * 4.0 +
    stabilityScore * 3.0 +
    signalScore * 3.6 +
    edgeScore * 0.16 +
    ev * 5.2 +
    probability * 1.7 +
    confidence * 1.8 +
    kelly * 1.0 -
    risk * 3.4 -
    penalty;

  return Number((score * marketWeight).toFixed(4));
}

function isSelectable(m: MarketDecision): boolean {
  const decision = String((m as any).decision ?? "").toUpperCase();
  const tier = String((m as any).tier ?? "").toUpperCase();
  const zone = String((m as any).zone ?? "").toUpperCase();
  const classification = String((m as any).classification ?? "").toUpperCase();

  return (
    decision === "BET" ||
    decision === "STRONG BET" ||
    decision === "ELITE" ||
    decision === "OPERACIONAL" ||
    classification === "BET" ||
    classification === "ELITE" ||
    classification === "SCALPER" ||
    tier === "ELITE" ||
    tier === "OPERACIONAL" ||
    zone === "GREEN" ||
    zone === "YELLOW"
  );
}

export function selectBestMarket(
  markets: MarketDecision[]
): MarketDecision | null {
  if (!Array.isArray(markets) || markets.length === 0) return null;

  const selectable = markets.filter(isSelectable);
  if (selectable.length === 0) return null;

  const green = selectable.filter(
    m => String((m as any).zone ?? "").toUpperCase() === "GREEN"
  );

  const yellow = selectable.filter(
    m => String((m as any).zone ?? "").toUpperCase() === "YELLOW"
  );

  const candidates =
    green.length > 0
      ? green
      : yellow.length > 0
      ? yellow
      : selectable;

  candidates.sort((a, b) => {
    const aScore = getOperationalScore(a);
    const bScore = getOperationalScore(b);

    if (bScore !== aScore) return bScore - aScore;

    const aCoherence = getCoherenceScore(a);
    const bCoherence = getCoherenceScore(b);

    if (bCoherence !== aCoherence) return bCoherence - aCoherence;

    const aStability = getMarketStabilityScore(a);
    const bStability = getMarketStabilityScore(b);

    if (bStability !== aStability) return bStability - aStability;

    const aRisk = Number(a.riskScore ?? (a as any).risk ?? 0.5);
    const bRisk = Number(b.riskScore ?? (b as any).risk ?? 0.5);

    if (aRisk !== bRisk) return aRisk - bRisk;

    const aEv = Number((a as any).ev ?? a.expectedValue ?? 0);
    const bEv = Number((b as any).ev ?? b.expectedValue ?? 0);

    if (bEv !== aEv) return bEv - aEv;

    const aProb = Number(a.probability ?? 0);
    const bProb = Number(b.probability ?? 0);

    if (bProb !== aProb) return bProb - aProb;

    return Number(b.kelly ?? 0) - Number(a.kelly ?? 0);
  });

  const best = candidates[0];

  return {
    ...best,
    operationalScore: getOperationalScore(best),
    stabilityScore: getMarketStabilityScore(best),
    coherenceScore: getCoherenceScore(best),
  } as any;
}