export function contextEngine(data: any) {
  const {
    homeStats,
    awayStats,
    baseLambdaHome,
    baseLambdaAway,
    leagueData
  } = data;

  const safeBaseHome = Number(baseLambdaHome ?? 1.2);
  const safeBaseAway = Number(baseLambdaAway ?? 1.0);

  /* ===========================
     📊 FORMA RECENTE
  ============================ */

const homeForm = Number(homeStats?.last5GoalsFor ?? 0) / 5;
const awayForm = Number(awayStats?.last5GoalsFor ?? 0) / 5;

  /* ===========================
     ⚡ RITMO DE JOGO
  ============================ */

 const homeTempo =
  Number(homeStats?.shots ?? 0) +
  Number(homeStats?.cornersAvg ?? 0);

const awayTempo =
  Number(awayStats?.shots ?? 0) +
  Number(awayStats?.cornersAvg ?? 0);

  const rawTempoFactor =
    ((homeTempo + awayTempo) / 20) *
    Number(leagueData?.tempo ?? 1);

  // ajuste suave
  const tempoFactor = Math.max(0.92, Math.min(rawTempoFactor, 1.08));

  /* ===========================
     🔥 PRESSÃO OFENSIVA
  ============================ */

const homePressure =
  Number(homeStats?.shotsOnTarget ?? 0) +
  Number(homeStats?.cornersAvg ?? 0);

const awayPressure =
  Number(awayStats?.shotsOnTarget ?? 0) +
  Number(awayStats?.cornersAvg ?? 0);
  
  const rawPressureFactor =
    ((homePressure + awayPressure) / 15) *
    Number(leagueData?.pressure ?? 1);

  // ajuste suave
  const pressureFactor = Math.max(0.92, Math.min(rawPressureFactor, 1.10));

  /* ===========================
     🏠 HOME ADVANTAGE
  ============================ */

  const homeAdvantage = 1.05;

  /* ===========================
     🔧 AJUSTE DE FORMA (SUAVE)
  ============================ */

  const homeFormFactor = 1 + ((homeForm - 1) * 0.12);
  const awayFormFactor = 1 + ((awayForm - 1) * 0.12);

  /* ===========================
     🔥 AJUSTE FINAL CONTROLADO
  ============================ */

  let lambdaHome =
    safeBaseHome *
    homeFormFactor *
    tempoFactor *
    pressureFactor *
    homeAdvantage;

  let lambdaAway =
    safeBaseAway *
    awayFormFactor *
    tempoFactor *
    pressureFactor;

  /* ===========================
     🛡️ LIMITAR DISTORÇÃO DE CONTEXTO
  ============================ */

  const maxHomeShift = safeBaseHome * 0.22;
  const maxAwayShift = safeBaseAway * 0.22;

  lambdaHome = Math.max(
    safeBaseHome - maxHomeShift,
    Math.min(safeBaseHome + maxHomeShift, lambdaHome)
  );

  lambdaAway = Math.max(
    safeBaseAway - maxAwayShift,
    Math.min(safeBaseAway + maxAwayShift, lambdaAway)
  );

  /* ===========================
     🔒 CLAMP FINAL
  ============================ */

  lambdaHome = Math.max(0.25, Math.min(4, lambdaHome));
  lambdaAway = Math.max(0.25, Math.min(4, lambdaAway));

  return {
    lambdaHome: Number(lambdaHome.toFixed(4)),
    lambdaAway: Number(lambdaAway.toFixed(4)),
    tempoFactor: Number(tempoFactor.toFixed(4)),
    pressureFactor: Number(pressureFactor.toFixed(4))
  };
}