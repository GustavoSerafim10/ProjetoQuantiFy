import { goalsModel } from "../../domain/marketModels/goalsModel";
import { contextEngine } from "../../domain/context/contextEngine";
import { handicapModel } from "../../domain/marketModels/handicapModel";
import { cornersModel } from "../../domain/marketModels/cornersModel";
import { calculateGlobalConfidence } from "../../domain/confidence/confidenceEngine";
import { skellamModel } from "../../domain/marketModels/skellamModel";
import { dixonColesModel } from "../../domain/marketModels/dixonColesModel";
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
  return Number.isFinite(num) ? num : fallback;
}

function normalizePercent(n: any, fallback = 0.5) {
  if (n === undefined || n === null || n === "") return fallback;

  if (typeof n === "string" && n.includes("%")) {
    const val = parseFloat(n);
    return Number.isFinite(val) ? val / 100 : fallback;
  }

  const num = Number(n);
  if (!Number.isFinite(num)) return fallback;

  return num > 1 ? num / 100 : num;
}

function sanitizeStats(stats: any = {}) {
  return {
    goalsFor: safe(stats.goalsFor, 1.2),
    goalsAgainst: safe(stats.goalsAgainst, 1.2),

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

    last5GoalsFor: safe(stats.last5GoalsFor, safe(stats.goalsFor, 1.2)),
    last5GoalsAgainst: safe(stats.last5GoalsAgainst, safe(stats.goalsAgainst, 1.2))
  };
}

/* ===========================
   LAMBDA CONTROL
=========================== */

function clampLambda(n: number) {
  if (!Number.isFinite(n)) return 1.2;
  return Math.max(0.35, Math.min(n, 2.25));
}

function normalizeLambdas(home: number, away: number) {
  const total = home + away;

  const MIN_TOTAL = 1.35;
  const MAX_TOTAL = 3.20;

  if (total <= 0) {
    return { home: 1.2, away: 1.0 };
  }

  if (total >= MIN_TOTAL && total <= MAX_TOTAL) {
    return {
      home: Number(home.toFixed(4)),
      away: Number(away.toFixed(4))
    };
  }

  const targetTotal = Math.max(MIN_TOTAL, Math.min(MAX_TOTAL, total));
  const scale = targetTotal / total;

  return {
    home: Number((home * scale).toFixed(4)),
    away: Number((away * scale).toFixed(4))
  };
}

/* ===========================
   AJUSTES
=========================== */

function applyDefensiveAdjustment(lambda: number, opponentStats: any) {
  const conceded = safe(opponentStats?.goalsAgainst, 1.3);
  const recentConceded = safe(opponentStats?.last5GoalsAgainst, conceded);

  const defensiveResistance = conceded * 0.6 + recentConceded * 0.4;

  if (defensiveResistance <= 0.70) return lambda * 0.88;
  if (defensiveResistance <= 0.90) return lambda * 0.94;

  return lambda;
}

function balanceLambdas(home: number, away: number) {
  const diff = Math.abs(home - away);

  if (diff < 0.08) {
    return {
      home: Number(home.toFixed(4)),
      away: Number(away.toFixed(4))
    };
  }

  if (diff > 0.95) {
    const adjustment = Math.min(diff * 0.02, 0.04);

    if (home > away) {
      return {
        home: Number((home - adjustment).toFixed(4)),
        away: Number((away + adjustment * 0.15).toFixed(4))
      };
    }

    return {
      home: Number((home + adjustment * 0.15).toFixed(4)),
      away: Number((away - adjustment).toFixed(4))
    };
  }

  return {
    home: Number(home.toFixed(4)),
    away: Number(away.toFixed(4))
  };
}

function calculateGoalExpectationScore(lambdaHome: number, lambdaAway: number) {
  const total = lambdaHome + lambdaAway;
  const diff = Math.abs(lambdaHome - lambdaAway);

  const totalNorm = Math.min(total / 3.1, 1);
  const balanceNorm = Math.max(0, 1 - diff / 1.6);

  const score = totalNorm * 0.72 + balanceNorm * 0.28;

  return Number(score.toFixed(4));
}

function classifyGoalProfile(lambdaHome: number, lambdaAway: number) {
  const total = lambdaHome + lambdaAway;

  if (total < 1.85 || (lambdaHome < 0.85 && lambdaAway < 0.85)) {
    return "LOW_GOAL";
  }

  if (total >= 2.75 && lambdaHome >= 0.95 && lambdaAway >= 0.95) {
    return "OPEN_GOALS";
  }

  if (Math.abs(lambdaHome - lambdaAway) >= 0.75) {
    return "FAVORITE_EDGE";
  }

  return "BALANCED";
}

/* ===========================
   PIPELINE
=========================== */

