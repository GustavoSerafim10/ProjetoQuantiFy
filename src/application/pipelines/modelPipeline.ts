import {
  goalsModel
} from "../../domain/marketModels/goalsModel";

import {
  contextEngine
} from "../../domain/context/contextEngine";

import {
  calculateGlobalConfidence
} from "../../domain/confidence/confidenceEngine";

import {
  buildLambda
} from "../../domain/model/lambdaBuilder";

import {
  gameSelector
} from "../engines/gameSelector";

/* ==========================================
   MODEL PIPELINE — QUANTIFY V7
========================================== */

/*
 * Responsabilidade:
 *
 * - preparar o contrato estatístico do modelo;
 * - preservar totais e médias separadamente;
 * - encaminhar dados confiáveis ao buildLambda();
 * - aplicar contexto com limite conservador;
 * - executar o goalsModel;
 * - extrair os mercados da matriz oficial;
 * - calcular perfil e expectativa de gols;
 * - produzir diagnósticos de coerência.
 *
 * Este arquivo NÃO:
 *
 * - calcula EV;
 * - calcula odds justas;
 * - toma a decisão final;
 * - substitui o lambdaBuilder;
 * - transforma totais em médias diretamente;
 * - inventa dados ausentes como se fossem reais.
 */

/* ==========================================
   CONTRATOS DE ENTRADA
========================================== */

interface RawTeamStats {
  matches?: unknown;
  matchesPlayed?: unknown;

  goalsFor?: unknown;
  goalsAgainst?: unknown;

  goalsPerGame?: unknown;
  goalsForPerGame?: unknown;
  avgGoals?: unknown;
  goalsPerMatch?: unknown;

  goalsConcededPerGame?: unknown;
  goalsAgainstPerGame?: unknown;
  avgGoalsAgainst?: unknown;
  goalsConcededPerMatch?: unknown;

  homeGoalsScoredPerMatch?: unknown;
  homeGoalsConcededPerMatch?: unknown;

  awayGoalsScoredPerMatch?: unknown;
  awayGoalsConcededPerMatch?: unknown;

  shots?: unknown;
  shotsPerGame?: unknown;
  avgShots?: unknown;
  shotsPerMatch?: unknown;

  shotsOnTarget?: unknown;
  shotsOnTargetPerGame?: unknown;
  avgShotsOnTarget?: unknown;
  shotsOnTargetPerMatch?: unknown;

  cornersAvg?: unknown;
  cornersPerGame?: unknown;

  bigChances?: unknown;
  bigChancesPerGame?: unknown;
  bigChancesPerMatch?: unknown;

  fouls?: unknown;
  foulsPerGame?: unknown;
  foulsPerMatch?: unknown;

  yellowCards?: unknown;
  yellowCardsPerGame?: unknown;
  yellowCardsPerMatch?: unknown;

  over05?: unknown;
  over15?: unknown;
  over25?: unknown;
  over35?: unknown;
  btts?: unknown;

  last5GoalsFor?: unknown;
  last5GoalsAgainst?: unknown;

  [key: string]: unknown;
}

/* ==========================================
   FONTES DAS ESTATÍSTICAS
========================================== */

type StatSource =
  | "homeGoalsScoredPerMatch"
  | "awayGoalsScoredPerMatch"
  | "homeGoalsConcededPerMatch"
  | "awayGoalsConcededPerMatch"

  | "goalsPerGame"
  | "goalsForPerGame"
  | "avgGoals"
  | "goalsPerMatch"

  | "goalsConcededPerGame"
  | "goalsAgainstPerGame"
  | "avgGoalsAgainst"
  | "goalsConcededPerMatch"

  | "goalsForDividedByMatches"
  | "goalsAgainstDividedByMatches"

  | "shotsPerGame"
  | "avgShots"
  | "shotsPerMatch"
  | "shots"

  | "shotsOnTargetPerGame"
  | "avgShotsOnTarget"
  | "shotsOnTargetPerMatch"
  | "shotsOnTarget"

  | "matchesPlayed"
  | "matches"

  | "neutralFallback"
  | "missing";

interface ResolvedNumber {
  value: number;
  source: StatSource;

  available: boolean;
  usedFallback: boolean;
  derivedFromTotals: boolean;
}

/* ==========================================
   CONTRATO SANITIZADO
========================================== */

interface SanitizedStats {
  matches: number;
  matchesPlayed: number;

