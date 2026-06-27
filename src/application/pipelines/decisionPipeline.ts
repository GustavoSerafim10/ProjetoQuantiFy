import {
  calculateEdge,
  calculateKelly
} from "../engines/elite/edgeEngine";

import { calculateConfidence } from "../../domain/analysis/confidenceEngine";
import { buildCombo } from "../../domain/analysis/multiBetBuilder";
import { validateStructure } from "../../domain/analysis/structureEngine";
import { calculateRiskScore } from "../../domain/risk/riskScore";

import { registerBet } from "../../domain/tracking/trackingEngine";

import { adjustProbability } from "../../domain/tracking/calibrationAdjuster";
import { generatePerformanceReport } from "../../domain/tracking/performanceReport";

import { analyzeMarketContext } from "../engines/marketIntelligence";
import { detectTrap } from "../engines/trapDetector";
import { autoLearningEngine } from "../../domain/learning/autoLearningEngine";

/* ===============================
   🔥 SNIPER FILTER (PRO V2)
=============================== */
function sniperFilter(m: any, data: any) {
  const market = String(m.market ?? "").toUpperCase();

  const probability = Number(m.probability ?? 0);
  const ev = Number(m.ev ?? 0);
  const risk = Number(m.risk ?? 1);
  const confidence = Number(m.confidence ?? 0.5);
  const trapScore = Number(m.trapScore ?? 0);
  const structureValid = m.structureValid !== false;

  const odd = Number(
    m.odd ??
    m.odds ??
    getOddFromInput(market, data.odds) ??
    data.odds?.[market] ??
    data.marketOdds?.[market] ??
    0
  );

  const warnings: string[] = [...(m.warnings ?? [])];

  if (odd <= 1.01) warnings.push("INVALID_ODD");
  if (ev <= 0) warnings.push("NEGATIVE_EV");
  if (probability < 0.52) warnings.push("LOW_PROBABILITY");
  if (risk > 0.72) warnings.push("HIGH_RISK");
  if (confidence < 0.50) warnings.push("LOW_CONFIDENCE");
  if (trapScore > 0.60) warnings.push("TRAP_RISK");
  if (!structureValid) warnings.push("WEAK_STRUCTURE");

  m.warnings = warnings;

  /*
    Sniper não mata mais mercado bom cedo demais.
    Só remove lixo evidente.
  */
  if (odd <= 1.01) return false;
  if (ev <= 0) return false;
  if (probability < 0.50) return false;
  if (risk > 0.78) return false;
  if (trapScore > 0.75) return false;

  return true;
}
/* ===============================
   💰 STAKE PRO
=============================== */
function calculateStakePro(m: any) {
  const baseKelly = Math.max(m.kelly, 0) * 0.33;

  let evFactor = 1;
  if (m.ev > 0.15) evFactor = 1.20;
  else if (m.ev > 0.10) evFactor = 1.10;
  else if (m.ev > 0.07) evFactor = 1.05;
  else evFactor = 0.90;

  let probFactor = 1;
  if (m.probability > 0.75) probFactor = 1.15;
  else if (m.probability > 0.68) probFactor = 1.05;
  else probFactor = 0.95;

  let riskFactor = 1;
  if (m.risk > 0.70) riskFactor = 0.60;
  else if (m.risk > 0.50) riskFactor = 0.75;
  else if (m.risk > 0.40) riskFactor = 0.90;

  let confidenceFactor = 1;
  if (m.confidence > 0.75) confidenceFactor = 1.10;
  else if (m.confidence < 0.55) confidenceFactor = 0.85;

  let stake =
    baseKelly *
    evFactor *
    probFactor *
    confidenceFactor *
    riskFactor;

  if (stake < 0.005) return 0;

  stake = Math.min(0.05, stake);

  return Number(stake.toFixed(4));
}

/* ===============================
   🧠 MARKET TYPE
=============================== */
function getMarketType(market: string) {
  if (!market) return "OTHER";

  const m = market.toLowerCase().trim();

  /* ===========================
     OVER / GOALS
  ============================ */
  if (m.includes("over")) {
    return "OVER";
  }

  /* ===========================
     BTTS
  ============================ */
  if (m.includes("btts")) {
    return "BTTS";
  }

  /* ===========================
     DOUBLE CHANCE
  ============================ */
  if (
    m.includes("1x") ||
    m.includes("x2") ||
    m.includes("double_chance") ||
    m.includes("double chance")
  ) {
    return "DOUBLE";
  }

  /* ===========================
     RESULT
  ============================ */
  if (
    m.includes("home") ||
    m.includes("away") ||
    m === "draw"
  ) {
    return "RESULT";
  }

  return "OTHER";
}

