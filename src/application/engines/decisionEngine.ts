import { calculateRiskScore } from "../../domain/risk/riskScore";
import { classifyZone } from "./zoneClassifier";
import { calibrateProbability } from "../../domain/calibration/probabilityCalibration";
import { autoLearningEngine } from "../../domain/learning/autoLearningEngine";

/* ===============================
   SAFE
=============================== */

const safe = (v: any, fallback: number) =>
  v === undefined || v === null || isNaN(v) ? fallback : v;

/* ===============================
   EV (APENAS INFORMATIVO)
=============================== */

function calibrateEV(ev: number) {
  if (ev > 0.20) return ev * 0.7;
  if (ev > 0.10) return ev * 0.85;
  return ev;
}

/* ===============================
   DECISION ENGINE FINAL ELITE
=============================== */

export function decisionEngine(input: any) {

  /* ===========================
     🔥 1. MONTE CARLO (BASE ABSOLUTA)
  ============================ */

  let prob = safe(input?.monteCarlo?.mainProb, 0);

  // 🚫 SEM PROB → SEM JOGO
  if (!prob || prob <= 0) {
    return {
      decision: "NO DATA",
      mode: "NONE"
    };
  }

  /* ===========================
     🔥 2. CALIBRAÇÃO BASE
  ============================ */

  prob = calibrateProbability(prob);

  /* ===========================
     🔥 3. AUTO LEARNING (CORE)
  ============================ */

  const learning = autoLearningEngine();

  if (learning?.ready && learning.probBias) {
    prob += learning.probBias;
  }

  // 🔒 CLAMP FINAL
  prob = Math.max(0.0001, Math.min(0.9999, prob));

  /* ===========================
     🔹 ODDS / EV (SECUNDÁRIO)
  ============================ */

  const bookmakerOdd = safe(input.bookmakerOdd, 2);

  const fairOdd = 1 / prob;

  const rawEV = prob * bookmakerOdd - 1;
  const expectedValue = calibrateEV(rawEV);

  /* ===========================
     🔹 KELLY
  ============================ */

  const b = bookmakerOdd - 1;
  const q = 1 - prob;

  let rawKelly = (prob * b - q) / (b || 1);
  rawKelly = Math.max(0, rawKelly);

  const kelly = Math.min(rawKelly * 0.35, 0.05);

  /* ===========================
     🔹 RISK SCORE
  ============================ */

  const lambdaHome = safe(input.lambdaHome, 1.2);
  const lambdaAway = safe(input.lambdaAway, 1.0);

  const riskScore = calculateRiskScore({
    lambdaHome,
    lambdaAway,
    leagueAvgGoals: safe(input.leagueAvgGoals, 1.3),
    eventProbability: prob,
    recentGoalStd: safe(input.recentGoalStd, 1),
    seasonGoalAvg: safe(input.seasonGoalAvg, 1.2)
  });

  const isAllowedByRisk = riskScore <= 0.55;

  /* ===========================
     🔥 MULTI-ENGINE SIGNALS
  ============================ */

  const shotsPressure =
    safe(input?.engines?.shotsData?.pressure, 1);

  const shotVolume =
    safe(input?.engines?.shotsData?.totalShots, 20);

  const cardsIntensity =
    safe(input?.engines?.cardsData?.intensity, 1);

  const cornerPressure =
    safe(input?.engines?.cornerData?.lambdaCorners, 9);

  /* ===========================
     🧠 ESTRUTURA REAL
  ============================ */

  const isHighProb = prob >= 0.60;
  const isVeryHighProb = prob >= 0.72;

  const strongPressure =
    shotVolume >= 22 && shotsPressure >= 1.1;

  const balancedGame =
    Math.abs(lambdaHome - lambdaAway) < 1.2;

  const stableGame =
    cardsIntensity >= 0.8;

  const strongStructure =
    strongPressure && balancedGame;

  /* ===========================
     🚫 BLOQUEIOS (PRIORIDADE)
  ============================ */

  if (!isAllowedByRisk) {
    return {
      probability: prob,
      bookmakerOdd,
      fairOdd,
      expectedValue,
      kelly,
      riskScore,
      decision: "BLOCKED BY RISK",
      mode: "NONE",
      zone: "RISK_BLOCK",
      signals: {
        shotsPressure,
        shotVolume,
        cardsIntensity,
        cornerPressure
      }
    };
  }

  if (!strongStructure) {
    return {
      probability: prob,
      bookmakerOdd,
      fairOdd,
      expectedValue,
      kelly,
      riskScore,
      decision: "NO BET (WEAK STRUCTURE)",
      mode: "NONE",
      zone: "STRUCTURE_BLOCK",
      signals: {
        shotsPressure,
        shotVolume,
        cardsIntensity,
        cornerPressure
      }
    };
  }

  if (prob < 0.60) {
    return {
      probability: prob,
      bookmakerOdd,
      fairOdd,
      expectedValue,
      kelly,
      riskScore,
      decision: "NO BET (LOW PROBABILITY)",
      mode: "NONE",
      zone: "PROB_BLOCK",
      signals: {
        shotsPressure,
        shotVolume,
        cardsIntensity,
        cornerPressure
      }
    };
  }

  /* ===========================
     🎯 DECISÃO FINAL
  ============================ */

  let decision = "NO BET";
  let mode: "ELITE" | "SCALPER" | "NONE" = "NONE";

  // ⚡ SCALPER (PURO — SEM EV)
  if (
    isVeryHighProb &&
    stableGame
  ) {
    decision = "SCALPER";
    mode = "SCALPER";
  }

  // 🔥 ELITE (SEM DEPENDER DE EV)
  else if (isHighProb) {
    decision = "BET";
    mode = "ELITE";
  }

  /* ===========================
     📊 ZONE (INFO ONLY)
  ============================ */

  const zone = classifyZone({
    expectedValue,
    riskScore,
    kelly,
    probability: prob
  });

  /* ===========================
     🏁 OUTPUT FINAL
  ============================ */

  return {
    probability: prob,
    bookmakerOdd,
    fairOdd,
    expectedValue,
    kelly,
    riskScore,
    decision,
    mode,
    zone,

    // 🔥 DEBUG PRO
    meta: {
      learningApplied: learning?.ready || false
    },

    signals: {
      shotsPressure,
      shotVolume,
      cardsIntensity,
      cornerPressure
    }
  };
}