import { poissonPMF } from "./poisson";
import { dixonColesAdjustment } from "./dixonColes";

/* ==========================================
   GOAL MATRIX — QUANTIFY V7.1 ELITE
========================================== */

/*
 * Responsabilidade:
 *
 * - construir a matriz de placares;
 * - combinar Poisson casa × Poisson visitante;
 * - aplicar Dixon-Coles de forma segura;
 * - controlar truncamento e normalização;
 * - preservar compatibilidade com consumidores antigos;
 * - expor diagnósticos para auditoria.
 *
 * Este arquivo NÃO:
 *
 * - constrói lambdas;
 * - calibra probabilidades;
 * - calcula EV;
 * - seleciona mercados;
 * - toma decisões.
 */

/* ==========================================
   CONTRATOS PRINCIPAIS
========================================== */

export interface ScoreProbability {
  homeGoals: number;
  awayGoals: number;
  probability: number;
}

export interface MatchOutcome {
  homeWin: number;
  draw: number;
  awayWin: number;
}

export interface GoalMatrixOptions {
  /*
   * Maior número de gols representado
   * individualmente para cada equipe.
   *
   * Exemplo:
   * maxGoals = 10
   * gera placares de 0x0 até 10x10.
   */
  maxGoals?: number;

  /*
   * Parâmetro Dixon-Coles.
   *
   * Mantido com o comportamento legado:
   * DEFAULT_RHO = -0.12.
   */
  rho?: number;
}

/* ==========================================
   DIAGNÓSTICOS
========================================== */

export type GoalMatrixQuality =
  | "EXCELLENT"
  | "GOOD"
  | "ACCEPTABLE"
  | "LOW"
  | "INVALID";

export interface NumericInputDiagnostic {
  raw: unknown;
  sanitized: number;

  valid: boolean;
  fallbackUsed: boolean;
  clampApplied: boolean;
}

export interface GoalMatrixDiagnostics {
  version: "V7.1_ELITE";

  inputs: {
    lambdaHome: NumericInputDiagnostic;
    lambdaAway: NumericInputDiagnostic;
    maxGoals: NumericInputDiagnostic;
    rho: NumericInputDiagnostic;
  };

  matrix: {
    cells: number;
    validCells: number;
    invalidCells: number;
    zeroProbabilityCells: number;
  };

  dixonColes: {
    requested: boolean;
    applied: boolean;

    invalidAdjustmentCount: number;
    negativeAdjustedProbabilityCount: number;
    nonFiniteAdjustedProbabilityCount: number;

    fallbackToIndependentPoisson: boolean;
  };

  truncation: {
    maxGoals: number;

    homeIncludedMass: number;
    awayIncludedMass: number;

    independentJointIncludedMass: number;
    estimatedTailMass: number;
  };

  normalization: {
    rawIndependentMass: number;
    rawAdjustedMass: number;
    normalizedMass: number;

    normalizationApplied: boolean;
    normalizationFactor: number;

    fallbackApplied: boolean;
    fallbackReason?: string;
  };

  quality: GoalMatrixQuality;

  warnings: string[];
}

export interface GoalMatrixBuildResult {
  matrix: ScoreProbability[];
  diagnostics: GoalMatrixDiagnostics;
}

/* ==========================================
   CONSTANTES
========================================== */

const VERSION =
  "V7.1_ELITE" as const;

const MIN_LAMBDA = 0.2;
const MAX_LAMBDA = 3.2;

const DEFAULT_HOME_LAMBDA = 1.32;
const DEFAULT_AWAY_LAMBDA = 1.23;

const DEFAULT_MAX_GOALS = 10;
const MIN_MAX_GOALS = 6;
const MAX_MAX_GOALS = 20;

const DEFAULT_RHO = -0.12;
const MIN_RHO = -0.25;
const MAX_RHO = 0.05;

const NORMALIZATION_TOLERANCE =
  1e-10;

const MASS_WARNING_THRESHOLD =
  0.0025;

const MASS_LOW_QUALITY_THRESHOLD =
  0.01;

/* ==========================================
   TIPOS INTERNOS
========================================== */

interface ParsedNumber {
  value: number;
  valid: boolean;
  fallbackUsed: boolean;
}