  goalsFor?: number;
  goalsAgainst?: number;

  goalsPerGame: number;
  goalsForPerGame: number;
  avgGoals: number;
  goalsPerMatch: number;

  goalsConcededPerGame: number;
  goalsAgainstPerGame: number;
  avgGoalsAgainst: number;
  goalsConcededPerMatch: number;

  homeGoalsScoredPerMatch?: number;
  homeGoalsConcededPerMatch?: number;

  awayGoalsScoredPerMatch?: number;
  awayGoalsConcededPerMatch?: number;

  shots?: number;
  shotsPerGame?: number;
  avgShots?: number;
  shotsPerMatch?: number;

  shotsOnTarget?: number;
  shotsOnTargetPerGame?: number;
  avgShotsOnTarget?: number;
  shotsOnTargetPerMatch?: number;

  cornersAvg: number;
  bigChancesPerMatch: number;

  foulsPerMatch: number;
  yellowCardsPerMatch: number;

  over05: number;
  over15: number;
  over25: number;
  over35: number;
  btts: number;

  last5GoalsFor: number;
  last5GoalsAgainst: number;

  missingFields: string[];
  warnings: string[];

  sources: {
    matches: StatSource;
    goalsForRate: StatSource;
    goalsAgainstRate: StatSource;
    shots: StatSource;
    shotsOnTarget: StatSource;
  };

  inputQuality: number;

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
   UTILITÁRIOS NUMÉRICOS
========================================== */

function clamp(
  value: number,
  minimum: number,
  maximum: number
): number {
  if (
    !Number.isFinite(
      value
    )
  ) {
    return minimum;
  }

  return Math.max(
    minimum,
    Math.min(
      value,
      maximum
    )
  );
}

function safeNumber(
  value: unknown,
  fallback: number
): number {
  const parsed =
    parseFiniteNumber(
      value
    );

  return parsed ??
    fallback;
}

function parseFiniteNumber(
  value: unknown
): number | null {
  if (
    value === undefined ||
    value === null ||
    value === "" ||
    typeof value === "boolean"
  ) {
    return null;
  }

  const parsed =
    Number(
      String(value)
        .replace(",", ".")
        .trim()
    );

  return Number.isFinite(
    parsed
  )
    ? parsed
    : null;
}

function parseNonNegativeNumber(
  value: unknown
): number | null {
  const parsed =
    parseFiniteNumber(
      value
    );

  if (
    parsed === null ||
    parsed < 0
  ) {
    return null;
  }

  return parsed;
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
      Number.parseFloat(
        value
      );

    return Number.isFinite(
      parsed
    )
      ? clamp(
          parsed / 100,
          0,
          1
        )
      : fallback;
  }

  const parsed =
    parseFiniteNumber(
      value
    );

  if (
    parsed === null
  ) {
    return fallback;
  }

  return clamp(
    parsed > 1
      ? parsed / 100
      : parsed,
    0,
    1
  );
}

function normalizeStrings(
  values: string[]
): string[] {
  return [
    ...new Set(
      values
        .map(
          value =>
            String(
              value ??
              ""
            ).trim()
        )
        .filter(Boolean)
    )
  ];
}

/* ==========================================
   RESOLUÇÃO DE ESTATÍSTICAS
========================================== */

function resolveFirstNumber(
  candidates: Array<{
    value: unknown;
    source: StatSource;
  }>,
  fallback: number,
  maximum: number
): ResolvedNumber {
  for (
    const candidate of candidates
  ) {
    const parsed =
      parseNonNegativeNumber(
        candidate.value
      );

    if (
      parsed !== null
    ) {
      return {
        value:
          clamp(
            parsed,
            0,
            maximum
          ),

        source:
          candidate.source,

        available:
          true,

        usedFallback:
          false,

        derivedFromTotals:
          candidate.source ===
            "goalsForDividedByMatches" ||
          candidate.source ===
            "goalsAgainstDividedByMatches"
      };
    }
  }

  return {
    value:
      fallback,

    source:
      "neutralFallback",

    available:
      false,

    usedFallback:
      true,

    derivedFromTotals:
      false
  };
}

