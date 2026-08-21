import {
  type RawTeamStats,
  type ResolvedNumber,
  type StatSource
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
  const parsed =
    parseFiniteNumber(
      value
    );

  return parsed ??
    fallback;
}

export function parseFiniteNumber(
  value: unknown
): number | null {
  if (
    value === undefined ||
    value === null ||
    value === "" ||
    typeof value === "boolean"
  ) {
    return null;
  }

  const parsed =
    Number(
      String(value)
        .replace(",", ".")
        .trim()
    );

  return Number.isFinite(
    parsed
  )
    ? parsed
    : null;
}

export function parseNonNegativeNumber(
  value: unknown
): number | null {
  const parsed =
    parseFiniteNumber(
      value
    );

  if (
    parsed === null ||
    parsed < 0
  ) {
    return null;
  }

  return parsed;
}

export function normalizePercent(
  value: unknown,
  fallback = 0.5
): number {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  if (
    typeof value === "string" &&
    value.includes("%")
  ) {
    const parsed =
      Number.parseFloat(
        value
      );

    return Number.isFinite(
      parsed
    )
      ? clamp(
          parsed / 100,
          0,
          1
        )
      : fallback;
  }

  const parsed =
    parseFiniteNumber(
      value
    );

  if (
    parsed === null
  ) {
    return fallback;
  }

  return clamp(
    parsed > 1
      ? parsed / 100
      : parsed,
    0,
    1
  );
}

export function normalizeStrings(
  values: string[]
): string[] {
  return [
    ...new Set(
      values
        .map(
          value =>
            String(
              value ??
              ""
            ).trim()
        )
        .filter(Boolean)
    )
  ];
}

/* ==========================================
   RESOLUÇÃO DE ESTATÍSTICAS
========================================== */

export function resolveFirstNumber(
  candidates: Array<{
    value: unknown;
    source: StatSource;
  }>,
  fallback: number,
  maximum: number
): ResolvedNumber {
  for (
    const candidate of candidates
  ) {
    const parsed =
      parseNonNegativeNumber(
        candidate.value
      );

    if (
      parsed !== null
    ) {
      return {
        value:
          clamp(
            parsed,
            0,
            maximum
          ),

        source:
          candidate.source,

        available:
          true,

        usedFallback:
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
      "neutralFallback",

    available:
      false,

    usedFallback:
      true,

    derivedFromTotals:
      false
  };
}

export function resolveOptionalNumber(
  candidates: Array<{
    value: unknown;
    source: StatSource;
  }>,
  maximum: number
): ResolvedNumber {
  for (
    const candidate of candidates
  ) {
    const parsed =
      parseNonNegativeNumber(
        candidate.value
      );

    if (
      parsed !== null
    ) {
      return {
        value:
          clamp(
            parsed,
            0,
            maximum
          ),

        source:
          candidate.source,

        available:
          true,

        usedFallback:
          false,

        derivedFromTotals:
          false
      };
    }
  }

  return {
    value:
      0,

    source:
      "missing",

    available:
      false,

    usedFallback:
      false,

    derivedFromTotals:
      false
  };
}

export function resolveMatches(
  stats: RawTeamStats
): ResolvedNumber {
  const matchesPlayed =
    parseNonNegativeNumber(
      stats.matchesPlayed
    );

  if (
    matchesPlayed !== null
  ) {
    return {
      value:
        clamp(
          matchesPlayed,
          0,
          100
        ),

      source:
        "matchesPlayed",

      available:
        true,

      usedFallback:
        false,

      derivedFromTotals:
        false
    };
  }

  const matches =
    parseNonNegativeNumber(
      stats.matches
    );

  if (
    matches !== null
  ) {
    return {
      value:
        clamp(
          matches,
          0,
          100
        ),

      source:
        "matches",

      available:
        true,

      usedFallback:
        false,

      derivedFromTotals:
        false
    };
  }

  return {
    value:
      0,

    source:
      "missing",

    available:
      false,

    usedFallback:
      false,

    derivedFromTotals:
      false
  };
}

export function derivePerGameRate(
  total: unknown,
  matches: number
): number | null {
  const parsedTotal =
    parseNonNegativeNumber(
      total
    );

  if (
    parsedTotal === null ||
    !Number.isFinite(
      matches
    ) ||
    matches <= 0
  ) {
    return null;
  }

  const result =
    parsedTotal /
    matches;

  return Number.isFinite(
    result
  )
    ? result
    : null;
}
