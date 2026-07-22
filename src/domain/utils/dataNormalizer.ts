type RawTeamStats = {
  matches?: unknown;
  matchesPlayed?: unknown;

  /*
   * Médias ofensivas.
   */
  avgGoals?: unknown;
  goalsPerGame?: unknown;
  goalsForPerGame?: unknown;

  /*
   * Totais ofensivos.
   */
  goalsFor?: unknown;
  goalsScored?: unknown;

  /*
   * Médias defensivas.
   */
  avgGoalsAgainst?: unknown;
  goalsConcededPerGame?: unknown;
  goalsAgainstPerGame?: unknown;

  /*
   * Totais defensivos.
   */
  goalsAgainst?: unknown;
  goalsConceded?: unknown;

  /*
   * Finalizações.
   */
  avgShots?: unknown;
  shotsPerGame?: unknown;

  avgShotsOnTarget?: unknown;
  shotsOnTargetPerGame?: unknown;

  /*
   * Forma recente.
   */
  last5Goals?: unknown;

  [key: string]: unknown;
};

/* ==========================================
   HELPERS NUMÉRICOS
========================================== */

const clamp = (
  value: number,
  min: number,
  max: number
): number => {
  return Math.min(
    Math.max(value, min),
    max
  );
};

const parseFiniteNumber = (
  value: unknown
): number | null => {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value === "boolean"
  ) {
    return null;
  }

  const normalizedValue =
    typeof value === "string"
      ? value
          .replace(",", ".")
          .trim()
      : value;

  const parsed =
    Number(normalizedValue);

  return Number.isFinite(parsed)
    ? parsed
    : null;
};

const firstFiniteNumber = (
  candidates: unknown[]
): number | null => {
  for (const candidate of candidates) {
    const parsed =
      parseFiniteNumber(candidate);

    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
};

const roundNumber = (
  value: number,
  decimals = 6
): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const factor =
    10 ** decimals;

  return (
    Math.round(value * factor) /
    factor
  );
};

/* ==========================================
   NORMALIZAÇÃO
========================================== */

