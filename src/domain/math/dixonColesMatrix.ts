import { dixonColesAdjustment } from "./dixonColes";

/* ===============================
   APPLY DIXON-COLES (FINAL)
=============================== */

export function applyDixonColesMatrix(
  matrix: number[][],
  lambdaHome: number,
  lambdaAway: number,
  rho: number = -0.08
) {

  if (!matrix || matrix.length === 0) return matrix;

  const maxGoals = matrix.length;

  const adjusted: number[][] = [];

  let total = 0;

  /* ===========================
     🔥 APPLY ADJUSTMENT
  ============================ */

  for (let i = 0; i < maxGoals; i++) {

    adjusted[i] = [];

    for (let j = 0; j < matrix[i].length; j++) {

      const base = matrix[i][j] ?? 0;

      const factor = dixonColesAdjustment(
        i,
        j,
        lambdaHome,
        lambdaAway,
        rho
      );

      const value = Math.max(0, base * factor);

      adjusted[i][j] = value;

      total += value;
    }
  }

  /* ===========================
     🚨 NORMALIZAÇÃO (CRÍTICO)
  ============================ */

  if (total <= 0) return adjusted;

  for (let i = 0; i < maxGoals; i++) {
    for (let j = 0; j < adjusted[i].length; j++) {

      adjusted[i][j] = adjusted[i][j] / total;

      // 🔥 proteção extra
      if (!isFinite(adjusted[i][j])) {
        adjusted[i][j] = 0;
      }
    }
  }

  return adjusted;
}