function resolveOptionalNumber(
  candidates: Array<{
    value: unknown;
    source: StatSource;
  }>,
  maximum: number
): ResolvedNumber {
  for (
    const candidate of candidates
  ) {
    const parsed =
      parseNonNegativeNumber(
        candidate.value
      );

    if (
      parsed !== null
    ) {
      return {
        value:
          clamp(
            parsed,
            0,
            maximum
          ),

        source:
          candidate.source,

        available:
          true,

        usedFallback:
          false,

        derivedFromTotals:
          false
      };
    }
  }

  return {
    value:
      0,

    source:
      "missing",

    available:
      false,

    usedFallback:
      false,

    derivedFromTotals:
      false
  };
}

function resolveMatches(
  stats: RawTeamStats
): ResolvedNumber {
  const matchesPlayed =
    parseNonNegativeNumber(
      stats.matchesPlayed
    );

  if (
    matchesPlayed !== null
  ) {
    return {
      value:
        clamp(
          matchesPlayed,
          0,
          100
        ),

      source:
        "matchesPlayed",

      available:
        true,

      usedFallback:
        false,

      derivedFromTotals:
        false
    };
  }

  const matches =
    parseNonNegativeNumber(
      stats.matches
    );

  if (
    matches !== null
  ) {
    return {
      value:
        clamp(
          matches,
          0,
          100
        ),

      source:
        "matches",

      available:
        true,

      usedFallback:
        false,

      derivedFromTotals:
        false
    };
  }

  return {
    value:
      0,

    source:
      "missing",

    available:
      false,

    usedFallback:
      false,

    derivedFromTotals:
      false
  };
}

function derivePerGameRate(
  total: unknown,
  matches: number
): number | null {
  const parsedTotal =
    parseNonNegativeNumber(
      total
    );

  if (
    parsedTotal === null ||
    !Number.isFinite(
      matches
    ) ||
    matches <= 0
  ) {
    return null;
  }

  const result =
    parsedTotal /
    matches;

  return Number.isFinite(
    result
  )
    ? result
    : null;
}

/* ==========================================
   RESOLUÇÃO DAS TAXAS DE GOLS
========================================== */

function resolveGoalsForRate(
  stats: RawTeamStats,
  venue: "HOME" | "AWAY",
  matches: number
): ResolvedNumber {
  const venueSpecific =
    venue === "HOME"
      ? stats.homeGoalsScoredPerMatch
      : stats.awayGoalsScoredPerMatch;

  return resolveFirstNumber(
    [
      {
        value:
          venueSpecific,

        source:
          venue === "HOME"
            ? "homeGoalsScoredPerMatch"
            : "awayGoalsScoredPerMatch"
      },

      {
        value:
          stats.goalsPerGame,

        source:
          "goalsPerGame"
      },

      {
        value:
          stats.goalsForPerGame,

        source:
          "goalsForPerGame"
      },

      {
        value:
          stats.avgGoals,

        source:
          "avgGoals"
      },

      {
        value:
          stats.goalsPerMatch,

        source:
          "goalsPerMatch"
      },

      {
        value:
          derivePerGameRate(
            stats.goalsFor,
            matches
          ),

        source:
          "goalsForDividedByMatches"
      }
    ],
    1.25,
    6
  );
}

function resolveGoalsAgainstRate(
  stats: RawTeamStats,
  venue: "HOME" | "AWAY",
  matches: number
): ResolvedNumber {
  const venueSpecific =
    venue === "HOME"
      ? stats.homeGoalsConcededPerMatch
      : stats.awayGoalsConcededPerMatch;

  return resolveFirstNumber(
    [
      {
        value:
          venueSpecific,

        source:
          venue === "HOME"
            ? "homeGoalsConcededPerMatch"
            : "awayGoalsConcededPerMatch"
      },

      {
        value:
          stats.goalsConcededPerGame,

        source:
          "goalsConcededPerGame"
      },

      {
        value:
          stats.goalsAgainstPerGame,

        source:
          "goalsAgainstPerGame"
      },

      {
        value:
          stats.avgGoalsAgainst,

        source:
          "avgGoalsAgainst"
      },

      {
        value:
          stats.goalsConcededPerMatch,

        source:
          "goalsConcededPerMatch"
      },

      {
        value:
          derivePerGameRate(
            stats.goalsAgainst,
            matches
          ),

        source:
          "goalsAgainstDividedByMatches"
      }
    ],
    1.25,
    6
  );
}

/* ==========================================
   SANITIZAÇÃO
========================================== */

