import { goalsModel } from "../../domain/marketModels/goalsModel";
import { contextEngine } from "../../domain/context/contextEngine";
import { calculateGlobalConfidence } from "../../domain/confidence/confidenceEngine";
import { buildLambda } from "../../domain/model/lambdaBuilder";

import { gameSelector } from "../engines/gameSelector";

/* ==========================================
   TIPOS
========================================== */

interface SanitizedStats {
  matches: number;
  matchesPlayed: number;

  goalsFor: number;
  goalsAgainst: number;

  goalsPerMatch: number;
  goalsConcededPerMatch: number;

  homeGoalsScoredPerMatch: number;
  homeGoalsConcededPerMatch: number;

  awayGoalsScoredPerMatch: number;
  awayGoalsConcededPerMatch: number;

  shots: number;
  shotsOnTarget: number;

  shotsPerMatch: number;
  shotsOnTargetPerMatch: number;

  cornersAvg: number;
  bigChancesPerMatch: number;

  fouls: number;
  yellowCards: number;

  over05: number;
  over15: number;
  over25: number;
  over35: number;
  btts: number;

  last5GoalsFor: number;
  last5GoalsAgainst: number;

  missingFields: string[];

  [key: string]: unknown;
}

interface MatrixMarkets {
  home: number;
  draw: number;
  away: number;

  over15: number;
  over25: number;

  bttsYes: number;
  bttsNo: number;

  doubleChance1X: number;
  doubleChanceX2: number;
}

/* ==========================================
   UTILITÁRIOS
========================================== */

function clamp(
  value: number,
  min: number,
  max: number
): number {
  return Math.max(
    min,
    Math.min(max, value)
  );
}

function safeNumber(
  value: unknown,
  fallback: number
): number {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
}

function optionalNumber(
  value: unknown
): number | undefined {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : undefined;
}

function normalizePercent(
  value: unknown,
  fallback = 0.5
): number {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  if (
    typeof value === "string" &&
    value.includes("%")
  ) {
    const parsed =
      Number.parseFloat(value);

    return Number.isFinite(parsed)
      ? clamp(parsed / 100, 0, 1)
      : fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  const normalized =
    parsed > 1
      ? parsed / 100
      : parsed;

  return clamp(
    normalized,
    0,
    1
  );
}

function hasValidValue(
  value: unknown
): boolean {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return false;
  }

  return Number.isFinite(
    Number(value)
  );
}

/* ==========================================
   SANITIZAÇÃO
========================================== */

