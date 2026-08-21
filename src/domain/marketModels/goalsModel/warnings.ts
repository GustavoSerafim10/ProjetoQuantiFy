import { approximatelyEqual } from "./numericHelpers";
import { type LambdaDiagnostics, type MatrixDiagnostics, type RhoDiagnostics } from "./types";

/* ==========================================
   WARNINGS E VALIDADE
========================================== */

export function buildWarnings(
  lambda:
    LambdaDiagnostics,
  rho:
    RhoDiagnostics,
  matrix:
    MatrixDiagnostics
): string[] {
  const warnings: string[] = [];

  if (!lambda.homeInputValid) {
    warnings.push(
      "INVALID_HOME_LAMBDA_INPUT"
    );
  }

  if (!lambda.awayInputValid) {
    warnings.push(
      "INVALID_AWAY_LAMBDA_INPUT"
    );
  }

  if (lambda.homeFallbackUsed) {
    warnings.push(
      "HOME_LAMBDA_FALLBACK_USED"
    );
  }

  if (lambda.awayFallbackUsed) {
    warnings.push(
      "AWAY_LAMBDA_FALLBACK_USED"
    );
  }

  if (lambda.homeClampApplied) {
    warnings.push(
      "HOME_LAMBDA_CLAMP_APPLIED"
    );
  }

  if (lambda.awayClampApplied) {
    warnings.push(
      "AWAY_LAMBDA_CLAMP_APPLIED"
    );
  }

  if (rho.clampApplied) {
    warnings.push(
      "RHO_CLAMP_APPLIED"
    );
  }

  if (rho.neutralFallbackUsed) {
    warnings.push(
      "RHO_NEUTRAL_FALLBACK_USED"
    );
  }

  if (
    matrix.independent
      .correctedCells > 0
  ) {
    warnings.push(
      "INDEPENDENT_MATRIX_SANITIZED"
    );
  }

  if (
    matrix.adjusted
      .correctedCells > 0
  ) {
    warnings.push(
      "DIXON_COLES_MATRIX_SANITIZED"
    );
  }

  if (
    !matrix.independent
      .shapeValid
  ) {
    warnings.push(
      "INVALID_INDEPENDENT_MATRIX_SHAPE"
    );
  }

  if (
    !matrix.adjusted
      .shapeValid
  ) {
    warnings.push(
      "INVALID_ADJUSTED_MATRIX_SHAPE"
    );
  }

  if (
    matrix.normalization
      .fallbackUsed
  ) {
    warnings.push(
      "MATRIX_NORMALIZATION_FALLBACK_USED"
    );
  }

  if (
    matrix.normalization
      .emergencyFallbackUsed
  ) {
    warnings.push(
      "MATRIX_EMERGENCY_ZERO_ZERO_USED"
    );
  }

  if (
    !approximatelyEqual(
      matrix.normalizedMatrixMass,
      1,
      1e-6
    )
  ) {
    warnings.push(
      "NORMALIZED_MATRIX_MASS_NOT_ONE"
    );
  }

  return warnings;
}

export function determineModelValidity(
  lambda:
    LambdaDiagnostics,
  matrix:
    MatrixDiagnostics
): boolean {
  /*
   * Um fallback numérico mantém o sistema vivo,
   * mas não deve ser tratado como previsão
   * plenamente válida para aposta.
   */
  if (lambda.fallbackUsed) {
    return false;
  }

  if (
    matrix.normalization
      .emergencyFallbackUsed
  ) {
    return false;
  }

  if (!matrix.matrixShapeValid) {
    return false;
  }

  if (
    !approximatelyEqual(
      matrix.normalizedMatrixMass,
      1,
      1e-6
    )
  ) {
    return false;
  }

  return true;
}
