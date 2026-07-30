import { poissonTable } from "../math/poisson";
import {
  applyDixonColesMatrixDetailed,
  type DixonColesMatrixMeta
} from "../math/dixonColesMatrix";
import { calculateDynamicRhoAdvanced } from "../model/rhoCalculator";
import { autoLearningEngine } from "../learning/autoLearningEngine";

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
   CONSTANTES
========================================== */

const MODEL_VERSION = "V7.1_ELITE" as const;

const MIN_LAMBDA = 0.20;
const MAX_LAMBDA = 3.20;

const DEFAULT_HOME_LAMBDA = 1.32;
const DEFAULT_AWAY_LAMBDA = 1.23;

const MIN_OPERATIONAL_RHO = -0.15;
const MAX_OPERATIONAL_RHO = 0.10;
const RHO_EPSILON = 1e-8;

const MIN_MAX_GOALS = 10;
const MAX_MAX_GOALS = 20;

const MASS_TOLERANCE = 1e-8;
const ROUND_DECIMALS = 8;

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

  learningReady: boolean;
  learningRhoShift: number;

  combinedRho: number;
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
  learningRhoShift: number;
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

interface ParsedNumber {
  value: number;
  valid: boolean;
  fallbackUsed: boolean;
}

interface SanitizedLambda {
  value: number;
  inputValid: boolean;
  fallbackUsed: boolean;
  clampApplied: boolean;
}

interface MatrixInspectionResult {
  matrix: number[][];
  diagnostics: MatrixInspection;
}

interface MatrixNormalizationResult {
  matrix: number[][];
  diagnostics: MatrixNormalizationDiagnostics;
}

interface RhoCalculationResult {
  bounds: RhoBounds;
  diagnostics: RhoDiagnostics;
}

/* ==========================================
   HELPERS NUMÉRICOS
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

  const parsed =
    Number(value);

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
  fallback: number
): number {
  return parseFiniteNumber(
    value,
    fallback
  ).value;
}

function sanitizeProbability(
  value: unknown
): number {
  return clamp(
    safeNumber(value, 0),
    0,
    1
  );
}

function roundNumber(
  value: number,
  decimals = ROUND_DECIMALS
): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const factor =
    10 ** decimals;

  return (
    Math.round(value * factor) /
    factor
  );
}

function approximatelyEqual(
  first: number,
  second: number,
  tolerance = MASS_TOLERANCE
): boolean {
  return (
    Math.abs(first - second) <=
    tolerance
  );
}

/* ==========================================
   VALIDAÇÃO DOS LAMBDAS
========================================== */

function sanitizeLambda(
  rawValue: unknown,
  fallback: number
): SanitizedLambda {
  const parsed =
    parseFiniteNumber(
      rawValue,
      fallback
    );

  const clamped =
    clamp(
      parsed.value,
      MIN_LAMBDA,
      MAX_LAMBDA
    );

  return {
    value: clamped,
    inputValid: parsed.valid,
    fallbackUsed: parsed.fallbackUsed,
    clampApplied:
      parsed.valid &&
      !approximatelyEqual(
        parsed.value,
        clamped,
        0
      )
  };
}

function createLambdaDiagnostics(
  rawHome: unknown,
  rawAway: unknown,
  home: SanitizedLambda,
  away: SanitizedLambda
): LambdaDiagnostics {
  return {
    rawHome,
    rawAway,

    lambdaHome:
      roundNumber(home.value),

    lambdaAway:
      roundNumber(away.value),

    totalLambda:
      roundNumber(
        home.value + away.value
      ),

    lambdaDifference:
      roundNumber(
        home.value - away.value
      ),

    homeInputValid:
      home.inputValid,

    awayInputValid:
      away.inputValid,

    homeFallbackUsed:
      home.fallbackUsed,

    awayFallbackUsed:
      away.fallbackUsed,

    fallbackUsed:
      home.fallbackUsed ||
      away.fallbackUsed,

    homeClampApplied:
      home.clampApplied,

    awayClampApplied:
      away.clampApplied
  };
}

/* ==========================================
   DIMENSÃO DINÂMICA
========================================== */

function calculateMaxGoals(
  lambdaHome: number,
  lambdaAway: number
): number {
  const maximumLambda =
    Math.max(
      lambdaHome,
      lambdaAway
    );

  /*
   * Cauda conservadora:
   * média + 6 desvios-padrão.
   */
  const estimatedLimit =
    Math.ceil(
      maximumLambda +
      6 * Math.sqrt(maximumLambda)
    );

  return Math.round(
    clamp(
      estimatedLimit,
      MIN_MAX_GOALS,
      MAX_MAX_GOALS
    )
  );
}

/* ==========================================
   MATRIZ POISSON INDEPENDENTE
========================================== */

