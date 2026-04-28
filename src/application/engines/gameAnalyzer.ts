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
  const matrix = goalMatrix(lambdaHome, lambdaAway);

  // Skellam agora vira a base para resultado e dupla chance
  const result = skellamModel(lambdaHome, lambdaAway);

  // Goal matrix continua sendo usada para gols e BTTS
  const ou25 = overUnderProbability(matrix, 2.5);
  const btts = bttsProbability(matrix);

  const evaluatedMarkets: MarketDecision[] = [];

  const MODEL_CONFIDENCE = 1.0;

  const marketsToEvaluate = [
    { name: "HOME WIN", probability: result.homeWinProb },
    { name: "DRAW", probability: result.drawProb },
    { name: "AWAY WIN", probability: result.awayWinProb },

    { name: "DOUBLE CHANCE 1X", probability: result.doubleChance1X },
    { name: "DOUBLE CHANCE X2", probability: result.doubleChanceX2 },

    { name: "OVER 2.5", probability: ou25.over },
    { name: "UNDER 2.5", probability: ou25.under },

    { name: "BTTS YES", probability: btts.yes },
    { name: "BTTS NO", probability: btts.no }
  ];

  for (const market of marketsToEvaluate) {
    const odd = odds[market.name];
    if (!odd || odd <= 1) continue;

    const impliedProb = 1 / odd;

    const adjustedProbability =
      market.probability * MODEL_CONFIDENCE +
      impliedProb * (1 - MODEL_CONFIDENCE);

    const decision = decisionEngine({
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

  // Antes estava filtrando apenas BTTS.
  // Agora deixa o sistema escolher entre todos os mercados avaliados.
  const allowedMarkets = evaluatedMarkets.filter(
    m => m.isAllowedByRisk && m.decision !== "NO BET"
  );

  const bestMarket = selectBestMarket(allowedMarkets);

  return {
    markets: evaluatedMarkets,
    bestMarket
  };
}