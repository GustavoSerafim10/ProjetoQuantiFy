/* ==========================================
   DIXON-COLES ADJUSTMENT — QUANTIFY V7.1 ELITE
========================================== */

/*
 * Responsabilidade:
 *
 * - calcular o fator tau de Dixon-Coles;
 * - atuar somente sobre 0–0, 0–1, 1–0 e 1–1;
 * - validar gols, lambdas e rho de forma estrita;
 * - preservar positividade matemática dos fatores;
 * - expor metadata detalhada sem quebrar a API antiga.
 *
 * Compatibilidade:
 *
 * - dixonColesAdjustment(...): retorna apenas number;
 * - dixonColesAdjustmentDetailed(...): retorna fator + debug.
 */

const VERSION = "V7.1_ELITE" as const;

const EPSILON = 1e-10;

const DEFAULT_HOME_LAMBDA = 1.32;
const DEFAULT_AWAY_LAMBDA = 1.23;

/* ==========================================
   TIPOS PÚBLICOS
========================================== */

export type DixonColesScoreCell =
  | "0-0"
  | "0-1"
  | "1-0"
  | "1-1"
  | "OTHER"
  | "INVALID";

export interface DixonColesRhoBounds {
  lowerBound: number;
  upperBound: number;

  mathematicalMinimum: number;
  mathematicalMaximum: number;

  valid: boolean;
}

export interface DixonColesAdjustmentMeta {
  version: typeof VERSION;

  valid: boolean;
  neutralFactorUsed: boolean;

  scoreCell: DixonColesScoreCell;
  lowScoreCell: boolean;

  homeGoals: number;
  awayGoals: number;

  lambdaHome: number;
  lambdaAway: number;

  rhoInput: number;
  rho: number;

  rhoClampApplied: boolean;
  rhoNeutralFallbackUsed: boolean;

  adjustment: number;

  bounds: DixonColesRhoBounds;

  warnings: string[];
}

export interface DixonColesAdjustmentResult {
  adjustment: number;
  meta: DixonColesAdjustmentMeta;
}

/* ==========================================
   TIPOS INTERNOS
========================================== */

interface ParsedNumber {
  value: number;
  valid: boolean;
  fallbackUsed: boolean;
}

interface SanitizedLambda {
  value: number;
  valid: boolean;
  fallbackUsed: boolean;
  epsilonFloorApplied: boolean;
}

interface SanitizedGoals {
  value: number;
  valid: boolean;
}

interface ConstrainedRho {
  value: number;
  inputValue: number;
  inputValid: boolean;

  clampApplied: boolean;
  neutralFallbackUsed: boolean;