function buildIndependentMatrix(
  homeDistribution: number[],
  awayDistribution: number[],
  maxGoals: number
): number[][] {
  const matrix: number[][] = [];

  for (
    let homeGoals = 0;
    homeGoals <= maxGoals;
    homeGoals++
  ) {
    const row: number[] = [];

    for (
      let awayGoals = 0;
      awayGoals <= maxGoals;
      awayGoals++
    ) {
      const homeProbability =
        sanitizeProbability(
          homeDistribution[homeGoals]
        );

      const awayProbability =
        sanitizeProbability(
          awayDistribution[awayGoals]
        );

      const jointProbability =
        homeProbability *
        awayProbability;

      row.push(
        Number.isFinite(jointProbability)
          ? Math.max(
              0,
              jointProbability
            )
          : 0
      );
    }

    matrix.push(row);
  }

  return matrix;
}

/* ==========================================
   INSPEÇÃO E NORMALIZAÇÃO DA MATRIZ
========================================== */

function calculateMatrixMass(
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

function createEmergencyZeroZeroMatrix(
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

function normalizeMatrixWithDiagnostics(
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

/* ==========================================
   RHO — LIMITES E METADATA
========================================== */

function calculateRhoBounds(
  lambdaHome: number,
  lambdaAway: number
): RhoBounds {
  const mathematicalMinimum =
    Math.max(
      -1 / lambdaHome,
      -1 / lambdaAway
    ) + RHO_EPSILON;

  const mathematicalMaximum =
    Math.min(
      1,
      1 / (
        lambdaHome *
        lambdaAway
      )
    ) - RHO_EPSILON;

  const lowerBound =
    Math.max(
      MIN_OPERATIONAL_RHO,
      mathematicalMinimum
    );

  const upperBound =
    Math.min(
      MAX_OPERATIONAL_RHO,
      mathematicalMaximum
    );

  const valid =
    Number.isFinite(lowerBound) &&
    Number.isFinite(upperBound) &&
    lowerBound <= upperBound;

  return {
    mathematicalMinimum:
      roundNumber(
        mathematicalMinimum
      ),

    mathematicalMaximum:
      roundNumber(
        mathematicalMaximum
      ),

    lowerBound:
      roundNumber(
        lowerBound
      ),

    upperBound:
      roundNumber(
        upperBound
      ),

    valid
  };
}

function constrainRho(
  rawRho: number,
  bounds: RhoBounds
): {
  rho: number;
  clampApplied: boolean;
  neutralFallbackUsed: boolean;
} {
  if (!bounds.valid) {
    return {
      rho: 0,
      clampApplied: false,
      neutralFallbackUsed: true
    };
  }

  const safeRaw =
    safeNumber(
      rawRho,
      0
    );

  const constrained =
    clamp(
      safeRaw,
      bounds.lowerBound,
      bounds.upperBound
    );

  return {
    rho:
      constrained,

    clampApplied:
      !approximatelyEqual(
        constrained,
        safeRaw,
        1e-12
      ),

    neutralFallbackUsed:
      false
  };
}

function calculateRho(
  lambdaHome: number,
  lambdaAway: number
): RhoCalculationResult {
  /*
   * Não reinserimos pressão, finalizações ou
   * cartões aqui para evitar dupla contagem.
   */
  let rawBaseRhoValue: unknown = 0;

  try {
    rawBaseRhoValue =
      calculateDynamicRhoAdvanced({
        lambdaHome,
        lambdaAway
      });
  } catch {
    rawBaseRhoValue = 0;
  }

  const rawBaseRho =
    safeNumber(
      rawBaseRhoValue,
      0
    );

  let learning: any = null;

  try {
    learning =
      autoLearningEngine();
  } catch {
    learning = null;
  }

  const learningReady =
    Boolean(
      learning?.ready
    );

  const learningRhoShift =
    learningReady
      ? safeNumber(
          learning?.rhoShift,
          0
        )
      : 0;

  const combinedRho =
    rawBaseRho +
    learningRhoShift;

  const bounds =
    calculateRhoBounds(
      lambdaHome,
      lambdaAway
    );

  const constrained =
    constrainRho(
      combinedRho,
      bounds
    );

  return {
    bounds,

    diagnostics: {
      rawBaseRho:
        roundNumber(
          rawBaseRho
        ),

      baseRho:
        roundNumber(
          rawBaseRho
        ),

      learningReady,

      learningRhoShift:
        roundNumber(
          learningRhoShift
        ),

      combinedRho:
        roundNumber(
          combinedRho
        ),

      rho:
        roundNumber(
          constrained.rho
        ),

      lowerBound:
        bounds.lowerBound,

      upperBound:
        bounds.upperBound,

      clampApplied:
        constrained.clampApplied,

      neutralFallbackUsed:
        constrained
          .neutralFallbackUsed
    }
  };
}

/* ==========================================
   EXTRAÇÃO DOS MERCADOS
========================================== */

function calculateMarkets(
  matrix: number[][]
): CanonicalMarkets {
  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;

  let over15 = 0;
  let over25 = 0;

  let bttsYes = 0;

  for (
    let homeGoals = 0;
    homeGoals < matrix.length;
    homeGoals++
  ) {
    const row =
      matrix[homeGoals] ?? [];

    for (
      let awayGoals = 0;
      awayGoals < row.length;
      awayGoals++
    ) {
      const probability =
        sanitizeProbability(
          row[awayGoals]
        );

      if (homeGoals > awayGoals) {
        homeWin += probability;
      } else if (
        homeGoals === awayGoals
      ) {
        draw += probability;
      } else {
        awayWin += probability;
      }

      const totalGoals =
        homeGoals +
        awayGoals;

      if (totalGoals >= 2) {
        over15 += probability;
      }

      if (totalGoals >= 3) {
        over25 += probability;
      }

      if (
        homeGoals >= 1 &&
        awayGoals >= 1
      ) {
        bttsYes += probability;
      }
    }
  }

  const safeHomeWin =
    sanitizeProbability(homeWin);

  const safeDraw =
    sanitizeProbability(draw);

  const safeAwayWin =
    sanitizeProbability(awayWin);

  const resultTotal =
    safeHomeWin +
    safeDraw +
    safeAwayWin;

  const normalizedHome =
    resultTotal > 0
      ? safeHomeWin /
        resultTotal
      : 0;

  const normalizedDraw =
    resultTotal > 0
      ? safeDraw /
        resultTotal
      : 0;

  const normalizedAway =
    resultTotal > 0
      ? safeAwayWin /
        resultTotal
      : 0;

  const safeOver15 =
    sanitizeProbability(
      over15
    );

  const safeOver25 =
    sanitizeProbability(
      over25
    );

  const safeBttsYes =
    sanitizeProbability(
      bttsYes
    );

  const under15 =
    sanitizeProbability(
      1 - safeOver15
    );

  const under25 =
    sanitizeProbability(
      1 - safeOver25
    );

  const bttsNo =
    sanitizeProbability(
      1 - safeBttsYes
    );

  return {
    homeWin:
      normalizedHome,

    draw:
      normalizedDraw,

    awayWin:
      normalizedAway,

    over15:
      safeOver15,

    over25:
      safeOver25,

    under15,
    under25,

    bttsYes:
      safeBttsYes,

    bttsNo,

    doubleChance1X:
      sanitizeProbability(
        normalizedHome +
        normalizedDraw
      ),

    doubleChanceX2:
      sanitizeProbability(
        normalizedDraw +
        normalizedAway
      )
  };
}

function roundMarkets(
  markets: CanonicalMarkets
): CanonicalMarkets {
  return {
    homeWin:
      roundNumber(
        markets.homeWin
      ),

    draw:
      roundNumber(
        markets.draw
      ),

    awayWin:
      roundNumber(
        markets.awayWin
      ),

    over15:
      roundNumber(
        markets.over15
      ),

    over25:
      roundNumber(
        markets.over25
      ),

    under15:
      roundNumber(
        markets.under15
      ),

    under25:
      roundNumber(
        markets.under25
      ),

    bttsYes:
      roundNumber(
        markets.bttsYes
      ),

    bttsNo:
      roundNumber(
        markets.bttsNo
      ),

    doubleChance1X:
      roundNumber(
        markets.doubleChance1X
      ),

    doubleChanceX2:
      roundNumber(
        markets.doubleChanceX2
      )
  };
}

function calculateMarketDelta(
  before: CanonicalMarkets,
  after: CanonicalMarkets
): MarketDelta {
  return {
    homeWin:
      roundNumber(
        after.homeWin -
        before.homeWin
      ),

    draw:
      roundNumber(
        after.draw -
        before.draw
      ),

    awayWin:
      roundNumber(
        after.awayWin -
        before.awayWin
      ),

    over15:
      roundNumber(
        after.over15 -
        before.over15
      ),

    over25:
      roundNumber(
        after.over25 -
        before.over25
      ),

    under15:
      roundNumber(
        after.under15 -
        before.under15
      ),

    under25:
      roundNumber(
        after.under25 -
        before.under25
      ),

    bttsYes:
      roundNumber(
        after.bttsYes -
        before.bttsYes
      ),

    bttsNo:
      roundNumber(
        after.bttsNo -
        before.bttsNo
      ),

    doubleChance1X:
      roundNumber(
        after.doubleChance1X -
        before.doubleChance1X
      ),

    doubleChanceX2:
      roundNumber(
        after.doubleChanceX2 -
        before.doubleChanceX2
      )
  };
}

/* ==========================================
   DIAGNÓSTICOS DA MATRIZ
========================================== */

function createMatrixDiagnostics(
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

/* ==========================================
   WARNINGS E VALIDADE
========================================== */

function buildWarnings(
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

function determineModelValidity(
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
