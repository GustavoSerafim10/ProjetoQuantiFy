/* ==========================================
   HELPERS
========================================== */

export function firstFiniteNumber(
  values: unknown[]
): number | null {
  for (
    const value of values
  ) {
    const parsed =
      parseFiniteNumber(
        value
      );

    if (
      parsed !== null
    ) {
      return parsed;
    }
  }

  return null;
}

export function firstProbability(
  values: unknown[]
): number | null {
  for (
    const value of values
  ) {
    const parsed =
      parseProbability(
        value
      );

    if (
      parsed !== null
    ) {
      return parsed;
    }
  }

  return null;
}

export function parseProbability(
  value: unknown
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value === "boolean"
  ) {
    return null;
  }

  const parsed =
    Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed < 0 ||
    parsed > 1
  ) {
    return null;
  }

  return parsed;
}

export function parseOdd(
  value: unknown
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value === "boolean"
  ) {
    return null;
  }

  const parsed =
    Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed <= 1
  ) {
    return null;
  }

  return parsed;
}

export function parseFiniteNumber(
  value: unknown
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value === "boolean"
  ) {
    return null;
  }

  const parsed =
    Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

export function parseNonNegativeNumber(
  value: unknown
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value === "boolean"
  ) {
    return null;
  }

  const parsed =
    Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed < 0
  ) {
    return null;
  }

  return parsed;
}

export function parsePositiveInteger(
  value: unknown
): number | null {
  const parsed =
    parseFiniteNumber(value);

  if (
    parsed === null ||
    !Number.isInteger(parsed) ||
    parsed <= 0
  ) {
    return null;
  }

  return parsed;
}

export function safeFiniteNumber(
  value: unknown,
  fallback: number
): number {
  const parsed =
    parseFiniteNumber(value);

  return parsed ??
    fallback;
}

export function normalizeWarnings(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const warnings =
    value
      .map(
        warning =>
          String(
            warning ??
            ""
          ).trim()
      )
      .filter(Boolean);

  return [
    ...new Set(
      warnings
    )
  ];
}

export function clamp(
  value: number,
  minimum: number,
  maximum: number
): number {
  if (!Number.isFinite(value)) {
    return minimum;
  }

  return Math.max(
    minimum,
    Math.min(
      value,
      maximum
    )
  );
}

export function roundNumber(
  value: number,
  decimals = 6
): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const factor =
    10 ** decimals;

  return (
    Math.round(
      value *
      factor
    ) /
    factor
  );
}