function sanitizeStats(
  rawStats: RawTeamStats = {},
  venue: "HOME" | "AWAY"
): SanitizedStats {
  const missingFields:
    string[] = [];

  const warnings:
    string[] = [];

  const matchesResult =
    resolveMatches(
      rawStats
    );

  const matches =
    matchesResult.value;

  const goalsForRateResult =
    resolveGoalsForRate(
      rawStats,
      venue,
      matches
    );

  const goalsAgainstRateResult =
    resolveGoalsAgainstRate(
      rawStats,
      venue,
      matches
    );

  /*
   * Totais permanecem como totais.
   *
   * Nunca atribuímos:
   *
   * goalsFor = goalsPerGame
   * goalsAgainst = goalsConcededPerGame
   */
  const goalsForTotal =
    parseNonNegativeNumber(
      rawStats.goalsFor
    );

  const goalsAgainstTotal =
    parseNonNegativeNumber(
      rawStats.goalsAgainst
    );

  const shotsResult =
    resolveOptionalNumber(
      [
        {
          value:
            rawStats.shotsPerGame,

          source:
            "shotsPerGame"
        },

        {
          value:
            rawStats.avgShots,

          source:
            "avgShots"
        },

        {
          value:
            rawStats.shotsPerMatch,

          source:
            "shotsPerMatch"
        },

        {
          value:
            rawStats.shots,

          source:
            "shots"
        }
      ],
      40
    );

  const shotsOnTargetResult =
    resolveOptionalNumber(
      [
        {
          value:
            rawStats.shotsOnTargetPerGame,

          source:
            "shotsOnTargetPerGame"
        },

        {
          value:
            rawStats.avgShotsOnTarget,

          source:
            "avgShotsOnTarget"
        },

        {
          value:
            rawStats.shotsOnTargetPerMatch,

          source:
            "shotsOnTargetPerMatch"
        },

        {
          value:
            rawStats.shotsOnTarget,

          source:
            "shotsOnTarget"
        }
      ],
      25
    );

  const shots =
    shotsResult.available
      ? shotsResult.value
      : undefined;

  const rawShotsOnTarget =
    shotsOnTargetResult.available
      ? shotsOnTargetResult.value
      : undefined;

  /*
   * Se chutes totais existirem, garantimos:
   *
   * shotsOnTarget <= shots.
   *
   * Se chutes totais estiverem ausentes,
   * preservamos chutes no alvo.
   *
   * Antes:
   *
   * Math.min(4, 0) = 0
   *
   * Agora:
   *
   * shots ausente + shotsOnTarget 4 = 4
   */
  const shotsOnTarget =
    rawShotsOnTarget === undefined
      ? undefined
      : shots !== undefined &&
          shots > 0
        ? Math.min(
            rawShotsOnTarget,
            shots
          )
        : rawShotsOnTarget;

  if (
    !matchesResult.available
  ) {
    missingFields.push(
      "matches"
    );
  }

  if (
    !goalsForRateResult.available
  ) {
    missingFields.push(
      "goalsForRate"
    );

    warnings.push(
      "GOALS_FOR_RATE_USING_NEUTRAL_FALLBACK"
    );
  }

  if (
    !goalsAgainstRateResult.available
  ) {
    missingFields.push(
      "goalsAgainstRate"
    );

    warnings.push(
      "GOALS_AGAINST_RATE_USING_NEUTRAL_FALLBACK"
    );
  }

  if (
    !shotsResult.available
  ) {
    missingFields.push(
      "shots"
    );
  }

  if (
    !shotsOnTargetResult.available
  ) {
    missingFields.push(
      "shotsOnTarget"
    );
  }

  if (
    goalsForRateResult
      .derivedFromTotals
  ) {
    warnings.push(
      "GOALS_FOR_RATE_DERIVED_FROM_TOTALS"
    );
  }

  if (
    goalsAgainstRateResult
      .derivedFromTotals
  ) {
    warnings.push(
      "GOALS_AGAINST_RATE_DERIVED_FROM_TOTALS"
    );
  }

  /*
   * Detecta divergência entre total/média quando
   * ambos estiverem disponíveis.
   */
  if (
    goalsForTotal !== null &&
    matches > 0
  ) {
    const derived =
      goalsForTotal /
      matches;

    if (
      Math.abs(
        derived -
        goalsForRateResult.value
      ) > 0.2
    ) {
      warnings.push(
        "GOALS_FOR_TOTAL_RATE_INCONSISTENCY"
      );
    }
  }

  if (
    goalsAgainstTotal !== null &&
    matches > 0
  ) {
    const derived =
      goalsAgainstTotal /
      matches;

    if (
      Math.abs(
        derived -
        goalsAgainstRateResult.value
      ) > 0.2
    ) {
      warnings.push(
        "GOALS_AGAINST_TOTAL_RATE_INCONSISTENCY"
      );
    }
  }

  const goalsForRate =
    goalsForRateResult.value;

  const goalsAgainstRate =
    goalsAgainstRateResult.value;

  const last5GoalsFor =
    clamp(
      safeNumber(
        rawStats.last5GoalsFor,
        goalsForRate
      ),
      0,
      6
    );

  const last5GoalsAgainst =
    clamp(
      safeNumber(
        rawStats.last5GoalsAgainst,
        goalsAgainstRate
      ),
      0,
      6
    );

  const realCoreFields =
    [
      matchesResult,
      goalsForRateResult,
      goalsAgainstRateResult
    ].filter(
      result =>
        result.available &&
        !result.usedFallback
    ).length;

  const inputQuality =
    realCoreFields /
    3;

  const sanitized:
    SanitizedStats = {
      matches,
      matchesPlayed:
        matches,

      goalsPerGame:
        goalsForRate,

      goalsForPerGame:
        goalsForRate,

      avgGoals:
        goalsForRate,

      goalsPerMatch:
        goalsForRate,

      goalsConcededPerGame:
        goalsAgainstRate,

      goalsAgainstPerGame:
        goalsAgainstRate,

      avgGoalsAgainst:
        goalsAgainstRate,

      goalsConcededPerMatch:
        goalsAgainstRate,

      cornersAvg:
        clamp(
          safeNumber(
            rawStats.cornersAvg ??
            rawStats.cornersPerGame,
            0
          ),
          0,
          20
        ),

      bigChancesPerMatch:
        clamp(
          safeNumber(
            rawStats.bigChancesPerMatch ??
            rawStats.bigChancesPerGame ??
            rawStats.bigChances,
            0
          ),
          0,
          10
        ),

      foulsPerMatch:
        clamp(
          safeNumber(
            rawStats.foulsPerMatch ??
            rawStats.foulsPerGame ??
            rawStats.fouls,
            0
          ),
          0,
          40
        ),

      yellowCardsPerMatch:
        clamp(
          safeNumber(
            rawStats.yellowCardsPerMatch ??
            rawStats.yellowCardsPerGame ??
            rawStats.yellowCards,
            0
          ),
          0,
          15
        ),

      over05:
        normalizePercent(
          rawStats.over05
        ),

      over15:
        normalizePercent(
          rawStats.over15
        ),

      over25:
        normalizePercent(
          rawStats.over25
        ),

      over35:
        normalizePercent(
          rawStats.over35
        ),

      btts:
        normalizePercent(
          rawStats.btts
        ),

      last5GoalsFor,
      last5GoalsAgainst,

      missingFields:
        normalizeStrings(
          missingFields
        ),

      warnings:
        normalizeStrings(
          warnings
        ),

      sources: {
        matches:
          matchesResult.source,

        goalsForRate:
          goalsForRateResult.source,

        goalsAgainstRate:
          goalsAgainstRateResult.source,

        shots:
          shotsResult.source,

        shotsOnTarget:
          shotsOnTargetResult.source
      },

      inputQuality:
        clamp(
          inputQuality,
          0,
          1
        )
    };

  /*
   * Só adicionamos totais quando realmente existem.
   */
  if (
    goalsForTotal !== null
  ) {
    sanitized.goalsFor =
      goalsForTotal;
  }

  if (
    goalsAgainstTotal !== null
  ) {
    sanitized.goalsAgainst =
      goalsAgainstTotal;
  }

  /*
   * Aliases específicos de mando recebem apenas
   * médias por partida já resolvidas.
   */
  if (
    venue === "HOME"
  ) {
    sanitized
      .homeGoalsScoredPerMatch =
      goalsForRate;

    sanitized
      .homeGoalsConcededPerMatch =
      goalsAgainstRate;
  } else {
    sanitized
      .awayGoalsScoredPerMatch =
      goalsForRate;

    sanitized
      .awayGoalsConcededPerMatch =
      goalsAgainstRate;
  }

  /*
   * Finalizações são opcionais.
   *
   * Não produzimos zeros falsos para o
   * lambdaBuilder quando o dado está ausente.
   */
  if (
    shots !== undefined
  ) {
    sanitized.shots =
      shots;

    sanitized.shotsPerGame =
      shots;

    sanitized.avgShots =
      shots;

    sanitized.shotsPerMatch =
      shots;
  }

  if (
    shotsOnTarget !== undefined
  ) {
    sanitized.shotsOnTarget =
      shotsOnTarget;

    sanitized.shotsOnTargetPerGame =
      shotsOnTarget;

    sanitized.avgShotsOnTarget =
      shotsOnTarget;

    sanitized.shotsOnTargetPerMatch =
      shotsOnTarget;
  }

  return sanitized;
}

