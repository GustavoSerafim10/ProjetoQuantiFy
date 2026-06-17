import type { MarketDecision } from "./gameAnalyzer";

function normalizeMarketName(market: string): string {
  return String(market ?? "")
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(".", "_");
}

function getMarketContextScore(
  market: string
): number {
  const m = normalizeMarketName(market);

  switch (m) {
    case "OVER_1_5":
      return 7;

    case "OVER_2_5":
      return 7;

    case "BTTS_YES":
      return 7;

    case "BTTS_NO":
      return 6;

    case "HOME":
    case "AWAY":
    case "HOME_WIN":
    case "AWAY_WIN":
      return 7;

    case "DOUBLE_CHANCE_HOME":
    case "DOUBLE_CHANCE_AWAY":
    case "DOUBLE_CHANCE_1X":
    case "DOUBLE_CHANCE_X2":
      return 7;

    case "DRAW":
      return 5;

    default:
      return 5;
  }
}

function isOddHealthy(m: MarketDecision): boolean {
  const market = normalizeMarketName(m.market);
  const odd = (m as any).odd ?? (m as any).odds ?? (m as any).bookmakerOdd ?? 0;

  if (!odd || odd <= 1) return true;

  if (market === "OVER_1_5") return odd >= 1.45 && odd <= 1.80;
  if (market === "OVER_2_5") return odd >= 1.60 && odd <= 2.50;
  if (market === "BTTS_YES") return odd >= 1.60 && odd <= 2.35;
  if (market === "BTTS_NO") return odd >= 1.55 && odd <= 2.30;

  if (
    market === "DOUBLE_CHANCE_1X" ||
    market === "DOUBLE_CHANCE_X2" ||
    market === "DOUBLE_CHANCE_HOME" ||
    market === "DOUBLE_CHANCE_AWAY"
  ) {
    return odd >= 1.35 && odd <= 1.75;
  }

  if (
    market === "HOME" ||
    market === "AWAY" ||
    market === "HOME_WIN" ||
    market === "AWAY_WIN"
  ) {
    return odd >= 1.55 && odd <= 3.20;
  }

  if (market === "DRAW") {
    return odd >= 2.80 && odd <= 4.20;
  }

  return odd >= 1.35 && odd <= 3.50;
}

function getOperationalPenalty(m: MarketDecision): number {
  const market = normalizeMarketName(m.market);
  const odd = (m as any).odd ?? (m as any).odds ?? (m as any).bookmakerOdd ?? 0;
  const probability = m.probability ?? 0;
  const ev = m.expectedValue ?? (m as any).ev ?? 0;
  const risk = m.riskScore ?? (m as any).risk ?? 0.5;
  const confidence = m.confidence ?? 0.5;

  let penalty = 0;

  if (!isOddHealthy(m)) {
    penalty += 5;
  }

  if (odd > 0 && odd < 1.35) penalty += 4;
  else if (odd > 0 && odd < 1.45) penalty += 2;

  if (probability >= 0.82 && odd > 0 && odd < 1.50) {
    penalty += 3;
  }

  if (ev < 0.08) {
    penalty += 2;
  }

  if (risk > 0.60) {
    penalty += 2;
  }

  if (confidence < 0.55) {
    penalty += 1;
  }

  if (
    market === "OVER_1_5" &&
    probability > 0.82 &&
    odd < 1.55
  ) {
    penalty += 2;
  }

  return penalty;
}

function getOperationalScore(m: MarketDecision): number {
  const contextScore = getMarketContextScore(m.market);
  const penalty = getOperationalPenalty(m);

  const ev = m.expectedValue ?? (m as any).ev ?? 0;
  const probability = m.probability ?? 0;
  const risk = m.riskScore ?? (m as any).risk ?? 0.5;
  const confidence = m.confidence ?? 0.5;
  const kelly = m.kelly ?? 0;
  const signalScore = (m as any).signalScore ?? 0;
  const edgeScore = (m as any).edgeScore ?? 0;
  const marketWeight = (m as any).marketWeight ?? 1;

  const score =
    contextScore +
    signalScore * 4 +
    edgeScore * 0.25 +
    ev * 8 +
    probability * 2 +
    confidence * 1.5 +
    kelly * 2 -
    risk * 3 -
    penalty;

  return Number((score * marketWeight).toFixed(4));
}

export function selectBestMarket(
  markets: MarketDecision[]
): MarketDecision | null {

  const operable = markets.filter(
    m =>
      m.decision === "BET" ||
      m.decision === "STRONG BET"
  );

  if (operable.length === 0)
    return null;

  const green = operable.filter(
    m => m.zone === "GREEN"
  );

  const yellow = operable.filter(
    m => m.zone === "YELLOW"
  );

  const candidates =
    green.length > 0
      ? green
      : yellow;

  if (candidates.length === 0)
    return null;

  candidates.sort((a, b) => {
    const aScore = getOperationalScore(a);
    const bScore = getOperationalScore(b);

    if (bScore !== aScore) return bScore - aScore;

    const aRisk = a.riskScore ?? (a as any).risk ?? 0.5;
    const bRisk = b.riskScore ?? (b as any).risk ?? 0.5;

    if (aRisk !== bRisk) return aRisk - bRisk;

    const aEv = a.expectedValue ?? (a as any).ev ?? 0;
    const bEv = b.expectedValue ?? (b as any).ev ?? 0;

    if (bEv !== aEv) return bEv - aEv;

    if (b.probability !== a.probability)
      return b.probability - a.probability;

    return (b.kelly ?? 0) - (a.kelly ?? 0);
  });

  return candidates[0];
}