function sanitizeStats(
  stats: any = {},
  venue: "HOME" | "AWAY"
): SanitizedStats {
  const missingFields: string[] = [];

  const registerMissing = (
    field: string,
    value: unknown
  ) => {
    if (!hasValidValue(value)) {
      missingFields.push(field);
    }
  };

  const matchesValue =
    optionalNumber(
      stats.matchesPlayed ??
      stats.matches
    );

  registerMissing(
    "matches",
    matchesValue
  );

  const matches = clamp(
    safeNumber(matchesValue, 0),
    0,
    100
  );

  const genericGoalsFor =
    optionalNumber(
      stats.goalsFor ??
      stats.goalsPerMatch ??
      stats.avgGoals
    );

  const genericGoalsAgainst =
    optionalNumber(
      stats.goalsAgainst ??
      stats.goalsConcededPerMatch ??
      stats.avgGoalsAgainst
    );

  const venueGoalsFor =
    venue === "HOME"
      ? optionalNumber(
          stats.homeGoalsScoredPerMatch
        )
      : optionalNumber(
          stats.awayGoalsScoredPerMatch
        );

  const venueGoalsAgainst =
    venue === "HOME"
      ? optionalNumber(
          stats.homeGoalsConcededPerMatch
        )
      : optionalNumber(
          stats.awayGoalsConcededPerMatch
        );

  registerMissing(
    "goalsFor",
    venueGoalsFor ?? genericGoalsFor
  );

  registerMissing(
    "goalsAgainst",
    venueGoalsAgainst ??
      genericGoalsAgainst
  );

  /*
   * Quando a média de gols estiver ausente, usamos
   * referência neutra somente para impedir NaN.
   *
   * A ausência continuará registrada em
   * missingFields para reduzir confiança e
   * aumentar risco nas etapas posteriores.
   */
  const goalsFor = clamp(
    safeNumber(
      venueGoalsFor ??
        genericGoalsFor,
      1.25
    ),
    0,
    6
  );

  const goalsAgainst = clamp(
    safeNumber(
      venueGoalsAgainst ??
        genericGoalsAgainst,
      1.25
    ),
    0,
    6
  );

  const shotsValue =
    optionalNumber(
      stats.shotsPerMatch ??
      stats.shots ??
      stats.avgShots
    );

  const shotsOnTargetValue =
    optionalNumber(
      stats.shotsOnTargetPerMatch ??
      stats.shotsOnTarget ??
      stats.avgShotsOnTarget
    );

  registerMissing(
    "shots",
    shotsValue
  );

  registerMissing(
    "shotsOnTarget",
    shotsOnTargetValue
  );

  /*
   * Não fabricamos volume ofensivo.
   *
   * Na ausência, o xG Proxy receberá zero e o
   * lambdaBuilder dependerá mais dos gols e do prior.
   */
  const shots = clamp(
    safeNumber(shotsValue, 0),
    0,
    40
  );

  const shotsOnTarget = clamp(
    Math.min(
      safeNumber(
        shotsOnTargetValue,
        0
      ),
      shots
    ),
    0,
    25
  );

  const last5GoalsFor = clamp(
    safeNumber(
      stats.last5GoalsFor,
      goalsFor
    ),
    0,
    6
  );

  const last5GoalsAgainst = clamp(
    safeNumber(
      stats.last5GoalsAgainst,
      goalsAgainst
    ),
    0,
    6
  );

  return {
    ...stats,

    matches,
    matchesPlayed: matches,

    goalsFor,
    goalsAgainst,

    goalsPerMatch: goalsFor,
    goalsConcededPerMatch:
      goalsAgainst,

    homeGoalsScoredPerMatch:
      venue === "HOME"
        ? goalsFor
        : safeNumber(
            stats.homeGoalsScoredPerMatch,
            goalsFor
          ),

    homeGoalsConcededPerMatch:
      venue === "HOME"
        ? goalsAgainst
        : safeNumber(
            stats.homeGoalsConcededPerMatch,
            goalsAgainst
          ),

    awayGoalsScoredPerMatch:
      venue === "AWAY"
        ? goalsFor
        : safeNumber(
            stats.awayGoalsScoredPerMatch,
            goalsFor
          ),

    awayGoalsConcededPerMatch:
      venue === "AWAY"
        ? goalsAgainst
        : safeNumber(
            stats.awayGoalsConcededPerMatch,
            goalsAgainst
          ),

    shots,
    shotsOnTarget,

    shotsPerMatch: shots,
    shotsOnTargetPerMatch:
      shotsOnTarget,

    cornersAvg: clamp(
      safeNumber(
        stats.cornersAvg,
        0
      ),
      0,
      20
    ),

    bigChancesPerMatch: clamp(
      safeNumber(
        stats.bigChancesPerMatch,
        0
      ),
      0,
      10
    ),

    foulsPerMatch: clamp(
      safeNumber(
        stats.foulsPerMatch,
        0
      ),
      0,
      40
    ),

    yellowCardsPerMatch: clamp(
      safeNumber(
        stats.yellowCardsPerMatch,
        0
      ),
      0,
      15
    ),

    over05: normalizePercent(
      stats.over05
    ),

    over15: normalizePercent(
      stats.over15
    ),

    over25: normalizePercent(
      stats.over25
    ),

    over35: normalizePercent(
      stats.over35
    ),

    btts: normalizePercent(
      stats.btts
    ),

    last5GoalsFor,
    last5GoalsAgainst,

    missingFields
  };
}

/* ==========================================
   CONTEXTO
========================================== */

