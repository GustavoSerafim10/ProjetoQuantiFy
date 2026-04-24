import type { GameAnalysis, MarketDecision } from "./gameAnalyzer";
import { calculateEdgeScore } from "./edgeScore";
import { calculateMarketRisk } from "./riskMetrics";

/* ===============================
   🔥 SIGNAL SCORE INPUT
=============================== */

type SignalScoreInput = {
  probability: number;
  structureScore: number;
  riskScore: number;
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

  const probWeight = 0.4;
  const structureWeight = 0.25;
  const riskWeight = 0.2;
  const pressureWeight = 0.15;

  const score =
    (probWeight * probability) +
    (structureWeight * structureScore) +
    (riskWeight * (1 - riskScore)) +
    (pressureWeight * pressureIndex);

  return Number(score.toFixed(4));
}

/* ===============================
   🔥 OUTPUT TYPE
=============================== */

export interface RankedMarket extends MarketDecision {
  edgeScore: number;
  riskScore: number;
  signalScore: number;

  ev?: number;
  probability: number;
  confidence: number;
  kelly: number; // 🔥 obrigatório igual ao pai
}

/* ===============================
   🔥 RANKING
=============================== */

export function rankMarkets(
  analysis: GameAnalysis
): RankedMarket[] {

return analysis.markets
  .filter(m => m.expectedValue > 0)
  .map((m: any) => {

    const edgeScore = calculateEdgeScore(m);
    const riskScore = calculateMarketRisk(m);

    const probability = m.probability ?? 0.5;
    const structureScore = m.structureScore ?? 0.5;
    const pressureIndex = m.pressureIndex ?? 0.5;

    const signalScore = calculateSignalScore({
      probability,
      structureScore,
      riskScore,
      pressureIndex
    });

    return {
      ...m,
      edgeScore,
      riskScore,
      signalScore,

      probability,
      confidence: m.confidence ?? 0.5,
      kelly: m.kelly ?? 0,
      ev: m.ev ?? m.expectedValue ?? 0
    };
  })
  .sort((a: any, b: any) => b.signalScore - a.signalScore);
}