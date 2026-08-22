import { calculateDynamicRhoAdvanced } from "../../model/rhoCalculator";
import { autoLearningEngine } from "../../learning/autoLearningEngine";

import { MIN_OPERATIONAL_RHO, MAX_OPERATIONAL_RHO, RHO_EPSILON } from "./constants";
import { approximatelyEqual, clamp, roundNumber, safeNumber } from "./numericHelpers";
import { type RhoBounds, type RhoCalculationResult } from "./types";

/* ==========================================
   RHO — LIMITES E METADATA
========================================== */

export function calculateRhoBounds(
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

export function constrainRho(
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

export function calculateRho(
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

  let learning: ReturnType<typeof autoLearningEngine> | null = null;

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
