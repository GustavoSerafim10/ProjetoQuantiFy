import {
  goalsModel
} from "../../../domain/marketModels/goalsModel";

import {
  contextEngine
} from "../../../domain/context/contextEngine";

import {
  calculateGlobalConfidence
} from "../../../domain/confidence/globalConfidenceEngine";

import {
  buildLambda
} from "../../../domain/model/lambdaBuilder";

import {
  gameSelector
} from "../../engines/gameSelector";

import {
  type RawTeamStats,
  type SanitizedStats
} from "./types";

import {
  clamp,
  safeNumber
} from "./numericHelpers";

import {
  sanitizeStats
} from "./sanitize";

import {
  applyBoundedContextAdjustment
} from "./contextAdjustment";

import {
  extractMatrixMarkets
} from "./matrixExtraction";

import {
  calculateGoalExpectationScore,
  classifyGoalProfile
} from "./goalProfile";

import {
  getObjectValue
} from "./objectHelpers";

/* ==========================================
   LAMBDA A PARTIR DE ESTATÍSTICAS — EXTRAÍDO
========================================== */

/*
 * Extraído de modelPipeline/index.ts em 2026-09-09 para ser
 * reaproveitado por fusedModelPipeline.ts (fusão stats+odds) sem
 * duplicar a cadeia sanitize → gameSelector → buildLambda →
 * contextEngine → goalsModel. modelPipeline continua produzindo
 * exatamente a mesma saída de antes, só que chamando esta função.
 */

export interface StatsLambdaResult {
  home: SanitizedStats;
  away: SanitizedStats;

  league: string;

  gameCheck: ReturnType<typeof gameSelector>;
  gameBlocked: boolean;

  lambdaBuild: ReturnType<typeof buildLambda>;

  baseLambdaHome: number;
  baseLambdaAway: number;

  contextAdjusted: unknown;

  lambdaHome: number;
  lambdaAway: number;
  totalLambda: number;

  minContextFactor: number;
  maxContextFactor: number;

  tempoFactor: number;
  pressureFactor: number;

  goals: ReturnType<typeof goalsModel>;
  markets: ReturnType<typeof extractMatrixMarkets>;

  result: { home: number; draw: number; away: number };
  btts: { yes: number; no: number };
  doubleChance: { oneX: number; xTwo: number };
  goalMarkets: { over15: number; over25: number };

  goalExpectationScore: number;
  goalProfile: ReturnType<typeof classifyGoalProfile>;
  isLowGoalGame: boolean;

  missingDataCount: number;
  missingDataPenalty: number;

  baseConfidence: number;
  confidence: number;
}

export function computeStatsLambda(
  rawHomeStats: RawTeamStats,
  rawAwayStats: RawTeamStats,
  league: string
): StatsLambdaResult {
  const home = sanitizeStats(rawHomeStats, "HOME");
  const away = sanitizeStats(rawAwayStats, "AWAY");

  const gameCheck = gameSelector({
    homeStats: home,
    awayStats: away
  });

  const gameBlocked = !gameCheck.allowed;

  const lambdaBuild = buildLambda(
    home as never,
    away as never,
    league
  );

  const baseLambdaHome = safeNumber(lambdaBuild.lambdaHome, 1.32);
  const baseLambdaAway = safeNumber(lambdaBuild.lambdaAway, 1.23);

  const contextAdjusted = contextEngine({
    homeStats: home,
    awayStats: away,

    baseLambdaHome,
    baseLambdaAway,

    leagueData: {
      leagueKey: league
    }
  });

  const contextualLambdas = applyBoundedContextAdjustment(
    baseLambdaHome,
    baseLambdaAway,
    contextAdjusted
  );

  const lambdaHome = contextualLambdas.lambdaHome;
  const lambdaAway = contextualLambdas.lambdaAway;
  const totalLambda = lambdaHome + lambdaAway;

  const goals = goalsModel(lambdaHome, lambdaAway, home, away);
  const markets = extractMatrixMarkets(goals.matrix);

  const result = {
    home: markets.home,
    draw: markets.draw,
    away: markets.away
  };

  const btts = {
    yes: markets.bttsYes,
    no: markets.bttsNo
  };

  const doubleChance = {
    oneX: markets.doubleChance1X,
    xTwo: markets.doubleChanceX2
  };

  const goalMarkets = {
    over15: markets.over15,
    over25: markets.over25
  };

  const goalExpectationScore = calculateGoalExpectationScore(
    lambdaHome,
    lambdaAway
  );

  const goalProfile = classifyGoalProfile(lambdaHome, lambdaAway);
  const isLowGoalGame = goalProfile === "LOW_GOAL";

  const missingDataCount =
    home.missingFields.length + away.missingFields.length;

  const baseConfidence = safeNumber(
    calculateGlobalConfidence({
      goals,
      btts,
      result,
      lambdaHome,
      lambdaAway
    }),
    0.5
  );

  const missingDataPenalty = Math.min(missingDataCount * 0.025, 0.2);

  const confidence = clamp(baseConfidence - missingDataPenalty, 0, 1);

  return {
    home,
    away,

    league,

    gameCheck,
    gameBlocked,

    lambdaBuild,

    baseLambdaHome,
    baseLambdaAway,

    contextAdjusted,

    lambdaHome,
    lambdaAway,
    totalLambda,

    minContextFactor: contextualLambdas.minContextFactor,
    maxContextFactor: contextualLambdas.maxContextFactor,

    tempoFactor: safeNumber(
      getObjectValue(contextAdjusted, "tempoFactor"),
      1
    ),

    pressureFactor: safeNumber(
      getObjectValue(contextAdjusted, "pressureFactor"),
      1
    ),

    goals,
    markets,

    result,
    btts,
    doubleChance,
    goalMarkets,

    goalExpectationScore,
    goalProfile,
    isLowGoalGame,

    missingDataCount,
    missingDataPenalty,

    baseConfidence,
    confidence
  };
}