/* ==========================================
   AJUSTE CONTEXTUAL
========================================== */

function applyBoundedContextAdjustment(
  baseLambdaHome: number,
  baseLambdaAway: number,
  contextAdjusted: unknown
) {
  const MIN_CONTEXT_FACTOR =
    0.92;

  const MAX_CONTEXT_FACTOR =
    1.08;

  const adjusted =
    isObjectRecord(
      contextAdjusted
    )
      ? contextAdjusted
      : {};

  const proposedHome =
    safeNumber(
      adjusted.lambdaHome,
      baseLambdaHome
    );

  const proposedAway =
    safeNumber(
      adjusted.lambdaAway,
      baseLambdaAway
    );

  const lambdaHome =
    clamp(
      proposedHome,
      baseLambdaHome *
        MIN_CONTEXT_FACTOR,
      baseLambdaHome *
        MAX_CONTEXT_FACTOR
    );

  const lambdaAway =
    clamp(
      proposedAway,
      baseLambdaAway *
        MIN_CONTEXT_FACTOR,
      baseLambdaAway *
        MAX_CONTEXT_FACTOR
    );

  return {
    lambdaHome,
    lambdaAway,

    minContextFactor:
      MIN_CONTEXT_FACTOR,

    maxContextFactor:
      MAX_CONTEXT_FACTOR
  };
}