interface MatrixBuildStats {
  validCells: number;
  invalidCells: number;
  zeroProbabilityCells: number;

  invalidAdjustmentCount: number;
  negativeAdjustedProbabilityCount: number;
  nonFiniteAdjustedProbabilityCount: number;
}

/* ==========================================
   UTILITÁRIOS NUMÉRICOS
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
  if (
    isMissingNumericValue(value)
  ) {
    return {
      value: fallback,
      valid: false,
      fallbackUsed: true
    };
  }

  const parsed =
    Number(value);

  if (
    !Number.isFinite(parsed)
  ) {
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

function sanitizeNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number
): NumericInputDiagnostic {
  const parsed =
    parseFiniteNumber(
      value,
      fallback
    );

  const sanitized =
    clamp(
      parsed.value,
      min,
      max
    );

  return {
    raw: value,
    sanitized,

    valid:
      parsed.valid,

    fallbackUsed:
      parsed.fallbackUsed,

    clampApplied:
      sanitized !==
      parsed.value
  };
}

function sanitizeLambda(
  value: unknown,
  fallback: number
): NumericInputDiagnostic {
  const diagnostic =
    sanitizeNumber(
      value,
      fallback,
      MIN_LAMBDA,
      MAX_LAMBDA
    );

  return {
    ...diagnostic,

    valid:
      diagnostic.valid &&
      diagnostic.sanitized > 0
  };
}

function sanitizeMaxGoals(
  value: unknown
): NumericInputDiagnostic {
  const parsed =
    parseFiniteNumber(
      value,
      DEFAULT_MAX_GOALS
    );

  const integerValue =
    Math.floor(
      parsed.value
    );

  const sanitized =
    clamp(
      integerValue,
      MIN_MAX_GOALS,
      MAX_MAX_GOALS
    );

  return {
    raw: value,
    sanitized,

    valid:
      parsed.valid &&
      integerValue >=
        MIN_MAX_GOALS,

    fallbackUsed:
      parsed.fallbackUsed,

    clampApplied:
      sanitized !==
        parsed.value
  };
}

function sanitizeRho(
  value: unknown
): NumericInputDiagnostic {
  return sanitizeNumber(
    value,
    DEFAULT_RHO,
    MIN_RHO,
    MAX_RHO
  );
}

function safeProbability(
  value: unknown
): number {
  if (
    isMissingNumericValue(value)
  ) {
    return 0;
  }

  const parsed =
    Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed < 0
  ) {
    return 0;
  }

  return parsed;
}

function sumProbabilities(
  matrix: ScoreProbability[]
): number {
  return matrix.reduce(
    (
      total,
      score
    ) =>
      total +
      safeProbability(
        score.probability
      ),
    0
  );
}

/* ==========================================
   MASSA POISSON
========================================== */

function poissonIncludedMass(
  lambda: number,
  maxGoals: number
): number {
  let mass = 0;

  for (
    let goals = 0;
    goals <= maxGoals;
    goals++
  ) {
    mass +=
      safeProbability(
        poissonPMF(
          lambda,
          goals
        )
      );
  }

  return clamp(
    mass,
    0,
    1
  );
}

/* ==========================================
   CONSTRUÇÃO DA MATRIZ
========================================== */

function createEmptyStats():
  MatrixBuildStats {
  return {
    validCells: 0,
    invalidCells: 0,
    zeroProbabilityCells: 0,

    invalidAdjustmentCount: 0,
    negativeAdjustedProbabilityCount: 0,
    nonFiniteAdjustedProbabilityCount: 0
  };
}

function buildIndependentMatrix(
  lambdaHome: number,
  lambdaAway: number,
  maxGoals: number
): {
  matrix: ScoreProbability[];
  stats: MatrixBuildStats;
} {
  const matrix:
    ScoreProbability[] = [];

  const stats =
    createEmptyStats();

  for (
    let home = 0;
    home <= maxGoals;
    home++
  ) {
    const probHome =
      safeProbability(
        poissonPMF(
          lambdaHome,
          home
        )
      );

    for (
      let away = 0;
      away <= maxGoals;
      away++
    ) {
      const probAway =
        safeProbability(
          poissonPMF(
            lambdaAway,
            away
          )
        );

      const probability =
        probHome *
        probAway;

      if (
        Number.isFinite(
          probability
        ) &&
        probability >= 0
      ) {
        stats.validCells++;

        if (
          probability === 0
        ) {
          stats
            .zeroProbabilityCells++;
        }
      } else {
        stats.invalidCells++;
      }

      matrix.push({
        homeGoals:
          home,

        awayGoals:
          away,

        probability:
          Number.isFinite(
            probability
          ) &&
          probability >= 0
            ? probability
            : 0
      });
    }
  }

  return {
    matrix,
    stats
  };
}

