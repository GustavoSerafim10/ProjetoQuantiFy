export function gameSelectionPipeline(context: any) {

  const { homeStats, awayStats, league } = context;

  if (!homeStats || !awayStats) {
    return block("Missing stats");
  }

  /* ===========================
     EXTRAÇÃO SEGURA
  ============================ */

  const homeShots = safe(homeStats.shots);
  const awayShots = safe(awayStats.shots);

  const homeCorners = safe(homeStats.cornersAvg);
  const awayCorners = safe(awayStats.cornersAvg);

  const homeGoals = safe(homeStats.goalsFor);
  const awayGoals = safe(awayStats.goalsFor);

  const totalShots = homeShots + awayShots;
  const totalCorners = homeCorners + awayCorners;
  const totalGoals = homeGoals + awayGoals;

  /* ===========================
     🚫 BLOQUEIOS REAIS (RAROS)
  ============================ */

  if (context.isFriendly) {
    return block("Friendly match");
  }

  if (isLowQualityLeague(league)) {
    return block("Low quality league");
  }

  /* ===========================
     ⚠️ SCORE DE QUALIDADE (NOVO)
  ============================ */

  let qualityScore = 0;

  // 🔹 SHOTS
  if (totalShots >= 20) qualityScore += 2;
  else if (totalShots >= 14) qualityScore += 1;

  // 🔹 GOALS PROFILE
  if (totalGoals >= 2.4) qualityScore += 2;
  else if (totalGoals >= 1.8) qualityScore += 1;

  // 🔹 CORNERS
  if (totalCorners >= 9) qualityScore += 2;
  else if (totalCorners >= 6) qualityScore += 1;

  // 🔹 BALANCE
  const shotDiff = Math.abs(homeShots - awayShots);
  if (shotDiff <= 5) qualityScore += 1;

  /* ===========================
     🚫 BLOQUEIO INTELIGENTE
  ============================ */

  if (qualityScore <= 1) {
    return block("Very low quality game");
  }

  /* ===========================
     🚀 BOOST (IMPORTANTE)
  ============================ */

  let confidenceBoost = 1;

  if (qualityScore >= 5) confidenceBoost = 1.08;
  else if (qualityScore >= 3) confidenceBoost = 1.03;

  /* ===========================
     ✅ PASSOU
  ============================ */

  return {
    allowed: true,
    reason: "Valid game",
    confidenceBoost,
    metrics: {
      totalShots,
      totalCorners,
      totalGoals,
      qualityScore
    }
  };
}

/* ===========================
   HELPERS
=========================== */

function safe(n: any, fallback = 0) {
  const num = Number(n);
  return isNaN(num) ? fallback : num;
}

function block(reason: string) {
  return {
    allowed: false,
    reason
  };
}

function isLowQualityLeague(league: string) {
  const blacklist = [
    "Friendly",
    "U20",
    "Youth",
    "Reserve"
  ];

  return blacklist.some(l =>
    league?.toLowerCase().includes(l.toLowerCase())
  );
}