/* ==========================================
   EXTRAÇÃO DA MATRIZ
========================================== */

function extractMatrixMarkets(
  matrix: number[][]
): MatrixMarkets {
  let home =
    0;

  let draw =
    0;

  let away =
    0;

  let over15 =
    0;

  let over25 =
    0;

  let bttsYes =
    0;

  for (
    let homeGoals = 0;
    homeGoals <
      matrix.length;
    homeGoals++
  ) {
    const row =
      matrix[
        homeGoals
      ] ?? [];

    for (
      let awayGoals = 0;
      awayGoals <
        row.length;
      awayGoals++
    ) {
      const probability =
        clamp(
          safeNumber(
            row[
              awayGoals
            ],
            0
          ),
          0,
          1
        );

      if (
        homeGoals >
        awayGoals
      ) {
        home +=
          probability;
      } else if (
        homeGoals ===
        awayGoals
      ) {
        draw +=
          probability;
      } else {
        away +=
          probability;
      }

      const totalGoals =
        homeGoals +
        awayGoals;

      if (
        totalGoals >= 2
      ) {
        over15 +=
          probability;
      }

      if (
        totalGoals >= 3
      ) {
        over25 +=
          probability;
      }

      if (
        homeGoals >= 1 &&
        awayGoals >= 1
      ) {
        bttsYes +=
          probability;
      }
    }
  }

  const resultTotal =
    home +
    draw +
    away;

  if (
    Number.isFinite(
      resultTotal
    ) &&
    resultTotal > 0
  ) {
    home /=
      resultTotal;

    draw /=
      resultTotal;

    away /=
      resultTotal;
  }

  home =
    clamp(
      home,
      0,
      1
    );

  draw =
    clamp(
      draw,
      0,
      1
    );

  away =
    clamp(
      away,
      0,
      1
    );

  over15 =
    clamp(
      over15,
      0,
      1
    );

  over25 =
    clamp(
      over25,
      0,
      1
    );

  bttsYes =
    clamp(
      bttsYes,
      0,
      1
    );

  const bttsNo =
    clamp(
      1 -
        bttsYes,
      0,
      1
    );

  const doubleChance1X =
    clamp(
      home +
        draw,
      0,
      1
    );

  const doubleChanceX2 =
    clamp(
      away +
        draw,
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
  const totalLambda =
    lambdaHome +
    lambdaAway;

  const weakerLambda =
    Math.min(
      lambdaHome,
      lambdaAway
    );

  /*
   * Mede expectativa conjunta de gols.
   *
   * Não altera lambda, probabilidade ou EV.
   */
  const totalComponent =
    clamp(
      totalLambda /
        3.25,
      0,
      1
    );

  const bilateralComponent =
    clamp(
      weakerLambda /
        1.15,
      0,
      1
    );

  return clamp(
    totalComponent *
      0.75 +
    bilateralComponent *
      0.25,
    0,
    1
  );
}

function classifyGoalProfile(
  lambdaHome: number,
  lambdaAway: number
):
  | "LOW_GOAL"
  | "OPEN_GOALS"
  | "FAVORITE_EDGE"
  | "BALANCED" {
  const total =
    lambdaHome +
    lambdaAway;

  const minimumLambda =
    Math.min(
      lambdaHome,
      lambdaAway
    );

  const difference =
    Math.abs(
      lambdaHome -
      lambdaAway
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

  if (
    difference >= 0.75
  ) {
    return "FAVORITE_EDGE";
  }

  return "BALANCED";
}

/* ==========================================
   PIPELINE
========================================== */

export function modelPipeline(
  context: unknown
) {
  if (
    !isObjectRecord(
      context
    ) ||
    !isObjectRecord(
      context.homeStats
    ) ||
    !isObjectRecord(
      context.awayStats
    )
  ) {
    console.warn(
      "⚠️ Dados insuficientes no modelPipeline"
    );

    return emptyResponse();
  }

  const rawHomeStats =
    context.homeStats as
      RawTeamStats;

  const rawAwayStats =
    context.awayStats as
      RawTeamStats;

  const league =
    String(
      context.league ??
      ""
    );

  const home =
    sanitizeStats(
      rawHomeStats,
      "HOME"
    );

  const away =
    sanitizeStats(
      rawAwayStats,
      "AWAY"
    );

  console.group(
    "🧠 MODEL PIPELINE — SANITIZATION AUDIT"
  );

  console.log(
    "RAW HOME STATS:",
    rawHomeStats
  );

  console.log(
    "SANITIZED HOME STATS:",
    home
  );

  console.log(
    "RAW AWAY STATS:",
    rawAwayStats
  );

  console.log(
    "SANITIZED AWAY STATS:",
    away
  );

  console.groupEnd();

  /* ========================================
     SELEÇÃO DO JOGO
  ======================================== */

  const gameCheck =
    gameSelector({
      homeStats:
        home,

      awayStats:
        away
    });

  const gameBlocked =
    !gameCheck.allowed;

  /* ========================================
     LAMBDA BUILDER OFICIAL
  ======================================== */

  const lambdaBuild =
    buildLambda(
      home as never,
      away as never,
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

  /* ========================================
     AJUSTE CONTEXTUAL CONTROLADO
  ======================================== */

  const contextAdjusted =
    contextEngine({
      homeStats:
        home,

      awayStats:
        away,

      baseLambdaHome,
      baseLambdaAway,

      leagueData: {
        leagueKey:
          league
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
    lambdaHome +
    lambdaAway;

  /* ========================================
     GOALS MODEL
  ======================================== */

  const goals =
    goalsModel(
      lambdaHome,
      lambdaAway,
      home,
      away
    );

  /* ========================================
     MERCADOS OFICIAIS
  ======================================== */

  const markets =
    extractMatrixMarkets(
      goals.matrix
    );

  const result = {
    home:
      markets.home,

    draw:
      markets.draw,

    away:
      markets.away
  };

  const btts = {
    yes:
      markets.bttsYes,

    no:
      markets.bttsNo
  };

  const doubleChance = {
    oneX:
      markets.doubleChance1X,

    xTwo:
      markets.doubleChanceX2
  };

  const goalMarkets = {
    over15:
      markets.over15,

    over25:
      markets.over25
  };

  /* ========================================
     PERFIL E SCORE
  ======================================== */

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
    goalProfile ===
    "LOW_GOAL";

  /* ========================================
     CONFIANÇA
  ======================================== */

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
   * Penalidade por ausência factual.
   *
   * Warnings de coerência são registrados,
   * mas não alteram probabilidades neste módulo.
   */
  const missingDataPenalty =
    Math.min(
      missingDataCount *
        0.025,
      0.20
    );

  const confidence =
    clamp(
      baseConfidence -
        missingDataPenalty,
      0,
      1
    );

  /* ========================================
     LOG FINAL
  ======================================== */

  console.group(
    "⚽ MODEL PIPELINE — FINAL AUDIT"
  );

  console.log(
    "LAMBDA BUILDER:",
    {
      lambdaBuild,

      baseLambdaHome,
      baseLambdaAway
    }
  );

  console.log(
    "CONTEXTUAL LAMBDAS:",
    {
      contextAdjusted,
      lambdaHome,
      lambdaAway,
      totalLambda
    }
  );

  console.log(
    "GOAL PROFILE:",
    {
      goalExpectationScore,
      goalProfile,
      isLowGoalGame
    }
  );

  console.log(
    "MARKETS:",
    markets
  );

  console.groupEnd();

  /* ========================================
     RESULTADO
  ======================================== */

return {
  ...context,

  homeStats:
    home,

  awayStats:
    away,

  /*
   * Mercados consolidados extraídos da matriz.
   * Mantido no retorno público por compatibilidade
   * com eliteAnalyzer e diagnósticos do pipeline.
   */
  markets,

  blocked:
    gameBlocked,
    
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

    handicap: {},
    corners: {},
    cards: {},
    shots: {},
    engines: {},

    tempoFactor:
      safeNumber(
        getObjectValue(
          contextAdjusted,
          "tempoFactor"
        ),
        1
      ),

    pressureFactor:
      safeNumber(
        getObjectValue(
          contextAdjusted,
          "pressureFactor"
        ),
        1
      ),

    confidence,

    debug: {
      ...(
        isObjectRecord(
          context.debug
        )
          ? context.debug
          : {}
      ),

      modelPipeline: {
        league,

        sanitization: {
          home: {
            sources:
              home.sources,

            inputQuality:
              home.inputQuality,

            missingFields:
              home.missingFields,

            warnings:
              home.warnings
          },

          away: {
            sources:
              away.sources,

            inputQuality:
              away.inputQuality,

            missingFields:
              away.missingFields,

            warnings:
              away.warnings
          }
        },

        homeSanitized:
          home,

        awaySanitized:
          away,

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
              getObjectValue(
                contextAdjusted,
                "lambdaHome"
              ),

            proposedAway:
              getObjectValue(
                contextAdjusted,
                "lambdaAway"
              ),

            tempoFactor:
              getObjectValue(
                contextAdjusted,
                "tempoFactor"
              ) ?? 1,

            pressureFactor:
              getObjectValue(
                contextAdjusted,
                "pressureFactor"
              ) ?? 1,

            minFactor:
              contextualLambdas
                .minContextFactor,

            maxFactor:
              contextualLambdas
                .maxContextFactor
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
   HELPERS DE OBJETO
========================================== */

function isObjectRecord(
  value: unknown
): value is Record<
  string,
  unknown
> {
  return (
    typeof value ===
      "object" &&
    value !== null &&
    !Array.isArray(
      value
    )
  );
}

function getObjectValue(
  value: unknown,
  key: string
): unknown {
  if (
    !isObjectRecord(
      value
    )
  ) {
    return undefined;
  }

  return value[key];
}

/* ==========================================
   FALLBACK
========================================== */

function emptyResponse() {
  return {
    blocked:
      true,

    blockReason:
      "INSUFFICIENT_DATA",

    lambdaHome:
      1.32,

    lambdaAway:
      1.23,

    totalLambda:
      2.55,

    goalExpectationScore:
      0.5,

    goalProfile:
      "UNKNOWN",

    isLowGoalGame:
      false,

    goals: {
      matrix:
        [],

      over15:
        0,

      over25:
        0,

      under15:
        0,

      under25:
        0,

      meta:
        {}
    },

    dixonColes: {
      matrix:
        [],

      rho:
        0,

      bttsYesProb:
        0,

      bttsNoProb:
        0
    },

    btts: {
      yes:
        0,

      no:
        0
    },

    result: {
      home:
        0,

      draw:
        0,

      away:
        0
    },

    doubleChance: {
      oneX:
        0,

      xTwo:
        0
    },

    markets: {
  home:
    0,

  draw:
    0,

  away:
    0,

  over15:
    0,

  over25:
    0,

  bttsYes:
    0,

  bttsNo:
    0,

  doubleChance1X:
    0,

  doubleChanceX2:
    0
},

    handicap: {},
    corners: {},
    cards: {},
    shots: {},
    engines: {},

    tempoFactor:
      1,

    pressureFactor:
      1,

    confidence:
      0,

    debug: {
      modelPipeline: {
        error:
          "INSUFFICIENT_DATA"
      }
    }
  };
}