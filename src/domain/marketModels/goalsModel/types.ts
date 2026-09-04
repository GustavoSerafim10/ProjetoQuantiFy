import { type DixonColesMatrixMeta } from "../../math/dixonColesMatrix";

import { type MODEL_VERSION } from "./constants";

/* ==========================================
   CONTRATOS PÚBLICOS
========================================== */

export interface GoalsModelStats {
  /*
   * Mantidos por compatibilidade com o projeto.
   *
   * Não são aplicados diretamente na matriz para
   * evitar dupla contagem com o lambdaBuilder.
   */
  matches?: number;
  pressure?: number;
  shots?: number;
  cards?: number;

  [key: string]: unknown;
}

export interface ResultMarkets {
  homeWin: number;
  draw: number;
  awayWin: number;
}

export interface GoalMarkets {
  over15: number;
  over25: number;
  under15: number;
  under25: number;
}

export interface BttsMarkets {
  yes: number;
  no: number;
}

export interface CanonicalMarkets {
  homeWin: number;
  draw: number;
  awayWin: number;

  over15: number;
  over25: number;
  under15: number;
  under25: number;

  bttsYes: number;
  bttsNo: number;

  doubleChance1X: number;
  doubleChanceX2: number;
}

export interface MarketDelta {
  homeWin: number;
  draw: number;
  awayWin: number;

  over15: number;
  over25: number;
  under15: number;
  under25: number;

  bttsYes: number;
  bttsNo: number;

  doubleChance1X: number;
  doubleChanceX2: number;
}

export interface LambdaDiagnostics {
  rawHome: unknown;
  rawAway: unknown;

  lambdaHome: number;
  lambdaAway: number;
  totalLambda: number;
  lambdaDifference: number;

  homeInputValid: boolean;
  awayInputValid: boolean;

  homeFallbackUsed: boolean;
  awayFallbackUsed: boolean;
  fallbackUsed: boolean;

  homeClampApplied: boolean;
  awayClampApplied: boolean;
}

export interface RhoBounds {
  mathematicalMinimum: number;
  mathematicalMaximum: number;
  lowerBound: number;
  upperBound: number;
  valid: boolean;
}

export interface RhoDiagnostics {
  rawBaseRho: number;
  baseRho: number;

  rho: number;

  lowerBound: number;
  upperBound: number;

  clampApplied: boolean;
  neutralFallbackUsed: boolean;
}

export interface MatrixInspection {
  rows: number;
  columns: number;
  expectedSize: number;

  shapeValid: boolean;

  nonFiniteCells: number;
  negativeCells: number;
  correctedCells: number;

  rawMass: number;
  sanitizedMass: number;
}

export interface MatrixNormalizationDiagnostics {
  source:
    | "ADJUSTED_MATRIX"
    | "INDEPENDENT_FALLBACK"
    | "EMERGENCY_ZERO_ZERO";

  normalized: boolean;
  fallbackUsed: boolean;
  emergencyFallbackUsed: boolean;

  sourceMass: number;
  normalizedMass: number;
  renormalizationFactor: number;
}

export interface MatrixDiagnostics {
  maxGoals: number;

  independent: MatrixInspection;
  adjusted: MatrixInspection;
  normalization: MatrixNormalizationDiagnostics;

  independentMatrixMass: number;
  adjustedMatrixMass: number;
  normalizedMatrixMass: number;

  independentTailMass: number;
  adjustedMassDelta: number;

  matrixRows: number;
  matrixColumns: number;
  matrixShapeValid: boolean;
}

export interface GoalsModelDebug {
  version: typeof MODEL_VERSION;
  valid: boolean;

  warnings: string[];

  lambda: LambdaDiagnostics;
  rho: RhoDiagnostics;
  matrix: MatrixDiagnostics;
  dixonColesMatrix: DixonColesMatrixMeta;

  independentMarkets: CanonicalMarkets;
  adjustedMarkets: CanonicalMarkets;
  marketDelta: MarketDelta;
}

export interface GoalsModelMeta {
  version: typeof MODEL_VERSION;
  valid: boolean;

  lambdaHome: number;
  lambdaAway: number;
  totalLambda: number;

  maxGoals: number;

  baseRho: number;
  rho: number;

  independentMatrixMass: number;
  adjustedMatrixMass: number;
  normalizedMatrixMass: number;

  lambdaFallbackUsed: boolean;
  matrixFallbackUsed: boolean;
  emergencyFallbackUsed: boolean;

  warnings: string[];

  rhoMeta: RhoDiagnostics;
  matrixDiagnostics: MatrixDiagnostics;
  dixonColesMatrix: DixonColesMatrixMeta;

  independentMarkets: CanonicalMarkets;
  adjustedMarkets: CanonicalMarkets;
  marketDelta: MarketDelta;
}

export interface GoalsModelResult {
  matrix: number[][];

  /*
   * Contrato legado preservado.
   */
  over15: number;
  over25: number;
  under15: number;
  under25: number;

  /*
   * Campos adicionais de auditoria e integração.
   */
  homeWin: number;
  draw: number;
  awayWin: number;

  bttsYes: number;
  bttsNo: number;

  doubleChance1X: number;
  doubleChanceX2: number;

  valid: boolean;
  warnings: string[];

  meta: GoalsModelMeta;
  debug: GoalsModelDebug;
}

/* ==========================================
   CONTRATOS INTERNOS
========================================== */

export interface ParsedNumber {
  value: number;
  valid: boolean;
  fallbackUsed: boolean;
}

export interface SanitizedLambda {
  value: number;
  inputValid: boolean;
  fallbackUsed: boolean;
  clampApplied: boolean;
}

export interface MatrixInspectionResult {
  matrix: number[][];
  diagnostics: MatrixInspection;
}

export interface MatrixNormalizationResult {
  matrix: number[][];
  diagnostics: MatrixNormalizationDiagnostics;
}

export interface RhoCalculationResult {
  bounds: RhoBounds;
  diagnostics: RhoDiagnostics;
}
