import type { TeamStatsPayload, ExternalDataInspection } from "./types";

/* ==========================================
   WARNINGS DO PAYLOAD
========================================== */

export function createPayloadWarnings({
  homeStats,
  awayStats,
  externalDataStatus
}: {
  homeStats:
    TeamStatsPayload;

  awayStats:
    TeamStatsPayload;

  externalDataStatus:
    ExternalDataInspection;
}): string[] {
  const warnings:
    string[] = [];

  if (
    externalDataStatus.partial
  ) {
    warnings.push(
      "EXTERNAL_DATA_PARTIAL"
    );
  }

  if (
    homeStats.shotsOnTargetPerGame ===
    undefined
  ) {
    warnings.push(
      "MISSING_HOME_SHOTS_ON_TARGET"
    );
  }

  if (
    awayStats.shotsOnTargetPerGame ===
    undefined
  ) {
    warnings.push(
      "MISSING_AWAY_SHOTS_ON_TARGET"
    );
  }

  if (
    homeStats.bigChances ===
    undefined
  ) {
    warnings.push(
      "MISSING_HOME_BIG_CHANCES"
    );
  }

  if (
    awayStats.bigChances ===
    undefined
  ) {
    warnings.push(
      "MISSING_AWAY_BIG_CHANCES"
    );
  }

  return warnings;
}

/* ==========================================
   WARNINGS
========================================== */

export function normalizeWarnings(
  warnings:
    string[]
): string[] {
  return [
    ...new Set(
      warnings
        .map(
          warning =>
            String(
              warning ??
              ""
            ).trim()
        )
        .filter(
          Boolean
        )
    )
  ];
}

export function formatWarning(
  warning:
    string
): string {
  return warning
    .replace(
      /_/g,
      " "
    )
    .toLowerCase()
    .replace(
      /^./,
      character =>
        character.toUpperCase()
    );
}
