import type { TeamStatsPayload, OddsPayload } from "./types";

/* ==========================================
   LIMPEZA DOS OBJETOS
========================================== */

export function removeInvalidTeamStats(
  input:
    Record<
      keyof TeamStatsPayload,
      number | null
    >
): TeamStatsPayload {
  const output:
    TeamStatsPayload = {};

  for (
    const [
      rawKey,
      value
    ] of Object.entries(
      input
    )
  ) {
    if (
      value === null ||
      !Number.isFinite(
        value
      ) ||
      value < 0
    ) {
      continue;
    }

    const key =
      rawKey as
        keyof TeamStatsPayload;

    output[key] =
      value;
  }

  return output;
}

export function removeInvalidOdds(
  input:
    Record<
      keyof OddsPayload,
      number | null
    >
): OddsPayload {
  const output:
    OddsPayload = {};

  for (
    const [
      rawKey,
      value
    ] of Object.entries(
      input
    )
  ) {
    if (
      value === null ||
      !Number.isFinite(
        value
      ) ||
      value <= 1
    ) {
      continue;
    }

    const key =
      rawKey as
        keyof OddsPayload;

    output[key] =
      value;
  }

  return output;
}
