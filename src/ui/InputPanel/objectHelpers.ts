import type { TeamStatsPayload } from "./types";

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
