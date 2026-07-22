type RawTeamStats = {
  matches?: unknown;
  avgGoals?: unknown;
  avgGoalsAgainst?: unknown;
  avgShots?: unknown;
  avgShotsOnTarget?: unknown;
  last5Goals?: unknown;

  [key: string]: unknown;
};

const clamp = (
  value: number,
  min: number,
  max: number
): number => {
  return Math.min(Math.max(value, min), max);
};

const safeNumber = (
  value: unknown,
  fallback = 0
): number => {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value === "boolean"
  ) {
    return fallback;
  }

  const normalizedValue =
    typeof value === "string"
      ? value.replace(",", ".").trim()
      : value;

  const parsed = Number(normalizedValue);

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
};

export function normalizeStats(
  stats: RawTeamStats = {}
) {
  /*
   * Os limites abaixo não representam previsões.
   * Eles funcionam somente como proteção contra:
   *
   * - erros de digitação;
   * - valores negativos;
   * - Infinity;
   * - escalas absurdas;
   * - contaminação dos modelos posteriores.
   */

  const matches = Math.round(
    clamp(
      safeNumber(stats.matches, 10),
      1,
      100
    )
  );

  const avgGoals = clamp(
    safeNumber(stats.avgGoals, 0),
    0,
    6
  );

  const avgGoalsAgainst = clamp(
    safeNumber(stats.avgGoalsAgainst, 0),
    0,
    6
  );

  const avgShots = clamp(
    safeNumber(stats.avgShots, 0),
    0,
    40
  );

  const rawShotsOnTarget = clamp(
    safeNumber(stats.avgShotsOnTarget, 0),
    0,
    25
  );

  /*
   * Finalizações no alvo não podem ultrapassar
   * o total de finalizações.
   */
  const avgShotsOnTarget = Math.min(
    rawShotsOnTarget,
    avgShots
  );

  /*
   * Consideramos last5Goals como o total de gols
   * marcados nos últimos cinco jogos.
   */
  const last5Goals = clamp(
    safeNumber(stats.last5Goals, 0),
    0,
    30
  );

  /* ===============================
     DERIVED FEATURES
  ================================ */

  const shotAccuracy =
    avgShots > 0
      ? clamp(
          avgShotsOnTarget / avgShots,
          0,
          1
        )
      : 0;

  /*
   * Gols por finalização no alvo.
   *
   * O cap evita que amostras pequenas ou dados
   * inconsistentes criem eficiências extremas.
   *
   * Esse valor não deve ser utilizado sozinho
   * para aumentar lambda ou probabilidade.
   */
  const rawOffensiveEfficiency =
    avgShotsOnTarget > 0
      ? avgGoals / avgShotsOnTarget
      : 0;

  const offensiveEfficiency = clamp(
    rawOffensiveEfficiency,
    0,
    0.75
  );

  /*
   * Não dividimos gols sofridos por gols marcados.
   * Isso misturaria ataque e defesa.
   *
   * A escala 1.35 é uma referência neutra provisória
   * por equipe e deverá futuramente vir da configuração
   * específica da liga.
   *
   * Valor:
   * < 1 = defesa melhor que a referência
   * = 1 = defesa próxima da referência
   * > 1 = defesa mais vulnerável
   */
  const referenceGoalsAgainst = 1.35;

  const defensiveFragility = clamp(
    avgGoalsAgainst / referenceGoalsAgainst,
    0,
    3
  );

  const recentGoalTrend = clamp(
    last5Goals / 5,
    0,
    6
  );

  /*
   * Feature de confiabilidade da amostra.
   *
   * Cresce de forma conservadora e atinge 1
   * a partir de 10 partidas.
   *
   * Não altera a probabilidade diretamente.
   */
  const sampleReliability = clamp(
    matches / 10,
    0.1,
    1
  );

  return {
    ...stats,

    matches,

    avgGoals,
    avgGoalsAgainst,

    avgShots,
    avgShotsOnTarget,

    last5Goals,

    goalsPerGame: avgGoals,
    goalsConcededPerGame: avgGoalsAgainst,

    shotsPerGame: avgShots,
    shotsOnTargetPerGame: avgShotsOnTarget,

    shotAccuracy,
    offensiveEfficiency,
    defensiveFragility,
    recentGoalTrend,

    sampleReliability
  };
}