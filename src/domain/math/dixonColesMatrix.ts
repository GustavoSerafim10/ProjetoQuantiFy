import { dixonColesAdjustment } from "./dixonColes";

/* ==========================================
   APPLY DIXON-COLES MATRIX — V7
========================================== */

/*
 * Responsabilidade:
 *
 * - receber uma matriz de probabilidades;
 * - aplicar a correção Dixon-Coles;
 * - remover valores inválidos;
 * - normalizar a massa probabilística;
 * - nunca alterar a matriz original.
 */

const EPSILON = 1e-12;

/* ==========================================
   UTILITÁRIOS
========================================== */

function safeNumber(
  value: unknown,
  fallback = 0
): number {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
}

function sanitizeProbability(
  value: unknown
): number {
  const parsed =
    safeNumber(value, 0);

  return parsed > 0
    ? parsed
    : 0;
}

function cloneAndSanitizeMatrix(
  matrix: number[][]
): number[][] {
  return matrix.map(row => {
    if (!Array.isArray(row)) {
      return [];
    }

    return row.map(value =>
      sanitizeProbability(value)
    );
  });
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

function normalizeMatrix(
  matrix: number[][]
): number[][] | null {
  const total =
    calculateMatrixMass(matrix);

  if (
    !Number.isFinite(total) ||
    total <= EPSILON
  ) {
    return null;
  }

  return matrix.map(row => {
    if (!Array.isArray(row)) {
      return [];
    }

    return row.map(value => {
      const probability =
        sanitizeProbability(value);

      const normalized =
        probability / total;

      return Number.isFinite(normalized)
        ? normalized
        : 0;
    });
  });
}

/* ==========================================
   FALLBACK
========================================== */

function buildFallbackMatrix(
  matrix: number[][]
): number[][] {
  const sanitized =
    cloneAndSanitizeMatrix(matrix);

  const normalized =
    normalizeMatrix(sanitized);

  if (normalized) {
    return normalized;
  }

  /*
   * Última proteção:
   *
   * caso a matriz original também seja inválida,
   * criamos uma matriz com as mesmas dimensões e
   * concentramos a massa em 0–0.
   */
  const rowCount =
    Math.max(matrix.length, 1);

  const fallback: number[][] = [];

  for (
    let rowIndex = 0;
    rowIndex < rowCount;
    rowIndex++
  ) {
    const sourceRow =
      Array.isArray(matrix[rowIndex])
        ? matrix[rowIndex]
        : [];

    const columnCount =
      Math.max(
        sourceRow.length,
        rowIndex === 0 ? 1 : 0
      );

    const row: number[] = [];

    for (
      let columnIndex = 0;
      columnIndex < columnCount;
      columnIndex++
    ) {
      row.push(
        rowIndex === 0 &&
        columnIndex === 0
          ? 1
          : 0
      );
    }

    fallback.push(row);
  }

  return fallback;
}

/* ==========================================
   APPLY DIXON-COLES
========================================== */

export function applyDixonColesMatrix(
  matrix: number[][],
  lambdaHome: number,
  lambdaAway: number,
  rho = 0
): number[][] {
  if (
    !Array.isArray(matrix) ||
    matrix.length === 0
  ) {
    return [];
  }

  const safeLambdaHome =
    Math.max(
      safeNumber(lambdaHome, 1.32),
      EPSILON
    );

  const safeLambdaAway =
    Math.max(
      safeNumber(lambdaAway, 1.23),
      EPSILON
    );

  const safeRho =
    safeNumber(rho, 0);

  const adjusted: number[][] = [];

  /* ==========================================
     APLICAÇÃO CÉLULA POR CÉLULA
  ========================================== */

  for (
    let homeGoals = 0;
    homeGoals < matrix.length;
    homeGoals++
  ) {
    const sourceRow =
      Array.isArray(matrix[homeGoals])
        ? matrix[homeGoals]
        : [];

    const adjustedRow: number[] = [];

    for (
      let awayGoals = 0;
      awayGoals < sourceRow.length;
      awayGoals++
    ) {
      const baseProbability =
        sanitizeProbability(
          sourceRow[awayGoals]
        );

      const factor =
        dixonColesAdjustment(
          homeGoals,
          awayGoals,
          safeLambdaHome,
          safeLambdaAway,
          safeRho
        );

      const rawAdjustedValue =
        baseProbability *
        safeNumber(factor, 1);

      const adjustedValue =
        Number.isFinite(rawAdjustedValue) &&
        rawAdjustedValue > 0
          ? rawAdjustedValue
          : 0;

      adjustedRow.push(
        adjustedValue
      );
    }

    adjusted.push(
      adjustedRow
    );
  }

  /* ==========================================
     NORMALIZAÇÃO
  ========================================== */

  const normalized =
    normalizeMatrix(adjusted);

  if (normalized) {
    return normalized;
  }

  /*
   * Se o ajuste gerar uma distribuição inválida,
   * voltamos para a matriz original normalizada.
   */
  return buildFallbackMatrix(matrix);
}