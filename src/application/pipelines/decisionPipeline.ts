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

import { marketFilter } from "../filters/marketFilter";
import { gameFilter } from "../filters/gameFilter";

/* ===============================
   🔥 SNIPER FILTER (EDGE-FIRST V5)
================================ */
function sniperFilter(m: any, data: any) {
  const market = String(m.market ?? "").toUpperCase();

  const probability = Number(m.probability ?? 0);
  const ev = Number(m.ev ?? -1);
  const risk = Number(m.risk ?? 1);
  const confidence = Number(m.confidence ?? 0);
  const trapScore = Number(m.trapScore ?? 0);
  const structureValid = Boolean(m.structureValid);
  const odd = Number(m.odd ?? 0);

  const lambdaHome = Number(data?.lambdaHome ?? 1);
  const lambdaAway = Number(data?.lambdaAway ?? 1);
  const lambdaDiff = Math.abs(lambdaHome - lambdaAway);
  const totalLambda = lambdaHome + lambdaAway;
  const goalExpectationScore = Number(data?.goalExpectationScore ?? 0.5);

  /* =========================================
     1) SANIDADE BÁSICA
  ========================================= */

  if (!market) return false;
  if (!Number.isFinite(probability) || !Number.isFinite(ev)) return false;
  if (!Number.isFinite(risk) || !Number.isFinite(confidence)) return false;
  if (!Number.isFinite(odd) || odd <= 1) return false;

  /* =========================================
     2) HARD CUTS REAIS (SÓ EXTREMOS)
  ========================================= */

  if (ev <= 0.01) {
    return false;
  }

  if (probability < 0.36) {
    return false;
  }

  if (risk >= 0.78) {
    return false;
  }

  if (confidence < 0.38 && ev < 0.08) {
    return false;
  }

  if (trapScore >= 0.74) {
    return false;
  }

  /* =========================================
     3) COERÊNCIA COM MERCADO
  ========================================= */

  const implied = 1 / odd;
  const edge = probability - implied;

  if (edge < -0.012) {
    return false;
  }

  /* =========================================
     4) ESTRUTURA
  ========================================= */

  if (!structureValid && ev < 0.05) {
    return false;
  }

  /* =========================================
     5) REGRAS ESPECÍFICAS POR MERCADO
  ========================================= */

  if (market === "HOME_WIN" || market === "AWAY_WIN") {
    if (lambdaDiff < 0.18 && ev < 0.08) {
      return false;
    }

    if (probability < 0.42 && ev < 0.10) {
      return false;
    }

    return true;
  }

  if (market === "DRAW") {
    if (lambdaDiff > 0.55 && ev < 0.09) {
      return false;
    }

    if (totalLambda > 3.25 && ev < 0.10) {
      return false;
    }

    if (probability < 0.24 && ev < 0.10) {
      return false;
    }

    return true;
  }

  if (
    market === "DOUBLE_CHANCE_1X" ||
    market === "DOUBLE_CHANCE_X2"
  ) {
    if (probability < 0.62 && ev < 0.06) {
      return false;
    }

    if (risk > 0.68 && ev < 0.08) {
      return false;
    }

    if (goalExpectationScore > 0.72 && ev < 0.08) {
      return false;
    }

    /* =========================================
       🔥 ANTI-LONGSHOT FAKE (DC)
    ========================================= */

    const suspiciousDCLongshot =
      odd >= 2.20 &&
      lambdaDiff < 0.55 &&
      confidence < 0.72;

    if (suspiciousDCLongshot && ev < 0.12) {
      return false;
    }

    return true;
  }

  if (market === "DOUBLE_CHANCE_12") {
    if (probability < 0.70 && ev < 0.06) {
      return false;
    }

    if (risk > 0.66 && ev < 0.08) {
      return false;
    }

    return true;
  }

  if (market === "OVER_1_5") {
    if (data?.isLowGoalGame && ev < 0.08) {
      return false;
    }

    if (goalExpectationScore < 0.35 && probability < 0.68) {
      return false;
    }

    return true;
  }

  if (market === "OVER_2_5") {
    if (data?.isLowGoalGame && ev < 0.10) {
      return false;
    }

    if (goalExpectationScore < 0.45 && ev < 0.08) {
      return false;
    }

    if (probability < 0.54 && ev < 0.09) {
      return false;
    }

    return true;
  }

  if (market === "OVER_3_5") {
    if (goalExpectationScore < 0.62 && ev < 0.10) {
      return false;
    }

    if (probability < 0.40 && ev < 0.12) {
      return false;
    }

    return true;
  }

  if (market === "BTTS_YES") {
    if (data?.marketContext?.isBadBTTSGame && ev < 0.10) {
      return false;
    }

    if (probability < 0.56 && ev < 0.08) {
      return false;
    }

    if (lambdaDiff > 1.15 && ev < 0.09) {
      return false;
    }

    return true;
  }

  if (market === "BTTS_NO") {
    if (goalExpectationScore > 0.78 && ev < 0.10) {
      return false;
    }

    if (probability < 0.56 && ev < 0.08) {
      return false;
    }

    return true;
  }

  /* =========================================
     6) 🔥 ANTI-LONGSHOT FAKE (WINNER)
  ========================================= */

  const isHomeWin = market === "HOME_WIN";
  const isAwayWin = market === "AWAY_WIN";

  const suspiciousWinnerLongshot =
    (
      (isHomeWin && odd >= 4.50) ||
      (isAwayWin && odd >= 4.50)
    ) &&
    lambdaDiff < 0.65 &&
    confidence < 0.75;

  if (suspiciousWinnerLongshot && ev < 0.15) {
    return false;
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
// 🔥 CLASSIFICAÇÃO PROFISSIONAL — EDGE-FIRST V3
function classifyDecision(
  market: any
): "SCALPER" | "ELITE" | "WATCHLIST" | "NO BET" {
  const {
    market: marketName,
    probability,
    ev,
    risk,
    odd
  } = market;

  const m = String(marketName ?? "").toUpperCase();

  const safeProbability = Number(probability ?? 0);
  const safeEv = Number(ev ?? -1);
  const safeRisk = Number(risk ?? 1);
  const safeOdd = Number(odd ?? 0);

  /* =========================
     SANIDADE BÁSICA
  ========================= */

  if (!m) return "NO BET";
  if (!Number.isFinite(safeProbability)) return "NO BET";
  if (!Number.isFinite(safeEv)) return "NO BET";
  if (!Number.isFinite(safeRisk)) return "NO BET";

  /* =========================
     HARD CUTS REAIS
  ========================= */

  if (safeEv <= 0.01) {
    return "NO BET";
  }

  if (safeRisk >= 0.78) {
    return "NO BET";
  }

  // corte extremo apenas para probabilidades realmente ruins
  if (safeProbability < 0.36) {
    return "NO BET";
  }

  if (safeOdd > 1) {
    const impliedProb = 1 / safeOdd;
    const edge = safeProbability - impliedProb;

    // evita mercado abaixo da linha justa com leve tolerância
    if (edge < -0.012) {
      return "NO BET";
    }
  }

  /* =========================
     SCALPER
     alta taxa de acerto + baixo risco
  ========================= */

  if (
    safeProbability >= 0.72 &&
    safeEv >= 0.04 &&
    safeRisk <= 0.50
  ) {
    return "SCALPER";
  }

  /* =========================
     ELITE — RESULTADOS
  ========================= */

  if (
    ["HOME_WIN", "AWAY_WIN"].includes(m) &&
    safeProbability >= 0.44 &&
    safeEv >= 0.08 &&
    safeRisk <= 0.66
  ) {
    return "ELITE";
  }

  /* =========================
     ELITE — OVER 1.5
  ========================= */

  if (
    m === "OVER_1_5" &&
    safeProbability >= 0.68 &&
    safeEv >= 0.04 &&
    safeRisk <= 0.64
  ) {
    return "ELITE";
  }

  /* =========================
     ELITE — OVER 2.5
  ========================= */

  if (
    m === "OVER_2_5" &&
    safeProbability >= 0.55 &&
    safeEv >= 0.06 &&
    safeRisk <= 0.66
  ) {
    return "ELITE";
  }

  /* =========================
     ELITE — BTTS
  ========================= */

  if (
    ["BTTS_YES", "BTTS_NO"].includes(m) &&
    safeProbability >= 0.57 &&
    safeEv >= 0.06 &&
    safeRisk <= 0.65
  ) {
    return "ELITE";
  }

  /* =========================
     ELITE — DOUBLE CHANCE
  ========================= */

  if (
    ["DOUBLE_CHANCE_1X", "DOUBLE_CHANCE_X2"].includes(m) &&
    safeProbability >= 0.64 &&
    safeEv >= 0.05 &&
    safeRisk <= 0.64
  ) {
    return "ELITE";
  }

  /* =========================
     WATCHLIST
     edge existe, mas ainda não é pick principal
  ========================= */

  if (
    safeEv >= 0.035 &&
    safeProbability >= 0.52 &&
    safeRisk <= 0.70
  ) {
    return "WATCHLIST";
  }

  return "NO BET";
}
/* ===============================
   🧠 SELECT BEST MARKET BY CONTEXT (V6.1 FULL PROFIT MODE)
================================ */
function selectBestMarketByContext(markets: any[], data: any) {
  if (!markets || markets.length === 0) return markets;

  const clamp = (n: number, min: number, max: number) =>
    Math.max(min, Math.min(max, n));

  const safe = (n: any, fallback = 0) => {
    const num = Number(n);
    return isNaN(num) ? fallback : num;
  };

  const goalScore = safe(data?.goalExpectationScore, 0.5);
  const lambdaHome = safe(data?.lambdaHome, 1);
  const lambdaAway = safe(data?.lambdaAway, 1);
  const totalLambda = lambdaHome + lambdaAway;
  const diff = Math.abs(lambdaHome - lambdaAway);

  const context = data?.marketContext || {};
  const pace = String(context?.paceLevel || "medium").toLowerCase();
  const gameType = String(context?.gameType || "balanced").toLowerCase();

  const gameProfile = String(
    data?.gameProfile || "UNKNOWN"
  ).toUpperCase();

  const scored = markets.map((m) => {
    const market = String(m.market ?? "").toUpperCase();
    const classification = String(m.classification ?? "").toUpperCase();

    const ev = safe(m.ev, 0);
    const risk = clamp(safe(m.risk, 1), 0, 1);
    const confidence = clamp(safe(m.confidence, 0.5), 0, 1);
    const probability = clamp(safe(m.probability, 0), 0, 1);
    const signalScore = clamp(safe(m.signalScore, 0), 0, 1);

    let boost = 1;

    /* ===============================
       SANIDADE LOCAL
    ================================ */

    if (
      !Number.isFinite(ev) ||
      !Number.isFinite(risk) ||
      !Number.isFinite(probability)
    ) {
      return {
        ...m,
        contextBoost: 0,
        contextScore: -9999
      };
    }

    if (ev <= 0) {
      return {
        ...m,
        contextBoost: 0,
        contextScore: -999
      };
    }

    /* ===============================
       FLAGS DE MERCADO
    ================================ */

    const isWinner =
      market === "HOME_WIN" ||
      market === "AWAY_WIN";

    const isDoubleChance =
      market === "DOUBLE_CHANCE_1X" ||
      market === "DOUBLE_CHANCE_X2";

    const isOver15 = market === "OVER_1_5";
    const isOver25 = market === "OVER_2_5";

    const isBtts =
      market === "BTTS_YES" ||
      market === "BTTS_NO";

    const isDraw = market === "DRAW";

    /* ===============================
       CONTEXTO LEVE BASE
    ================================ */

    if (isOver15 || isOver25) {
      if (goalScore > 0.65) boost *= 1.04;
      else if (goalScore < 0.40) boost *= 0.95;

      if (pace === "high") boost *= 1.025;
      if (gameType === "open") boost *= 1.025;

      if (totalLambda < 2.1) boost *= 0.95;
      if (totalLambda > 3.2) boost *= 1.025;
    }

    if (isBtts) {
      if (goalScore > 0.58) boost *= 1.035;
      else if (goalScore < 0.42) boost *= 0.965;

      if (diff < 0.50) boost *= 1.025;
      if (pace === "low") boost *= 0.965;
      if (gameType === "open") boost *= 1.02;
    }

    if (isWinner) {
      if (diff > 1.0) boost *= 1.045;
      else if (diff < 0.30) boost *= 0.96;

      if (gameType === "dominant") boost *= 1.025;
    }

    if (isDraw) {
      if (diff < 0.35) boost *= 1.03;
      if (goalScore < 0.48) boost *= 1.02;
      if (pace === "high") boost *= 0.97;
    }

    if (isDoubleChance) {
      if (diff > 0.90) boost *= 1.025;
      if (goalScore < 0.50) boost *= 1.015;

      if (goalScore > 0.65) boost *= 0.99;
    }

    /* ===============================
       V6 — BOOST POR PERFIL DE JOGO
    ================================ */

    if (gameProfile === "OPEN_GOALS") {
      if (isOver25) boost *= 1.06;
      if (isBtts) boost *= 1.05;
      if (isOver15) boost *= 1.02;

      if (isWinner) boost *= 0.96;
      if (isDoubleChance) boost *= 0.95;
      if (isDraw) boost *= 0.94;
    }

    if (gameProfile === "BTTS_GAME") {
      if (isBtts) boost *= 1.07;
      if (isOver25) boost *= 1.03;
      if (isOver15) boost *= 1.01;

      if (isWinner) boost *= 0.95;
      if (isDoubleChance) boost *= 0.96;
      if (isDraw) boost *= 0.95;
    }

    if (gameProfile === "CLEAR_FAVORITE") {
      if (isWinner) boost *= 1.07;
      if (isDoubleChance) boost *= 1.03;
      if (isOver15) boost *= 1.03;

      if (isOver25 && diff < 0.75) boost *= 0.97;
      if (isBtts && Math.min(lambdaHome, lambdaAway) < 1.0) boost *= 0.95;
      if (isDraw) boost *= 0.92;
    }

    if (gameProfile === "LOW_GOAL_GAME") {
      if (isDraw) boost *= 1.03;

      if (isOver25) boost *= 0.90;
      if (isBtts) boost *= 0.92;
      if (isOver15) boost *= 0.96;
      if (isWinner) boost *= 0.98;
    }

    if (
      gameProfile === "HYBRID" ||
      gameProfile === "MUDDY" ||
      gameProfile === "UNKNOWN"
    ) {
      if (isWinner) boost *= 0.96;
      if (isDoubleChance) boost *= 0.97;
      if (isOver25) boost *= 0.96;
      if (isBtts) boost *= 0.97;
    }

/* ===============================
   DOMINÂNCIA DE MERCADO
   OVER > BTTS quando o jogo é muito aberto
================================ */

const isVeryOpenGame =
  totalLambda > 3.2 &&
  goalScore > 0.65;

if (isVeryOpenGame && isOver25) {
  boost *= 1.08;
}

if (isVeryOpenGame && isBtts) {
  boost *= 0.93;
}

    /* ===============================
       DOMINÂNCIA ASSIMÉTRICA
       Favorito forte → reduzir BTTS / over alto
    ================================ */

    const isAsymmetricDominance =
      diff >= 0.75 &&
      Math.min(lambdaHome, lambdaAway) < 1.05;

    if (isAsymmetricDominance) {
      if (isWinner) boost *= 1.04;
      if (isOver15) boost *= 1.02;

      if (isOver25) boost *= 0.96;
      if (isBtts) boost *= 0.93;
    }

    /* ===============================
       AJUSTE LEVE POR CLASSIFICAÇÃO
    ================================ */

    if (classification === "SCALPER") boost *= 1.02;
    else if (classification === "ELITE") boost *= 1.015;
    else if (classification === "WATCHLIST") boost *= 0.995;
    else if (classification === "NO BET") boost *= 0.96;

    /* ===============================
       LIMITAR IMPACTO DO CONTEXTO
    ================================ */

    boost = clamp(boost, 0.90, 1.10);

    /* ===============================
       SCORE FINAL — VALUE FIRST
    ================================ */

    const finalScore =
      (
        (ev * 0.54) +
        ((1 - risk) * 0.18) +
        (confidence * 0.11) +
        (probability * 0.11) +
        (signalScore * 0.06)
      ) * boost;

    return {
      ...m,
      contextBoost: Number(boost.toFixed(4)),
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

const filteredMarkets = marketFilter(data.markets);

if (filteredMarkets.length === 0) {
  return {
    elite: null,
    scalper: null,
    markets: [],
    discarded: [],
    noBet: true,
    reason: "NO_VALID_MARKETS"
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

  const enriched = filteredMarkets.map((m: any) => {
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

/* ===============================
   🎯 VALUE SCORE (EDGE-FIRST V3)
================================ */

const safe = (n: any, fallback = 0) => {
  const num = Number(n);
  return isNaN(num) ? fallback : num;
};

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

const safeEv = safe(ev, 0);
const safeRisk = clamp(safe(risk, 1), 0, 1);
const safeConfidence = clamp(safe(confidence, 0), 0, 1);
const safeProbability = clamp(safe(probability, 0), 0, 1);

/* ===============================
   EV AJUSTADO
================================ */ 

const evComponent =
  safeEv > 0
    ? safeEv
    : safeEv * 1.15; // penaliza um pouco mais EV negativo

let valueScore =
  (evComponent * 0.72) +
  ((1 - safeRisk) * 0.16) +
  (safeConfidence * 0.05) +
  (safeProbability * 0.07);

let finalScore = valueScore;

/* ===============================
   BOOST POR EDGE REAL
================================ */

if (ev > 0.10) {
  finalScore *= 1.05;
}

if (ev > 0.18) {
  finalScore *= 1.10;
}

if (ev > 0.28) {
  finalScore *= 1.15;
}

/* ===============================
   CONTROLE DE RISCO EXTREMO
================================ */

if (risk > 0.70) {
  finalScore *= 0.85;
}

/* ===============================
   CONTROLE LONGSHOT (SUAVE)
================================ */

if (odd > 3.2 && ev < 0.18) {
  finalScore *= 0.90;
}

/* ===============================
   BOOST POR EDGE REAL
=============================== */

if (ev > 0.15) {
  finalScore *= 1.15;
}

if (ev > 0.25) {
  finalScore *= 1.25;
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
}

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

const sortedRaw = [...valid].sort((a: any, b: any) => {
  const valueDiff = Number(b.valueScore ?? 0) - Number(a.valueScore ?? 0);
  if (Math.abs(valueDiff) > 0.0001) return valueDiff;

  const evDiff = Number(b.ev ?? 0) - Number(a.ev ?? 0);
  if (Math.abs(evDiff) > 0.0001) return evDiff;

  const probDiff = Number(b.probability ?? 0) - Number(a.probability ?? 0);
  if (Math.abs(probDiff) > 0.0001) return probDiff;

  return Number(a.risk ?? 1) - Number(b.risk ?? 1);
});

  /* ===============================
   FORCE BEST SCALPER
================================ */

const forcedPicks: any[] = [];

const bestScalper =
  sortedRaw.find(
    (m: any) => m.classification === "SCALPER"
  );

if (bestScalper) {
  forcedPicks.push(bestScalper);
}

/* ===============================
   DIVERSIFICATION
================================ */

const diversified: any[] = [...forcedPicks];

const usedTypes = new Set(
  forcedPicks.map((m) => getMarketType(m.market))
);

for (const m of sortedRaw) {
  const type = getMarketType(m.market);

  if (!usedTypes.has(type)) {
    diversified.push(m);
    usedTypes.add(type);
  }

  if (diversified.length >= 6) {
    break;
  }
}

/* ===============================
   GAME FILTER — V6 HARD GATE
================================ */

const gameGate = gameFilter({
  ...data,

  lambdaHome: data?.lambdaHome ?? 1.2,
  lambdaAway: data?.lambdaAway ?? 1.0,
  goalExpectationScore: data?.goalExpectationScore ?? 0.5,

  monteCarlo:
    data?.monteCarlo ||
    data?.simulation?.monteCarlo ||
    null,

  result: data?.result ?? null,
  btts: data?.btts ?? null,
  goals: data?.goals ?? null
});

const minGameScore =
  gameGate.level === "STRONG" ? 0.60 :
  gameGate.level === "GOOD" ? 0.62 :
  0.999;

if (
  !gameGate.allowed ||
  (gameGate.score ?? 0) < minGameScore
) {
  return {
    ...data,
    elite: null,
    scalper: null,
    best: null,
    officialPick: null,
    watchlist: [],
    secondary: null,
    combo: null,
    markets: [],
    discarded: enriched,
    noBet: true,
    blocked: true,
    blockReason:
      !gameGate.allowed
        ? gameGate.reason
        : "GAME_SCORE_TOO_LOW",
    gameProfile: gameGate.profile,
    gameFilterScore: gameGate.score,
    gameFilterLevel: gameGate.level ?? "WEAK",
    gameDiagnostics: gameGate.diagnostics ?? null
  };
}

/* ===============================
   CONTEXT REORDER
================================ */

const sorted = selectBestMarketByContext(
  diversified,
  {
    ...data,
    marketContext,
    gameProfile: gameGate.profile ?? "UNKNOWN"
  }
);

/* ===============================
   CLASSIFICATION BUCKETS
================================ */

let elite: any | null = null;
let scalper: any | null = null;
const watchlist: any[] = [];

for (const m of sorted) {
  if (
    m.classification === "SCALPER" &&
    !scalper
  ) {
    scalper = m;
  } else if (
    m.classification === "ELITE" &&
    !elite
  ) {
    elite = m;
  } else if (
    m.classification === "WATCHLIST"
  ) {
    watchlist.push(m);
  }
}

/* ===============================
   FINAL PICK
================================ */

const eliteClearlyBetter =
  elite &&
  (
    !scalper ||
    (
      Number(elite.ev ?? 0) > Number(scalper.ev ?? 0) * 1.15 &&
      Number(elite.probability ?? 0) >= 0.55 &&
      Number(elite.risk ?? 1) <= 0.64
    )
  );

const best =
  eliteClearlyBetter
    ? elite
    : scalper ||
      elite ||
      sorted.find((m: any) =>
        ["SCALPER", "ELITE", "WATCHLIST"].includes(m.classification)
      ) ||
      watchlist[0] ||
      sorted[0] ||
      null;

let finalBest = best;

/* ===============================
   FINAL QUALITY GATE — V6 FULL PROFIT MODE
================================ */

if (finalBest) {
  const cls = String(finalBest.classification || "").toUpperCase();
  const ev = Number(finalBest.ev ?? 0);
  const probability = Number(finalBest.probability ?? 0);
  const risk = Number(finalBest.risk ?? 1);
  const odd = Number(finalBest.odd ?? 0);
  const market = String(finalBest.market ?? "").toUpperCase();

  const gameLevel = String(gameGate?.level ?? "WEAK").toUpperCase();
  const gameProfile = String(gameGate?.profile ?? "UNKNOWN").toUpperCase();
  const gameScore = Number(gameGate?.score ?? 0);

  const invalidCore =
    !Number.isFinite(ev) ||
    !Number.isFinite(probability) ||
    !Number.isFinite(risk) ||
    !Number.isFinite(odd);

  /* ===============================
     1) SANIDADE + CLASSIFICAÇÃO
  ================================ */

  if (invalidCore || cls === "NO BET") {
    finalBest = null;
  } else if (cls === "SCALPER") {
    if (
      ev < 0.04 ||
      probability < 0.70 ||
      risk > 0.52
    ) {
      finalBest = null;
    }
  } else if (cls === "ELITE") {
    if (
      ev < 0.05 ||
      probability < 0.50 ||
      risk > 0.66
    ) {
      finalBest = null;
    }
  } else if (cls === "WATCHLIST") {
    finalBest = null;
  } else {
    finalBest = null;
  }

  /* ===============================
     2) GAME LEVEL GATE
  ================================ */

  // jogo fraco: só aceita scalper
  if (
    finalBest &&
    gameLevel === "WEAK" &&
    cls !== "SCALPER"
  ) {
    finalBest = null;
  }

  // jogo médio: elite precisa ser mais forte
  if (
    finalBest &&
    gameLevel === "GOOD" &&
    cls === "ELITE" &&
    ev < 0.07
  ) {
    finalBest = null;
  }

  // score mínimo duro
  if (
    finalBest &&
    gameScore < 0.60
  ) {
    finalBest = null;
  }

  /* ===============================
   3) PROFILE GATE
   Mercado deve combinar com o tipo de jogo
================================ */

// ===============================
// FLAGS DE MERCADO
// ===============================

const isWinner =
  market === "HOME_WIN" ||
  market === "AWAY_WIN";

const isDoubleChance =
  market === "DOUBLE_CHANCE_1X" ||
  market === "DOUBLE_CHANCE_X2" ||
  market === "DOUBLE_CHANCE_12";

const isOver15 =
  market === "OVER_1_5";

const isHighOver =
  market === "OVER_2_5" ||
  market === "OVER_3_5";

const isBtts =
  market === "BTTS_YES" ||
  market === "BTTS_NO";

// ===============================
// REGRAS POR PERFIL
// ===============================

// Winner só em jogo de favorito claro
if (
  finalBest &&
  isWinner &&
  gameProfile !== "CLEAR_FAVORITE"
) {
  finalBest = null;
}

// Double chance também só em favorito claro
if (
  finalBest &&
  isDoubleChance &&
  gameProfile !== "CLEAR_FAVORITE"
) {
  finalBest = null;
}

// Over 2.5 / 3.5 só em jogo aberto de verdade
if (
  finalBest &&
  isHighOver &&
  !["OPEN_GOALS", "BTTS_GAME"].includes(gameProfile)
) {
  finalBest = null;
}

// BTTS só em jogo simétrico / aberto
if (
  finalBest &&
  isBtts &&
  !["BTTS_GAME", "OPEN_GOALS"].includes(gameProfile)
) {
  finalBest = null;
}

// Over 1.5 pode passar em jogo forte ou aberto
if (
  finalBest &&
  isOver15 &&
  !["OPEN_GOALS", "BTTS_GAME", "CLEAR_FAVORITE"].includes(gameProfile)
) {
  finalBest = null;
}

  /* ===============================
     4) ODD FLOOR INTELIGENTE
  ================================ */

  if (finalBest && odd < 1.20) {
    finalBest = null;
  }

  if (finalBest && odd < 1.25 && ev < 0.10) {
    finalBest = null;
  }

  if (
    finalBest &&
    odd < 1.30 &&
    probability < 0.78 &&
    ev < 0.08
  ) {
    finalBest = null;
  }

  // odds baixas só passam em jogo realmente forte
  if (
    finalBest &&
    odd < 1.30 &&
    gameLevel !== "STRONG"
  ) {
    finalBest = null;
  }

  /* ===============================
     5) TRAVA ANTI-LONGSHOT FAKE
  ================================ */

  const isResultLike =
    isWinner || isDoubleChance;

  if (
    finalBest &&
    isResultLike &&
    odd >= 2.20 &&
    probability < 0.60 &&
    ev < 0.16
  ) {
    finalBest = null;
  }

  if (
    finalBest &&
    isWinner &&
    odd >= 4.50 &&
    ev < 0.20
  ) {
    finalBest = null;
  }

  /* ===============================
     6) CONTROLE EXTRA POR RISCO
  ================================ */

  if (
    finalBest &&
    cls === "ELITE" &&
    risk > 0.62 &&
    ev < 0.09
  ) {
    finalBest = null;
  }

  if (
    finalBest &&
    cls === "SCALPER" &&
    odd < 1.35 &&
    ev < 0.11 &&
    gameLevel !== "STRONG"
  ) {
    finalBest = null;
  }
}

/* ===============================
   WATCHLIST NÃO É PICK OFICIAL
================================ */

const officialPick =
  finalBest &&
  ["SCALPER", "ELITE"].includes(finalBest.classification)
    ? finalBest
    : null;

const noBet = !officialPick;

/* ===============================
   TRACKING
================================ */

if (
  officialPick &&
  Number.isFinite(Number(officialPick.odd)) &&
  Number.isFinite(Number(officialPick.probability)) &&
  Number.isFinite(Number(officialPick.ev))
) {
  registerBet({
    id: generateId(),
    match: data.match || "Unknown Match",
    market: officialPick.market,
    category: officialPick.category || "GENERAL",
    odd: officialPick.odd,
    probability: officialPick.probability,
    ev: officialPick.ev,
    kelly: officialPick.kelly,
    stake: calculateStakePro(officialPick),
    createdAt: Date.now(),
    type: officialPick.classification as
      | "SCALPER"
      | "ELITE"
  });
}

/* ===============================
   COMBO BUILD
================================ */

const combo = buildCombo(sorted);

return {
  elite,
  scalper,
  best: finalBest || null,
  officialPick,
  watchlist,
  secondary: valid[1] || null,
  combo,
  markets: sorted,
  discarded: enriched.filter((m: any) => !valid.includes(m)),
  noBet
}
};