function applyBoundedContextAdjustment(
  baseLambdaHome: number,
  baseLambdaAway: number,
  contextAdjusted: any
) {
  /*
   * O contextEngine pode alterar os lambdas,
   * mas não pode substituir o modelo estrutural.
   *
   * Limite provisório conservador:
   * máximo de ±8% por equipe.
   *
   * Esse intervalo deverá ser calibrado por
   * backtest e análise fora da amostra.
   */
  const MIN_CONTEXT_FACTOR = 0.92;
  const MAX_CONTEXT_FACTOR = 1.08;

  const proposedHome =
    safeNumber(
      contextAdjusted?.lambdaHome,
      baseLambdaHome
    );

  const proposedAway =
    safeNumber(
      contextAdjusted?.lambdaAway,
      baseLambdaAway
    );

  const lambdaHome = clamp(
    proposedHome,
    baseLambdaHome *
      MIN_CONTEXT_FACTOR,
    baseLambdaHome *
      MAX_CONTEXT_FACTOR
  );

  const lambdaAway = clamp(
    proposedAway,
    baseLambdaAway *
      MIN_CONTEXT_FACTOR,
    baseLambdaAway *
      MAX_CONTEXT_FACTOR
  );

  return {
    lambdaHome,
    lambdaAway
  };
}

/* ==========================================
   EXTRAÇÃO DA MATRIZ
========================================== */

function extractMatrixMarkets(
  matrix: number[][]
): MatrixMarkets {
  let home = 0;
  let draw = 0;
  let away = 0;

  let over15 = 0;
  let over25 = 0;

  let bttsYes = 0;

  for (
    let homeGoals = 0;
    homeGoals < matrix.length;
    homeGoals++
  ) {
    const row =
      matrix[homeGoals] ?? [];

    for (
      let awayGoals = 0;
      awayGoals < row.length;
      awayGoals++
    ) {
      const probability = clamp(
        safeNumber(
          row[awayGoals],
          0
        ),
        0,
        1
      );

      if (homeGoals > awayGoals) {
        home += probability;
      } else if (
        homeGoals === awayGoals
      ) {
        draw += probability;
      } else {
        away += probability;
      }

      const totalGoals =
        homeGoals + awayGoals;

      if (totalGoals >= 2) {
        over15 += probability;
      }

      if (totalGoals >= 3) {
        over25 += probability;
      }

      if (
        homeGoals >= 1 &&
        awayGoals >= 1
      ) {
        bttsYes += probability;
      }
    }
  }

  const resultTotal =
    home + draw + away;

  /*
   * Pequena normalização defensiva contra erros
   * de ponto flutuante.
   */
  if (
    Number.isFinite(resultTotal) &&
    resultTotal > 0
  ) {
    home /= resultTotal;
    draw /= resultTotal;
    away /= resultTotal;
  }

  home = clamp(home, 0, 1);
  draw = clamp(draw, 0, 1);
  away = clamp(away, 0, 1);

  over15 = clamp(over15, 0, 1);
  over25 = clamp(over25, 0, 1);

  bttsYes = clamp(
    bttsYes,
    0,
    1
  );

  const bttsNo =
    clamp(
      1 - bttsYes,
      0,
      1
    );

  const doubleChance1X =
    clamp(
      home + draw,
      0,
      1
    );

  const doubleChanceX2 =
    clamp(
      away + draw,
      0,
      1
    );

  return {
    home,
    draw,
    away,

    over15,
    over25,

    bttsYes,
    bttsNo,

    doubleChance1X,
    doubleChanceX2
  };
}

/* ==========================================
   PERFIL DE GOLS
========================================== */

function calculateGoalExpectationScore(
  lambdaHome: number,
  lambdaAway: number
): number {
  const total =
    lambdaHome + lambdaAway;

  const weakerLambda =
    Math.min(
      lambdaHome,
      lambdaAway
    );

  /*
   * O score mede expectativa conjunta de gols.
   *
   * A participação do menor lambda evita considerar
   * um jogo unilateral como excelente para BTTS.
   *
   * Ele não altera probabilidades.
   */
  const totalComponent =
    clamp(
      total / 3.25,
      0,
      1
    );

  const bilateralComponent =
    clamp(
      weakerLambda / 1.15,
      0,
      1
    );

  const score =
    totalComponent * 0.75 +
    bilateralComponent * 0.25;

  return clamp(
    score,
    0,
    1
  );
}

function classifyGoalProfile(
  lambdaHome: number,
  lambdaAway: number
) {
  const total =
    lambdaHome + lambdaAway;

  const minimumLambda =
    Math.min(
      lambdaHome,
      lambdaAway
    );

  const difference =
    Math.abs(
      lambdaHome - lambdaAway
    );

  if (
    total < 1.85 ||
    (
      lambdaHome < 0.85 &&
      lambdaAway < 0.85
    )
  ) {
    return "LOW_GOAL";
  }

  if (
    total >= 2.75 &&
    minimumLambda >= 0.95
  ) {
    return "OPEN_GOALS";
  }

  if (difference >= 0.75) {
    return "FAVORITE_EDGE";
  }

  return "BALANCED";
}

