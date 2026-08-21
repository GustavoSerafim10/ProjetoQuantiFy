import { roundNumber } from "./numericHelpers";
import { type MatrixInspectionResult, type MatrixNormalizationResult } from "./types";

/* ==========================================
   INSPEÇÃO E NORMALIZAÇÃO DA MATRIZ
========================================== */

export function calculateMatrixMass(
  matrix: number[][]
): number {
  let mass = 0;

  for (const row of matrix) {
    if (!Array.isArray(row)) {
      continue;
    }

    for (const value of row) {
      const numeric =
        Number(value);

      if (
        Number.isFinite(numeric) &&
        numeric > 0
      ) {
        mass += numeric;
      }
    }
  }

  return mass;
}

export function inspectAndSanitizeMatrix(
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
  let correctedCells = 0;
  let rawMass = 0;

  const sanitized =
    Array.from(
      { length: expectedSize },
      (_, rowIndex) =>
        Array.from(
          { length: expectedSize },
          (_, columnIndex) => {
            const rawValue =
              source?.[rowIndex]?.[
                columnIndex
              ];

            const parsed =
              Number(rawValue);

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
    matrix:
      sanitized,

    diagnostics: {
      rows,
      columns,
      expectedSize,

      shapeValid,

      nonFiniteCells,
      negativeCells,
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

export function createEmergencyZeroZeroMatrix(
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

export function normalizeMatrixWithDiagnostics(
  adjustedMatrix: number[][],
  independentMatrix: number[][],
  expectedSize: number
): MatrixNormalizationResult {
  const adjustedInspection =
    inspectAndSanitizeMatrix(
      adjustedMatrix,
      expectedSize
    );

  const adjustedMass =
    calculateMatrixMass(
      adjustedInspection.matrix
    );

  if (
    Number.isFinite(adjustedMass) &&
    adjustedMass > 0
  ) {
    const normalized =
      adjustedInspection.matrix.map(
        row =>
          row.map(
            value =>
              value /
              adjustedMass
          )
      );

    return {
      matrix:
        normalized,

      diagnostics: {
        source:
          "ADJUSTED_MATRIX",

        normalized: true,
        fallbackUsed: false,
        emergencyFallbackUsed: false,

        sourceMass:
          roundNumber(
            adjustedMass
          ),

        normalizedMass:
          roundNumber(
            calculateMatrixMass(
              normalized
            )
          ),

        renormalizationFactor:
          roundNumber(
            1 / adjustedMass
          )
      }
    };
  }

  const independentInspection =
    inspectAndSanitizeMatrix(
      independentMatrix,
      expectedSize
    );

  const independentMass =
    calculateMatrixMass(
      independentInspection.matrix
    );

  if (
    Number.isFinite(independentMass) &&
    independentMass > 0
  ) {
    const normalizedFallback =
      independentInspection.matrix.map(
        row =>
          row.map(
            value =>
              value /
              independentMass
          )
      );

    return {
      matrix:
        normalizedFallback,

      diagnostics: {
        source:
          "INDEPENDENT_FALLBACK",

        normalized: true,
        fallbackUsed: true,
        emergencyFallbackUsed: false,

        sourceMass:
          roundNumber(
            independentMass
          ),

        normalizedMass:
          roundNumber(
            calculateMatrixMass(
              normalizedFallback
            )
          ),

        renormalizationFactor:
          roundNumber(
            1 / independentMass
          )
      }
    };
  }

  return {
    matrix:
      createEmergencyZeroZeroMatrix(
        expectedSize
      ),

    diagnostics: {
      source:
        "EMERGENCY_ZERO_ZERO",

      normalized: true,
      fallbackUsed: true,
      emergencyFallbackUsed: true,

      sourceMass: 0,
      normalizedMass: 1,
      renormalizationFactor: 0
    }
  };
}