export function normalizeStats(
  stats: RawTeamStats = {}
) {
  /*
   * Quantidade de partidas.
   */
  const rawMatches =
    firstFiniteNumber([
      stats.matches,
      stats.matchesPlayed
    ]);

  const matches =
    Math.round(
      clamp(
        rawMatches ?? 10,
        1,
        100
      )
    );

  /*
   * Totais de gols.
   *
   * Permanecem separados das médias para
   * impedir mistura de unidades.
   */
  const goalsFor =
    clamp(
      firstFiniteNumber([
        stats.goalsFor,
        stats.goalsScored
      ]) ?? 0,
      0,
      500
    );

  const goalsAgainst =
    clamp(
      firstFiniteNumber([
        stats.goalsAgainst,
        stats.goalsConceded
      ]) ?? 0,
      0,
      500
    );

  /*
   * Média de gols marcados.
   *
   * Ordem de autoridade:
   *
   * 1. avgGoals
   * 2. goalsPerGame
   * 3. goalsForPerGame
   * 4. goalsFor / matches
   */
  const suppliedAvgGoals =
    firstFiniteNumber([
      stats.avgGoals,
      stats.goalsPerGame,
      stats.goalsForPerGame
    ]);

  const calculatedAvgGoals =
    matches > 0 &&
    goalsFor > 0
      ? goalsFor / matches
      : null;

  const avgGoals =
    clamp(
      suppliedAvgGoals ??
        calculatedAvgGoals ??
        0,
      0,
      6
    );

  /*
   * Média de gols sofridos.
   *
   * Ordem de autoridade:
   *
   * 1. avgGoalsAgainst
   * 2. goalsConcededPerGame
   * 3. goalsAgainstPerGame
   * 4. goalsAgainst / matches
   */
  const suppliedAvgGoalsAgainst =
    firstFiniteNumber([
      stats.avgGoalsAgainst,
      stats.goalsConcededPerGame,
      stats.goalsAgainstPerGame
    ]);

  const calculatedAvgGoalsAgainst =
    matches > 0 &&
    goalsAgainst > 0
      ? goalsAgainst / matches
      : null;

  const avgGoalsAgainst =
    clamp(
      suppliedAvgGoalsAgainst ??
        calculatedAvgGoalsAgainst ??
        0,
      0,
      6
    );

  /*
   * Finalizações.
   */
  const avgShots =
    clamp(
      firstFiniteNumber([
        stats.avgShots,
        stats.shotsPerGame
      ]) ?? 0,
      0,
      40
    );

  const rawShotsOnTarget =
    clamp(
      firstFiniteNumber([
        stats.avgShotsOnTarget,
        stats.shotsOnTargetPerGame
      ]) ?? 0,
      0,
      25
    );

  /*
   * Chutes no alvo não podem ultrapassar
   * o total de chutes.
   *
   * Quando o total de chutes estiver ausente,
   * preservamos o valor de chutes no alvo,
   * pois zero não deve apagar um dado válido.
   */
  const avgShotsOnTarget =
    avgShots > 0
      ? Math.min(
          rawShotsOnTarget,
          avgShots
        )
      : rawShotsOnTarget;

  const last5Goals =
    clamp(
      firstFiniteNumber([
        stats.last5Goals
      ]) ?? 0,
      0,
      30
    );

  /* ========================================
     FEATURES DERIVADAS
  ======================================== */

  const shotAccuracy =
    avgShots > 0
      ? clamp(
          avgShotsOnTarget /
            avgShots,
          0,
          1
        )
      : 0;

  const rawOffensiveEfficiency =
    avgShotsOnTarget > 0
      ? (
          avgGoals /
          avgShotsOnTarget
        )
      : 0;

  const offensiveEfficiency =
    clamp(
      rawOffensiveEfficiency,
      0,
      0.75
    );

  /*
   * Referência neutra provisória.
   *
   * Futuramente deve vir da configuração
   * específica da competição.
   */
  const referenceGoalsAgainst =
    1.35;

  const defensiveFragility =
    clamp(
      avgGoalsAgainst /
        referenceGoalsAgainst,
      0,
      3
    );

  const recentGoalTrend =
    clamp(
      last5Goals / 5,
      0,
      6
    );

  const sampleReliability =
    clamp(
      matches / 10,
      0.1,
      1
    );

  /*
   * Diagnóstico de consistência.
   */
  const warnings: string[] = [];

  if (
    suppliedAvgGoals === null &&
    calculatedAvgGoals === null
  ) {
    warnings.push(
      "MISSING_GOALS_PER_GAME"
    );
  }

  if (
    suppliedAvgGoalsAgainst === null &&
    calculatedAvgGoalsAgainst === null
  ) {
    warnings.push(
      "MISSING_GOALS_CONCEDED_PER_GAME"
    );
  }

  if (
    suppliedAvgGoals !== null &&
    calculatedAvgGoals !== null &&
    Math.abs(
      suppliedAvgGoals -
        calculatedAvgGoals
    ) > 0.25
  ) {
    warnings.push(
      "GOALS_PER_GAME_TOTAL_MISMATCH"
    );
  }

  if (
    suppliedAvgGoalsAgainst !== null &&
    calculatedAvgGoalsAgainst !== null &&
    Math.abs(
      suppliedAvgGoalsAgainst -
        calculatedAvgGoalsAgainst
    ) > 0.25
  ) {
    warnings.push(
      "GOALS_AGAINST_PER_GAME_TOTAL_MISMATCH"
    );
  }

  return {
    ...stats,

    matches,
    matchesPlayed:
      matches,

    goalsFor:
      roundNumber(goalsFor),

    goalsAgainst:
      roundNumber(goalsAgainst),

    avgGoals:
      roundNumber(avgGoals),

    avgGoalsAgainst:
      roundNumber(
        avgGoalsAgainst
      ),

    goalsPerGame:
      roundNumber(avgGoals),

    goalsForPerGame:
      roundNumber(avgGoals),

    goalsConcededPerGame:
      roundNumber(
        avgGoalsAgainst
      ),

    goalsAgainstPerGame:
      roundNumber(
        avgGoalsAgainst
      ),

    avgShots:
      roundNumber(avgShots),

    shotsPerGame:
      roundNumber(avgShots),

    avgShotsOnTarget:
      roundNumber(
        avgShotsOnTarget
      ),

    shotsOnTargetPerGame:
      roundNumber(
        avgShotsOnTarget
      ),

    last5Goals:
      roundNumber(last5Goals),

    shotAccuracy:
      roundNumber(shotAccuracy),

    offensiveEfficiency:
      roundNumber(
        offensiveEfficiency
      ),

    defensiveFragility:
      roundNumber(
        defensiveFragility
      ),

    recentGoalTrend:
      roundNumber(
        recentGoalTrend
      ),

    sampleReliability:
      roundNumber(
        sampleReliability
      ),

    normalizationWarnings: [
      ...new Set(warnings)
    ],

    normalizationDebug: {
      suppliedAvgGoals:
        roundNullableNumber(
          suppliedAvgGoals
        ),

      calculatedAvgGoals:
        roundNullableNumber(
          calculatedAvgGoals
        ),

      suppliedAvgGoalsAgainst:
        roundNullableNumber(
          suppliedAvgGoalsAgainst
        ),

      calculatedAvgGoalsAgainst:
        roundNullableNumber(
          calculatedAvgGoalsAgainst
        )
    }
  };
}

/* ==========================================
   DEBUG
========================================== */

function roundNullableNumber(
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