/* ==========================================
   PIPELINE
========================================== */

export function modelPipeline(
  context: any
) {
  if (
    !context?.homeStats ||
    !context?.awayStats
  ) {
    console.warn(
      "⚠️ Dados insuficientes no modelPipeline"
    );

    return emptyResponse();
  }

  const {
    homeStats,
    awayStats,
    league
  } = context;

  const home =
    sanitizeStats(
      homeStats,
      "HOME"
    );

  const away =
    sanitizeStats(
      awayStats,
      "AWAY"
    );

  /* ==========================================
     SELEÇÃO DO JOGO
  ========================================== */

  const gameCheck =
    gameSelector({
      homeStats: home,
      awayStats: away
    });

  /*
   * O modelPipeline informa a qualidade do jogo.
   * A decisão final permanece no decisionPipeline.
   */
  const gameBlocked =
    !gameCheck.allowed;

  /* ==========================================
     LAMBDA BUILDER OFICIAL
  ========================================== */

  const lambdaBuild =
    buildLambda(
      home as any,
      away as any,
      league
    );

  const baseLambdaHome =
    safeNumber(
      lambdaBuild.lambdaHome,
      1.32
    );

  const baseLambdaAway =
    safeNumber(
      lambdaBuild.lambdaAway,
      1.23
    );

  /* ==========================================
     AJUSTE CONTEXTUAL CONTROLADO
  ========================================== */

  const contextAdjusted =
    contextEngine({
      homeStats: home,
      awayStats: away,

      baseLambdaHome,
      baseLambdaAway,

      leagueData: {
        leagueKey: league
      }
    });

  const contextualLambdas =
    applyBoundedContextAdjustment(
      baseLambdaHome,
      baseLambdaAway,
      contextAdjusted
    );

  const lambdaHome =
    contextualLambdas.lambdaHome;

  const lambdaAway =
    contextualLambdas.lambdaAway;

  const totalLambda =
    lambdaHome + lambdaAway;

  /* ==========================================
     GOALS MODEL
  ========================================== */

  const goals =
    goalsModel(
      lambdaHome,
      lambdaAway,
      home,
      away
    );

  /* ==========================================
     MERCADOS OFICIAIS
  ========================================== */

  const markets =
    extractMatrixMarkets(
      goals.matrix
    );

  const result = {
    home: markets.home,
    draw: markets.draw,
    away: markets.away
  };

  const btts = {
    yes: markets.bttsYes,
    no: markets.bttsNo
  };

  const doubleChance = {
    oneX:
      markets.doubleChance1X,

    xTwo:
      markets.doubleChanceX2
  };

  /*
   * Mantemos as probabilidades de gols retornadas
   * pelo próprio goalsModel. Elas devem ser idênticas
   * às extraídas da matriz.
   */
  const goalMarkets = {
    over15:
      markets.over15,

    over25:
      markets.over25
  };

  /* ==========================================
     PERFIL E SCORE
  ========================================== */

  const goalExpectationScore =
    calculateGoalExpectationScore(
      lambdaHome,
      lambdaAway
    );

  const goalProfile =
    classifyGoalProfile(
      lambdaHome,
      lambdaAway
    );

  const isLowGoalGame =
    goalProfile === "LOW_GOAL";

  /* ==========================================
     CONFIANÇA
  ========================================== */

  const missingDataCount =
    home.missingFields.length +
    away.missingFields.length;

  const baseConfidence =
    safeNumber(
      calculateGlobalConfidence({
        goals,
        btts,
        result,
        lambdaHome,
        lambdaAway
      }),
      0.5
    );

  /*
   * Ausência de dados reduz confiança, não altera
   * probabilidades matemáticas.
   */
  const missingDataPenalty =
    Math.min(
      missingDataCount * 0.025,
      0.20
    );

  const confidence =
    clamp(
      baseConfidence -
        missingDataPenalty,
      0,
      1
    );

  /* ==========================================
     RESULTADO
  ========================================== */

  return {
    ...context,

    blocked: gameBlocked,

    blockReason:
      gameBlocked
        ? gameCheck.reason
        : null,

    lambdaHome,
    lambdaAway,
    totalLambda,

    goalExpectationScore,
    goalProfile,
    isLowGoalGame,

    goals: {
      ...goals,

      over15:
        goalMarkets.over15,

      over25:
        goalMarkets.over25,

      under15:
        1 -
        goalMarkets.over15,

      under25:
        1 -
        goalMarkets.over25
    },

    /*
     * Mantido para compatibilidade com módulos
     * que ainda acessam model.dixonColes.
     *
     * A matriz já contém o ajuste Dixon-Coles.
     */
    dixonColes: {
      matrix:
        goals.matrix,

      rho:
        goals.meta.rho,

      bttsYesProb:
        markets.bttsYes,

      bttsNoProb:
        markets.bttsNo
    },

    btts,
    result,
    doubleChance,

    /*
     * Compatibilidade temporária.
     *
     * Handicap, corners, cards e shots não fazem
     * parte dos nove mercados oficiais e não são
     * calculados neste pipeline.
     */
    handicap: {},
    corners: {},
    cards: {},
    shots: {},
    engines: {},

    tempoFactor:
      safeNumber(
        contextAdjusted?.tempoFactor,
        1
      ),

    pressureFactor:
      safeNumber(
        contextAdjusted?.pressureFactor,
        1
      ),

    confidence,

    debug: {
      ...(context.debug || {}),

      modelPipeline: {
        league,

        homeSanitized: home,
        awaySanitized: away,

        missingData: {
          home:
            home.missingFields,

          away:
            away.missingFields,

          total:
            missingDataCount,

          confidencePenalty:
            missingDataPenalty
        },

        gameSelector:
          gameCheck,

        gameBlocked,

        lambda: {
          builder:
            lambdaBuild.diagnostics,

          base: {
            home:
              baseLambdaHome,

            away:
              baseLambdaAway,

            total:
              baseLambdaHome +
              baseLambdaAway
          },

          contextAdjusted: {
            proposedHome:
              contextAdjusted
                ?.lambdaHome,

            proposedAway:
              contextAdjusted
                ?.lambdaAway,

            tempoFactor:
              contextAdjusted
                ?.tempoFactor ??
              1,

            pressureFactor:
              contextAdjusted
                ?.pressureFactor ??
              1
          },

          final: {
            home:
              lambdaHome,

            away:
              lambdaAway,

            total:
              totalLambda,

            diff:
              Math.abs(
                lambdaHome -
                lambdaAway
              )
          }
        },

        markets,

        coherence: {
          resultSum:
            markets.home +
            markets.draw +
            markets.away,

          bttsSum:
            markets.bttsYes +
            markets.bttsNo,

          oneXCheck:
            markets.home +
            markets.draw,

          xTwoCheck:
            markets.away +
            markets.draw,

          modelOver15:
            goals.over15,

          matrixOver15:
            markets.over15,

          modelOver25:
            goals.over25,

          matrixOver25:
            markets.over25
        },

        goalExpectationScore,
        goalProfile,
        isLowGoalGame,

        confidence: {
          base:
            baseConfidence,

          missingDataPenalty,

          final:
            confidence
        }
      }
    }
  };
}

/* ==========================================
   FALLBACK
========================================== */

function emptyResponse() {
  return {
    blocked: true,

    blockReason:
      "INSUFFICIENT_DATA",

    lambdaHome: 1.32,
    lambdaAway: 1.23,
    totalLambda: 2.55,

    goalExpectationScore: 0.5,
    goalProfile: "UNKNOWN",
    isLowGoalGame: false,

    goals: {
      matrix: [],

      over15: 0,
      over25: 0,

      under15: 0,
      under25: 0,

      meta: {}
    },

    dixonColes: {
      matrix: [],
      rho: 0,

      bttsYesProb: 0,
      bttsNoProb: 0
    },

    btts: {
      yes: 0,
      no: 0
    },

    result: {
      home: 0,
      draw: 0,
      away: 0
    },

    doubleChance: {
      oneX: 0,
      xTwo: 0
    },

    handicap: {},
    corners: {},
    cards: {},
    shots: {},
    engines: {},

    tempoFactor: 1,
    pressureFactor: 1,

    confidence: 0,

    debug: {
      modelPipeline: {
        error:
          "INSUFFICIENT_DATA"
      }
    }
  };
}