export function modelPipeline(context: any) {
  if (!context?.homeStats || !context?.awayStats) {
    console.warn("⚠️ Dados insuficientes no modelPipeline");
    return emptyResponse();
  }

  const { homeStats, awayStats, league } = context;

  const leagueData = leagueConfig[league] || leagueConfig.default;

  const home = sanitizeStats(homeStats);
  const away = sanitizeStats(awayStats);

  const gameCheck = gameSelector({ homeStats: home, awayStats: away });

  /*
    Importante:
    Não vamos matar o sistema aqui de forma agressiva.
    O modelPipeline apenas informa se o jogo é ruim.
    A decisão final deve acontecer depois, no decisionPipeline.
  */
  const gameBlocked = !gameCheck.allowed;

  let lambdaHomeBase = calculateLambda(home, away, leagueData);
  let lambdaAwayBase = calculateLambda(away, home, leagueData);

  if (!Number.isFinite(lambdaHomeBase)) {
    lambdaHomeBase = (home.goalsFor + away.goalsAgainst) / 2 || 1.2;
  }

  if (!Number.isFinite(lambdaAwayBase)) {
    lambdaAwayBase = (away.goalsFor + home.goalsAgainst) / 2 || 1.0;
  }

  const lambdaHomeSafe = clampLambda(lambdaHomeBase);
  const lambdaAwaySafe = clampLambda(lambdaAwayBase);

  const contextAdjusted = contextEngine({
    homeStats: home,
    awayStats: away,
    baseLambdaHome: lambdaHomeSafe,
    baseLambdaAway: lambdaAwaySafe,
    leagueData
  });

  let lambdaHome = clampLambda(
    safe(contextAdjusted?.lambdaHome, lambdaHomeSafe)
  );

  let lambdaAway = clampLambda(
    safe(contextAdjusted?.lambdaAway, lambdaAwaySafe)
  );

  lambdaHome = Math.max(
    lambdaHomeSafe * 0.88,
    Math.min(lambdaHomeSafe * 1.16, lambdaHome)
  );

  lambdaAway = Math.max(
    lambdaAwaySafe * 0.88,
    Math.min(lambdaAwaySafe * 1.16, lambdaAway)
  );

  let normalized = normalizeLambdas(lambdaHome, lambdaAway);

  lambdaHome = clampLambda(normalized.home);
  lambdaAway = clampLambda(normalized.away);

  lambdaHome = applyDefensiveAdjustment(lambdaHome, away);
  lambdaAway = applyDefensiveAdjustment(lambdaAway, home);

  const balanced = balanceLambdas(lambdaHome, lambdaAway);

  lambdaHome = balanced.home;
  lambdaAway = balanced.away;

  normalized = normalizeLambdas(lambdaHome, lambdaAway);

  lambdaHome = normalized.home;
  lambdaAway = normalized.away;

  const totalLambda = Number((lambdaHome + lambdaAway).toFixed(4));

  const goalExpectationScore =
    calculateGoalExpectationScore(lambdaHome, lambdaAway);

  const goalProfile = classifyGoalProfile(lambdaHome, lambdaAway);

  const isLowGoalGame = goalProfile === "LOW_GOAL";

  const goals = goalsModel(lambdaHome, lambdaAway, home, away);

  const dixonColes = dixonColesModel(lambdaHome, lambdaAway);

  const btts = {
    yes: dixonColes.bttsYesProb,
    no: dixonColes.bttsNoProb
  };

  const result = skellamModel(lambdaHome, lambdaAway);

  const handicap = handicapModel(goals.matrix);

  const shotsData = shotsEngine({ homeStats: home, awayStats: away });
  const shots = shotsModel(shotsData.expectedShots || 10);

  const cornerData = cornerEngine({
    homeStats: home,
    awayStats: away,
    lambdaHome,
    lambdaAway
  });

  const corners = cornersModel(cornerData.lambdaCorners || 8);

  const cardsData = cardsEngine({ homeStats: home, awayStats: away });
  const cards = cardsModel(cardsData.lambdaCards || 3);

  const confidence = safe(
    calculateGlobalConfidence({
      goals,
      btts,
      result,
      lambdaHome,
      lambdaAway
    }),
    0.5
  );

  return {
    ...context,

    blocked: gameBlocked,
    blockReason: gameBlocked ? gameCheck.reason : null,

    lambdaHome,
    lambdaAway,
    totalLambda,

    goalExpectationScore,
    goalProfile,
    isLowGoalGame,

    goals,
    dixonColes,
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

    confidence,

    debug: {
      ...(context.debug || {}),
      modelPipeline: {
        league,
        leagueData,

        homeSanitized: home,
        awaySanitized: away,

        gameSelector: gameCheck,
        gameBlocked,

        lambda: {
          base: {
            home: Number(lambdaHomeBase.toFixed(4)),
            away: Number(lambdaAwayBase.toFixed(4))
          },
          safe: {
            home: lambdaHomeSafe,
            away: lambdaAwaySafe
          },
          final: {
            home: lambdaHome,
            away: lambdaAway,
            total: totalLambda,
            diff: Number(Math.abs(lambdaHome - lambdaAway).toFixed(4))
          }
        },

        goalExpectationScore,
        goalProfile,
        isLowGoalGame,
        confidence
      }
    }
  };
}

/* ===========================
   FALLBACK
=========================== */

function emptyResponse() {
  return {
    blocked: true,
    blockReason: "INSUFFICIENT_DATA",

    lambdaHome: 1.2,
    lambdaAway: 1.0,
    totalLambda: 2.2,

    goalExpectationScore: 0.5,
    goalProfile: "UNKNOWN",
    isLowGoalGame: false,

    goals: {},
    dixonColes: {},
    btts: {},
    result: {},
    handicap: {},
    corners: {},
    cards: {},
    shots: {},
    engines: {},

    tempoFactor: 1,
    pressureFactor: 1,
    confidence: 0.5,

    debug: {
      modelPipeline: {
        error: "INSUFFICIENT_DATA"
      }
    }
  };
}