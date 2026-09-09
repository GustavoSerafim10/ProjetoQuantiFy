
interface ContextEngineStats {
  last5GoalsFor?: unknown;
  goalsPerGame?: unknown;
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

/*
 * Achado real em 2026-09-09: com dados reais de jogos da Série B
 * analisados no mesmo dia, tempoFactor e/ou pressureFactor bateram
 * exatamente no limite do clamp (±0.94/1.08/1.10) em praticamente
 * TODO jogo testado (proporções brutas observadas: 1.068, 1.156,
 * 1.179, 1.191 para tempo; 0.935, 1.102, 1.156 para pressão — a
 * maioria já fora da faixa antiga). Isso não é mais um risco
 * teórico: times com volume de finalização/escanteio só um pouco
 * acima da média já saturam. Faixa alargada para bater com o ±18%
 * que `applyBoundedContextAdjustment` (modelPipeline/
 * contextAdjustment.ts) já usa como o limite de segurança real do
 * contexto combinado — em vez de inventar um terceiro número
 * arbitrário, este componente individual usa o mesmo limite já
 * validado, e para de ser um gargalo mais apertado que ele.
 */
export const MIN_TEMPO_FACTOR = 0.82;
export const MAX_TEMPO_FACTOR = 1.18;

export const MIN_PRESSURE_FACTOR = 0.82;
export const MAX_PRESSURE_FACTOR = 1.18;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(n, max));
}

/*
 * Achado real em 2026-09-09: a heurística antiga (`raw > 5 ? raw/5
 * : raw`) tentava adivinhar se o valor recebido já era uma média
 * por jogo ou um total de 5 jogos — mas `last5GoalsFor`
 * (sanitize.ts) já é SEMPRE uma média por jogo, com teto 6. Um time
 * em sequência realmente artilheira (ex: 5.4 gols/jogo nos últimos
 * 5) caía no ramo ">5" e era dividido por 5 → 1.08, quase neutro —
 * ou seja, o sinal de sequência quente virava o oposto do
 * pretendido. `value` já chega pronto (`last5GoalsFor` ou, na
 * ausência, `goalsPerGame` — os dois já são médias por jogo, nunca
 * totais de temporada), então não há nada para adivinhar aqui.
 */
function recentGoalsFactor(value: unknown) {
  return safe(value, 1);
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

  const homeForm = recentGoalsFactor(homeStats?.last5GoalsFor ?? homeStats?.goalsPerGame);
  const awayForm = recentGoalsFactor(awayStats?.last5GoalsFor ?? awayStats?.goalsPerGame);

  const homeTempo =
    safe(homeStats?.shots, AVG_SHOTS_PER_TEAM) +
    safe(homeStats?.cornersAvg, AVG_CORNERS_PER_TEAM);

  const awayTempo =
    safe(awayStats?.shots, AVG_SHOTS_PER_TEAM) +
    safe(awayStats?.cornersAvg, AVG_CORNERS_PER_TEAM);

  const rawTempoFactor =
    ((homeTempo + awayTempo) / NEUTRAL_TEMPO_TOTAL) *
    safe(leagueData?.tempo, 1);

  const tempoFactor = clamp(rawTempoFactor, MIN_TEMPO_FACTOR, MAX_TEMPO_FACTOR);

  const homePressure =
    safe(homeStats?.shotsOnTarget, AVG_SHOTS_ON_TARGET_PER_TEAM) +
    safe(homeStats?.cornersAvg, AVG_CORNERS_PER_TEAM);

  const awayPressure =
    safe(awayStats?.shotsOnTarget, AVG_SHOTS_ON_TARGET_PER_TEAM) +
    safe(awayStats?.cornersAvg, AVG_CORNERS_PER_TEAM);

  const rawPressureFactor =
    ((homePressure + awayPressure) / NEUTRAL_PRESSURE_TOTAL) *
    safe(leagueData?.pressure, 1);

  const pressureFactor = clamp(rawPressureFactor, MIN_PRESSURE_FACTOR, MAX_PRESSURE_FACTOR);

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