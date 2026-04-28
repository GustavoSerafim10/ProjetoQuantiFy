/* ===============================
   DIXON-COLES ADJUSTMENT (PRO)
=============================== */

function clamp(value: number, min = 0.85, max = 1.15) {
  if (!Number.isFinite(value)) return 1;
  return Math.max(min, Math.min(max, value));
}

function safeRho(rho: number) {
  // faixa segura realista para futebol
  return Math.max(-0.25, Math.min(0.05, rho));
}

export function dixonColesAdjustment(
  homeGoals: number,
  awayGoals: number,
  lambdaHome: number,
  lambdaAway: number,
  rhoInput: number
): number {

  const rho = safeRho(rhoInput);

  let adjustment = 1;

  /* ===============================
     CORE DIXON-COLES
  =============================== */

  if (homeGoals === 0 && awayGoals === 0) {
    adjustment = 1 - (lambdaHome * lambdaAway * rho);
  }

  else if (homeGoals === 0 && awayGoals === 1) {
    adjustment = 1 + (lambdaHome * rho);
  }

  else if (homeGoals === 1 && awayGoals === 0) {
    adjustment = 1 + (lambdaAway * rho);
  }

  else if (homeGoals === 1 && awayGoals === 1) {
    adjustment = 1 - rho;
  }

  /* ===============================
     PROTEÇÃO FINAL (CRÍTICO)
  =============================== */

  return clamp(adjustment);
}