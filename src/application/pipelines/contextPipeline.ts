import { normalizeStats } from "../../domain/utils/dataNormalizer";

export function contextPipeline(input: any) {
  const homeStats = normalizeStats(input.homeStats);
  const awayStats = normalizeStats(input.awayStats);

  const homeGoals = homeStats.goalsPerGame ?? 0;
  const awayGoals = awayStats.goalsPerGame ?? 0;

  const homeConcede = homeStats.goalsConcededPerGame ?? 0;
  const awayConcede = awayStats.goalsConcededPerGame ?? 0;

  const totalAttack =
    homeGoals + awayGoals;

  const totalConcede =
    homeConcede + awayConcede;

  const goalExpectationScore =
    (
      totalAttack * 0.6 +
      totalConcede * 0.4
    ) / 4;

  const paceLevel =
    goalExpectationScore > 0.68
      ? "high"
      : goalExpectationScore > 0.52
      ? "medium"
      : "low";

  const lambdaDiff = Math.abs(
    (homeGoals + awayConcede) -
    (awayGoals + homeConcede)
  );

  const gameType =
    lambdaDiff > 1.2
      ? "dominant"
      : goalExpectationScore > 0.62
      ? "open"
      : "balanced";

  const marketContext = {
    isBadBTTSGame:
      totalAttack < 2.2 ||
      Math.min(homeGoals, awayGoals) < 0.9,

    paceLevel,
    gameType,

    weights: {}
  };

return {
  ...input,
  homeStats,
  awayStats,
  marketContext
};
}