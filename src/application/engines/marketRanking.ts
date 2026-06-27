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

function clamp(n: number, min = 0, max = 1) {
  return Math.max(min, Math.min(Number(n), max));
}

function calculateSignalScore(input: SignalScoreInput): number {
  const {
    probability,
    structureScore,
    riskScore,
    edgeScore,
    confidence,
    marketWeight,
    pressureIndex = 0.5,
  } = input;

  const normalizedEdge = clamp(edgeScore / 10);

  const rawScore =
    (0.22 * clamp(probability)) +
    (0.18 * clamp(structureScore)) +
    (0.22 * (1 - clamp(riskScore))) +
    (0.24 * normalizedEdge) +
    (0.09 * clamp(confidence)) +
    (0.05 * clamp(pressureIndex));

  return Number((rawScore * marketWeight).toFixed(4));
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
  rankingWarnings?: string[];
}

function normalizeMarketName(market: string): string {
  return String(market ?? "")
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/\./g, "_");
}

function getMarketWeight(market: string, analysis: any): number {
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

function getOddRangeWarning(market: string, odd: number): string | null {
  const key = normalizeMarketName(market);

  if (!odd || odd <= 1) return "INVALID_ODD";

  if (key === "OVER_1_5" && odd < 1.40) return "LOW_ODD_OVER15";
  if (key === "OVER_2_5" && odd < 1.55) return "LOW_ODD_OVER25";
  if (key === "BTTS_YES" && odd < 1.55) return "LOW_ODD_BTTS_YES";
  if (key === "BTTS_NO" && odd < 1.50) return "LOW_ODD_BTTS_NO";

  if (
    (key === "DOUBLE_CHANCE_1X" || key === "DOUBLE_CHANCE_X2") &&
    odd < 1.30
  ) {
    return "LOW_ODD_DOUBLE_CHANCE";
  }

  if ((key === "HOME_WIN" || key === "AWAY_WIN") && odd < 1.45) {
    return "LOW_ODD_RESULT";
  }

  if (key === "DRAW" && odd < 2.70) return "LOW_ODD_DRAW";

  if (odd > 5.0) return "VERY_HIGH_ODD_VARIANCE";

  return null;
}

export function rankMarkets(
  analysis: GameAnalysis
): RankedMarket[] {
  const markets = (analysis.markets ?? []).map((m: any) => {
    const edgeScore = calculateEdgeScore(m);
    const riskScore = Number(m.riskScore ?? m.risk ?? calculateMarketRisk(m));

    const probability = Number(m.probability ?? 0.5);
    const structureScore = Number(m.structureScore ?? 0.5);
    const pressureIndex = Number(m.pressureIndex ?? 0.5);
    const confidence = Number(m.confidence ?? 0.5);
    const marketWeight = getMarketWeight(m.market, analysis);

    const ev = Number(m.ev ?? m.expectedValue ?? 0);
    const odd = Number(m.odd ?? m.odds ?? m.bookmakerOdd ?? 0);

    const rankingWarnings: string[] = [
      ...((m.warnings as string[]) ?? []),
    ];

    if (ev <= 0) rankingWarnings.push("NEGATIVE_OR_ZERO_EV");

    const oddWarning = getOddRangeWarning(m.market, odd);
    if (oddWarning) rankingWarnings.push(oddWarning);

    if (probability >= 0.82 && odd > 0 && odd < 1.42) {
      rankingWarnings.push("HIGH_PROB_LOW_ODD_CAUTION");
    }

    let adjustedMarketWeight = marketWeight;

    if (rankingWarnings.includes("NEGATIVE_OR_ZERO_EV")) {
      adjustedMarketWeight *= 0.65;
    }

    if (oddWarning) {
      adjustedMarketWeight *= 0.85;
    }

    const signalScore = calculateSignalScore({
      probability,
      structureScore,
      riskScore,
      edgeScore,
      confidence,
      marketWeight: adjustedMarketWeight,
      pressureIndex,
    });

    return {
      ...m,
      edgeScore,
      riskScore,
      signalScore,
      probability,
      confidence,
      kelly: m.kelly ?? 0,
      ev,
      marketWeight: Number(adjustedMarketWeight.toFixed(4)),
      rankingWarnings,

      debug: {
        ...(m.debug || {}),
        marketRanking: {
          edgeScore,
          riskScore,
          signalScore,
          probability,
          structureScore,
          pressureIndex,
          confidence,
          ev,
          odd,
          marketWeight,
          adjustedMarketWeight,
          rankingWarnings,
        },
      },
    };
  });

  return markets.sort((a: any, b: any) => b.signalScore - a.signalScore);
}