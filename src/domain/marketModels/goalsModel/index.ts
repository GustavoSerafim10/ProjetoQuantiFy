import { poissonTable } from "../../math/poisson";
import {
  applyDixonColesMatrixDetailed
} from "../../math/dixonColesMatrix";

import { DEFAULT_HOME_LAMBDA, DEFAULT_AWAY_LAMBDA, MODEL_VERSION } from "./constants";
import { buildIndependentMatrix } from "./independentMatrix";
import { sanitizeLambda, createLambdaDiagnostics } from "./lambdaValidation";
import { calculateMarketDelta, calculateMarkets, roundMarkets } from "./marketExtraction";
import { createMatrixDiagnostics } from "./matrixDiagnostics";
import { calculateMaxGoals } from "./matrixDimension";
import { inspectAndSanitizeMatrix, normalizeMatrixWithDiagnostics } from "./matrixNormalization";
import { roundNumber } from "./numericHelpers";
import { calculateRho } from "./rho";
import {
  type GoalsModelDebug,
  type GoalsModelMeta,
  type GoalsModelResult,
  type GoalsModelStats
} from "./types";
import { buildWarnings, determineModelValidity } from "./warnings";

export * from "./types";

/* ==========================================
   GOALS MODEL — QUANTIFY V7.1 ELITE
========================================== */

/*
 * Responsabilidade:
 *
 * - receber os lambdas calculados pelo lambdaBuilder;
 * - validar estruturalmente as entradas;
 * - construir a matriz Poisson independente;
 * - aplicar Dixon-Coles uma única vez;
 * - normalizar e auditar a matriz final;
 * - extrair 1X2, gols, BTTS e dupla chance;
 * - mostrar o impacto exato do rho;
 * - sinalizar qualquer fallback estrutural.
 *
 * Este arquivo não:
 *
 * - reconstrói lambdas;
 * - utiliza odds;
 * - calcula EV;
 * - escolhe mercado;
 * - define stake;
 * - toma decisão de aposta.
 */

/* ==========================================
   GOALS MODEL V7.1 ELITE
========================================== */

