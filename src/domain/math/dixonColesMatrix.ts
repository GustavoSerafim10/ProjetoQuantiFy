import { dixonColesAdjustment } from "./dixonColes";

/* ==========================================
   DIXON-COLES MATRIX — QUANTIFY V7.1 ELITE
========================================== */

/*
 * Responsabilidade:
 *
 * - receber uma matriz de probabilidades;
 * - validar e sanitizar a estrutura;
 * - aplicar o fator tau célula por célula;
 * - preservar a matriz bruta ajustada para auditoria;
 * - normalizar a distribuição final;
 * - informar qualquer fallback ou correção;
 * - nunca alterar a matriz original.
 *
 * Compatibilidade:
 *
 * - applyDixonColesMatrixDetailed(): API detalhada V7.1;
 * - applyDixonColesMatrix(): wrapper legado que retorna number[][].
 */

const VERSION = "V7.1_ELITE" as const;
const EPSILON = 1e-12;
const ROUND_DECIMALS = 10;

/* ==========================================
   TIPOS PÚBLICOS
========================================== */

export interface DixonColesMatrixInspection {
  rows: number;
  columns: number;
  expectedSize: number;

  shapeValid: boolean;

  nonFiniteCells: number;
  negativeCells: number;
  missingCells: number;
  correctedCells: number;

  rawMass: number;
  sanitizedMass: number;
}

export interface DixonColesMatrixMeta {
  version: typeof VERSION;

  valid: boolean;
  normalized: boolean;

  fallbackUsed: boolean;
  emergencyFallbackUsed: boolean;

  source:
    | "DIXON_COLES_ADJUSTED"
    | "ORIGINAL_MATRIX_FALLBACK"
    | "EMERGENCY_ZERO_ZERO";

  inputMass: number;
  rawAdjustedMass: number;
  normalizedMass: number;
  renormalizationFactor: number;
  massDelta: number;

  lambdaHome: number;
  lambdaAway: number;
  rho: number;

  inputInspection: DixonColesMatrixInspection;
  adjustedInspection: DixonColesMatrixInspection;

  warnings: string[];
}

export interface DixonColesMatrixResult {
  /*
   * Matriz final normalizada para consumo do modelo.
   */
  matrix: number[][];

  /*
   * Matriz após tau e antes da normalização.
   * É esta matriz que o GoalsModel deve auditar.
   */
  rawAdjustedMatrix: number[][];

  /*
   * Cópia sanitizada da matriz recebida.
   */
  sanitizedInputMatrix: number[][];

  meta: DixonColesMatrixMeta;
}

/* ==========================================
   TIPOS INTERNOS
========================================== */

interface ParsedNumber {
  value: number;
  valid: boolean;
  fallbackUsed: boolean;
}

interface MatrixInspectionResult {
  matrix: number[][];
  inspection: DixonColesMatrixInspection;
}

interface NormalizationResult {
  matrix: number[][];
  normalized: boolean;
  mass: number;
  factor: number;
}

/* ==========================================
   HELPERS NUMÉRICOS
========================================== */

function isMissingNumericValue(
  value: unknown
): boolean {
  return (
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value === "boolean"
  );
}

function parseFiniteNumber(
  value: unknown,
  fallback: number
): ParsedNumber {
  if (isMissingNumericValue(value)) {
    return {
      value: fallback,
      valid: false,
      fallbackUsed: true
    };
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return {
      value: fallback,
      valid: false,
      fallbackUsed: true
    };
  }

  return {
    value: parsed,
    valid: true,
    fallbackUsed: false
  };
}

function safeNumber(
  value: unknown,
  fallback = 0
): number {
  return parseFiniteNumber(
    value,
    fallback
  ).value;
}

function sanitizeProbability(
  value: unknown
): number {
  const parsed =
    parseFiniteNumber(
      value,
      0
    );

  if (!parsed.valid) {
    return 0;
  }

  return parsed.value > 0
    ? parsed.value
    : 0;
}

function roundNumber(
  value: number,
  decimals = ROUND_DECIMALS
): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const factor = 10 ** decimals;

  return (
    Math.round(value * factor) /
    factor
  );
}

/* ==========================================
   ESTRUTURA DA MATRIZ
========================================== */

function determineExpectedSize(
  matrix: number[][]
): number {
  if (
    !Array.isArray(matrix) ||
    matrix.length === 0
  ) {
    return 1;
  }

  const widestRow =
    matrix.reduce(
      (maximum, row) =>
        Array.isArray(row)
          ? Math.max(
              maximum,
              row.length
            )
          : maximum,
      0
    );

  return Math.max(
    matrix.length,
    widestRow,
    1
  );
}

function calculateMatrixMass(
  matrix: number[][]
): number {
  let total = 0;

  for (const row of matrix) {
    if (!Array.isArray(row)) {
      continue;
    }

    for (const value of row) {
      const probability =
        sanitizeProbability(value);

      total += probability;
    }
  }

  return Number.isFinite(total)
    ? total
    : 0;
}

