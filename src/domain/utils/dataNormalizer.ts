export function normalizeStats(stats: any) {
  const safeNumber = (
    value: any,
    fallback = 0
  ) => {
    const num = Number(value);
    return isNaN(num) ? fallback : num;
  };

  const matches = Math.max(
    safeNumber(stats.matches, 10),
    1
  );

  const avgGoals = safeNumber(stats.avgGoals);
  const avgGoalsAgainst = safeNumber(stats.avgGoalsAgainst);

  const avgShots = safeNumber(stats.avgShots);
  const avgShotsOnTarget = safeNumber(stats.avgShotsOnTarget);

  const last5Goals = safeNumber(stats.last5Goals);

  /* ===============================
     DERIVED FEATURES
  ================================ */

  const shotAccuracy =
    avgShots > 0
      ? avgShotsOnTarget / avgShots
      : 0;

  const offensiveEfficiency =
    avgShotsOnTarget > 0
      ? avgGoals / avgShotsOnTarget
      : 0;

  const defensiveFragility =
    avgGoalsAgainst / Math.max(avgGoals, 0.5);

  const recentGoalTrend =
    last5Goals / 5;

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

    shotAccuracy: Number(
      shotAccuracy.toFixed(3)
    ),

    offensiveEfficiency: Number(
      offensiveEfficiency.toFixed(3)
    ),

    defensiveFragility: Number(
      defensiveFragility.toFixed(3)
    ),

    recentGoalTrend: Number(
      recentGoalTrend.toFixed(3)
    )
  };
}