export function goalsModel(
  lambdaHome: number,
  lambdaAway: number,
  _homeStats?: GoalsModelStats,
  _awayStats?: GoalsModelStats
): GoalsModelResult {
  /* ==========================================
     1. LAMBDAS
  ========================================== */

  const sanitizedHome =
    sanitizeLambda(
      lambdaHome,
      DEFAULT_HOME_LAMBDA
    );

  const sanitizedAway =
    sanitizeLambda(
      lambdaAway,
      DEFAULT_AWAY_LAMBDA
    );

  const lambdaH =
    sanitizedHome.value;

  const lambdaA =
    sanitizedAway.value;

  const lambdaDiagnostics =
    createLambdaDiagnostics(
      lambdaHome,
      lambdaAway,
      sanitizedHome,
      sanitizedAway
    );

  const maxGoals =
    calculateMaxGoals(
      lambdaH,
      lambdaA
    );

  const expectedSize =
    maxGoals + 1;

  /* ==========================================
     2. DISTRIBUIÇÕES POISSON
  ========================================== */

  const homeDistribution =
    poissonTable(
      lambdaH,
      maxGoals
    );

  const awayDistribution =
    poissonTable(
      lambdaA,
      maxGoals
    );

  const rawIndependentMatrix =
    buildIndependentMatrix(
      homeDistribution,
      awayDistribution,
      maxGoals
    );

  const independentInspection =
    inspectAndSanitizeMatrix(
      rawIndependentMatrix,
      expectedSize
    );

  const normalizedIndependent =
    normalizeMatrixWithDiagnostics(
      independentInspection.matrix,
      independentInspection.matrix,
      expectedSize
    ).matrix;

  const independentMarkets =
    roundMarkets(
      calculateMarkets(
        normalizedIndependent
      )
    );

  /* ==========================================
     3. RHO
  ========================================== */

  const rhoCalculation =
    calculateRho(
      lambdaH,
      lambdaA
    );

  const rhoDiagnostics =
    rhoCalculation.diagnostics;

  /* ==========================================
     4. DIXON-COLES
  ========================================== */

  let dixonColesResult:
    ReturnType<
      typeof applyDixonColesMatrixDetailed
    >;

  try {
    dixonColesResult =
      applyDixonColesMatrixDetailed(
        independentInspection.matrix,
        lambdaH,
        lambdaA,
        rhoDiagnostics.rho
      );
  } catch {
    /*
     * O módulo detalhado já possui fallback interno.
     * Este catch protege apenas contra falha externa
     * inesperada de execução/importação.
     */
    dixonColesResult =
      applyDixonColesMatrixDetailed(
        independentInspection.matrix,
        lambdaH,
        lambdaA,
        0
      );
  }

  /*
   * Auditamos a matriz bruta, antes da normalização
   * interna do módulo Dixon-Coles.
   */
  const adjustedInspection =
    inspectAndSanitizeMatrix(
      dixonColesResult
        .rawAdjustedMatrix,
      expectedSize
    );

  /*
   * O GoalsModel continua sendo a autoridade final
   * de normalização e fallback da matriz consumida.
   */
  const normalization =
    normalizeMatrixWithDiagnostics(
      adjustedInspection.matrix,
      independentInspection.matrix,
      expectedSize
    );

  const matrix =
    normalization.matrix;

  /* ==========================================
     5. MERCADOS E DELTAS
  ========================================== */

  const adjustedMarkets =
    roundMarkets(
      calculateMarkets(
        matrix
      )
    );

  const marketDelta =
    calculateMarketDelta(
      independentMarkets,
      adjustedMarkets
    );

  /* ==========================================
     6. DIAGNÓSTICOS
  ========================================== */

  const matrixDiagnostics =
    createMatrixDiagnostics(
      maxGoals,
      independentInspection
        .diagnostics,
      adjustedInspection
        .diagnostics,
      normalization
        .diagnostics,
      matrix
    );

  const warnings =
    Array.from(
      new Set([
        ...buildWarnings(
          lambdaDiagnostics,
          rhoDiagnostics,
          matrixDiagnostics
        ),
        ...dixonColesResult
          .meta
          .warnings
      ])
    );

  const valid =
    determineModelValidity(
      lambdaDiagnostics,
      matrixDiagnostics
    );

  const debug:
    GoalsModelDebug = {
      version:
        MODEL_VERSION,

      valid,

      warnings,

      lambda:
        lambdaDiagnostics,

      rho:
        rhoDiagnostics,

      matrix:
        matrixDiagnostics,

      dixonColesMatrix:
        dixonColesResult.meta,

      independentMarkets,

      adjustedMarkets,

      marketDelta
    };

  const meta:
    GoalsModelMeta = {
      version:
        MODEL_VERSION,

      valid,

      lambdaHome:
        roundNumber(lambdaH),

      lambdaAway:
        roundNumber(lambdaA),

      totalLambda:
        roundNumber(
          lambdaH + lambdaA
        ),

      maxGoals,

      baseRho:
        rhoDiagnostics.baseRho,

      learningRhoShift:
        rhoDiagnostics
          .learningRhoShift,

      rho:
        rhoDiagnostics.rho,

      independentMatrixMass:
        matrixDiagnostics
          .independentMatrixMass,

      adjustedMatrixMass:
        matrixDiagnostics
          .adjustedMatrixMass,

      normalizedMatrixMass:
        matrixDiagnostics
          .normalizedMatrixMass,

      lambdaFallbackUsed:
        lambdaDiagnostics
          .fallbackUsed,

      matrixFallbackUsed:
        normalization
          .diagnostics
          .fallbackUsed,

      emergencyFallbackUsed:
        normalization
          .diagnostics
          .emergencyFallbackUsed,

      warnings,

      rhoMeta:
        rhoDiagnostics,

      matrixDiagnostics,

      dixonColesMatrix:
        dixonColesResult.meta,

      independentMarkets,

      adjustedMarkets,

      marketDelta
    };

  /* ==========================================
     7. RESULTADO
  ========================================== */

  return {
    matrix,

    /*
     * Contrato legado.
     */
    over15:
      adjustedMarkets.over15,

    over25:
      adjustedMarkets.over25,

    under15:
      adjustedMarkets.under15,

    under25:
      adjustedMarkets.under25,

    /*
     * Mercados adicionais.
     */
    homeWin:
      adjustedMarkets.homeWin,

    draw:
      adjustedMarkets.draw,

    awayWin:
      adjustedMarkets.awayWin,

    bttsYes:
      adjustedMarkets.bttsYes,

    bttsNo:
      adjustedMarkets.bttsNo,

    doubleChance1X:
      adjustedMarkets
        .doubleChance1X,

    doubleChanceX2:
      adjustedMarkets
        .doubleChanceX2,

    valid,
    warnings,

    meta,
    debug
  };
}
