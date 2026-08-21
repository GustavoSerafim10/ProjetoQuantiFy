import { MIN_LAMBDA, MAX_LAMBDA } from "./constants";
import { approximatelyEqual, clamp, parseFiniteNumber, roundNumber } from "./numericHelpers";
import { type LambdaDiagnostics, type SanitizedLambda } from "./types";

/* ==========================================
   VALIDAÇÃO DOS LAMBDAS
========================================== */

export function sanitizeLambda(
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

export function createLambdaDiagnostics(
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