/* ===============================
   PENALIDADE / BOOST
=============================== */
function getMarketPenalty(type: string) {
  if (type === "OVER") return 0.97;
  if (type === "BTTS") return 0.98;

  return 1;
}

function getMarketBoost(type: string) {
  if (type === "RESULT") return 1.02;
  if (type === "DOUBLE") return 1.01;

  return 1;
}

/* ===============================
   ODDS MAPPER
=============================== */
function getOddFromInput(market: string, odds: any) {
  if (!odds || !market) return null;

  const m = market.toLowerCase().trim();

  if (m.includes("over_1_5") || m.includes("over 1.5")) {
    return odds.over15;
  }

  if (m.includes("over_2_5") || m.includes("over 2.5")) {
    return odds.over25;
  }

  if (
    (m.includes("btts_yes")) ||
    (m.includes("btts") && m.includes("yes"))
  ) {
    return odds.bttsYes;
  }

  if (
    (m.includes("btts_no")) ||
    (m.includes("btts") && m.includes("no"))
  ) {
    return odds.bttsNo;
  }

  if (
    m === "home" ||
    m === "home_win" ||
    m.includes("home win")
  ) {
    return odds.home;
  }

  if (m === "draw") {
    return odds.draw;
  }

  if (
    m === "away" ||
    m === "away_win" ||
    m.includes("away win")
  ) {
    return odds.away;
  }

  if (
    m.includes("1x") ||
    m.includes("double_chance_1x")
  ) {
    return odds.homeOrDraw;
  }

  if (
    m.includes("x2") ||
    m.includes("double_chance_x2")
  ) {
    return odds.awayOrDraw;
  }

  return null;
}

/* ===============================
   WEIGHTS
=============================== */
function autoTuneWeights() {
  return {
    probWeight: 0.30,
    confidenceWeight: 0.22,
    riskWeight: 0.33
  };
}

/* ===============================
   SIGNAL SCORE
=============================== */
function calculateSignalScore(
  m: any,
  weights: any,
  marketBoost = 1
) {
  const structureWeight = 0.15;

  const score =
    (
      (m.probability * weights.probWeight) +
      (m.confidence * weights.confidenceWeight) +
      ((1 - m.risk) * weights.riskWeight) +
      ((m.structureScore ?? 0.5) * structureWeight)
    ) * marketBoost;

  return Number(score.toFixed(4));
}
// 🔥 CLASSIFICAÇÃO PROFISSIONAL — VERSÃO FINAL (FASE 1 COMPLETA)
function classifyDecision(
  market: any
): "SCALPER" | "ELITE" | "BET" | "WATCHLIST" | "NO BET" {
  
  const probability = Number(market.probability ?? 0);
  const ev = Number(market.ev ?? 0);
  const risk = Number(market.risk ?? 1);
  const odd = Number(market.odd ?? 0);

  if (odd <= 1.01) return "NO BET";
  if (ev <= 0) return "NO BET";
  if (probability < 0.50) return "NO BET";
  if (risk > 0.78) return "NO BET";

  /*
    WATCHLIST:
    Mercado tem valor potencial, mas ainda não é entrada forte.
  */
  if (
    ev >= 0.035 &&
    probability >= 0.54 &&
    risk <= 0.70 &&
    odd >= 1.30
  ) {
    /*
      SCALPER:
      Probabilidade alta, risco baixo e EV aceitável.
    */
    if (
      probability >= 0.74 &&
      ev >= 0.07 &&
      risk <= 0.52 &&
      odd >= 1.38
    ) {
      return "SCALPER";
    }

    /*
      ELITE:
      Valor forte e estrutura limpa.
    */
    if (
      ev >= 0.12 &&
      probability >= 0.62 &&
      risk <= 0.58 &&
      odd >= 1.38
    ) {
      return "ELITE";
    }

    /*
      BET:
      Entrada operacional boa.
    */
    if (
      ev >= 0.07 &&
      probability >= 0.58 &&
      risk <= 0.64 &&
      odd >= 1.35
    ) {
      return "BET";
    }

    return "WATCHLIST";
  }

  return "NO BET";
}
/* ===============================
   🧠 SELECT BEST MARKET BY CONTEXT (ELITE V2)
=============================== */