function buildAdjustedMatrix(
  lambdaHome: number,
  lambdaAway: number,
  maxGoals: number,
  rho: number
): {
  matrix: ScoreProbability[];
  stats: MatrixBuildStats;
} {
  const matrix:
    ScoreProbability[] = [];

  const stats =
    createEmptyStats();

  for (
    let home = 0;
    home <= maxGoals;
    home++
  ) {
    const probHome =
      safeProbability(
        poissonPMF(
          lambdaHome,
          home
        )
      );

    for (
      let away = 0;
      away <= maxGoals;
      away++
    ) {
      const probAway =
        safeProbability(
          poissonPMF(
            lambdaAway,
            away
          )
        );

      const baseProbability =
        probHome *
        probAway;

      const dcAdjustment =
        dixonColesAdjustment(
          home,
          away,
          lambdaHome,
          lambdaAway,
          rho
        );

      if (
        !Number.isFinite(
          dcAdjustment
        )
      ) {
        stats
          .invalidAdjustmentCount++;
      }

      const rawAdjustedProbability =
        baseProbability *
        dcAdjustment;

      if (
        Number.isFinite(
          rawAdjustedProbability
        ) &&
        rawAdjustedProbability < 0
      ) {
        stats
          .negativeAdjustedProbabilityCount++;
      }

      if (
        !Number.isFinite(
          rawAdjustedProbability
        )
      ) {
        stats
          .nonFiniteAdjustedProbabilityCount++;
      }

      const probability =
        Number.isFinite(
          rawAdjustedProbability
        ) &&
        rawAdjustedProbability >= 0
          ? rawAdjustedProbability
          : 0;

      if (
        Number.isFinite(
          probability
        ) &&
        probability >= 0
      ) {
        stats.validCells++;

        if (
          probability === 0
        ) {
          stats
            .zeroProbabilityCells++;
        }
      } else {
        stats.invalidCells++;
      }

      matrix.push({
        homeGoals:
          home,

        awayGoals:
          away,

        probability
      });
    }
  }

  return {
    matrix,
    stats
  };
}

/* ==========================================
   NORMALIZAÇÃO
========================================== */

function normalizeValidMatrix(
  matrix: ScoreProbability[]
): {
  matrix: ScoreProbability[];
  rawMass: number;
  normalizedMass: number;
  normalizationApplied: boolean;
  normalizationFactor: number;
} {
  const rawMass =
    sumProbabilities(
      matrix
    );

  if (
    matrix.length === 0 ||
    !Number.isFinite(
      rawMass
    ) ||
    rawMass <= 0
  ) {
    return {
      matrix: [],
      rawMass,
      normalizedMass: 0,
      normalizationApplied: false,
      normalizationFactor: 0
    };
  }

  const normalizationApplied =
    Math.abs(
      1 - rawMass
    ) >
      NORMALIZATION_TOLERANCE;

  const normalizationFactor =
    1 / rawMass;

  const normalized =
    matrix.map(
      score => ({
        ...score,

        probability:
          safeProbability(
            score.probability
          ) *
          normalizationFactor
      })
    );

  const normalizedMass =
    sumProbabilities(
      normalized
    );

  return {
    matrix:
      normalized,

    rawMass,
    normalizedMass,

    normalizationApplied,
    normalizationFactor
  };
}

/* ==========================================
   QUALIDADE
========================================== */

