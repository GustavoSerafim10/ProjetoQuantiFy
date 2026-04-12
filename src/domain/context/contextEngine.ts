export function contextEngine(data: any) {

  const {
    homeStats,
    awayStats,
    baseLambdaHome,
    baseLambdaAway,
    leagueData
  } = data;

  /* ===========================
     📊 FORMA RECENTE
  ============================ */

  const homeForm = homeStats.last5Goals / 5;
  const awayForm = awayStats.last5Goals / 5;

  /* ===========================
     ⚡ RITMO DE JOGO
  ============================ */

  const homeTempo = homeStats.avgShots + homeStats.avgCorners;
  const awayTempo = awayStats.avgShots + awayStats.avgCorners;

  const tempoFactor =
  ((homeTempo + awayTempo) / 20) *
  (leagueData?.tempo ?? 1);

  /* ===========================
     🔥 PRESSÃO OFENSIVA
  ============================ */

  const homePressure =
    homeStats.avgShotsOnTarget + homeStats.avgCorners;

  const awayPressure =
    awayStats.avgShotsOnTarget + awayStats.avgCorners;

 const pressureFactor =
  ((homePressure + awayPressure) / 15) *
  (leagueData?.pressure ?? 1);

  /* ===========================
     🏠 HOME ADVANTAGE
  ============================ */

  const homeAdvantage = 1.08;

  /* ===========================
     🔥 AJUSTE FINAL
  ============================ */

  let lambdaHome =
    baseLambdaHome *
    (1 + homeForm * 0.1) *
    tempoFactor *
    pressureFactor *
    homeAdvantage;

  let lambdaAway =
    baseLambdaAway *
    (1 + awayForm * 0.1) *
    tempoFactor *
    pressureFactor;

  // 🔒 CLAMP
  lambdaHome = Math.max(0.2, Math.min(4, lambdaHome));
  lambdaAway = Math.max(0.2, Math.min(4, lambdaAway));

  return {
    lambdaHome,
    lambdaAway,
    tempoFactor,
    pressureFactor
  };
}