function selectBestMarketByContext(markets: any[], data: any) {
  if (!markets || markets.length === 0) return markets;

  const goalScore = data.goalExpectationScore ?? 0.5;
  const totalLambda = (data.lambdaHome || 1) + (data.lambdaAway || 1);
  const diff = Math.abs((data.lambdaHome || 1) - (data.lambdaAway || 1));

  const context = data.marketContext || {};
  const pace = context.paceLevel || "medium";
  const gameType = context.gameType || "balanced";

  const scored = markets.map((m) => {
    let boost = 1;
    const market = m.market;

    if (market.includes("OVER")) {
      if (goalScore > 0.65) boost *= 1.10;
      else if (goalScore > 0.55) boost *= 1.05;
      else boost *= 0.90;

      if (pace === "high") boost *= 1.05;
      if (gameType === "open") boost *= 1.05;

      if (totalLambda < 2.2) boost *= 0.90;
    }

    if (market.includes("BTTS")) {
      if (goalScore > 0.55) boost *= 1.08;
      else boost *= 0.93;

      if (diff < 0.6) boost *= 1.05;
      if (pace === "low") boost *= 0.90;
    }

    if (
      market.includes("HOME") ||
      market.includes("AWAY")
    ) {
      if (diff > 1.2) boost *= 1.10;
      else boost *= 0.95;

      if (gameType === "dominant") boost *= 1.05;
      if (goalScore < 0.50) boost *= 1.03;
    }

    if (market.includes("1X") || market.includes("X2")) {
      if (diff > 1.0) boost *= 1.08;
      if (goalScore < 0.50) boost *= 1.03;
    }

    boost = Math.max(0.85, Math.min(boost, 1.20));

    const finalScore =
  (
    m.ev * 0.35 +
    m.probability * 0.20 +
    (1 - m.risk) * 0.20 +
    m.confidence * 0.15 +
    m.signalScore * 0.10
  ) * boost;

    return {
      ...m,
      contextScore: Number(finalScore.toFixed(4))
    };
  });

  return scored.sort((a, b) => b.contextScore - a.contextScore);
}
/* ===============================
   ID
=============================== */
function generateId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getMonteCarloProb(
  market: string,
  mc: any
) {
  const m = market
    .toUpperCase()
    .trim();

  switch (m) {
    case "OVER 1.5":
    case "OVER_1_5":
      return mc.over15Prob;

    case "OVER 2.5":
    case "OVER_2_5":
      return mc.over25Prob;

    case "BTTS YES":
    case "BTTS_YES":
      return mc.bttsProb;

    case "BTTS NO":
    case "BTTS_NO":
      return 1 - mc.bttsProb;

    case "HOME WIN":
    case "HOME_WIN":
      return mc.homeWinProb;

    case "DRAW":
      return mc.drawProb;

    case "AWAY WIN":
    case "AWAY_WIN":
      return mc.awayWinProb;

    case "1X":
    case "DOUBLE_CHANCE_1X":
      return mc.homeWinProb + mc.drawProb;

    case "X2":
    case "DOUBLE_CHANCE_X2":
      return mc.awayWinProb + mc.drawProb;

    default:
      console.warn(
        "⚠️ Mercado não reconhecido no Monte Carlo:",
        market
      );

      return 0.5;
  }
}
/* ===============================
   PIPELINE
=============================== */

