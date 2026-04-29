import { calculateRiskV2 } from "../../domain/analysis/riskEngine";
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
     🔥 1. PROBABILIDADE BASE
  ============================ */

  let prob = safe(input?.monteCarlo?.mainProb, 0);

  if (!prob || prob <= 0) {
    prob = safe(input?.probability, 0);
  }

  /* ===========================
     🔥 OUTPUT BASE (ANTI-ERRO TS)
  ============================ */

  function buildOutput(
    decisionText: string,
    mode: "ELITE" | "SCALPER" | "NONE" = "NONE",
    zone: any = "RED"
  ) {
    return {
      probability: prob,
      bookmakerOdd,
      fairOdd,
      expectedValue,
      kelly,
      riskScore,
      decision: decisionText,
      mode,
      zone,

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

  if (!prob || prob <= 0) {
    return buildOutput("NO DATA");
  }

  /* ===========================
     🔥 2. CALIBRAÇÃO
  ============================ */

  prob = calibrateProbability(prob);

  const learning = autoLearningEngine();

  if (learning?.ready && learning.probBias) {
    prob += learning.probBias;
  }

  prob = Math.max(0.0001, Math.min(0.9999, prob));

  /* ===========================
     🔹 ODDS / EV
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
     🔥 RISK V2 (PRO)
  ============================ */

  const lambdaHome = safe(input.lambdaHome, 1.2);
  const lambdaAway = safe(input.lambdaAway, 1.0);

  const riskScore = calculateRiskV2({
    probability: prob,
    ev: expectedValue,
    kelly,
    market: input.market || "UNKNOWN",
    lambdaHome,
    lambdaAway
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
     🧠 ESTRUTURA DO JOGO
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
     🚫 BLOQUEIOS
  ============================ */

  if (!isAllowedByRisk) {
    return buildOutput("BLOCKED BY RISK");
  }

  if (!strongStructure) {
    return buildOutput("NO BET (WEAK STRUCTURE)");
  }

  if (prob < 0.60) {
    return buildOutput("NO BET (LOW PROBABILITY)");
  }

  /* ===========================
     🎯 DECISÃO FINAL
  ============================ */

  let decision = "NO BET";
  let mode: "ELITE" | "SCALPER" | "NONE" = "NONE";

  if (isVeryHighProb && stableGame) {
    decision = "SCALPER";
    mode = "SCALPER";
  }
  else if (isHighProb) {
    decision = "BET";
    mode = "ELITE";
  }

  const zone = classifyZone({
    expectedValue,
    riskScore,
    kelly,
    probability: prob
  });

  return buildOutput(decision, mode, zone);
}