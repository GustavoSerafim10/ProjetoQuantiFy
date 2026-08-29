
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

/*
 * Médias realistas de um time em uma partida de futebol profissional
 * (não são médias de campeonato buscadas de fora — servem só de centro
 * neutro para a fórmula abaixo). Usadas tanto como fallback de dado
 * ausente quanto como denominador de tempo/pressão, para que a ausência
 * total de dado sempre produza fator neutro (1.0), e para que os números
 * que o usuário realmente digita por time façam o fator variar de verdade
 * em vez de saturar sempre no mesmo extremo.
 */
const AVG_SHOTS_PER_TEAM = 12;
const AVG_CORNERS_PER_TEAM = 5;
const AVG_SHOTS_ON_TARGET_PER_TEAM = 4.3;

const NEUTRAL_TEMPO_TOTAL =
  2 * (AVG_SHOTS_PER_TEAM + AVG_CORNERS_PER_TEAM);

const NEUTRAL_PRESSURE_TOTAL =
  2 * (AVG_SHOTS_ON_TARGET_PER_TEAM + AVG_CORNERS_PER_TEAM);

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
    safe(homeStats?.shots, AVG_SHOTS_PER_TEAM) +
    safe(homeStats?.cornersAvg, AVG_CORNERS_PER_TEAM);

  const awayTempo =
    safe(awayStats?.shots, AVG_SHOTS_PER_TEAM) +
    safe(awayStats?.cornersAvg, AVG_CORNERS_PER_TEAM);

  const rawTempoFactor =
    ((homeTempo + awayTempo) / NEUTRAL_TEMPO_TOTAL) *
    safe(leagueData?.tempo, 1);

  const tempoFactor = clamp(rawTempoFactor, 0.94, 1.08);

  const homePressure =
    safe(homeStats?.shotsOnTarget, AVG_SHOTS_ON_TARGET_PER_TEAM) +
    safe(homeStats?.cornersAvg, AVG_CORNERS_PER_TEAM);

  const awayPressure =
    safe(awayStats?.shotsOnTarget, AVG_SHOTS_ON_TARGET_PER_TEAM) +
    safe(awayStats?.cornersAvg, AVG_CORNERS_PER_TEAM);

  const rawPressureFactor =
    ((homePressure + awayPressure) / NEUTRAL_PRESSURE_TOTAL) *
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