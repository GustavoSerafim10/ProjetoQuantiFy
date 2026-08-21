import { calculateMatrixMass } from "./matrixNormalization";
import { roundNumber } from "./numericHelpers";
import { type MatrixDiagnostics, type MatrixInspection, type MatrixNormalizationDiagnostics } from "./types";

/* ==========================================
   DIAGNÓSTICOS DA MATRIZ
========================================== */

export function createMatrixDiagnostics(
  maxGoals: number,
  independentInspection: MatrixInspection,
  adjustedInspection: MatrixInspection,
  normalization:
    MatrixNormalizationDiagnostics,
  finalMatrix: number[][]
): MatrixDiagnostics {
  const independentMass =
    independentInspection
      .sanitizedMass;

  const adjustedMass =
    adjustedInspection
      .sanitizedMass;

  const normalizedMass =
    calculateMatrixMass(
      finalMatrix
    );

  const matrixRows =
    finalMatrix.length;

  const matrixColumns =
    matrixRows > 0
      ? finalMatrix[0]?.length ?? 0
      : 0;

  const expectedSize =
    maxGoals + 1;

  return {
    maxGoals,

    independent:
      independentInspection,

    adjusted:
      adjustedInspection,

    normalization,

    independentMatrixMass:
      roundNumber(
        independentMass
      ),

    adjustedMatrixMass:
      roundNumber(
        adjustedMass
      ),

    normalizedMatrixMass:
      roundNumber(
        normalizedMass
      ),

    independentTailMass:
      roundNumber(
        Math.max(
          0,
          1 - independentMass
        )
      ),

    adjustedMassDelta:
      roundNumber(
        adjustedMass -
        independentMass
      ),

    matrixRows,
    matrixColumns,

    matrixShapeValid:
      matrixRows ===
        expectedSize &&
      finalMatrix.every(
        row =>
          Array.isArray(row) &&
          row.length ===
            expectedSize
      )
  };
}
