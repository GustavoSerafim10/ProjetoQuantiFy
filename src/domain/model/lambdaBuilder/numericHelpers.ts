import type {
  StatSource,
  ResolvedStat,
  ResolvedOptionalStat
} from "./types";

/* ==========================================
   UTILITÁRIOS NUMÉRICOS
========================================== */

export function clamp(
  value: number,
  minimum: number,
  maximum: number
): number {
  if (
    !Number.isFinite(
      value
    )
  ) {
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

export function safeNumber(
  value: unknown,
  fallback: number
): number {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value === "boolean"
  ) {
    return fallback;
  }

  const parsed =
    Number(
      value
    );

  return Number.isFinite(
    parsed
  )
    ? parsed
    : fallback;
}

export function safePositiveNumber(
  value: unknown,
  fallback: number,
  minimum = 0.01
): number {
  const parsed =
    safeNumber(
      value,
      fallback
    );

  return parsed >= minimum
    ? parsed
    : fallback;
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
    Number(
      value
    );

  return Number.isFinite(
    parsed
  )
    ? parsed
    : null;
}

export function roundNumber(
  value: number,
  decimals = 4
): number {
  if (
    !Number.isFinite(
      value
    )
  ) {
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

/* ==========================================
   RESOLVEDORES GENÉRICOS
========================================== */

export function resolveFirstStat(
  candidates: Array<{
    value: unknown;
    source: StatSource;
  }>,
  fallback: number
): ResolvedStat {
  for (
    const candidate of candidates
  ) {
    const parsed =
      parseFiniteNumber(
        candidate.value
      );

    if (
      parsed !== null &&
      parsed >= 0
    ) {
      return {
        value:
          parsed,

        source:
          candidate.source,

        usedLeagueFallback:
          false,

        derivedFromTotals:
          candidate.source ===
            "goalsForDividedByMatches" ||
          candidate.source ===
            "goalsAgainstDividedByMatches"
      };
    }
  }

  return {
    value:
      fallback,

    source:
      "leagueFallback",

    usedLeagueFallback:
      true,

    derivedFromTotals:
      false
  };
}

export function resolveOptionalStat(
  candidates: Array<{
    value: unknown;
    source: StatSource;
  }>
): ResolvedOptionalStat {
  for (
    const candidate of candidates
  ) {
    const parsed =
      parseFiniteNumber(
        candidate.value
      );

    if (
      parsed !== null &&
      parsed >= 0
    ) {
      return {
        value:
          parsed,

        source:
          candidate.source,

        available:
          true
      };
    }
  }

  return {
    value:
      null,

    source:
      "missing",

    available:
      false
  };
}