function inspectAndSanitizeMatrix(
  matrix: number[][],
  expectedSize: number
): MatrixInspectionResult {
  const source =
    Array.isArray(matrix)
      ? matrix
      : [];

  const rows =
    source.length;

  const columns =
    rows > 0 &&
    Array.isArray(source[0])
      ? source[0].length
      : 0;

  const shapeValid =
    rows === expectedSize &&
    source.every(
      row =>
        Array.isArray(row) &&
        row.length === expectedSize
    );

  let nonFiniteCells = 0;
  let negativeCells = 0;
  let missingCells = 0;
  let correctedCells = 0;
  let rawMass = 0;

  const sanitized =
    Array.from(
      { length: expectedSize },
      (_, rowIndex) =>
        Array.from(
          { length: expectedSize },
          (_, columnIndex) => {
            const row =
              source[rowIndex];

            if (
              !Array.isArray(row) ||
              columnIndex >= row.length
            ) {
              missingCells++;
              correctedCells++;
              return 0;
            }

            const raw =
              row[columnIndex];

            const parsed =
              Number(raw);

            if (!Number.isFinite(parsed)) {
              nonFiniteCells++;
              correctedCells++;
              return 0;
            }

            rawMass += parsed;

            if (parsed < 0) {
              negativeCells++;
              correctedCells++;
              return 0;
            }

            return parsed;
          }
        )
    );

  return {
    matrix: sanitized,

    inspection: {
      rows,
      columns,
      expectedSize,

      shapeValid,

      nonFiniteCells,
      negativeCells,
      missingCells,
      correctedCells,

      rawMass:
        roundNumber(rawMass),

      sanitizedMass:
        roundNumber(
          calculateMatrixMass(
            sanitized
          )
        )
    }
  };
}

/* ==========================================
   NORMALIZAÇÃO E FALLBACK
========================================== */

function normalizeMatrix(
  matrix: number[][]
): NormalizationResult {
  const mass =
    calculateMatrixMass(matrix);

  if (
    !Number.isFinite(mass) ||
    mass <= EPSILON
  ) {
    return {
      matrix: [],
      normalized: false,
      mass: 0,
      factor: 0
    };
  }

  const factor =
    1 / mass;

  const normalized =
    matrix.map(
      row =>
        row.map(
          value => {
            const probability =
              sanitizeProbability(value);

            const result =
              probability * factor;

            return Number.isFinite(result)
              ? result
              : 0;
          }
        )
    );

  return {
    matrix: normalized,
    normalized: true,
    mass:
      calculateMatrixMass(
        normalized
      ),
    factor
  };
}

function buildEmergencyZeroZeroMatrix(
  expectedSize: number
): number[][] {
  return Array.from(
    { length: expectedSize },
    (_, rowIndex) =>
      Array.from(
        { length: expectedSize },
        (_, columnIndex) =>
          rowIndex === 0 &&
          columnIndex === 0
            ? 1
            : 0
      )
  );
}

/* ==========================================
   WARNINGS
========================================== */

function buildWarnings(
  inputInspection:
    DixonColesMatrixInspection,
  adjustedInspection:
    DixonColesMatrixInspection,
  lambdaHomeValid: boolean,
  lambdaAwayValid: boolean,
  rhoValid: boolean,
  source:
    DixonColesMatrixMeta["source"]
): string[] {
  const warnings: string[] = [];

  if (!lambdaHomeValid) {
    warnings.push(
      "INVALID_HOME_LAMBDA_INPUT"
    );
  }

  if (!lambdaAwayValid) {
    warnings.push(
      "INVALID_AWAY_LAMBDA_INPUT"
    );
  }

  if (!rhoValid) {
    warnings.push(
      "INVALID_RHO_INPUT"
    );
  }

  if (!inputInspection.shapeValid) {
    warnings.push(
      "INVALID_INPUT_MATRIX_SHAPE"
    );
  }

  if (
    inputInspection.correctedCells > 0
  ) {
    warnings.push(
      "INPUT_MATRIX_SANITIZED"
    );
  }

  if (!adjustedInspection.shapeValid) {
    warnings.push(
      "INVALID_ADJUSTED_MATRIX_SHAPE"
    );
  }

  if (
    adjustedInspection.correctedCells > 0
  ) {
    warnings.push(
      "ADJUSTED_MATRIX_SANITIZED"
    );
  }

  if (
    source ===
    "ORIGINAL_MATRIX_FALLBACK"
  ) {
    warnings.push(
      "DIXON_COLES_FALLBACK_TO_INPUT"
    );
  }

  if (
    source ===
    "EMERGENCY_ZERO_ZERO"
  ) {
    warnings.push(
      "DIXON_COLES_EMERGENCY_ZERO_ZERO"
    );
  }

  return warnings;
}

/* ==========================================
   APPLY DIXON-COLES — DETALHADO
========================================== */

