export function detectTrap(m: any, context: any): number {

  let trapScore = 0;

  const lambdaDiff = Math.abs(
    context.lambdaHome - context.lambdaAway
  );

  /* ===========================
     🚨 OVER ARMADILHA
  ============================ */

  if (m.market.includes("Over")) {

    if (context.totalLambda < 2.4) {
      trapScore += 0.3;
    }

    if ((context.stats?.home?.pressure ?? 0) < 10) {
      trapScore += 0.2;
    }
  }

  /* ===========================
     🚨 BTTS ARMADILHA
  ============================ */

  if (m.market === "BTTS Yes") {

    if (lambdaDiff > 1.2) {
      trapScore += 0.3;
    }

    if (
      (context.stats?.home?.cleanSheet ?? 0) > 0.4 ||
      (context.stats?.away?.cleanSheet ?? 0) > 0.4
    ) {
      trapScore += 0.3;
    }
  }

  /* ===========================
     🚨 FAVORITO FRACO
  ============================ */

  if (
    m.market === "Home Win" ||
    m.market === "Away Win"
  ) {

    if (lambdaDiff < 0.6) {
      trapScore += 0.3;
    }
  }

  return Math.min(1, trapScore);
}