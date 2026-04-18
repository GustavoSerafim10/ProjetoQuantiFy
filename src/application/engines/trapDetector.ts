export function detectTrap(m: any, context: any): number {
  let trapScore = 0;

  const market = String(m?.market ?? "").toUpperCase();

  const lambdaHome = Number(context?.lambdaHome ?? 1);
  const lambdaAway = Number(context?.lambdaAway ?? 1);
  const totalLambda = Number(context?.totalLambda ?? (lambdaHome + lambdaAway));
  const lambdaDiff = Math.abs(lambdaHome - lambdaAway);

  const homePressure = Number(context?.stats?.home?.pressure ?? 0);
  const awayPressure = Number(context?.stats?.away?.pressure ?? 0);
  const avgPressure = (homePressure + awayPressure) / 2;

  const homeCleanSheet = Number(context?.stats?.home?.cleanSheet ?? 0);
  const awayCleanSheet = Number(context?.stats?.away?.cleanSheet ?? 0);

  const goalScore = Number(context?.goalExpectationScore ?? 0.5);

  /* ===========================
     🚨 OVER ARMADILHA
  ============================ */

  if (market.includes("OVER")) {
    if (totalLambda < 2.2) trapScore += 0.22;
    if (goalScore < 0.45) trapScore += 0.20;
    if (avgPressure < 10) trapScore += 0.14;

    if (market.includes("OVER_2_5")) {
      if (totalLambda < 2.5) trapScore += 0.12;
      if (goalScore < 0.52) trapScore += 0.10;
    }
  }

  /* ===========================
     🚨 BTTS ARMADILHA
  ============================ */

  if (market.includes("BTTS")) {
    if (lambdaDiff > 1.0) trapScore += 0.20;
    if (goalScore < 0.50) trapScore += 0.16;

    if (homeCleanSheet > 0.40 || awayCleanSheet > 0.40) {
      trapScore += 0.20;
    }

    if (avgPressure < 9) trapScore += 0.10;
  }

  /* ===========================
     🚨 FAVORITO FRACO
  ============================ */

  if (market === "HOME_WIN" || market === "AWAY_WIN") {
    if (lambdaDiff < 0.45) trapScore += 0.22;
    if (goalScore < 0.48) trapScore += 0.08;
  }

  /* ===========================
     🚨 DOUBLE CHANCE ARMADILHA
  ============================ */

  if (market === "DOUBLE_CHANCE_1X" || market === "DOUBLE_CHANCE_X2") {
    if (lambdaDiff < 0.20) trapScore += 0.12;
    if (avgPressure < 8) trapScore += 0.08;
  }

  /* ===========================
     🎯 NORMALIZAÇÃO FINAL
  ============================ */

  trapScore = Math.max(0, Math.min(trapScore, 1));

  return Number(trapScore.toFixed(4));
}