import type { GameAnalysis, MarketDecision } from "./gameAnalyzer";
import { calculateEdgeScore } from "./edgeScore";
import { calculateMarketRisk } from "./riskMetrics";

/* ===============================
   🔥 SIGNAL SCORE INPUT
=============================== */

type SignalScoreInput = {
  probability: number;
  structureScore: number;
  riskScore: number; // escala 0-10
  pressureIndex?: number;
};

/* ===============================
   🔥 SIGNAL SCORE
=============================== */

function calculateSignalScore(input: SignalScoreInput): number {
  const {
    probability,
    structureScore,
    riskScore,
    pressureIndex = 0.5
  } = input;

  const safeProbability = Math.max(0, Math.min(probability ?? 0.5, 1));
  const safeStructure = Math.max(0, Math.min(structureScore ?? 0.5, 1));
  const safePressure = Math.max(0, Math.min(pressureIndex ?? 0.5, 1));

  // riskMetrics retorna 0–10, então normalizamos
  const normalizedRisk = Math.max(0, Math.min((riskScore ?? 5) / 10, 1));

  const probWeight = 0.28;
  const structureWeight = 0.27;
  const riskWeight = 0.25;
  const pressureWeight = 0.20;

  const score =
    (probWeight * safeProbability) +
    (structureWeight * safeStructure) +
    (riskWeight * (1 - normalizedRisk)) +
    (pressureWeight * safePressure);

  return Number(score.toFixed(4));
}

/* ===============================
   🔥 OUTPUT TYPE
=============================== */

export interface RankedMarket extends MarketDecision {
  edgeScore: number;
  riskScore: number;      // 0–10
  signalScore: number;    // 0–1 aprox
  rankingScore: number;   // score final do ranking

  ev?: number;
  probability: number;
  confidence: number;
  kelly: number;
}

/* ===============================
   🔥 RANKING
=============================== */

export function rankMarkets(
  analysis: GameAnalysis
): RankedMarket[] {
  return analysis.markets
    .filter((m: any) => {
      const ev = Number(m?.ev ?? m?.expectedValue ?? 0);
      return ev > 0;
    })
    .map((m: any) => {
      const edgeScore = calculateEdgeScore(m);
      const riskScore = calculateMarketRisk(m); // 0–10

      const probability = Number(m?.probability ?? 0.5);
      const structureScore = Number(m?.structureScore ?? 0.5);
      const pressureIndex = Number(m?.pressureIndex ?? 0.5);
      const confidence = Number(m?.confidence ?? 0.5);
      const kelly = Number(m?.kelly ?? 0);
      const ev = Number(m?.ev ?? m?.expectedValue ?? 0);

      const signalScore = calculateSignalScore({
        probability,
        structureScore,
        riskScore,
        pressureIndex
      });

      const normalizedRisk = Math.max(0, Math.min(riskScore / 10, 1));

      /* ===========================
         SCORE FINAL DO RANKING
         VALUE FIRST
      ============================ */

      const rankingScore =
        (ev * 0.45) +
        (edgeScore * 0.20) +
        (signalScore * 0.15) +
        (confidence * 0.10) +
        ((1 - normalizedRisk) * 0.10);

      return {
        ...m,
        edgeScore,
        riskScore,
        signalScore,
        rankingScore,
        probability,
        confidence,
        kelly,
        ev
      };
    })
    .sort((a: any, b: any) => b.rankingScore - a.rankingScore);
}