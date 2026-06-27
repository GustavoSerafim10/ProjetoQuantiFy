function safe(n: any, fallback = 0) {
  const num = Number(n);
  return Number.isFinite(num) ? num : fallback;
}

export function gameSelector(context: any) {
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

const strongGame =
  totalShots >= 20 ||
  totalBigChances >= 3;

let confidenceBoost = 1;

// jogo ofensivamente bom
if (strongGame) {
  confidenceBoost = 1.08;
}

// jogo com volume equilibrado e boas chances
if (totalShots >= 18 && totalBigChances >= 2.5) {
  confidenceBoost = 1.10;
}

// jogo muito forte ofensivamente
if (totalShots >= 22 && totalBigChances >= 3.2) {
  confidenceBoost = 1.12;
}

// penalização por baixa intensidade
if (warnings.includes("LOW_INTENSITY")) {
  confidenceBoost -= 0.04;
}

// penalização por time morto
if (warnings.includes("LOW_PRODUCTION_TEAM")) {
  confidenceBoost -= 0.05;
}

// penalização por jogo assimétrico
if (warnings.includes("ASYMMETRIC_GAME")) {
  confidenceBoost -= 0.03;
}

// trava final de segurança
confidenceBoost = Math.max(0.90, Math.min(confidenceBoost, 1.12));

  return {
    /*
      Não bloqueia mais o jogo no modelPipeline.
      Apenas classifica qualidade operacional.
    */
    allowed: true,
    reason: warnings.length ? warnings.join("_") : "OK",
    warnings,
    confidenceBoost,

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
      strongGame,
    },
  };
}