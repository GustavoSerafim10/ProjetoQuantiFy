import {
  goalMatrix,
  overUnderProbability,
  bttsProbability
} from "../../domain/math/goalMatrix";

import { skellamModel } from "../../domain/marketModels/skellamModel";
import { decisionEngine } from "./decisionEngine";
import type { MarketCategory } from "../../domain/types/MarketCategory";
import { classifyMarket } from "../../domain/utils/marketClassifier";
import { selectBestMarket } from "./bestOnlySelector";
import { correlationPipeline } from "../pipelines/correlationPipeline";

export interface MarketDecision {
  market: string;
  category: MarketCategory;

  probability: number;
  bookmakerOdd: number;
  fairOdd: number;
  expectedValue: number;
  kelly: number;
  riskScore: number;

  decision: string;
  isAllowedByRisk: boolean;
  zone: "GREEN" | "YELLOW" | "RED";

  confidence?: number;
  signalScore?: number;
  edgeScore?: number;
  marketWeight?: number;

  ev?: number;
  odd?: number;
  odds?: number;
  risk?: number;

  source?: string;
  structureScore?: number;
  pressureIndex?: number;

  correlationPenalty?: number;
  correlationBoost?: number;
  correlationAdjusted?: boolean;
}

export interface GameAnalysis {
  markets: MarketDecision[];
  bestMarket: MarketDecision | null;
}

export function eliteAnalyzer(
  lambdaHome: number,
  lambdaAway: number,
  odds: Record<string, number>,
  leagueAvgGoals: number,
  recentGoalStd: number,
  seasonGoalAvg: number
): GameAnalysis {

  /* ===========================
     🔢 BASE MATEMÁTICA
  ============================ */

  const matrix = goalMatrix(lambdaHome, lambdaAway);

  const result = skellamModel(lambdaHome, lambdaAway);

  const ou25 = overUnderProbability(matrix, 2.5);
  const ou15 = overUnderProbability(matrix, 1.5);

  const btts = bttsProbability(matrix);

  /* ===========================
     🔥 SCORE DE GOLS (PRO REAL)
  ============================ */

  const totalLambda = lambdaHome + lambdaAway;

  const balance = 1 - Math.abs(lambdaHome - lambdaAway);

  const totalScore = Math.min(totalLambda / 3.2, 1);
  const balanceScore = Math.max(0, Math.min(balance, 1));

  const goalExpectationScore = Number(
    ((totalScore * 0.7) + (balanceScore * 0.3)).toFixed(4)
  );

  /* ===========================
     🧠 STEP 1 — MARKETS BASE
  ============================ */

  const marketsToEvaluate = [
    { name: "HOME WIN", probability: result.homeWinProb },
    { name: "DRAW", probability: result.drawProb },
    { name: "AWAY WIN", probability: result.awayWinProb },

    { name: "DOUBLE CHANCE 1X", probability: result.doubleChance1X },
    { name: "DOUBLE CHANCE X2", probability: result.doubleChanceX2 },

    { name: "OVER 1.5", probability: ou15.over },
    { name: "OVER 2.5", probability: ou25.over },

    { name: "BTTS YES", probability: btts.yes },
    { name: "BTTS NO", probability: btts.no }
  ];

  const evaluatedMarkets: MarketDecision[] = [];

  for (const market of marketsToEvaluate) {

    const odd = odds[market.name];
    if (!odd || odd <= 1) continue;

    const adjustedProbability = market.probability;

    const decision = decisionEngine({
      market: market.name,
      probability: adjustedProbability,
      bookmakerOdd: odd,
      lambdaHome,
      lambdaAway,
      leagueAvgGoals,
      recentGoalStd,
      seasonGoalAvg
    });

    const isAllowedByRisk =
      (decision?.riskScore ?? 0.5) < 0.7;

    evaluatedMarkets.push({
      market: market.name,
      category: classifyMarket(market.name),
      probability: decision.probability ?? adjustedProbability,
      bookmakerOdd: decision.bookmakerOdd ?? odd,
      fairOdd: decision.fairOdd ?? (1 / adjustedProbability),
      expectedValue: decision.expectedValue ?? 0,
      kelly: decision.kelly ?? 0,
      riskScore: decision.riskScore ?? 0.5,
      decision: decision.decision ?? "NO BET",
      zone: (decision.zone ?? "YELLOW") as "GREEN" | "YELLOW" | "RED",
      isAllowedByRisk
    });
  }

  /* ===========================
     🔗 STEP 2 — CORRELATION
  ============================ */

  const correlated = correlationPipeline({
    markets: evaluatedMarkets,
    lambdaHome,
    lambdaAway,
    goalExpectationScore
  });

  /* ===========================
     🧠 STEP 3 — AJUSTE DE PROB
  ============================ */

const markets = (correlated.markets as MarketDecision[]).map(m => {

  const factor = (m as any).correlationFactor ?? 1;

  const adjustedProb = Math.max(
    0,
    Math.min(1, m.probability * (0.9 + factor * 0.1))
  );

  return {
    ...m,
    probability: Number(adjustedProb.toFixed(4))
  };
});

  /* ===========================
     🛡️ STEP 4 — FILTRO FINAL
  ============================ */

  const allowedMarkets = markets.filter(m => {

    if (!m.isAllowedByRisk) return false;
    if (m.riskScore > 0.62) return false;
    if (m.expectedValue < 0.05) return false;
    if (m.probability < 0.55) return false;

    // 🔥 HARD FILTER OVER 2.5
    if (m.market === "OVER 2.5" && m.probability < 0.65) return false;

    return true;
  });

  /* ===========================
     🏆 STEP 5 — BEST PICK
  ============================ */

  const bestMarket =
    allowedMarkets.length > 0
      ? selectBestMarket(allowedMarkets)
      : null;

  /* ===========================
     🏁 OUTPUT FINAL
  ============================ */

  return {
    markets,
    bestMarket
  };
}