function classifyQuality(
  estimatedTailMass: number,
  fallbackApplied: boolean,
  invalidCells: number,
  invalidAdjustments: number
): GoalMatrixQuality {
  if (
    fallbackApplied &&
    invalidCells > 0
  ) {
    return "LOW";
  }

  if (
    invalidCells > 0 ||
    invalidAdjustments > 0
  ) {
    return "ACCEPTABLE";
  }

  if (
    estimatedTailMass <=
      MASS_WARNING_THRESHOLD
  ) {
    return "EXCELLENT";
  }

  if (
    estimatedTailMass <=
      MASS_LOW_QUALITY_THRESHOLD
  ) {
    return "GOOD";
  }

  if (
    estimatedTailMass <= 0.025
  ) {
    return "ACCEPTABLE";
  }

  return "LOW";
}

/* ==========================================
   WARNINGS
========================================== */

function buildWarnings(
  lambdaHome:
    NumericInputDiagnostic,
  lambdaAway:
    NumericInputDiagnostic,
  maxGoals:
    NumericInputDiagnostic,
  rho:
    NumericInputDiagnostic,
  stats:
    MatrixBuildStats,
  estimatedTailMass: number,
  normalizationApplied: boolean,
  fallbackApplied: boolean
): string[] {
  const warnings: string[] = [];

  if (
    !lambdaHome.valid
  ) {
    warnings.push(
      "INVALID_HOME_LAMBDA_INPUT"
    );
  }

  if (
    !lambdaAway.valid
  ) {
    warnings.push(
      "INVALID_AWAY_LAMBDA_INPUT"
    );
  }

  if (
    lambdaHome.fallbackUsed
  ) {
    warnings.push(
      "HOME_LAMBDA_FALLBACK_USED"
    );
  }

  if (
    lambdaAway.fallbackUsed
  ) {
    warnings.push(
      "AWAY_LAMBDA_FALLBACK_USED"
    );
  }

  if (
    lambdaHome.clampApplied
  ) {
    warnings.push(
      "HOME_LAMBDA_CLAMP_APPLIED"
    );
  }

  if (
    lambdaAway.clampApplied
  ) {
    warnings.push(
      "AWAY_LAMBDA_CLAMP_APPLIED"
    );
  }

  if (
    !maxGoals.valid
  ) {
    warnings.push(
      "INVALID_MAX_GOALS_INPUT"
    );
  }

  if (
    maxGoals.fallbackUsed
  ) {
    warnings.push(
      "MAX_GOALS_FALLBACK_USED"
    );
  }

  if (
    maxGoals.clampApplied
  ) {
    warnings.push(
      "MAX_GOALS_CLAMP_APPLIED"
    );
  }

  if (
    !rho.valid
  ) {
    warnings.push(
      "INVALID_RHO_INPUT"
    );
  }

  if (
    rho.fallbackUsed
  ) {
    warnings.push(
      "RHO_FALLBACK_USED"
    );
  }

  if (
    rho.clampApplied
  ) {
    warnings.push(
      "RHO_CLAMP_APPLIED"
    );
  }

  if (
    stats
      .invalidAdjustmentCount >
    0
  ) {
    warnings.push(
      "INVALID_DIXON_COLES_ADJUSTMENT"
    );
  }

  if (
    stats
      .negativeAdjustedProbabilityCount >
    0
  ) {
    warnings.push(
      "NEGATIVE_ADJUSTED_PROBABILITY"
    );
  }

  if (
    stats
      .nonFiniteAdjustedProbabilityCount >
    0
  ) {
    warnings.push(
      "NON_FINITE_ADJUSTED_PROBABILITY"
    );
  }

  if (
    stats.invalidCells > 0
  ) {
    warnings.push(
      "INVALID_MATRIX_CELLS"
    );
  }

  if (
    estimatedTailMass >
      MASS_WARNING_THRESHOLD
  ) {
    warnings.push(
      "TRUNCATION_MASS_ABOVE_THRESHOLD"
    );
  }

  if (
    normalizationApplied
  ) {
    warnings.push(
      "MATRIX_NORMALIZATION_APPLIED"
    );
  }

  if (
    fallbackApplied
  ) {
    warnings.push(
      "DIXON_COLES_FALLBACK_TO_INDEPENDENT_POISSON"
    );
  }

  return warnings;
}

/* ==========================================
   API PRINCIPAL COM DIAGNÓSTICOS
========================================== */

