import type { TeamStatsPayload } from "./types";

/* ==========================================
   VALIDAÇÃO DOS CAMPOS OBRIGATÓRIOS
========================================== */

export function validateRequiredTeamFields({
  homeStats,
  awayStats,
  homeTeam,
  awayTeam
}: {
  homeStats:
    TeamStatsPayload;

  awayStats:
    TeamStatsPayload;

  homeTeam:
    string;

  awayTeam:
    string;
}): string[] {
  const errors:
    string[] = [];

  validateRequiredStatsForTeam(
    homeStats,
    homeTeam,
    errors
  );

  validateRequiredStatsForTeam(
    awayStats,
    awayTeam,
    errors
  );

  return errors;
}

function validateRequiredStatsForTeam(
  stats: TeamStatsPayload,
  teamName: string,
  errors: string[]
) {
  if (
    !isPositiveNumber(
      stats.matches
    )
  ) {
    errors.push(
      `${teamName}: informe a quantidade de partidas.`
    );
  }

  if (
    !isNonNegativeNumber(
      stats.goalsFor
    )
  ) {
    errors.push(
      `${teamName}: informe os gols marcados.`
    );
  }

  if (
    !isNonNegativeNumber(
      stats.goalsAgainst
    )
  ) {
    errors.push(
      `${teamName}: informe os gols sofridos.`
    );
  }

  if (
    !isNonNegativeNumber(
      stats.goalsPerGame
    )
  ) {
    errors.push(
      `${teamName}: informe os gols por jogo.`
    );
  }

  if (
    !isNonNegativeNumber(
      stats.goalsConcededPerGame
    )
  ) {
    errors.push(
      `${teamName}: informe os gols sofridos por jogo.`
    );
  }
}

/* ==========================================
   VALIDAÇÃO DE COERÊNCIA
========================================== */

export function validateTeamConsistency(
  stats:
    TeamStatsPayload,

  teamName:
    string
): string[] {
  const errors:
    string[] = [];

  const matches =
    stats.matches;

  const goalsFor =
    stats.goalsFor;

  const goalsAgainst =
    stats.goalsAgainst;

  const goalsPerGame =
    stats.goalsPerGame;

  const goalsConcededPerGame =
    stats.goalsConcededPerGame;

  if (
    isPositiveNumber(
      matches
    ) &&
    isNonNegativeNumber(
      goalsFor
    ) &&
    isNonNegativeNumber(
      goalsPerGame
    )
  ) {
    const calculatedGoalsPerGame =
      goalsFor /
      matches;

    const difference =
      Math.abs(
        calculatedGoalsPerGame -
        goalsPerGame
      );

    /*
     * Tolerância de 0,20 permite arredondamentos
     * comuns como:
     *
     * 28 / 18 = 1,555...
     * SofaScore = 1,6
     */
    if (
      difference >
      0.2
    ) {
      errors.push(
        `${teamName}: gols por jogo inconsistentes. ` +
        `${goalsFor} gols em ${matches} jogos equivalem a ` +
        `${calculatedGoalsPerGame.toFixed(2)}, mas foi informado ` +
        `${goalsPerGame.toFixed(2)}.`
      );
    }
  }

  if (
    isPositiveNumber(
      matches
    ) &&
    isNonNegativeNumber(
      goalsAgainst
    ) &&
    isNonNegativeNumber(
      goalsConcededPerGame
    )
  ) {
    const calculatedConcededPerGame =
      goalsAgainst /
      matches;

    const difference =
      Math.abs(
        calculatedConcededPerGame -
        goalsConcededPerGame
      );

    if (
      difference >
      0.2
    ) {
      errors.push(
        `${teamName}: gols sofridos por jogo inconsistentes. ` +
        `${goalsAgainst} gols sofridos em ${matches} jogos equivalem a ` +
        `${calculatedConcededPerGame.toFixed(2)}, mas foi informado ` +
        `${goalsConcededPerGame.toFixed(2)}.`
      );
    }
  }

  return errors;
}

/* ==========================================
   VALIDAÇÃO NUMÉRICA
========================================== */

function isPositiveNumber(
  value:
    unknown
): value is number {
  return (
    typeof value ===
      "number" &&
    Number.isFinite(
      value
    ) &&
    value > 0
  );
}

function isNonNegativeNumber(
  value:
    unknown
): value is number {
  return (
    typeof value ===
      "number" &&
    Number.isFinite(
      value
    ) &&
    value >= 0
  );
}
