export function gameSelector(context: any) {

  const { homeStats, awayStats } = context;

  /* ===========================
     MÉTRICAS BASE
  ============================ */

  const shotsHome = homeStats?.shots ?? 0;
  const shotsAway = awayStats?.shots ?? 0;

  const cornersHome = homeStats?.cornersAvg ?? 0;
  const cornersAway = awayStats?.cornersAvg ?? 0;

  const bigChancesHome = homeStats?.bigChances ?? 0;
  const bigChancesAway = awayStats?.bigChances ?? 0;

  /* ===========================
     DERIVADOS
  ============================ */

  const totalShots = shotsHome + shotsAway;
  const totalCorners = cornersHome + cornersAway;
  const totalBigChances = bigChancesHome + bigChancesAway;

  const shotDiff = Math.abs(shotsHome - shotsAway);

  /* ===========================
     🚫 REGRAS AJUSTADAS
  ============================ */

  // 🔴 1. BAIXA INTENSIDADE (menos rígido)
  const lowIntensity =
    totalShots < 14 &&
    totalCorners < 6 &&
    totalBigChances < 1.5;

  if (lowIntensity) {
    return {
      allowed: false,
      reason: "LOW_INTENSITY"
    };
  }

  // 🔴 2. ASSIMETRIA EXTREMA (menos agressivo)
  const asymmetry = shotDiff > 10;

  if (asymmetry) {
    return {
      allowed: false,
      reason: "ASYMMETRIC_GAME"
    };
  }

  // 🔴 3. TIME COMPLETAMENTE MORTO (ajustado)
  const deadTeam =
    (shotsHome < 4 && bigChancesHome < 0.5) ||
    (shotsAway < 4 && bigChancesAway < 0.5);

  if (deadTeam) {
    return {
      allowed: false,
      reason: "LOW_PRODUCTION"
    };
  }

  /* ===========================
     🧠 BOOST POSITIVO (NOVO)
  ============================ */

  const strongGame =
    totalShots >= 20 ||
    totalBigChances >= 3;

  if (strongGame) {
    return {
      allowed: true,
      confidenceBoost: 1.05
    };
  }

  /* ===========================
     ✅ APROVADO
  ============================ */

  return {
    allowed: true
  };
}