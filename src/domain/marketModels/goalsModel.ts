import { poissonTable } from "../math/poisson";
import { applyDixonColesMatrix } from "../math/dixonColesMatrix";
import { applySampleAdjustment } from "../model/sampleAdjust";
import { calculateDynamicRhoAdvanced } from "../model/rhoCalculator";

import { autoLearningEngine } from "../learning/autoLearningEngine";

function safe(n: any, fallback = 0) {
  const num = Number(n);
  return isNaN(num) ? fallback : num;
}

function normalizeMatrix(matrix: number[][]): number[][] {
  const total = matrix.reduce(
    (acc, row) => acc + row.reduce((s, v) => s + v, 0),
    0
  );

  if (!isFinite(total) || total <= 0) return matrix;

  return matrix.map(row =>
    row.map(v => v / total)
  );
}

function compressHighProbability(p: number): number {
  if (p >= 0.88) return 0.84 + (p - 0.88) * 0.45;
  if (p >= 0.82) return 0.79 + (p - 0.82) * 0.65;
  if (p >= 0.78) return 0.76 + (p - 0.78) * 0.70;
  return p;
}

export function goalsModel(
  lambdaHome: number,
  lambdaAway: number,
  homeStats?: any,
  awayStats?: any
) {
  const maxGoals = 10;

  const lambdaH = safe(lambdaHome, 1.2);
  const lambdaA = safe(lambdaAway, 1.0);

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

  let rho = calculateDynamicRhoAdvanced({
    lambdaHome,
    lambdaAway,
    shotsPressure: homeStats?.pressure,
    shotVolume: homeStats?.shots,
    cardsIntensity: homeStats?.cards
  });

  const learning = autoLearningEngine();

  if (learning?.ready && learning.rhoShift) {
    rho += learning.rhoShift;
  }

  rho = Math.max(-0.15, Math.min(-0.02, rho));

  matrix = applyDixonColesMatrix(
    matrix,
    lambdaH,
    lambdaA,
    rho
  );

  matrix = normalizeMatrix(matrix);

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

  let adjustedOver15 = over15;
  let adjustedOver25 = over25;
  let adjustedOver35 = over35;

  if (homeStats?.matches && awayStats?.matches) {
    const sampleSize = Math.min(
      safe(homeStats.matches, 0),
      safe(awayStats.matches, 0)
    );

    if (sampleSize > 0) {
      adjustedOver15 = applySampleAdjustment(
        over15,
        sampleSize,
        0.72
      );

      adjustedOver25 = applySampleAdjustment(
        over25,
        sampleSize,
        0.50
      );

      adjustedOver35 = applySampleAdjustment(
        over35,
        sampleSize,
        0.32
      );
    }
  }

  adjustedOver15 = compressHighProbability(adjustedOver15);
  adjustedOver25 = Math.max(0.05, Math.min(0.85, adjustedOver25));
  adjustedOver35 = Math.max(0.02, Math.min(0.70, adjustedOver35));

  return {
    matrix,

    over15: adjustedOver15,
    over25: adjustedOver25,
    over35: adjustedOver35,

    under15: 1 - adjustedOver15,
    under25: 1 - adjustedOver25,
    under35: 1 - adjustedOver35,

    meta: {
      rho,
      lambdaHome: lambdaH,
      lambdaAway: lambdaA
    }
  };
}