export function applyDixonColesMatrixDetailed(
  matrix: number[][],
  lambdaHome: number,
  lambdaAway: number,
  rho = 0
): DixonColesMatrixResult {
  const expectedSize =
    determineExpectedSize(matrix);

  const inputInspection =
    inspectAndSanitizeMatrix(
      matrix,
      expectedSize
    );

  const parsedLambdaHome =
    parseFiniteNumber(
      lambdaHome,
      1.32
    );

  const parsedLambdaAway =
    parseFiniteNumber(
      lambdaAway,
      1.23
    );

  const parsedRho =
    parseFiniteNumber(
      rho,
      0
    );

  const safeLambdaHome =
    Math.max(
      parsedLambdaHome.value,
      EPSILON
    );

  const safeLambdaAway =
    Math.max(
      parsedLambdaAway.value,
      EPSILON
    );

  const safeRho =
    parsedRho.value;

  const rawAdjustedMatrix =
    inputInspection.matrix.map(
      (row, homeGoals) =>
        row.map(
          (
            baseProbability,
            awayGoals
          ) => {
            const factor =
              dixonColesAdjustment(
                homeGoals,
                awayGoals,
                safeLambdaHome,
                safeLambdaAway,
                safeRho
              );

            const safeFactor =
              safeNumber(
                factor,
                1
              );

            const rawAdjusted =
              baseProbability *
              safeFactor;

            return (
              Number.isFinite(
                rawAdjusted
              ) &&
              rawAdjusted >= 0
            )
              ? rawAdjusted
              : 0;
          }
        )
    );

  const adjustedInspection =
    inspectAndSanitizeMatrix(
      rawAdjustedMatrix,
      expectedSize
    );

  const adjustedNormalization =
    normalizeMatrix(
      adjustedInspection.matrix
    );

  let finalMatrix:
    number[][];

  let source:
    DixonColesMatrixMeta["source"];

  let fallbackUsed = false;
  let emergencyFallbackUsed = false;
  let renormalizationFactor = 0;

  if (adjustedNormalization.normalized) {
    finalMatrix =
      adjustedNormalization.matrix;

    source =
      "DIXON_COLES_ADJUSTED";

    renormalizationFactor =
      adjustedNormalization.factor;
  } else {
    const inputNormalization =
      normalizeMatrix(
        inputInspection.matrix
      );

    fallbackUsed = true;

    if (inputNormalization.normalized) {
      finalMatrix =
        inputNormalization.matrix;

      source =
        "ORIGINAL_MATRIX_FALLBACK";

      renormalizationFactor =
        inputNormalization.factor;
    } else {
      finalMatrix =
        buildEmergencyZeroZeroMatrix(
          expectedSize
        );

      source =
        "EMERGENCY_ZERO_ZERO";

      emergencyFallbackUsed = true;
    }
  }

  const inputMass =
    inputInspection
      .inspection
      .sanitizedMass;

  const rawAdjustedMass =
    adjustedInspection
      .inspection
      .sanitizedMass;

  const normalizedMass =
    calculateMatrixMass(
      finalMatrix
    );

  const warnings =
    buildWarnings(
      inputInspection.inspection,
      adjustedInspection.inspection,
      parsedLambdaHome.valid,
      parsedLambdaAway.valid,
      parsedRho.valid,
      source
    );

  const valid =
    parsedLambdaHome.valid &&
    parsedLambdaAway.valid &&
    parsedRho.valid &&
    inputInspection
      .inspection
      .shapeValid &&
    adjustedInspection
      .inspection
      .shapeValid &&
    !fallbackUsed &&
    !emergencyFallbackUsed &&
    Math.abs(
      normalizedMass - 1
    ) <= 1e-6;

  return {
    matrix:
      finalMatrix,

    rawAdjustedMatrix:
      adjustedInspection.matrix,

    sanitizedInputMatrix:
      inputInspection.matrix,

    meta: {
      version:
        VERSION,

      valid,
      normalized: true,

      fallbackUsed,
      emergencyFallbackUsed,

      source,

      inputMass:
        roundNumber(
          inputMass
        ),

      rawAdjustedMass:
        roundNumber(
          rawAdjustedMass
        ),

      normalizedMass:
        roundNumber(
          normalizedMass
        ),

      renormalizationFactor:
        roundNumber(
          renormalizationFactor
        ),

      massDelta:
        roundNumber(
          rawAdjustedMass -
          inputMass
        ),

      lambdaHome:
        roundNumber(
          safeLambdaHome
        ),

      lambdaAway:
        roundNumber(
          safeLambdaAway
        ),

      rho:
        roundNumber(
          safeRho
        ),

      inputInspection:
        inputInspection.inspection,

      adjustedInspection:
        adjustedInspection.inspection,

      warnings
    }
  };
}

/* ==========================================
   WRAPPER LEGADO
========================================== */

export function applyDixonColesMatrix(
  matrix: number[][],
  lambdaHome: number,
  lambdaAway: number,
  rho = 0
): number[][] {
  return applyDixonColesMatrixDetailed(
    matrix,
    lambdaHome,
    lambdaAway,
    rho
  ).matrix;
}
