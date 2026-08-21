import type { ResolvedNumber } from "./types";

/* ==========================================
   WARNINGS
========================================== */

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
            warning ?? ""
          ).trim()
      )
      .filter(Boolean);

  return [
    ...new Set(
      warnings
    )
  ];
}

/* ==========================================
   PARSERS
========================================== */

export function parseProbability(
  value: unknown
): number | null {
  const parsed =
    parseFiniteNumber(
      value
    );

  if (
    parsed === null ||
    parsed < 0 ||
    parsed > 1
  ) {
    return null;
  }

  return parsed;
}

export function parsePositiveNumber(
  value: unknown
): number | null {
  const parsed =
    parseFiniteNumber(
      value
    );

  if (
    parsed === null ||
    parsed <= 0
  ) {
    return null;
  }

  return parsed;
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

export function parseOdd(
  value: unknown
): number | null {
  const parsed =
    parseFiniteNumber(
      value
    );

  if (
    parsed === null ||
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
    Number(
      value
    );

  return Number.isFinite(
    parsed
  )
    ? parsed
    : null;
}

/* ==========================================
   HELPERS NUMÉRICOS
========================================== */

export function clampProbability(
  value: number
): number {
  return clamp(
    value,
    0,
    1
  );
}

export function clamp(
  value: number,
  minimum: number,
  maximum: number
): number {
  if (
    !Number.isFinite(value)
  ) {
    return maximum;
  }

  return Math.max(
    minimum,
    Math.min(
      value,
      maximum
    )
  );
}

export function roundNullableNumber(
  value: number | null,
  decimals = 6
): number | null {
  if (value === null) {
    return null;
  }

  return roundNumber(
    value,
    decimals
  );
}

export function roundNumber(
  value: number,
  decimals = 6
): number {
  if (
    !Number.isFinite(value)
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
   EXTRAÇÃO DE INCERTEZA V7.2 (candidate resolvers)
========================================== */

/*
 * As funções abaixo foram originalmente
 * declaradas dentro da seção "EXTRAÇÃO DE
 * INCERTEZA V7.2", mas são utilitários
 * genéricos de resolução de candidatos
 * (primeiro valor válido de uma lista).
 *
 * Como são consumidas tanto pela extração de
 * médias (averages.ts) quanto pela extração
 * de incerteza (uncertaintyExtraction.ts),
 * foram centralizadas aqui junto aos demais
 * helpers genéricos — mesmo padrão adotado
 * em decisionPipeline/helpers.ts.
 */

export function firstResolvedProbability(
  candidates: Array<[unknown, string]>
): ResolvedNumber {
  for (const [candidate, source] of candidates) {
    const value = parseProbability(candidate);

    if (value !== null) {
      return { value, source };
    }
  }

  return { value: null, source: "missing" };
}

export function firstResolvedNonNegative(
  candidates: Array<[unknown, string]>
): ResolvedNumber {
  for (const [candidate, source] of candidates) {
    const value = parseNonNegativeNumber(candidate);

    if (value !== null) {
      return { value, source };
    }
  }

  return { value: null, source: "missing" };
}

export function firstBoolean(
  candidates: unknown[]
): boolean | null {
  for (const candidate of candidates) {
    if (typeof candidate === "boolean") {
      return candidate;
    }
  }

  return null;
}

export function firstDefined(
  candidates: unknown[]
): unknown {
  for (const candidate of candidates) {
    if (candidate !== null && candidate !== undefined) {
      return candidate;
    }
  }

  return null;
}

export function firstPositiveNumber(
  candidates: unknown[]
): number | null {
  for (
    const candidate of candidates
  ) {
    const parsed =
      parsePositiveNumber(
        candidate
      );

    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
}

export function firstNonNegativeNumber(
  candidates: unknown[]
): number | null {
  for (
    const candidate of candidates
  ) {
    const parsed =
      parseNonNegativeNumber(
        candidate
      );

    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
}