export function goalMatrixWithDiagnostics(
  lambdaHome: number,
  lambdaAway: number,
  options:
    GoalMatrixOptions = {}
): GoalMatrixBuildResult {
  const lambdaHomeDiagnostic =
    sanitizeLambda(
      lambdaHome,
      DEFAULT_HOME_LAMBDA
    );

  const lambdaAwayDiagnostic =
    sanitizeLambda(
      lambdaAway,
      DEFAULT_AWAY_LAMBDA
    );

  const maxGoalsDiagnostic =
    sanitizeMaxGoals(
      options.maxGoals
    );

  const rhoDiagnostic =
    sanitizeRho(
      options.rho
    );

  const safeLambdaHome =
    lambdaHomeDiagnostic
      .sanitized;

  const safeLambdaAway =
    lambdaAwayDiagnostic
      .sanitized;

  const maxGoals =
    maxGoalsDiagnostic
      .sanitized;

  const rho =
    rhoDiagnostic
      .sanitized;

  const homeIncludedMass =
    poissonIncludedMass(
      safeLambdaHome,
      maxGoals
    );

  const awayIncludedMass =
    poissonIncludedMass(
      safeLambdaAway,
      maxGoals
    );

  const independentJointIncludedMass =
    homeIncludedMass *
    awayIncludedMass;

  const estimatedTailMass =
    clamp(
      1 -
        independentJointIncludedMass,
      0,
      1
    );

  const independentBuild =
    buildIndependentMatrix(
      safeLambdaHome,
      safeLambdaAway,
      maxGoals
    );

  const rawIndependentMass =
    sumProbabilities(
      independentBuild.matrix
    );

  const adjustedBuild =
    buildAdjustedMatrix(
      safeLambdaHome,
      safeLambdaAway,
      maxGoals,
      rho
    );

  const rawAdjustedMass =
    sumProbabilities(
      adjustedBuild.matrix
    );

  const adjustedInvalid =
    adjustedBuild
      .matrix.length === 0 ||
    !Number.isFinite(
      rawAdjustedMass
    ) ||
    rawAdjustedMass <= 0 ||
    adjustedBuild
      .stats
      .invalidAdjustmentCount >
      0 ||
    adjustedBuild
      .stats
      .negativeAdjustedProbabilityCount >
      0 ||
    adjustedBuild
      .stats
      .nonFiniteAdjustedProbabilityCount >
      0;

  const selectedMatrix =
    adjustedInvalid
      ? independentBuild.matrix
      : adjustedBuild.matrix;

  const selectedStats =
    adjustedInvalid
      ? independentBuild.stats
      : adjustedBuild.stats;

  const normalized =
    normalizeValidMatrix(
      selectedMatrix
    );

  /*
   * Em condições normais, a matriz independente
   * sempre será válida. Esta proteção evita retornar
   * distribuição uniforme caso alguma dependência
   * matemática externa falhe.
   */
  const finalFallbackNeeded =
    normalized.matrix.length === 0 ||
    normalized.normalizedMass <= 0;

  const emergencyMatrix =
    finalFallbackNeeded
      ? [
          {
            homeGoals: 0,
            awayGoals: 0,
            probability: 1
          }
        ]
      : normalized.matrix;

  const emergencyReason =
    finalFallbackNeeded
      ? "INDEPENDENT_POISSON_MATRIX_INVALID"
      : undefined;

  const fallbackApplied =
    adjustedInvalid ||
    finalFallbackNeeded;

  const invalidAdjustments =
    adjustedBuild
      .stats
      .invalidAdjustmentCount +
    adjustedBuild
      .stats
      .negativeAdjustedProbabilityCount +
    adjustedBuild
      .stats
      .nonFiniteAdjustedProbabilityCount;

  const quality =
    finalFallbackNeeded
      ? "INVALID"
      : classifyQuality(
          estimatedTailMass,
          fallbackApplied,
          selectedStats.invalidCells,
          invalidAdjustments
        );

  const warnings =
    buildWarnings(
      lambdaHomeDiagnostic,
      lambdaAwayDiagnostic,
      maxGoalsDiagnostic,
      rhoDiagnostic,
      adjustedBuild.stats,
      estimatedTailMass,
      normalized
        .normalizationApplied,
      adjustedInvalid
    );

  if (
    finalFallbackNeeded
  ) {
    warnings.push(
      "EMERGENCY_ZERO_ZERO_FALLBACK"
    );
  }

  return {
    matrix:
      emergencyMatrix,

    diagnostics: {
      version:
        VERSION,

      inputs: {
        lambdaHome:
          lambdaHomeDiagnostic,

        lambdaAway:
          lambdaAwayDiagnostic,

        maxGoals:
          maxGoalsDiagnostic,

        rho:
          rhoDiagnostic
      },

      matrix: {
        cells:
          emergencyMatrix.length,

        validCells:
          selectedStats
            .validCells,

        invalidCells:
          selectedStats
            .invalidCells,

        zeroProbabilityCells:
          selectedStats
            .zeroProbabilityCells
      },

      dixonColes: {
        requested:
          rho !== 0,

        applied:
          rho !== 0 &&
          !adjustedInvalid,

        invalidAdjustmentCount:
          adjustedBuild
            .stats
            .invalidAdjustmentCount,

        negativeAdjustedProbabilityCount:
          adjustedBuild
            .stats
            .negativeAdjustedProbabilityCount,

        nonFiniteAdjustedProbabilityCount:
          adjustedBuild
            .stats
            .nonFiniteAdjustedProbabilityCount,

        fallbackToIndependentPoisson:
          adjustedInvalid
      },

      truncation: {
        maxGoals,

        homeIncludedMass,
        awayIncludedMass,

        independentJointIncludedMass,
        estimatedTailMass
      },

      normalization: {
        rawIndependentMass,
        rawAdjustedMass,

        normalizedMass:
          finalFallbackNeeded
            ? 1
            : normalized
                .normalizedMass,

        normalizationApplied:
          normalized
            .normalizationApplied,

        normalizationFactor:
          normalized
            .normalizationFactor,

        fallbackApplied,

        fallbackReason:
          adjustedInvalid
            ? "INVALID_DIXON_COLES_MATRIX"
            : emergencyReason
      },

      quality,

      warnings
    }
  };
}

