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

/* ===============================
   🔥 SNIPER FILTER (EDGE-FIRST V3)
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

  // sem valor real
  if (ev <= 0.01) {
    return false;
  }

  // probabilidade muito fraca
  if (probability < 0.40) {
    return false;
  }

  // risco extremo
  if (risk >= 0.78) {
    return false;
  }

  // confiança extremamente baixa
  if (confidence < 0.42) {
    return false;
  }

  // trap extremo
  if (trapScore >= 0.72) {
    return false;
  }

  /* =========================================
     3) COERÊNCIA COM MERCADO
  ========================================= */

  const implied = 1 / odd;

  // pequena borda técnica para evitar matar edge marginal válido
  if (probability + 0.015 < implied) {
    return false;
  }

  /* =========================================
     4) ESTRUTURA
  ========================================= */

  // não matar tudo por estrutura imperfeita
  // só bloquear quando estrutura estiver ruim + valor fraco
  if (!structureValid && ev < 0.05) {
    return false;
  }

  /* =========================================
     5) REGRAS ESPECÍFICAS POR MERCADO
     (agora só bloqueiam extremos ruins)
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

  if (
    market === "DOUBLE_CHANCE_1X" ||
    market === "DOUBLE_CHANCE_X2"
  ) {
    if (probability < 0.58 && ev < 0.05) {
      return false;
    }

    if (risk > 0.70 && ev < 0.08) {
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

  if (market === "BTTS_YES") {
    if (data?.marketContext?.isBadBTTSGame && ev < 0.10) {
      return false;
    }

    if (probability < 0.56 && ev < 0.08) {
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
// 🔥 CLASSIFICAÇÃO PROFISSIONAL — EDGE-FIRST V2
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
     (só casos ruins de verdade)
  ========================= */

  if (safeEv <= 0.01) {
    return "NO BET";
  }

  if (safeProbability < 0.40) {
    return "NO BET";
  }

  if (safeRisk >= 0.78) {
    return "NO BET";
  }

  if (safeOdd > 1) {
    const impliedProb = 1 / safeOdd;

    // pequena tolerância para não matar edge marginal válido
    if (safeProbability + 0.015 < impliedProb) {
      return "NO BET";
    }
  }

  /* =========================
     SCALPER
     alta taxa de acerto + risco mais baixo
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
    safeProbability >= 0.43 &&
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
    safeProbability >= 0.54 &&
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
    safeProbability >= 0.56 &&
    safeEv >= 0.06 &&
    safeRisk <= 0.66
  ) {
    return "ELITE";
  }

  /* =========================
     ELITE — DOUBLE CHANCE
  ========================= */

  if (
    ["DOUBLE_CHANCE_1X", "DOUBLE_CHANCE_X2"].includes(m) &&
    safeProbability >= 0.60 &&
    safeEv >= 0.04 &&
    safeRisk <= 0.68
  ) {
    return "ELITE";
  }

  /* =========================
     WATCHLIST
     edge existe, mas não é pick principal
  ========================= */

  if (
    safeEv >= 0.03 &&
    safeProbability >= 0.50 &&
    safeRisk <= 0.72
  ) {
    return "WATCHLIST";
  }

  return "NO BET";
}
/* ===============================
   🧠 SELECT BEST MARKET BY CONTEXT (VALUE-FIRST V3)
=============================== */
function selectBestMarketByContext(markets: any[], data: any) {
  if (!markets || markets.length === 0) return markets;

  const goalScore = Number(data?.goalExpectationScore ?? 0.5);
  const totalLambda = Number(
    (data?.lambdaHome ?? 1) + (data?.lambdaAway ?? 1)
  );
  const diff = Math.abs(
    Number(data?.lambdaHome ?? 1) - Number(data?.lambdaAway ?? 1)
  );

  const context = data?.marketContext || {};
  const pace = context?.paceLevel || "medium";
  const gameType = context?.gameType || "balanced";

  const scored = markets.map((m) => {
    let boost = 1;
    const market = String(m.market ?? "").toUpperCase();

    /* ===============================
       CONTEXTO COMO AJUSTE LEVE
    ================================ */

    if (market.includes("OVER")) {
      if (goalScore > 0.65) boost *= 1.05;
      else if (goalScore < 0.40) boost *= 0.95;

      if (pace === "high") boost *= 1.03;
      if (gameType === "open") boost *= 1.03;

      if (totalLambda < 2.1) boost *= 0.95;
    }

    if (market.includes("BTTS")) {
      if (goalScore > 0.58) boost *= 1.04;
      else if (goalScore < 0.42) boost *= 0.96;

      if (diff < 0.50) boost *= 1.03;
      if (pace === "low") boost *= 0.96;
    }

    if (market.includes("HOME") || market.includes("AWAY")) {
      if (diff > 1.0) boost *= 1.05;
      else if (diff < 0.30) boost *= 0.96;

      if (gameType === "dominant") boost *= 1.03;
    }

    if (market.includes("1X") || market.includes("X2")) {
      if (diff > 0.90) boost *= 1.04;
      if (goalScore < 0.50) boost *= 1.02;
    }

    /* ===============================
       LIMITAR IMPACTO DO CONTEXTO
    ================================ */

    boost = Math.max(0.92, Math.min(boost, 1.10));

    /* ===============================
       SCORE FINAL — VALUE FIRST
    ================================ */

    const finalScore =
      (
        (Number(m.ev ?? 0) * 0.50) +
        (Number(1 - (m.risk ?? 1)) * 0.18) +
        (Number(m.confidence ?? 0) * 0.12) +
        (Number(m.probability ?? 0) * 0.10) +
        (Number(m.signalScore ?? 0) * 0.10)
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
   🎯 VALUE SCORE (EDGE-FIRST V2)
================================ */

let valueScore =
  (Number(ev ?? 0) * 0.75) +         // 🔥 EV DOMINANTE
  (Number(1 - (risk ?? 1)) * 0.15) + // 🧠 CONTROLE DE RISCO
  (Number(confidence ?? 0) * 0.05) + // 🔍 QUALIDADE DO MODELO
  (Number(probability ?? 0) * 0.05); // ⚖️ SUPORTE LEVE

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

  /* ===============================
     CLASSIFICATION BUCKETS
  ================================ */

  let elite: any | null = null;
  let scalper: any | null = null;
  const watchlist: any[] = [];

  for (const m of diversified) {
    if (
      m.classification === "SCALPER" &&
      !scalper
    ) {
      scalper = m;
    }

    else if (
      m.classification === "ELITE" &&
      !elite
    ) {
      elite = m;
    }

    else if (
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
      diversified,
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

/* FINAL QUALITY GATE — SNIPER V2 */

if (
  finalBest &&
  (
    finalBest.classification === "NO BET" ||
    finalBest.ev < 0.07 ||
    finalBest.probability < 0.53 ||
    finalBest.risk > 0.65
  )
) {
  finalBest = null;
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

if (officialPick) {
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
  best: officialPick,
  watchlist,
  secondary: sorted[1] || null,
  combo,
  markets: sorted,
  discarded: enriched.filter(
    (m: any) => !valid.includes(m)
  ),
  noBet
};
}