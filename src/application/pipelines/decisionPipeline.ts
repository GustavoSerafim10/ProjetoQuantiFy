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
function sniperFilter(
  m: any,
  data: any
) {
  const market = m.market.toUpperCase();

  const {
    probability,
    ev,
    risk,
    confidence,
    trapScore,
    structureValid
  } = m;

  /* =========================================
     HARD CUTS (QUALIDADE FINAL)
  ========================================= */

  if (
    ev < 0.05 ||
    probability < 0.55 ||
    risk > 0.65 ||
    confidence < 0.55
  ) {
    return false;
  }

  /* =========================================
     ANTI MARGINAL
  ========================================= */

  if (
    ev < 0.08 &&
    probability < 0.60
  ) {
    return false;
  }

  /* =========================================
     COERÊNCIA ODDS x PROB
  ========================================= */

  if (m.odd) {
    const implied = 1 / m.odd;
    if (probability < implied) {
      return false;
    }
  }

  /* =========================================
     HARD STRUCTURAL CUTS (SEU CORE)
  ========================================= */

  if (trapScore > 0.50) {
    return false;
  }

  if (!structureValid) {
    return false;
  }

  /* =========================================
     RESULTADOS (HOME / AWAY)
  ========================================= */

  if (
    market === "HOME_WIN" ||
    market === "AWAY_WIN"
  ) {
    const lambdaDiff = Math.abs(
      (data.lambdaHome ?? 1) -
      (data.lambdaAway ?? 1)
    );

    if (
      lambdaDiff < 0.35 ||
      ev < 0.10 ||
      probability < 0.40
    ) {
      return false;
    }

    return true;
  }

  /* =========================================
     DOUBLE CHANCE
  ========================================= */

  if (
    market === "DOUBLE_CHANCE_1X" ||
    market === "DOUBLE_CHANCE_X2"
  ) {
    const lambdaDiff = Math.abs(
      (data.lambdaHome ?? 1) -
      (data.lambdaAway ?? 1)
    );

    if (
      lambdaDiff < 0.20 ||
      probability < 0.65 ||
      ev < 0.06 ||
      risk > 0.58
    ) {
      return false;
    }

    return true;
  }

  /* =========================================
     OVER 1.5
  ========================================= */

  if (market === "OVER_1_5") {
    if (data.isLowGoalGame) return false;

    if (
      data.goalExpectationScore < 0.45 ||
      probability < 0.72 ||
      ev < 0.05
    ) {
      return false;
    }

    return true;
  }

  /* =========================================
     OVER 2.5 (SEU PONTO CRÍTICO)
  ========================================= */

  if (market === "OVER_2_5") {
    if (data.isLowGoalGame) return false;

 if (
  data.goalExpectationScore < 0.62 ||
  probability < 0.65 ||
  ev < 0.13 ||
  risk > 0.55
) {
  return false;
}

    return true;
  }

  /* =========================================
     BTTS YES
  ========================================= */

  if (market === "BTTS_YES") {
    if (
      data.marketContext?.isBadBTTSGame ||
      probability < 0.60 ||
      ev < 0.07 ||
      risk > 0.62
    ) {
      return false;
    }

    return true;
  }

  /* =========================================
     BTTS NO
  ========================================= */

  if (market === "BTTS_NO") {
    if (
      data.goalExpectationScore > 0.65 ||
      probability < 0.60 ||
      ev < 0.07 ||
      risk > 0.62
    ) {
      return false;
    }

    return true;
  }

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
): "SCALPER" | "ELITE" | "NO BET" {

  const {
    market: marketName,
    probability,
    ev,
    risk,
    odd
  } = market;

  const m = marketName.toUpperCase();

  /* =========================
     HARD CUTS GLOBAIS (BASE)
  ========================= */

  if (
    ev < 0.06 ||
    probability < 0.55 ||
    risk > 0.65
  ) {
    return "NO BET";
  }

  /* =========================
     ANTI MARGINAL (EV + PROB FRACOS)
  ========================= */

  if (
    ev < 0.08 &&
    probability < 0.60
  ) {
    return "NO BET";
  }

  /* =========================
     COERÊNCIA ODDS x PROB
  ========================= */

  if (odd) {
    const impliedProb = 1 / odd;

    if (probability < impliedProb) {
      return "NO BET";
    }
  }

  /* =========================
     BLOQUEIOS ESPECÍFICOS (ANTI-TRAP)
  ========================= */

  // 🔻 Over fraco (seu maior problema atual)
if (
  m === "OVER_2_5" &&
  (
    probability < 0.65 ||
    ev < 0.13 ||
    risk > 0.55
  )
) {
  return "NO BET";
}

  // 🔻 BTTS muito borderline
if (
  ["BTTS_YES", "BTTS_NO"].includes(m) &&
  (
    probability < 0.60 ||
    ev < 0.07 ||
    risk > 0.62
  )
) {
  return "NO BET";
}

/* =========================
   SCALPER UNIVERSAL
========================= */

if (
  probability >= 0.72 &&
  ev >= 0.04 &&
  risk <= 0.50
) {
  return "SCALPER";
}

/* =========================
   ⚖️ MID VALUE (CONTROLADO)
========================= */

if (
  ["HOME_WIN", "AWAY_WIN"].includes(m) &&
  probability >= 0.45 &&
  ev >= 0.10 &&
  risk <= 0.62
) {
  return "ELITE";
}

/* =========================
   ELITE — RESULTADOS
========================= */

  if (
    ["HOME_WIN", "AWAY_WIN"].includes(m) &&
    probability >= 0.40 &&
    ev >= 0.10 &&
    risk <= 0.62
  ) {
    return "ELITE";
  }

  /* =========================
     ELITE — OVER 1.5
  ========================= */

if (
  m === "OVER_1_5" &&
  probability >= 0.75 &&
  ev >= 0.15 &&
  risk <= 0.55
) {
  return "ELITE";
}

  /* =========================
     ELITE — OVER 2.5
  ========================= */

if (
  m === "OVER_2_5" &&
  probability >= 0.65 &&
  ev >= 0.13 &&
  risk <= 0.55
) {
  return "ELITE";
}

  /* =========================
     ELITE — BTTS
  ========================= */

  if (
    ["BTTS_YES", "BTTS_NO"].includes(m) &&
    probability >= 0.62 &&
    ev >= 0.07 &&
    risk <= 0.62
  ) {
    return "ELITE";
  }

  /* =========================
     ELITE — DOUBLE CHANCE
  ========================= */

  if (
    [
      "DOUBLE_CHANCE_1X",
      "DOUBLE_CHANCE_X2"
    ].includes(m) &&
    probability >= 0.65 &&
    ev >= 0.06 &&
    risk <= 0.58
  ) {
    return "ELITE";
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
   
  if (data.blocked) {
    return {
      elite: null,
      scalper: null,
      markets: [],
      discarded: [],
      noBet: true,
      reason: data.blockReason
    };
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

if (odd < 1.40) {
  finalScore *= 0.88;
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
  risk
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

const valid = enriched.filter((m: any) =>
  sniperFilter(
    m,
    {
      ...data,
      marketContext
    }
  )
);

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

  // Endurecer BTTS
  if (m.market?.includes("BTTS")) {
    if (m.ev < 0.20) return false;
    if (m.probability < 0.66) return false;
  }

  // Evitar Over 1.5 com odd murcha + EV fraco
  if (m.market === "OVER_1_5") {
    if (m.odd < 1.40 && m.ev < 0.18) return false;
    if (m.probability < 0.78) return false;
  }

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
  } else if (m.classification === "WATCHLIST") {
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
  (
    finalBest.ev < 0.08 ||
    finalBest.probability < 0.55
  )
) {
  finalBest = null;
}

const noBet = !finalBest;

  /* ===============================
     TRACKING
  ================================ */
if (finalBest) {
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
      | "WATCHLIST"
  });
}

  /* ===============================
     COMBO BUILD
  ================================ */

  const combo = buildCombo(sorted);

  return {
    elite,
    scalper,
    best:finalBest,
    watchlist,
    secondary:
      sorted[1] || null,
    combo,
    markets: sorted,
    discarded:
      enriched.filter(
        (m: any) =>
          !valid.includes(m)
      ),
    noBet
  };
}