/* ==========================================
   API LEGADA — COMPATIBILIDADE
========================================== */

export function goalMatrix(
  lambdaHome: number,
  lambdaAway: number,
  options:
    GoalMatrixOptions = {}
): ScoreProbability[] {
  return goalMatrixWithDiagnostics(
    lambdaHome,
    lambdaAway,
    options
  ).matrix;
}

/* ==========================================
   MERCADOS
========================================== */

export function matchOutcomeProbabilities(
  matrix: ScoreProbability[]
): MatchOutcome {
  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;

  for (
    const score of matrix
  ) {
    const probability =
      safeProbability(
        score.probability
      );

    if (
      score.homeGoals >
      score.awayGoals
    ) {
      homeWin +=
        probability;
    } else if (
      score.homeGoals ===
      score.awayGoals
    ) {
      draw +=
        probability;
    } else {
      awayWin +=
        probability;
    }
  }

  return {
    homeWin,
    draw,
    awayWin
  };
}

export function overUnderProbability(
  matrix: ScoreProbability[],
  line: number
): {
  over: number;
  under: number;
} {
  const parsedLine =
    parseFiniteNumber(
      line,
      2.5
    );

  const safeLine =
    parsedLine.value;

  let over = 0;
  let under = 0;

  for (
    const cell of matrix
  ) {
    const probability =
      safeProbability(
        cell.probability
      );

    const totalGoals =
      cell.homeGoals +
      cell.awayGoals;

    if (
      totalGoals >
      safeLine
    ) {
      over +=
        probability;
    } else {
      under +=
        probability;
    }
  }

  return {
    over,
    under
  };
}

export function bttsProbability(
  matrix: ScoreProbability[]
): {
  yes: number;
  no: number;
} {
  let yes = 0;
  let no = 0;

  for (
    const cell of matrix
  ) {
    const probability =
      safeProbability(
        cell.probability
      );

    if (
      cell.homeGoals > 0 &&
      cell.awayGoals > 0
    ) {
      yes +=
        probability;
    } else {
      no +=
        probability;
    }
  }

  return {
    yes,
    no
  };
}
