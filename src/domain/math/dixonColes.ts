/* ===============================
   DIXON-COLES ADJUSTMENT (FINAL)
=============================== */

export function dixonColesAdjustment(
  homeGoals: number,
  awayGoals: number,
  lambdaHome: number,
  lambdaAway: number,
  rho: number
): number {

  // 🔥 Correção para placares baixos (core do modelo)

  if (homeGoals === 0 && awayGoals === 0) {
    return 1 - (lambdaHome * lambdaAway * rho);
  }

  if (homeGoals === 0 && awayGoals === 1) {
    return 1 + (lambdaHome * rho);
  }

  if (homeGoals === 1 && awayGoals === 0) {
    return 1 + (lambdaAway * rho);
  }

  if (homeGoals === 1 && awayGoals === 1) {
    return 1 - rho;
  }

  // 🔥 Fora disso → sem ajuste
  return 1;
}