interface GameSelectorTeamStats {
  shots?: unknown;
  cornersAvg?: unknown;
  bigChances?: unknown;
}

interface GameSelectorContext {
  homeStats?: GameSelectorTeamStats;
  awayStats?: GameSelectorTeamStats;
}

function safe(n: unknown, fallback = 0) {
  const num = Number(n);
  return Number.isFinite(num) ? num : fallback;
}

export function gameSelector(context: GameSelectorContext) {
  const { homeStats, awayStats } = context;

  const shotsHome = safe(homeStats?.shots, 8);
  const shotsAway = safe(awayStats?.shots, 8);

  const cornersHome = safe(homeStats?.cornersAvg, 4);
  const cornersAway = safe(awayStats?.cornersAvg, 4);

  const bigChancesHome = safe(homeStats?.bigChances, 1);
  const bigChancesAway = safe(awayStats?.bigChances, 1);

  const totalShots = shotsHome + shotsAway;
  const totalCorners = cornersHome + cornersAway;
  const totalBigChances = bigChancesHome + bigChancesAway;

  const shotDiff = Math.abs(shotsHome - shotsAway);

  const warnings: string[] = [];

  const lowIntensity =
    totalShots < 13 &&
    totalCorners < 5.5 &&
    totalBigChances < 1.2;

  if (lowIntensity) {
    warnings.push("LOW_INTENSITY");
  }

  const asymmetry = shotDiff > 11;

  if (asymmetry) {
    warnings.push("ASYMMETRIC_GAME");
  }

  const deadTeam =
    (shotsHome < 3.5 && bigChancesHome < 0.4) ||
    (shotsAway < 3.5 && bigChancesAway < 0.4);

  if (deadTeam) {
    warnings.push("LOW_PRODUCTION_TEAM");
  }

  return {
    /*
      Não bloqueia mais o jogo no modelPipeline.
      Apenas classifica qualidade operacional.
    */
    allowed: true,
    reason: warnings.length ? warnings.join("_") : "OK",
    warnings,

    diagnostics: {
      shotsHome,
      shotsAway,
      totalShots,
      cornersHome,
      cornersAway,
      totalCorners,
      bigChancesHome,
      bigChancesAway,
      totalBigChances,
      shotDiff,
      lowIntensity,
      asymmetry,
      deadTeam,
    },
  };
}