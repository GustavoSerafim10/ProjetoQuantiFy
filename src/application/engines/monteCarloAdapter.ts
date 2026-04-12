import { monteCarloPoisson } from "../../domain/simulation/monteCarloPoisson";

/* ===========================
   HELPERS
=========================== */

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(n, max));
}

/* 🔥 ANTI-PROB IRREAL */
function calibrateProbability(p: number) {
  if (p > 0.90) return 0.90;
  if (p < 0.05) return 0.05;
  return p;
}

/* 🔥 NORMALIZA TOTAL DE GOLS */
function normalizeLambdas(home: number, away: number) {
  const total = home + away;

  const MAX_TOTAL = 2.8; // 🔥 chave do equilíbrio

  if (total <= MAX_TOTAL) return { home, away };

  const scale = MAX_TOTAL / total;

  return {
    home: home * scale,
    away: away * scale
  };
}

/* ===========================
   MODIFIERS (SUAVIZADOS)
=========================== */

function getPressureFactor(pressure: number) {
  if (pressure >= 25) return 1.15;
  if (pressure >= 18) return 1.08;
  if (pressure >= 12) return 1.03;
  return 0.97;
}

function getDefenseFactor(goalsAgainst: number) {
  if (goalsAgainst <= 0.8) return 0.90;
  if (goalsAgainst <= 1.2) return 1;
  if (goalsAgainst <= 1.8) return 1.08;
  return 1.15;
}

function getFormFactor(last5For: number) {
  if (last5For >= 10) return 1.12;
  if (last5For >= 7) return 1.05;
  if (last5For >= 5) return 1;
  return 0.95;
}

/* ===========================
   LAMBDA
=========================== */

function adjustLambda(base: number, modifiers: number[]) {
  let adjusted = base;

  for (const m of modifiers) {
    adjusted *= m;
  }

  return clamp(adjusted, 0.4, 2.2);
}

/* ===========================
   🚀 MONTE CARLO
=========================== */

export function runMonteCarlo(data: any) {

  const home = data.stats.home;
  const away = data.stats.away;

  /* ===========================
     BASE
  ============================ */

  const baseHome = home.goalsFor || 1.2;
  const baseAway = away.goalsFor || 1.2;

  /* ===========================
     MODIFIERS
  ============================ */

  const homeModifiers = [
    getPressureFactor(home.pressure || 10),
    getFormFactor(home.last5GoalsFor || 5),
    getDefenseFactor(away.goalsAgainst || 1.2)
  ];

  const awayModifiers = [
    getPressureFactor(away.pressure || 10),
    getFormFactor(away.last5GoalsFor || 5),
    getDefenseFactor(home.goalsAgainst || 1.2)
  ];

  /* ===========================
     LAMBDA BRUTO
  ============================ */

  let lambdaHome = adjustLambda(baseHome, homeModifiers);
  let lambdaAway = adjustLambda(baseAway, awayModifiers);

  /* ===========================
     🔥 NORMALIZAÇÃO GLOBAL
  ============================ */

  const normalized = normalizeLambdas(lambdaHome, lambdaAway);

  lambdaHome = normalized.home;
  lambdaAway = normalized.away;

  /* ===========================
     MONTE CARLO
  ============================ */

  const result = monteCarloPoisson(lambdaHome, lambdaAway, 15000);

  /* ===========================
     🔥 CALIBRAÇÃO FINAL
  ============================ */

  const over25Prob = calibrateProbability(result.over25);
  const bttsProb = calibrateProbability(result.bttsYes);
  const homeWinProb = calibrateProbability(result.homeWin);
  const drawProb = calibrateProbability(result.draw);
  const awayWinProb = calibrateProbability(result.awayWin);

  /* ===========================
     OUTPUT
  ============================ */

  return {
    over25Prob,
    over15Prob: result.over15, // 🔥 ADICIONA ISSO

    bttsProb,
    homeWinProb,
    drawProb,
    awayWinProb,
    
    mainProb: over25Prob,

    debug: {
      lambdaHome,
      lambdaAway,
      totalLambda: lambdaHome + lambdaAway
    }
  };
}