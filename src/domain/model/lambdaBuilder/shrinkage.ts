import {
  clamp,
  safeNumber,
  safePositiveNumber
} from "./numericHelpers";

import {
  MIN_ADAPTIVE_SHRINK,
  MAX_ADAPTIVE_SHRINK
} from "./constants";

/* ==========================================
   SHRINKAGE
========================================== */

export function calculateAdaptiveShrinkFactor(
  matchesPlayed: number,
  inputQuality: number
): number {
  const safeMatches =
    clamp(
      matchesPlayed,
      0,
      100
    );

  const safeQuality =
    clamp(
      inputQuality,
      0,
      1
    );

  const sampleComponent =
    safeMatches <= 5
      ? 1
      : safeMatches >= 30
        ? 0
        : 1 -
          (
            safeMatches - 5
          ) /
          25;

  const qualityComponent =
    1 -
    safeQuality;

  const blendedSeverity =
    clamp(
      sampleComponent * 0.70 +
      qualityComponent * 0.30,
      0,
      1
    );

  return (
    MIN_ADAPTIVE_SHRINK +
    (
      MAX_ADAPTIVE_SHRINK -
      MIN_ADAPTIVE_SHRINK
    ) *
    blendedSeverity
  );
}

export function shrinkStat(
  raw: unknown,
  leagueAverage: number,
  matchesPlayed: unknown,
  inputQuality = 1
): number {
  const safeLeagueAverage =
    safePositiveNumber(
      leagueAverage,
      1.25
    );

  const safeRaw =
    clamp(
      safeNumber(
        raw,
        safeLeagueAverage
      ),
      0,
      6
    );

  const safeMatches =
    clamp(
      safeNumber(
        matchesPlayed,
        0
      ),
      0,
      100
    );

  const adaptiveShrink =
    calculateAdaptiveShrinkFactor(
      safeMatches,
      inputQuality
    );

  const denominator =
    safeMatches +
    adaptiveShrink;

  const sampleWeight =
    denominator > 0
      ? safeMatches /
        denominator
      : 0;

  return (
    safeRaw *
      sampleWeight +
    safeLeagueAverage *
      (
        1 -
        sampleWeight
      )
  );
}
