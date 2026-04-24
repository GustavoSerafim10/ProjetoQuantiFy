import { goalsModel } from "../../domain/marketModels/goalsModel";
import { bttsModel } from "../../domain/marketModels/bttsModel";
import { contextEngine } from "../../domain/context/contextEngine";
import { handicapModel } from "../../domain/marketModels/handicapModel";
import { cornersModel } from "../../domain/marketModels/cornersModel";
import { calculateGlobalConfidence } from "../../domain/confidence/confidenceEngine";
import { skellamModel } from "../../domain/marketModels/skellamModel";
import { leagueConfig } from "../../domain/config/leagueConfig";
import { calculateLambda } from "../../domain/adapters/lambdaAdapter";

import { cardsEngine } from "../engines/cardsEngine";
import { cardsModel } from "../../domain/marketModels/cardsModel";

import { shotsEngine } from "../engines/shotsEngine";
import { shotsModel } from "../../domain/marketModels/shotsModel";

import { cornerEngine } from "../engines/cornerEngine";
import { gameSelector } from "../engines/gameSelector";

/* ===========================
   HELPERS
=========================== */

function safe(n: any, fallback = 0) {
  const num = Number(n);
  return isNaN(num) ? fallback : num;
}

function normalizePercent(n: any, fallback = 0.5) {
  if (n === undefined || n === null || n === "") return fallback;

  if (typeof n === "string" && n.includes("%")) {
    const val = parseFloat(n);
    return isNaN(val) ? fallback : val / 100;
  }

  const num = Number(n);
  if (isNaN(num)) return fallback;

  return num > 1 ? num / 100 : num;
}

function sanitizeStats(stats: any) {
  return {
    goalsFor: safe(stats.goalsFor),
    goalsAgainst: safe(stats.goalsAgainst),

    shots: safe(stats.shots, 8),
    shotsOnTarget: safe(stats.shotsOnTarget, 3),

    cornersAvg: safe(stats.cornersAvg, 4),
    bigChances: safe(stats.bigChances, 1),

    fouls: safe(stats.fouls, 12),
    yellowCards: safe(stats.yellowCards, 2),

    over05: normalizePercent(stats.over05),
    over15: normalizePercent(stats.over15),
    over25: normalizePercent(stats.over25),
    over35: normalizePercent(stats.over35),
    btts: normalizePercent(stats.btts),

    last5GoalsFor: safe(stats.last5GoalsFor),
    last5GoalsAgainst: safe(stats.last5GoalsAgainst)
  };
}

/* ===========================
   LIMITES
=========================== */

function clampLambda(n: number) {
  if (isNaN(n)) return 1.2;
  return Math.max(0.2, Math.min(n, 2.5));
}

/* ===========================
   NORMALIZAÇÃO GLOBAL
=========================== */

function normalizeLambdas(home: number, away: number) {
  const total = home + away;

  const MAX_TOTAL = 3.5;

  if (total <= MAX_TOTAL) {
    return { home, away };
  }

  const scale = MAX_TOTAL / total;

  return {
    home: home * scale,
    away: away * scale
  };
}

/* ===========================
   AJUSTE DEFENSIVO
=========================== */

function applyDefensiveAdjustment(lambda: number, opponentStats: any) {
  const conceded = opponentStats.goalsAgainst;

  if (conceded <= 0.8) return lambda * 0.85;
  if (conceded <= 1.0) return lambda * 0.92;

  return lambda;
}

/* ===========================
   BALANCEAMENTO
=========================== */

function balanceLambdas(home: number, away: number) {
  const diff = Math.abs(home - away);

  if (diff < 0.3) {
    return {
      home: home * 0.98,
      away: away * 0.98
    };
  }

  return { home, away };
}

/* ===========================
   🔥 SCORE DE GOLS (NOVO)
=========================== */

function calculateGoalExpectationScore(lambdaHome: number, lambdaAway: number) {

  const total = lambdaHome + lambdaAway;
  const balance = 1 - Math.abs(lambdaHome - lambdaAway);

  const totalNorm = Math.min(total / 3.2, 1);
  const balanceNorm = Math.max(0, Math.min(balance, 1));

  const score =
    (totalNorm * 0.7) +
    (balanceNorm * 0.3);

  return Number(score.toFixed(4));
}

/* ===========================
   PIPELINE
=========================== */

