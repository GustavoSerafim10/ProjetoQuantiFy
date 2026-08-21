import { MASS_TOLERANCE, ROUND_DECIMALS } from "./constants";
import { type ParsedNumber } from "./types";

/* ==========================================
   HELPERS NUMÉRICOS
========================================== */

export function clamp(
  value: number,
  min: number,
  max: number
): number {
  return Math.max(
    min,
    Math.min(max, value)
  );
}

export function isMissingNumericValue(
  value: unknown
): boolean {
  return (
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value === "boolean"
  );
}

export function parseFiniteNumber(
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

export function safeNumber(
  value: unknown,
  fallback: number
): number {
  return parseFiniteNumber(
    value,
    fallback
  ).value;
}

export function sanitizeProbability(
  value: unknown
): number {
  return clamp(
    safeNumber(value, 0),
    0,
    1
  );
}

export function roundNumber(
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

export function approximatelyEqual(
  first: number,
  second: number,
  tolerance = MASS_TOLERANCE
): boolean {
  return (
    Math.abs(first - second) <=
    tolerance
  );
}
