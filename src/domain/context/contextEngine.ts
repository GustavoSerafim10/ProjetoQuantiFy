
interface ContextEngineStats {
  last5GoalsFor?: unknown;
  goalsFor?: unknown;
  shots?: unknown;
  cornersAvg?: unknown;
  shotsOnTarget?: unknown;
}

interface ContextEngineLeagueData {
  tempo?: unknown;
  pressure?: unknown;
  homeAdvantage?: unknown;
  leagueKey?: unknown;
}

interface ContextEngineInput {
  homeStats?: ContextEngineStats;
  awayStats?: ContextEngineStats;
  baseLambdaHome?: unknown;
  baseLambdaAway?: unknown;
  leagueData?: ContextEngineLeagueData;
}

function safe(n: unknown, fallback = 1) {
  const num = Number(n);
  return Number.isFinite(num) ? num : fallback;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(n, max));
}

function recentGoalsFactor(value: unknown) {
  const raw = safe(value, 1);

  const avg =
    raw > 5
      ? raw / 5
      : raw;

  return avg;
}

export function contextEngine(data: ContextEngineInput) {
  const {
    homeStats,
    awayStats,
    baseLambdaHome,
    baseLambdaAway,
    leagueData
  } = data;

  const safeBaseHome = clamp(safe(baseLambdaHome, 1.2), 0.35, 2.25);
  const safeBaseAway = clamp(safe(baseLambdaAway, 1.0), 0.35, 2.25);

  const homeForm = recentGoalsFactor(homeStats?.last5GoalsFor ?? homeStats?.goalsFor);
  const awayForm = recentGoalsFactor(awayStats?.last5GoalsFor ?? awayStats?.goalsFor);

  const homeTempo =
    safe(homeStats?.shots, 8) +
    safe(homeStats?.cornersAvg, 4);

  const awayTempo =
    safe(awayStats?.shots, 8) +
    safe(awayStats?.cornersAvg, 4);

  const rawTempoFactor =
    ((homeTempo + awayTempo) / 24) *
    safe(leagueData?.tempo, 1);

  const tempoFactor = clamp(rawTempoFactor, 0.94, 1.08);

  const homePressure =
    safe(homeStats?.shotsOnTarget, 3) +
    safe(homeStats?.cornersAvg, 4);

  const awayPressure =
    safe(awayStats?.shotsOnTarget, 3) +
    safe(awayStats?.cornersAvg, 4);

  const rawPressureFactor =
    ((homePressure + awayPressure) / 14) *
    safe(leagueData?.pressure, 1);

  const pressureFactor = clamp(rawPressureFactor, 0.94, 1.10);

  const homeAdvantage = safe(leagueData?.homeAdvantage, 1.05);

  const homeFormFactor = clamp(
    1 + ((homeForm - 1.2) * 0.08),
    0.92,
    1.08
  );

  const awayFormFactor = clamp(
    1 + ((awayForm - 1.1) * 0.08),
    0.92,
    1.08
  );

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

  const maxHomeShift = safeBaseHome * 0.18;
  const maxAwayShift = safeBaseAway * 0.18;

  lambdaHome = clamp(
    lambdaHome,
    safeBaseHome - maxHomeShift,
    safeBaseHome + maxHomeShift
  );

  lambdaAway = clamp(
    lambdaAway,
    safeBaseAway - maxAwayShift,
    safeBaseAway + maxAwayShift
  );

  lambdaHome = clamp(lambdaHome, 0.35, 2.25);
  lambdaAway = clamp(lambdaAway, 0.35, 2.25);

  return {
    lambdaHome: Number(lambdaHome.toFixed(4)),
    lambdaAway: Number(lambdaAway.toFixed(4)),
    tempoFactor: Number(tempoFactor.toFixed(4)),
    pressureFactor: Number(pressureFactor.toFixed(4)),

    debug: {
      contextEngine: {
        base: {
          home: safeBaseHome,
          away: safeBaseAway
        },
        form: {
          homeForm,
          awayForm,
          homeFormFactor,
          awayFormFactor
        },
        tempo: {
          homeTempo,
          awayTempo,
          rawTempoFactor,
          tempoFactor
        },
        pressure: {
          homePressure,
          awayPressure,
          rawPressureFactor,
          pressureFactor
        },
        homeAdvantage,
        final: {
          lambdaHome: Number(lambdaHome.toFixed(4)),
          lambdaAway: Number(lambdaAway.toFixed(4))
        }
      }
    }
  };
}