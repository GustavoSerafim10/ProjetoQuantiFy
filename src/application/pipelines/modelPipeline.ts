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

  // limite individual saudável
  return Math.max(0.35, Math.min(n, 2.45));
}


/* ===========================
   NORMALIZAÇÃO GLOBAL
=========================== */

function normalizeLambdas(home: number, away: number) {
  const total = home + away;

  const MIN_TOTAL = 1.4;
  const MAX_TOTAL = 3.35;

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
   AJUSTE DEFENSIVO
=========================== */

function applyDefensiveAdjustment(lambda: number, opponentStats: any) {
  const conceded = safe(opponentStats?.goalsAgainst, 1.3);
  const recentConceded = safe(
    opponentStats?.last5GoalsAgainst,
    conceded
  );

  const defensiveResistance =
    (conceded * 0.60) +
    (recentConceded * 0.40);

  if (defensiveResistance <= 0.75) return lambda * 0.90;
  if (defensiveResistance <= 0.95) return lambda * 0.95;

  return lambda;
}

/* ===========================
   BALANCEAMENTO
=========================== */

function balanceLambdas(home: number, away: number) {
  const diff = Math.abs(home - away);

  // Micro ajuste apenas quando é quase espelhado
  if (diff < 0.10) {
    return {
      home: Number((home * 0.995).toFixed(4)),
      away: Number((away * 0.995).toFixed(4))
    };
  }

  // Não achatar favoritismo real
  if (diff > 0.85) {
    const adjustment = Math.min(diff * 0.025, 0.045);

    if (home > away) {
      return {
        home: Number((home - adjustment).toFixed(4)),
        away: Number((away + adjustment * 0.20).toFixed(4))
      };
    }

    return {
      home: Number((home + adjustment * 0.20).toFixed(4)),
      away: Number((away - adjustment).toFixed(4))
    };
  }

  return {
    home: Number(home.toFixed(4)),
    away: Number(away.toFixed(4))
  };
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
=========================== */

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

/*
  Proteção contra distorção do contexto:
  o contexto pode ajustar, mas não pode inflar/achatar demais.
*/
lambdaHome = Math.max(
  lambdaHomeSafe * 0.88,
  Math.min(lambdaHomeSafe * 1.16, lambdaHome)
);

lambdaAway = Math.max(
  lambdaAwaySafe * 0.88,
  Math.min(lambdaAwaySafe * 1.16, lambdaAway)
);

lambdaHome = clampLambda(lambdaHome);
lambdaAway = clampLambda(lambdaAway);

/* ===========================
   NORMALIZAÇÃO INICIAL
=========================== */

let normalized = normalizeLambdas(lambdaHome, lambdaAway);

lambdaHome = clampLambda(normalized.home);
lambdaAway = clampLambda(normalized.away);

/* ===========================
   AJUSTES PROFISSIONAIS
=========================== */

lambdaHome = applyDefensiveAdjustment(lambdaHome, away);
lambdaAway = applyDefensiveAdjustment(lambdaAway, home);

const balanced = balanceLambdas(lambdaHome, lambdaAway);

lambdaHome = balanced.home;
lambdaAway = balanced.away;

/* ===========================
   NORMALIZAÇÃO FINAL
=========================== */

normalized = normalizeLambdas(lambdaHome, lambdaAway);

lambdaHome = normalized.home;
lambdaAway = normalized.away;

/* ===========================
   🔥 SCORE FINAL DE GOLS
=========================== */

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