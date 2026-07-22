/* ==========================================
   DIXON-COLES ADJUSTMENT — V7
========================================== */

/*
 * Esta função possui somente uma responsabilidade:
 *
 * calcular o fator tau de Dixon-Coles para os
 * placares de baixa contagem:
 *
 * 0–0
 * 0–1
 * 1–0
 * 1–1
 *
 * Para todos os demais placares, o fator é 1.
 */

const EPSILON = 1e-10;

/* ==========================================
   UTILITÁRIOS
========================================== */

function clamp(
  value: number,
  min: number,
  max: number
): number {
  return Math.max(
    min,
    Math.min(max, value)
  );
}

function safeNumber(
  value: unknown,
  fallback: number
): number {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
}

function sanitizeLambda(
  value: unknown,
  fallback: number
): number {
  const parsed =
    safeNumber(value, fallback);

  /*
   * O lambda precisa ser estritamente positivo
   * para o cálculo dos limites matemáticos do rho.
   *
   * Normalmente o lambdaBuilder já garante
   * valores iguais ou superiores a 0.20.
   */
  return Math.max(
    parsed,
    EPSILON
  );
}

function sanitizeGoals(
  value: unknown
): number {
  const parsed =
    safeNumber(value, -1);

  if (
    parsed < 0 ||
    !Number.isInteger(parsed)
  ) {
    return -1;
  }

  return parsed;
}

/* ==========================================
   LIMITES MATEMÁTICOS DO RHO
========================================== */

function constrainRho(
  rhoInput: unknown,
  lambdaHome: number,
  lambdaAway: number
): number {
  const rho =
    safeNumber(rhoInput, 0);

  /*
   * Para manter positivos os fatores:
   *
   * tau(0,1) = 1 + lambdaHome * rho
   * tau(1,0) = 1 + lambdaAway * rho
   */
  const lowerBound =
    Math.max(
      -1 / lambdaHome,
      -1 / lambdaAway
    ) + EPSILON;

  /*
   * Para manter positivos:
   *
   * tau(0,0) = 1 - lambdaHome * lambdaAway * rho
   * tau(1,1) = 1 - rho
   */
  const upperBound =
    Math.min(
      1,
      1 /
        (
          lambdaHome *
          lambdaAway
        )
    ) - EPSILON;

  /*
   * Em um cenário numericamente inconsistente,
   * rho neutro preserva a matriz Poisson.
   */
  if (
    !Number.isFinite(lowerBound) ||
    !Number.isFinite(upperBound) ||
    lowerBound > upperBound
  ) {
    return 0;
  }

  return clamp(
    rho,
    lowerBound,
    upperBound
  );
}

/* ==========================================
   DIXON-COLES CORE
========================================== */

export function dixonColesAdjustment(
  homeGoals: number,
  awayGoals: number,
  lambdaHome: number,
  lambdaAway: number,
  rhoInput: number
): number {
  const safeHomeGoals =
    sanitizeGoals(homeGoals);

  const safeAwayGoals =
    sanitizeGoals(awayGoals);

  /*
   * Entrada de placar inválida:
   * retornamos fator neutro para não contaminar
   * a matriz com NaN ou Infinity.
   */
  if (
    safeHomeGoals < 0 ||
    safeAwayGoals < 0
  ) {
    return 1;
  }

  /*
   * Dixon-Coles altera apenas os quatro placares
   * de baixa contagem.
   */
  const isLowScoreCell =
    (
      safeHomeGoals === 0 ||
      safeHomeGoals === 1
    ) &&
    (
      safeAwayGoals === 0 ||
      safeAwayGoals === 1
    );

  if (!isLowScoreCell) {
    return 1;
  }

  const safeLambdaHome =
    sanitizeLambda(
      lambdaHome,
      1.32
    );

  const safeLambdaAway =
    sanitizeLambda(
      lambdaAway,
      1.23
    );

  const rho =
    constrainRho(
      rhoInput,
      safeLambdaHome,
      safeLambdaAway
    );

  let adjustment = 1;

  /* ==========================================
     CORE DIXON-COLES
  ========================================== */

  if (
    safeHomeGoals === 0 &&
    safeAwayGoals === 0
  ) {
    adjustment =
      1 -
      (
        safeLambdaHome *
        safeLambdaAway *
        rho
      );
  } else if (
    safeHomeGoals === 0 &&
    safeAwayGoals === 1
  ) {
    adjustment =
      1 +
      (
        safeLambdaHome *
        rho
      );
  } else if (
    safeHomeGoals === 1 &&
    safeAwayGoals === 0
  ) {
    adjustment =
      1 +
      (
        safeLambdaAway *
        rho
      );
  } else if (
    safeHomeGoals === 1 &&
    safeAwayGoals === 1
  ) {
    adjustment =
      1 - rho;
  }

  /* ==========================================
     PROTEÇÃO FINAL
  ========================================== */

  /*
   * Não aplicamos clamp arbitrário como 0.85–1.15.
   *
   * O rho já foi limitado matematicamente para
   * preservar fatores positivos.
   */
  if (
    !Number.isFinite(adjustment) ||
    adjustment <= 0
  ) {
    return 1;
  }

  return adjustment;
}