export function decisionPipeline(data: any) {

  /* ===============================
     GAME WARNING
  =============================== */

  const warnings: string[] = [
    ...(data.warnings ?? [])
  ];

  if (data.blocked) {
    warnings.push(
      data.blockReason ?? "GAME_FILTER_BLOCKED"
    );
  }

  if (!data.monteCarlo) {
    return {
      elite: null,
      scalper: null,
      markets: [],
      discarded: [],
      noBet: true,
      reason: "NO_MONTE_CARLO"
    };
  }

  if (!Array.isArray(data?.markets)) {
    return {
      elite: null,
      scalper: null,
      markets: [],
      discarded: [],
      noBet: true
    };
  }

  const weights = autoTuneWeights();
  const report = generatePerformanceReport();
  const calibration = report?.calibration;

  const marketContext = analyzeMarketContext(data);
  const learning = autoLearningEngine();

  /* ===============================
     ENRICH MARKETS
  ================================ */

  const enriched = data.markets.map((m: any) => {
    let probability = getMonteCarloProb(
      m.market,
      data.monteCarlo
    );

    probability = adjustProbability(
      probability,
      calibration
    );

    if (learning.ready) {
      probability += (learning.probBias ?? 0);
    }

    probability = Math.max(
      0.01,
      Math.min(0.99, probability)
    );

    const inputOdd = getOddFromInput(
      m.market,
      data.odds
    );

    const odd =
      inputOdd && inputOdd > 1
        ? inputOdd
        : m.odd;

    const ev = calculateEdge(
      probability,
      odd
    );

    const kelly = calculateKelly(
      probability,
      odd
    );

    const risk = calculateRiskScore({
      lambdaHome: data.lambdaHome,
      lambdaAway: data.lambdaAway,
      leagueAvgGoals: data.leagueAvgGoals,
      eventProbability: probability,
      recentGoalStd: data.recentGoalStd,
      seasonGoalAvg: data.seasonGoalAvg,
      goalExpectationScore: data.goalExpectationScore,
      totalLambda:
        (data.lambdaHome ?? 0) +
        (data.lambdaAway ?? 0),
      marketType: getMarketType(m.market)
    });

    const structure = validateStructure(
      m,
      data
    );

    const structureScore =
      structure.score ?? 0.5;

    const trapScore = detectTrap(
      m,
      data
    );

    let confidence = calculateConfidence({
      probability,
      odds: odd,
      ev,
      kelly,
      lambdaHome: data.lambdaHome,
      lambdaAway: data.lambdaAway,
      market: m.market,
      goalExpectationScore:
        data.goalExpectationScore
    });

    /* ===============================
       GLOBAL CONFIDENCE ADJUSTMENT
    ================================ */

    if (data.confidence !== undefined) {
      const globalFactor =
        0.65 +
        (data.confidence * 0.35);

      confidence *= globalFactor;
    }

    if (learning.ready) {
      confidence *=
        1 + (learning.rhoShift ?? 0);
    }

    confidence *= 1 - trapScore * 0.4;

    const marketBoost =
      marketContext?.weights?.[m.market] ??
      marketContext?.weights?.[
        m.market.toLowerCase()
      ] ??
      1;

    const rawScore = calculateSignalScore(
      {
        probability,
        confidence,
        risk,
        structureScore
      },
      weights,
      marketBoost
    );

    const type = getMarketType(m.market);

    const signalScore =
      rawScore *
      (1 - trapScore) *
      getMarketPenalty(type) *
      getMarketBoost(type);

let valueScore =
  (ev * 0.45) +
  (signalScore * 0.25) +
  (probability * 0.15) +
  ((1 - risk) * 0.15);

let finalScore = valueScore;

/* ===============================
   EDGE QUALITY CONTROL
================================ */

if (ev > 0.15 && probability >= 0.62 && risk <= 0.55) {
  finalScore *= 1.08;
}

if (ev > 0.25 && probability >= 0.68 && risk <= 0.50) {
  finalScore *= 1.12;
}

/* ===============================
   PENALIDADE ODDS BAIXAS
================================ */

if (odd < 1.35) {
  finalScore *= 0.65;
} else if (odd < 1.45) {
  finalScore *= 0.78;
} else if (odd < 1.50 && probability >= 0.82) {
  finalScore *= 0.85;
}

/* ===============================
   LONGSHOT PROTECTION
================================ */

if (odd > 3.0) {
  finalScore *= 0.90;
}

if (odd > 4.5) {
  finalScore *= 0.82;
}

const classification = classifyDecision({
  market: m.market,
  probability,
  ev,
  risk,
  odd
});

return {
  ...m,
  odd,
  probability,
  ev,
  kelly,
  risk,
  confidence,
  structureValid: structure.valid,
  structureScore,
  structureReasons: structure.reasons,
  trapScore,
  signalScore,
  valueScore: finalScore, // 🔥 AQUI É O SEGREDO
  classification
};
  });

  /* =============================== 
   SNIPER FILTER
================================ */

const valid: any[] = [];
const discardedBySniper: any[] = [];

for (const m of enriched) {
  const passed = sniperFilter(
    m,
    {
      ...data,
      marketContext
    }
  );

  if (passed) {
    valid.push(m);
  } else {
    discardedBySniper.push({
      ...m,
      discardedStage: "SNIPER_FILTER",
      discardedReason:
        m.warnings?.length
          ? m.warnings.join(", ")
          : "FAILED_SNIPER_FILTER"
    });
  }
}

const sortedRaw = [...valid].sort(
  (a: any, b: any) =>
    b.valueScore - a.valueScore
);


  /* ===============================
     FORCE BEST SCALPER
  ================================ */

  const forcedPicks: any[] = [];

  const bestScalper =
    sortedRaw.find(
      (m: any) =>
        m.classification === "SCALPER"
    );

  if (bestScalper) {
    forcedPicks.push(bestScalper);
  }

  /* ===============================
     DIVERSIFICATION
  ================================ */

  const diversified: any[] = [
    ...forcedPicks
  ];

  const usedTypes = new Set(
    forcedPicks.map((m) =>
      getMarketType(m.market)
    )
  );

  for (const m of sortedRaw) {
    const type = getMarketType(
      m.market
    );

    if (!usedTypes.has(type)) {
      diversified.push(m);
      usedTypes.add(type);
    }

    if (diversified.length >= 6) {
      break;
    }
  }


function passesDecisionGuards(m: any) {
  if (!m) return false;

  const odd = Number(m.odd ?? m.odds ?? 0);
  const ev = Number(m.ev ?? m.expectedValue ?? 0);
  const probability = Number(m.probability ?? 0);
  const risk = Number(m.risk ?? m.riskScore ?? 1);

  if (odd <= 1.01) return false;
  if (ev <= 0) return false;
  if (probability < 0.50) return false;
  if (risk > 0.78) return false;

  /*
    Aqui não fazemos cortes específicos por mercado.
    Isso já foi analisado por value, risk, ranking e classification.
  */
  return true;
}

/* ===============================
   CLASSIFICATION BUCKETS
================================ */

let elite: any | null = null;
let scalper: any | null = null;
const watchlist: any[] = [];

const guardedMarkets = diversified.filter(passesDecisionGuards);

for (const m of guardedMarkets) {
if (m.classification === "SCALPER" && !scalper) {
  scalper = m;
} else if (m.classification === "ELITE" && !elite) {
  elite = m;
} else if (
  m.classification === "BET" ||
  m.classification === "WATCHLIST"
) {
  watchlist.push(m);
}
}

/* ===============================
   CONTEXT REORDER
================================ */

const sorted =
  selectBestMarketByContext(
    guardedMarkets,
    {
      ...data,
      marketContext
    }
  );

  /* ===============================
     FINAL PICK
  ================================ */
const best =
  sorted[0] ||
  scalper ||
  elite ||
  watchlist[0] ||
  null;

let finalBest = best;

if (
  finalBest &&
  finalBest.classification === "NO BET"
) {
  finalBest = null;
}

const noBet = !finalBest;

/* ===============================
   TRACKING
================================ */

if (
  finalBest &&
  ["SCALPER", "ELITE"].includes(finalBest.classification)
) {
  registerBet({
    id: generateId(),
    match: data.match || "Unknown Match",

    market: finalBest.market,
    category: finalBest.category || "GENERAL",

    odd: finalBest.odd,
    probability: finalBest.probability,

    ev: finalBest.ev,
    kelly: finalBest.kelly,
    stake: calculateStakePro(finalBest),

    createdAt: Date.now(),

   type: finalBest.classification as
  | "SCALPER"
  | "ELITE"
  | "BET"
  });
}

  /* ===============================
     COMBO BUILD
  ================================ */

  const combo = buildCombo(sorted);

return {
  elite,
  scalper,
  best: finalBest,
  watchlist,
  secondary: sorted[1] || null,
  combo,
  markets: sorted,
  discarded: discardedBySniper,
  noBet,

  reason: finalBest
    ? finalBest.classification
    : discardedBySniper.length
      ? "MARKETS_DISCARDED_BY_SNIPER"
      : "NO_VALID_MARKET",

  warnings,

    debug: {
    inputMarkets: data.markets.length,
    enrichedMarkets: enriched.length,
    validMarkets: valid.length,
    discardedBySniper: discardedBySniper.length,
    guardedMarkets: guardedMarkets.length,
    finalBest: finalBest?.market ?? null,
    bestClassification: finalBest?.classification ?? null
  }
};
}