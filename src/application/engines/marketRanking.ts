import type { GameAnalysis, MarketDecision } from "./gameAnalyzer";
import { calculateEdgeScore } from "./edgeScore";
import { calculateMarketRisk } from "./riskMetrics";

type SignalScoreInput = {
  probability: number;
  structureScore: number;
  riskScore: number;
  edgeScore: number;
  confidence: number;
  marketWeight: number;
  pressureIndex?: number;
};

function calculateSignalScore(input: SignalScoreInput): number {
  const {
    probability,
    structureScore,
    riskScore,
    edgeScore,
    confidence,
    marketWeight,
    pressureIndex = 0.5
  } = input;

  const probWeight = 0.20;
  const structureWeight = 0.22;
  const riskWeight = 0.24;
  const edgeWeight = 0.20;
  const confidenceWeight = 0.09;
  const pressureWeight = 0.05;

  const normalizedEdge = Math.max(0, Math.min(edgeScore / 10, 1));

  const rawScore =
    (probWeight * probability) +
    (structureWeight * structureScore) +
    (riskWeight * (1 - riskScore)) +
    (edgeWeight * normalizedEdge) +
    (confidenceWeight * confidence) +
    (pressureWeight * pressureIndex);

  const weightedScore = rawScore * marketWeight;

  return Number(weightedScore.toFixed(4));
}

export interface RankedMarket extends MarketDecision {
  edgeScore: number;
  riskScore: number;
  signalScore: number;
  ev?: number;
  probability: number;
  confidence: number;
  kelly: number;
  marketWeight?: number;
}

function normalizeMarketName(market: string): string {
  return String(market ?? "")
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(".", "_");
}

function getMarketWeight(
  market: string,
  analysis: any
): number {
  const key = normalizeMarketName(market);

  return Number(
    analysis.marketContext?.weights?.[key] ??
    analysis.context?.marketContext?.weights?.[key] ??
    analysis.marketIntelligence?.weights?.[key] ??
    analysis.model?.marketContext?.weights?.[key] ??
    analysis.data?.marketContext?.weights?.[key] ??
    1
  );
}

function isOddInHealthyRange(
  market: string,
  odd: number
): boolean {
  const key = normalizeMarketName(market);

  if (!odd || odd <= 1) return true;

  if (key === "OVER_1_5") return odd >= 1.45 && odd <= 1.80;
  if (key === "OVER_2_5") return odd >= 1.60 && odd <= 2.50;
  if (key === "BTTS_YES") return odd >= 1.60 && odd <= 2.35;
  if (key === "BTTS_NO") return odd >= 1.55 && odd <= 2.30;

  if (key === "DOUBLE_CHANCE_1X" || key === "DOUBLE_CHANCE_X2") {
    return odd >= 1.35 && odd <= 1.75;
  }

  if (key === "HOME" || key === "AWAY" || key === "HOME_WIN" || key === "AWAY_WIN") {
    return odd >= 1.55 && odd <= 3.20;
  }

  if (key === "DRAW") return odd >= 2.80 && odd <= 4.20;

  return odd >= 1.35 && odd <= 3.50;
}

export function rankMarkets(
  analysis: GameAnalysis
): RankedMarket[] {

  return analysis.markets
    .filter((m: any) => {
      const ev = m.ev ?? m.expectedValue ?? 0;
      const probability = m.probability ?? 0;
      const odd = m.odd ?? m.odds ?? m.bookmakerOdd ?? 0;
      const market = normalizeMarketName(m.market);

      if (ev <= 0) return false;
      if (!isOddInHealthyRange(market, odd)) return false;

      if (probability >= 0.82 && odd > 0 && odd < 1.45) return false;

      return true;
    })
    .map((m: any) => {
      const edgeScore = calculateEdgeScore(m);
      const riskScore = calculateMarketRisk(m);

      const probability = Number(m.probability ?? 0.5);
      const structureScore = Number(m.structureScore ?? 0.5);
      const pressureIndex = Number(m.pressureIndex ?? 0.5);
      const confidence = Number(m.confidence ?? 0.5);
      const marketWeight = getMarketWeight(m.market, analysis);

      const signalScore = calculateSignalScore({
        probability,
        structureScore,
        riskScore,
        edgeScore,
        confidence,
        marketWeight,
        pressureIndex
      });

      return {
        ...m,
        edgeScore,
        riskScore,
        signalScore,
        probability,
        confidence,
        kelly: m.kelly ?? 0,
        ev: m.ev ?? m.expectedValue ?? 0,
        marketWeight
      };
    })
    .sort((a: any, b: any) => b.signalScore - a.signalScore);
}