export function modelPipeline(context: any) {

  if (!context?.homeStats || !context?.awayStats) {
    console.warn("⚠️ Dados insuficientes");
    return emptyResponse();
  }

  const { homeStats, awayStats, league } = context;

  const leagueData = leagueConfig[league] || leagueConfig.default;

  const home = sanitizeStats(homeStats);
  const away = sanitizeStats(awayStats);

  console.log("🏠 HOME:", home);
  console.log("🚀 AWAY:", away);

  /* ===========================
     GAME SELECTOR
  ============================ */

  const gameCheck = gameSelector({ homeStats: home, awayStats: away });

  if (!gameCheck.allowed) {
    return {
      ...context,
      blocked: true,
      blockReason: gameCheck.reason,
      ...emptyResponse()
    };
  }

  /* ===========================
     LAMBDA BASE
  ============================ */

  let lambdaHomeBase = calculateLambda(home, away, leagueData);
  let lambdaAwayBase = calculateLambda(away, home, leagueData);

  if (!lambdaHomeBase || isNaN(lambdaHomeBase)) {
    lambdaHomeBase = (home.goalsFor + away.goalsAgainst) / 2 || 1.2;
  }

  if (!lambdaAwayBase || isNaN(lambdaAwayBase)) {
    lambdaAwayBase = (away.goalsFor + home.goalsAgainst) / 2 || 1.0;
  }

  let lambdaHomeSafe = clampLambda(lambdaHomeBase);
  let lambdaAwaySafe = clampLambda(lambdaAwayBase);

  /* ===========================
     CONTEXTO
  ============================ */

  const contextAdjusted = contextEngine({
    homeStats: home,
    awayStats: away,
    baseLambdaHome: lambdaHomeSafe,
    baseLambdaAway: lambdaAwaySafe,
    leagueData
  });

  let lambdaHome = clampLambda(
    safe(contextAdjusted.lambdaHome, lambdaHomeSafe)
  );

  let lambdaAway = clampLambda(
    safe(contextAdjusted.lambdaAway, lambdaAwaySafe)
  );

  /* ===========================
     AJUSTES PROFISSIONAIS
  ============================ */

  lambdaHome = applyDefensiveAdjustment(lambdaHome, away);
  lambdaAway = applyDefensiveAdjustment(lambdaAway, home);

  const balanced = balanceLambdas(lambdaHome, lambdaAway);
  lambdaHome = balanced.home;
  lambdaAway = balanced.away;

  const normalized = normalizeLambdas(lambdaHome, lambdaAway);
  lambdaHome = normalized.home;
  lambdaAway = normalized.away;

  /* ===========================
     🔥 SCORE FINAL DE GOLS
  ============================ */

  const goalExpectationScore =
    calculateGoalExpectationScore(lambdaHome, lambdaAway);

    const totalLambda = lambdaHome + lambdaAway;

const isLowGoalGame =
  totalLambda < 2.0 || // jogo travado
  (lambdaHome < 1.0 && lambdaAway < 1.0); // ataques fracos

  console.log("🔥 LAMBDAS:", lambdaHome, lambdaAway);
  console.log("🔥 GOAL SCORE:", goalExpectationScore);

  /* ===========================
     GOALS CORE
  ============================ */

  const goals = goalsModel(lambdaHome, lambdaAway, home, away);
  const btts = bttsModel(goals.matrix);
  const result = skellamModel(lambdaHome, lambdaAway);
  const handicap = handicapModel(goals.matrix);

  /* ===========================
     SHOTS
  ============================ */

  const shotsData = shotsEngine({ homeStats: home, awayStats: away });
  const shots = shotsModel(shotsData.expectedShots || 10);

  /* ===========================
     CORNERS
  ============================ */

  const cornerData = cornerEngine({
    homeStats: home,
    awayStats: away,
    lambdaHome,
    lambdaAway
  });

  const corners = cornersModel(cornerData.lambdaCorners || 8);

  /* ===========================
     CARDS
  ============================ */

  const cardsData = cardsEngine({ homeStats: home, awayStats: away });
  const cards = cardsModel(cardsData.lambdaCards || 3);

  /* ===========================
     CONFIDENCE
  ============================ */

  const confidence = safe(calculateGlobalConfidence({
    goals,
    btts,
    result,
    lambdaHome,
    lambdaAway
  }), 0.5);

  return {
    ...context,
    blocked: false,
    goalExpectationScore, // 🔥 NOVO
    isLowGoalGame, // 🔥 ADICIONA AQUI
    lambdaHome,
    lambdaAway,
    goals,
    btts,
    result,
    handicap,
    corners,
    cards,
    shots,
    engines: {
      shotsData,
      cornerData,
      cardsData
    },
    tempoFactor: contextAdjusted?.tempoFactor ?? 1,
    pressureFactor: contextAdjusted?.pressureFactor ?? 1,
    confidence
  };
}

/* ===========================
   FALLBACK
=========================== */

function emptyResponse() {
  return {
    lambdaHome: 1.2,
    lambdaAway: 1.0,
    goals: {},
    btts: {},
    result: {},
    handicap: {},
    corners: {},
    cards: {},
    shots: {},
    confidence: 0.5
  };
}