  bounds: DixonColesRhoBounds;
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

function approximatelyEqual(
  first: number,
  second: number,
  tolerance = 1e-12
): boolean {
  return (
    Math.abs(first - second) <=
    tolerance
  );
}

/* ==========================================
   SANITIZAÇÃO DAS ENTRADAS
========================================== */

function sanitizeLambda(
  value: unknown,
  fallback: number
): SanitizedLambda {
  const parsed =
    parseFiniteNumber(
      value,
      fallback
    );

  const floored =
    Math.max(
      parsed.value,
      EPSILON
    );

  return {
    value: floored,

    valid:
      parsed.valid &&
      parsed.value > 0,

    fallbackUsed:
      parsed.fallbackUsed,

    epsilonFloorApplied:
      parsed.value <= 0
  };
}

function sanitizeGoals(
  value: unknown
): SanitizedGoals {
  const parsed =
    parseFiniteNumber(
      value,
      -1
    );

  const valid =
    parsed.valid &&
    parsed.value >= 0 &&
    Number.isInteger(
      parsed.value
    );

  return {
    value:
      valid
        ? parsed.value
        : -1,

    valid
  };
}

/* ==========================================
   IDENTIFICAÇÃO DA CÉLULA
========================================== */

function identifyScoreCell(
  homeGoals: SanitizedGoals,
  awayGoals: SanitizedGoals
): DixonColesScoreCell {
  if (
    !homeGoals.valid ||
    !awayGoals.valid
  ) {
    return "INVALID";
  }

  if (
    homeGoals.value === 0 &&
    awayGoals.value === 0
  ) {
    return "0-0";
  }

  if (
    homeGoals.value === 0 &&
    awayGoals.value === 1
  ) {
    return "0-1";
  }

  if (
    homeGoals.value === 1 &&
    awayGoals.value === 0
  ) {
    return "1-0";
  }

  if (
    homeGoals.value === 1 &&
    awayGoals.value === 1
  ) {
    return "1-1";
  }

  return "OTHER";
}

/* ==========================================
   LIMITES MATEMÁTICOS DO RHO
========================================== */

function calculateRhoBounds(
  lambdaHome: number,
  lambdaAway: number
): DixonColesRhoBounds {
  /*
   * Positividade:
   *
   * tau(0,1) = 1 + λHρ > 0
   * tau(1,0) = 1 + λAρ > 0
   */
  const mathematicalMinimum =
    Math.max(
      -1 / lambdaHome,
      -1 / lambdaAway
    ) + EPSILON;

  /*
   * Positividade:
   *
   * tau(0,0) = 1 - λHλAρ > 0
   * tau(1,1) = 1 - ρ > 0
   */
  const mathematicalMaximum =
    Math.min(
      1,
      1 /
        (
          lambdaHome *
          lambdaAway
        )
    ) - EPSILON;

  const valid =
    Number.isFinite(
      mathematicalMinimum
    ) &&
    Number.isFinite(
      mathematicalMaximum
    ) &&
    mathematicalMinimum <=
      mathematicalMaximum;

  return {
    lowerBound:
      valid
        ? mathematicalMinimum
        : 0,

    upperBound:
      valid
        ? mathematicalMaximum
        : 0,

    mathematicalMinimum:
      safeNumber(
        mathematicalMinimum,
        0
      ),

    mathematicalMaximum:
      safeNumber(
        mathematicalMaximum,
        0
      ),

    valid
  };
}

function constrainRho(
  rhoInput: unknown,
  lambdaHome: number,
  lambdaAway: number
): ConstrainedRho {
  const parsed =
    parseFiniteNumber(
      rhoInput,
      0
    );

  const bounds =
    calculateRhoBounds(
      lambdaHome,
      lambdaAway
    );

  if (!bounds.valid) {
    return {
      value: 0,
      inputValue:
        parsed.value,
      inputValid:
        parsed.valid,

      clampApplied: false,
      neutralFallbackUsed: true,

      bounds
    };
  }

  const constrained =
    clamp(
      parsed.value,
      bounds.lowerBound,
      bounds.upperBound
    );

  return {
    value:
      constrained,

    inputValue:
      parsed.value,

    inputValid:
      parsed.valid,

    clampApplied:
      !approximatelyEqual(
        constrained,
        parsed.value
      ),

    neutralFallbackUsed:
      false,

    bounds
  };
}

/* ==========================================
   CORE DIXON-COLES
========================================== */

function calculateAdjustment(
  scoreCell: DixonColesScoreCell,
  lambdaHome: number,
  lambdaAway: number,
  rho: number
): number {
  switch (scoreCell) {
    case "0-0":
      return (
        1 -
        (
          lambdaHome *
          lambdaAway *
          rho
        )
      );

    case "0-1":
      return (
        1 +
        (
          lambdaHome *
          rho
        )
      );

    case "1-0":
      return (
        1 +
        (
          lambdaAway *
          rho
        )
      );

    case "1-1":
      return (
        1 - rho
      );

    default:
      return 1;
  }
}

/* ==========================================
   WARNINGS
========================================== */

function buildWarnings(
  homeGoals: SanitizedGoals,
  awayGoals: SanitizedGoals,
  homeLambda: SanitizedLambda,
  awayLambda: SanitizedLambda,
  constrainedRho: ConstrainedRho,
  neutralFactorUsed: boolean
): string[] {
  const warnings: string[] = [];

  if (!homeGoals.valid) {
    warnings.push(
      "INVALID_HOME_GOALS_INPUT"
    );
  }

  if (!awayGoals.valid) {
    warnings.push(
      "INVALID_AWAY_GOALS_INPUT"
    );
  }

  if (!homeLambda.valid) {
    warnings.push(
      "INVALID_HOME_LAMBDA_INPUT"
    );
  }

  if (!awayLambda.valid) {
    warnings.push(
      "INVALID_AWAY_LAMBDA_INPUT"
    );
  }

  if (homeLambda.fallbackUsed) {
    warnings.push(
      "HOME_LAMBDA_FALLBACK_USED"
    );
  }

  if (awayLambda.fallbackUsed) {
    warnings.push(
      "AWAY_LAMBDA_FALLBACK_USED"
    );
  }

  if (
    homeLambda.epsilonFloorApplied
  ) {
    warnings.push(
      "HOME_LAMBDA_EPSILON_FLOOR"
    );
  }

  if (
    awayLambda.epsilonFloorApplied
  ) {
    warnings.push(
      "AWAY_LAMBDA_EPSILON_FLOOR"
    );
  }

  if (!constrainedRho.inputValid) {
    warnings.push(
      "INVALID_RHO_INPUT"
    );
  }

  if (
    constrainedRho.clampApplied
  ) {
    warnings.push(
      "RHO_CLAMP_APPLIED"
    );
  }

  if (
    constrainedRho
      .neutralFallbackUsed
  ) {
    warnings.push(
      "RHO_NEUTRAL_FALLBACK_USED"
    );
  }

  if (neutralFactorUsed) {
    warnings.push(
      "NEUTRAL_ADJUSTMENT_USED"
    );
  }

  return warnings;
}

/* ==========================================
   API DETALHADA V7.1
========================================== */

export function dixonColesAdjustmentDetailed(
  homeGoals: number,
  awayGoals: number,
  lambdaHome: number,
  lambdaAway: number,
  rhoInput: number
): DixonColesAdjustmentResult {
  const safeHomeGoals =
    sanitizeGoals(homeGoals);

  const safeAwayGoals =
    sanitizeGoals(awayGoals);

  const scoreCell =
    identifyScoreCell(
      safeHomeGoals,
      safeAwayGoals
    );

  const lowScoreCell =
    scoreCell === "0-0" ||
    scoreCell === "0-1" ||
    scoreCell === "1-0" ||
    scoreCell === "1-1";

  /*
   * Para placar inválido ou célula fora do bloco
   * Dixon-Coles, o fator correto é neutro.
   */
  if (
    scoreCell === "INVALID" ||
    scoreCell === "OTHER"
  ) {
    const neutralBounds: DixonColesRhoBounds = {
      lowerBound: 0,
      upperBound: 0,
      mathematicalMinimum: 0,
      mathematicalMaximum: 0,
      valid: true
    };

    const warnings =
      scoreCell === "INVALID"
        ? buildWarnings(
            safeHomeGoals,
            safeAwayGoals,
            {
              value:
                DEFAULT_HOME_LAMBDA,
              valid: true,
              fallbackUsed: false,
              epsilonFloorApplied: false
            },
            {
              value:
                DEFAULT_AWAY_LAMBDA,
              valid: true,
              fallbackUsed: false,
              epsilonFloorApplied: false
            },
            {
              value: 0,
              inputValue: 0,
              inputValid: true,
              clampApplied: false,
              neutralFallbackUsed: false,
              bounds:
                neutralBounds
            },
            true
          )
        : [];

    return {
      adjustment: 1,

      meta: {
        version:
          VERSION,

        valid:
          scoreCell !== "INVALID",

        neutralFactorUsed:
          true,

        scoreCell,
        lowScoreCell,

        homeGoals:
          safeHomeGoals.value,

        awayGoals:
          safeAwayGoals.value,

        lambdaHome:
          DEFAULT_HOME_LAMBDA,

        lambdaAway:
          DEFAULT_AWAY_LAMBDA,

        rhoInput:
          safeNumber(
            rhoInput,
            0
          ),

        rho: 0,

        rhoClampApplied: false,
        rhoNeutralFallbackUsed: false,

        adjustment: 1,

        bounds:
          neutralBounds,

        warnings
      }
    };
  }

  const safeLambdaHome =
    sanitizeLambda(
      lambdaHome,
      DEFAULT_HOME_LAMBDA
    );

  const safeLambdaAway =
    sanitizeLambda(
      lambdaAway,
      DEFAULT_AWAY_LAMBDA
    );

  const constrainedRho =
    constrainRho(
      rhoInput,
      safeLambdaHome.value,
      safeLambdaAway.value
    );

  const rawAdjustment =
    calculateAdjustment(
      scoreCell,
      safeLambdaHome.value,
      safeLambdaAway.value,
      constrainedRho.value
    );

  const adjustmentValid =
    Number.isFinite(
      rawAdjustment
    ) &&
    rawAdjustment > 0;

  const adjustment =
    adjustmentValid
      ? rawAdjustment
      : 1;

  const neutralFactorUsed =
    !adjustmentValid;

  const warnings =
    buildWarnings(
      safeHomeGoals,
      safeAwayGoals,
      safeLambdaHome,
      safeLambdaAway,
      constrainedRho,
      neutralFactorUsed
    );

  const valid =
    safeHomeGoals.valid &&
    safeAwayGoals.valid &&
    safeLambdaHome.valid &&
    safeLambdaAway.valid &&
    constrainedRho.inputValid &&
    constrainedRho.bounds.valid &&
    adjustmentValid;

  return {
    adjustment,

    meta: {
      version:
        VERSION,

      valid,

      neutralFactorUsed,

      scoreCell,
      lowScoreCell,

      homeGoals:
        safeHomeGoals.value,

      awayGoals:
        safeAwayGoals.value,

      lambdaHome:
        safeLambdaHome.value,

      lambdaAway:
        safeLambdaAway.value,

      rhoInput:
        constrainedRho.inputValue,

      rho:
        constrainedRho.value,

      rhoClampApplied:
        constrainedRho
          .clampApplied,

      rhoNeutralFallbackUsed:
        constrainedRho
          .neutralFallbackUsed,

      adjustment,

      bounds:
        constrainedRho.bounds,

      warnings
    }
  };
}

/* ==========================================
   API LEGADA COMPATÍVEL
========================================== */

export function dixonColesAdjustment(
  homeGoals: number,
  awayGoals: number,
  lambdaHome: number,
  lambdaAway: number,
  rhoInput: number
): number {
  return dixonColesAdjustmentDetailed(
    homeGoals,
    awayGoals,
    lambdaHome,
    lambdaAway,
    rhoInput
  ).adjustment;
}
