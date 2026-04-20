import { monteCarloPoisson } from "../../domain/simulation/monteCarloPoisson";

/* ===========================
   HELPERS
=========================== */

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(n, max));
}

function safe(n: any, fallback = 0) {
  const num = Number(n);
  return isNaN(num) ? fallback : num;
}

/* 🔥 ANTI-PROB IRREAL */
function calibrateProbability(p: number) {
  if (p > 0.90) return 0.90;
  if (p < 0.05) return 0.05;
  return p;
}

/* ===========================
   NORMALIZAÇÃO LEVE
=========================== */

function normalizeLambdas(home: number, away: number) {
  const total = home + away;

  const MIN_TOTAL = 1.2;
  const MAX_TOTAL = 3.8;

  if (total <= 0) {
    return { home: 1.2, away: 1.0 };
  }

  if (total >= MIN_TOTAL && total <= MAX_TOTAL) {
    return { home, away };
  }

  const targetTotal = clamp(total, MIN_TOTAL, MAX_TOTAL);
  const scale = targetTotal / total;

  return {
    home: Number((home * scale).toFixed(4)),
    away: Number((away * scale).toFixed(4))
  };
}

/* ===========================
   MODIFIERS (fallback only)
=========================== */

function getPressureFactor(pressure: number) {
  if (pressure >= 25) return 1.12;
  if (pressure >= 18) return 1.07;
  if (pressure >= 12) return 1.03;
  return 0.98;
}

function getDefenseFactor(goalsAgainst: number) {
  if (goalsAgainst <= 0.8) return 0.92;
  if (goalsAgainst <= 1.2) return 1;
  if (goalsAgainst <= 1.8) return 1.06;
  return 1.12;
}

function getFormFactor(last5For: number) {
  if (last5For >= 10) return 1.10;
  if (last5For >= 7) return 1.05;
  if (last5For >= 5) return 1;
  return 0.96;
}

/* ===========================
   FALLBACK LAMBDA
=========================== */

function adjustLambda(base: number, modifiers: number[]) {
  let adjusted = base;

  for (const m of modifiers) {
    adjusted *= m;
  }

  return clamp(adjusted, 0.4, 2.8);
}

/* ===========================
   🚀 MONTE CARLO
=========================== */

export function runMonteCarlo(data: any) {
  const home = data?.stats?.home || {};
  const away = data?.stats?.away || {};

  /* ===========================
     PRIORIDADE MÁXIMA:
     usar lambdas finais do pipeline
  ============================ */

  const hasPipelineLambdas =
    Number.isFinite(Number(data?.lambdaHome)) &&
    Number.isFinite(Number(data?.lambdaAway));

  let lambdaHome = safe(data?.lambdaHome, NaN);
  let lambdaAway = safe(data?.lambdaAway, NaN);

  /* ===========================
     FALLBACK SECUNDÁRIO
  ============================ */

  if (!hasPipelineLambdas) {
    const baseHome = safe(home.goalsFor, 1.2);
    const baseAway = safe(away.goalsFor, 1.0);

    const homeModifiers = [
      getPressureFactor(safe(home.pressure, 10)),
      getFormFactor(safe(home.last5GoalsFor, 5)),
      getDefenseFactor(safe(away.goalsAgainst, 1.2))
    ];

    const awayModifiers = [
      getPressureFactor(safe(away.pressure, 10)),
      getFormFactor(safe(away.last5GoalsFor, 5)),
      getDefenseFactor(safe(home.goalsAgainst, 1.2))
    ];

    lambdaHome = adjustLambda(baseHome, homeModifiers);
    lambdaAway = adjustLambda(baseAway, awayModifiers);
  }

  /* ===========================
     PROTEÇÃO FINAL
  ============================ */

  lambdaHome = clamp(safe(lambdaHome, 1.2), 0.35, 3.4);
  lambdaAway = clamp(safe(lambdaAway, 1.0), 0.35, 3.4);

  const normalized = normalizeLambdas(lambdaHome, lambdaAway);
  lambdaHome = normalized.home;
  lambdaAway = normalized.away;

  /* ===========================
     MONTE CARLO
  ============================ */

  const result = monteCarloPoisson(lambdaHome, lambdaAway, 15000);

  /* ===========================
     CALIBRAÇÃO FINAL
  ============================ */

  const over25Prob = calibrateProbability(result.over25);
  const over15Prob = calibrateProbability(result.over15);
  const bttsProb = calibrateProbability(result.bttsYes);
  const homeWinProb = calibrateProbability(result.homeWin);
  const drawProb = calibrateProbability(result.draw);
  const awayWinProb = calibrateProbability(result.awayWin);

  /* ===========================
     OUTPUT
  ============================ */

  return {
    over25Prob,
    over15Prob,
    bttsProb,
    homeWinProb,
    drawProb,
    awayWinProb,
    mainProb: over25Prob,

    debug: {
      source: hasPipelineLambdas ? "pipeline_lambdas" : "fallback_rebuild",
      lambdaHome,
      lambdaAway,
      totalLambda: Number((lambdaHome + lambdaAway).toFixed(4))
    }
  };
}