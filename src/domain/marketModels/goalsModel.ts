import { poissonTable } from "../math/poisson";
import { applyDixonColesMatrix } from "../math/dixonColesMatrix";
import { applySampleAdjustment } from "../model/sampleAdjust";
import { calculateDynamicRhoAdvanced } from "../model/rhoCalculator";

import { autoLearningEngine } from "../learning/autoLearningEngine";

/* ===============================
   SAFE
=============================== */

function safe(n: any, fallback = 0) {
  const num = Number(n);
  return isNaN(num) ? fallback : num;
}

/* ===============================
   GOALS MODEL (FINAL)
=============================== */

export function goalsModel(
  lambdaHome: number,
  lambdaAway: number,
  homeStats?: any,
  awayStats?: any
) {

  const maxGoals = 10;

  const lambdaH = safe(lambdaHome, 1.2);
  const lambdaA = safe(lambdaAway, 1.0);

  /* ===========================
     🔥 POISSON BASE
  ============================ */

  const homeDist = poissonTable(lambdaH, maxGoals);
  const awayDist = poissonTable(lambdaA, maxGoals);

  let matrix: number[][] = [];

  for (let i = 0; i <= maxGoals; i++) {
    matrix[i] = [];

    for (let j = 0; j <= maxGoals; j++) {
      const value = (homeDist[i] ?? 0) * (awayDist[j] ?? 0);
      matrix[i][j] = isFinite(value) ? value : 0;
    }
  }

  /* ===========================
     🔥 RHO DINÂMICO (CORE)
  ============================ */

let rho = calculateDynamicRhoAdvanced({
  lambdaHome,
  lambdaAway,
  shotsPressure: homeStats?.pressure,
  shotVolume: homeStats?.shots,
  cardsIntensity: homeStats?.cards
});

// 🔥 AUTO LEARNING (AJUSTE DINÂMICO)
const learning = autoLearningEngine();

if (learning?.ready && learning.rhoShift) {
  rho += learning.rhoShift;
}

// 🔒 CLAMP FINAL (CRÍTICO)
rho = Math.max(-0.15, Math.min(-0.02, rho));

  /* ===========================
     🔥 DIXON-COLES
  ============================ */

  matrix = applyDixonColesMatrix(
    matrix,
    lambdaH,
    lambdaA,
    rho
  );

  /* ===========================
     📊 MERCADOS
  ============================ */

  let over15 = 0;
  let over25 = 0;
  let over35 = 0;

  for (let i = 0; i <= maxGoals; i++) {
    for (let j = 0; j <= maxGoals; j++) {

      const prob = matrix[i][j] ?? 0;
      const total = i + j;

      if (total > 1) over15 += prob;
      if (total > 2) over25 += prob;
      if (total > 3) over35 += prob;
    }
  }

  /* ===========================
     🔧 SAMPLE ADJUSTMENT
  ============================ */

  let adjustedOver25 = over25;

  if (homeStats?.matches && awayStats?.matches) {

    const sampleSize = Math.min(
      safe(homeStats.matches, 0),
      safe(awayStats.matches, 0)
    );

    if (sampleSize > 0) {
      adjustedOver25 = applySampleAdjustment(
        over25,
        sampleSize,
        0.5
      );
    }
  }

  /* ===========================
     🏁 OUTPUT
  ============================ */

  return {
    matrix,

    over15,
    over25: adjustedOver25,
    over35,

    under15: 1 - over15,
    under25: 1 - adjustedOver25,
    under35: 1 - over35,

    // 🔥 DEBUG / CONTROLE (NÍVEL PRO)
    meta: {
      rho,
      lambdaHome: lambdaH,
      lambdaAway: lambdaA
    }
  };
}