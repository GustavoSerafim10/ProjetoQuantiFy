import { normalizeStats } from "../../domain/utils/dataNormalizer";

function safe(n: any, fallback = 0) {
  const num = Number(n);
  return Number.isFinite(num) ? num : fallback;
}

function clamp(n: number, min = 0, max = 1) {
  return Math.max(min, Math.min(n, max));
}

export function contextPipeline(input: any) {
  const homeStats = normalizeStats(input.homeStats || {});
  const awayStats = normalizeStats(input.awayStats || {});

  const homeGoals = safe(homeStats.goalsPerGame ?? homeStats.goalsFor, 1.2);
  const awayGoals = safe(awayStats.goalsPerGame ?? awayStats.goalsFor, 1.1);

  const homeConcede = safe(
    homeStats.goalsConcededPerGame ?? homeStats.goalsAgainst,
    1.2
  );

  const awayConcede = safe(
    awayStats.goalsConcededPerGame ?? awayStats.goalsAgainst,
    1.2
  );

  const totalAttack = homeGoals + awayGoals;
  const totalConcede = homeConcede + awayConcede;

  const rawGoalExpectation =
    (totalAttack * 0.6 + totalConcede * 0.4) / 4;

  const goalExpectationScore = Number(
    clamp(rawGoalExpectation).toFixed(4)
  );

  const paceLevel =
    goalExpectationScore >= 0.68
      ? "high"
      : goalExpectationScore >= 0.50
      ? "medium"
      : "low";

  const lambdaDiff = Math.abs(
    (homeGoals + awayConcede) -
    (awayGoals + homeConcede)
  );

  const gameType =
    lambdaDiff >= 1.20
      ? "dominant"
      : goalExpectationScore >= 0.62
      ? "open"
      : "balanced";

  const minAttack = Math.min(homeGoals, awayGoals);

  /*
    Importante:
    Não vamos matar BTTS cedo demais.
    Isso aqui deve ser um ALERTA contextual, não uma sentença final.
  */
  const isBadBTTSGame =
    totalAttack < 2.0 ||
    minAttack < 0.75;

  const marketContext = {
    isBadBTTSGame,
    paceLevel,
    gameType,
    goalExpectationScore,
    lambdaDiff: Number(lambdaDiff.toFixed(4)),

    attackProfile: {
      homeGoals,
      awayGoals,
      totalAttack,
      minAttack,
    },

    defensiveProfile: {
      homeConcede,
      awayConcede,
      totalConcede,
    },

    weights: {},
  };

  return {
    ...input,
    homeStats,
    awayStats,
    marketContext,

    debug: {
      ...(input.debug || {}),
      contextPipeline: {
        homeGoals,
        awayGoals,
        homeConcede,
        awayConcede,
        totalAttack,
        totalConcede,
        goalExpectationScore,
        paceLevel,
        lambdaDiff,
        gameType,
        isBadBTTSGame,
      },
    },
  };
}