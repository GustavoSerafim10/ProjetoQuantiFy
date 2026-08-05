import type {
  TeamStats
} from "../types/TeamStats";

import {
  getLeagueGoalAdjustment,
  resolveLeagueStrength,
  buildLeagueReliability,
  type LeagueReliability
} from "../rating/leagueStrength";

import {
  calculateXGProxyDetailed
} from "../math/xgProxy";

/* ==========================================
   LAMBDA BUILDER — QUANTIFY V7.2 ELITE

   Objetivo da V7.2:
   - preservar a natureza estatística da entrada;
   - distinguir splits reais de médias gerais;
   - normalizar médias gerais contra uma base neutra;
   - aplicar o mando uma única vez nas bases finais;
   - impedir zero falso em finalizações totais;
   - ampliar diagnósticos de proveniência;
   - reduzir o viés estrutural de X2 gerado por
     normalização incompatível entre fonte e base.
========================================== */

/* ==========================================
   PARÂMETROS ESTRUTURAIS
========================================== */

/*
 * Elasticidades inferiores a 1 comprimem
 * diferenças extremas entre as equipes.
 *
 * Devem ser calibradas futuramente com:
 *
 * - backtest;
 * - Log Loss;
 * - Brier Score;
 * - calibração por faixa de probabilidade.
 */
const ATTACK_ELASTICITY =
  0.82;

const DEFENSE_ELASTICITY =
  0.78;

/*
 * Quantidade equivalente de partidas usadas
 * como prior no shrinkage.
 */
const SHRINK_FACTOR =
  10;

/*
 * Limites individuais de segurança.
 */
const MIN_LAMBDA =
  0.20;

const MAX_LAMBDA =
  3.20;

/*
 * Limite máximo do total.
 *
 * Apenas reduz jogos excessivamente inflados.
 * Não eleva jogos de baixa expectativa.
 */
const MAX_TOTAL_LAMBDA =
  5.0;

/*
 * Composição ofensiva.
 *
 * O xG proxy possui peso menor por não conhecer:
 *
 * - posição da finalização;
 * - ângulo;
 * - qualidade da chance;
 * - tipo de assistência;
 * - pressão defensiva.
 */
const GOALS_WEIGHT =
  0.58;

const XG_PROXY_WEIGHT =
  0.22;

const SHOT_QUALITY_WEIGHT =
  0.20;

const DOMINANCE_ELASTICITY =
  0.18;

const RECENT_FORM_MAX_ADJUSTMENT =
  0.12;

const VARIANCE_MAX_ADJUSTMENT =
  0.08;

const SHOT_QUALITY_MAX_ADJUSTMENT =
  0.14;

const MIN_ADAPTIVE_SHRINK =
  4;

const MAX_ADAPTIVE_SHRINK =
  18;

/*
 * Referência mínima para considerar uma amostra
 * razoavelmente confiável.
 */
const MIN_RELIABLE_MATCHES =
  8;

/* ==========================================
   FONTES DOS DADOS
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

  | "shotsOnTargetPerGame"
  | "avgShotsOnTarget"
  | "shotsOnTarget"
  | "shotsOnTargetPerMatch"

  | "shotsPerGame"
  | "avgShots"
  | "shots"
  | "shotsPerMatch"

  | "bigChancesPerGame"
  | "avgBigChances"
  | "bigChances"
  | "bigChancesPerMatch"

  | "recentGoalsPerGame"
  | "recentFormFactor"
  | "goalVariance"
  | "conversionRate"

  | "matchesPlayed"
  | "matches"

  | "leagueFallback"
  | "missing";

interface ResolvedStat {
  value: number;
  source: StatSource;

  usedLeagueFallback:
    boolean;

  derivedFromTotals:
    boolean;
}

interface ResolvedOptionalStat {
  value: number | null;
  source: StatSource;

  available:
    boolean;
}

/* ==========================================
   TIPOS INTERNOS
========================================== */

interface LimitedLambdas {
  home: number;
  away: number;
}

interface ContextualAttackFactors {
  recentFormFactor: number;
  varianceFactor: number;
  shotQualityFactor: number;

  recentGoalsPerGame: number | null;
  goalVariance: number | null;
  bigChancesPerGame: number | null;
  conversionRate: number | null;

  diagnostics: {
    recentFormAvailable: boolean;
    varianceAvailable: boolean;
    shotQualityAvailable: boolean;
  };
}

interface TeamStatsCompatibility {
  /*
   * Amostra.
   */
  matchesPlayed?: number;
  matches?: number;

  /*
   * Totais.
   */
  goalsFor?: number;
  goalsAgainst?: number;

  /*
   * Contrato canônico atual.
   */
  goalsPerGame?: number;
  goalsForPerGame?: number;
  avgGoals?: number;

  goalsConcededPerGame?: number;
  goalsAgainstPerGame?: number;
  avgGoalsAgainst?: number;

  /*
   * Contratos antigos.
   */
  goalsPerMatch?: number;
  goalsConcededPerMatch?: number;

  homeGoalsScoredPerMatch?: number;
  homeGoalsConcededPerMatch?: number;

  awayGoalsScoredPerMatch?: number;
  awayGoalsConcededPerMatch?: number;

  /*
   * Finalizações no alvo.
   */
  shotsOnTargetPerGame?: number;
  avgShotsOnTarget?: number;
  shotsOnTarget?: number;
  shotsOnTargetPerMatch?: number;

  /*
   * Finalizações totais.
   */
  shotsPerGame?: number;
  avgShots?: number;
  shots?: number;
  shotsPerMatch?: number;

  bigChancesPerGame?: number;
  avgBigChances?: number;
  bigChances?: number;
  bigChancesPerMatch?: number;

  recentGoalsPerGame?: number;
  recentFormFactor?: number;
  goalVariance?: number;

  conversionRate?: number;
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
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value === "boolean"
  ) {
    return fallback;
  }

  const parsed =
    Number(
      value
    );

  return Number.isFinite(
    parsed
  )
    ? parsed
    : fallback;
}

function safePositiveNumber(
  value: unknown,
  fallback: number,
  minimum = 0.01
): number {
  const parsed =
    safeNumber(
      value,
      fallback
    );

  return parsed >= minimum
    ? parsed
    : fallback;
}

function parseFiniteNumber(
  value: unknown
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value === "boolean"
  ) {
    return null;
  }

  const parsed =
    Number(
      value
    );

  return Number.isFinite(
    parsed
  )
    ? parsed
    : null;
}

function roundNumber(
  value: number,
  decimals = 4
): number {
  if (
    !Number.isFinite(
      value
    )
  ) {
    return 0;
  }

  const factor =
    10 ** decimals;

  return (
    Math.round(
      value *
      factor
    ) /
    factor
  );
}

/* ==========================================
   RESOLVEDORES GENÉRICOS
========================================== */

function resolveFirstStat(
  candidates: Array<{
    value: unknown;
    source: StatSource;
  }>,
  fallback: number
): ResolvedStat {
  for (
    const candidate of candidates
  ) {
    const parsed =
      parseFiniteNumber(
        candidate.value
      );

    if (
      parsed !== null &&
      parsed >= 0
    ) {
      return {
        value:
          parsed,

        source:
          candidate.source,

        usedLeagueFallback:
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
      "leagueFallback",

    usedLeagueFallback:
      true,

    derivedFromTotals:
      false
  };
}

function resolveOptionalStat(
  candidates: Array<{
    value: unknown;
    source: StatSource;
  }>
): ResolvedOptionalStat {
  for (
    const candidate of candidates
  ) {
    const parsed =
      parseFiniteNumber(
        candidate.value
      );

    if (
      parsed !== null &&
      parsed >= 0
    ) {
      return {
        value:
          parsed,

        source:
          candidate.source,

        available:
          true
      };
    }
  }

  return {
    value:
      null,

    source:
      "missing",

    available:
      false
  };
}

/* ==========================================
   AMOSTRA
========================================== */

function resolveMatchesPlayed(
  team:
    TeamStatsCompatibility
): ResolvedStat {
  const matchesPlayed =
    parseFiniteNumber(
      team.matchesPlayed
    );

  if (
    matchesPlayed !== null &&
    matchesPlayed >= 0
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

      usedLeagueFallback:
        false,

      derivedFromTotals:
        false
    };
  }

  const matches =
    parseFiniteNumber(
      team.matches
    );

  if (
    matches !== null &&
    matches >= 0
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

      usedLeagueFallback:
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

    usedLeagueFallback:
      false,

    derivedFromTotals:
      false
  };
}

/* ==========================================
   MÉDIAS DERIVADAS DOS TOTAIS
========================================== */

function deriveRateFromTotals(
  total: unknown,
  matchesPlayed: number
): number | null {
  const safeTotal =
    parseFiniteNumber(
      total
    );

  if (
    safeTotal === null ||
    safeTotal < 0 ||
    !Number.isFinite(
      matchesPlayed
    ) ||
    matchesPlayed <= 0
  ) {
    return null;
  }

  const rate =
    safeTotal /
    matchesPlayed;

  return Number.isFinite(
    rate
  )
    ? rate
    : null;
}

/* ==========================================
   RESOLUÇÃO DAS TAXAS DE ATAQUE
========================================== */

function resolveHomeGoalsScored(
  team: TeamStatsCompatibility,
  fallback: number,
  matchesPlayed: number
): ResolvedStat {
  const derivedFromTotals =
    deriveRateFromTotals(
      team.goalsFor,
      matchesPlayed
    );

  const resolved =
    resolveFirstStat(
      [
        {
          value:
            team.homeGoalsScoredPerMatch,

          source:
            "homeGoalsScoredPerMatch"
        },

        {
          value:
            team.goalsPerGame,

          source:
            "goalsPerGame"
        },

        {
          value:
            team.goalsForPerGame,

          source:
            "goalsForPerGame"
        },

        {
          value:
            team.avgGoals,

          source:
            "avgGoals"
        },

        {
          value:
            team.goalsPerMatch,

          source:
            "goalsPerMatch"
        },

        {
          value:
            derivedFromTotals,

          source:
            "goalsForDividedByMatches"
        }
      ],
      fallback
    );

  return {
    ...resolved,

    value:
      clamp(
        resolved.value,
        0,
        6
      )
  };
}

function resolveAwayGoalsScored(
  team: TeamStatsCompatibility,
  fallback: number,
  matchesPlayed: number
): ResolvedStat {
  const derivedFromTotals =
    deriveRateFromTotals(
      team.goalsFor,
      matchesPlayed
    );

  const resolved =
    resolveFirstStat(
      [
        {
          value:
            team.awayGoalsScoredPerMatch,

          source:
            "awayGoalsScoredPerMatch"
        },

        {
          value:
            team.goalsPerGame,

          source:
            "goalsPerGame"
        },

        {
          value:
            team.goalsForPerGame,

          source:
            "goalsForPerGame"
        },

        {
          value:
            team.avgGoals,

          source:
            "avgGoals"
        },

        {
          value:
            team.goalsPerMatch,

          source:
            "goalsPerMatch"
        },

        {
          value:
            derivedFromTotals,

          source:
            "goalsForDividedByMatches"
        }
      ],
      fallback
    );

  return {
    ...resolved,

    value:
      clamp(
        resolved.value,
        0,
        6
      )
  };
}

/* ==========================================
   RESOLUÇÃO DAS TAXAS DEFENSIVAS
========================================== */

function resolveHomeGoalsConceded(
  team: TeamStatsCompatibility,
  fallback: number,
  matchesPlayed: number
): ResolvedStat {
  const derivedFromTotals =
    deriveRateFromTotals(
      team.goalsAgainst,
      matchesPlayed
    );

  const resolved =
    resolveFirstStat(
      [
        {
          value:
            team.homeGoalsConcededPerMatch,

          source:
            "homeGoalsConcededPerMatch"
        },

        {
          value:
            team.goalsConcededPerGame,

          source:
            "goalsConcededPerGame"
        },

        {
          value:
            team.goalsAgainstPerGame,

          source:
            "goalsAgainstPerGame"
        },

        {
          value:
            team.avgGoalsAgainst,

          source:
            "avgGoalsAgainst"
        },

        {
          value:
            team.goalsConcededPerMatch,

          source:
            "goalsConcededPerMatch"
        },

        {
          value:
            derivedFromTotals,

          source:
            "goalsAgainstDividedByMatches"
        }
      ],
      fallback
    );

  return {
    ...resolved,

    value:
      clamp(
        resolved.value,
        0,
        6
      )
  };
}

function resolveAwayGoalsConceded(
  team: TeamStatsCompatibility,
  fallback: number,
  matchesPlayed: number
): ResolvedStat {
  const derivedFromTotals =
    deriveRateFromTotals(
      team.goalsAgainst,
      matchesPlayed
    );

  const resolved =
    resolveFirstStat(
      [
        {
          value:
            team.awayGoalsConcededPerMatch,

          source:
            "awayGoalsConcededPerMatch"
        },

        {
          value:
            team.goalsConcededPerGame,

          source:
            "goalsConcededPerGame"
        },

        {
          value:
            team.goalsAgainstPerGame,

          source:
            "goalsAgainstPerGame"
        },

        {
          value:
            team.avgGoalsAgainst,

          source:
            "avgGoalsAgainst"
        },

        {
          value:
            team.goalsConcededPerMatch,

          source:
            "goalsConcededPerMatch"
        },

        {
          value:
            derivedFromTotals,

          source:
            "goalsAgainstDividedByMatches"
        }
      ],
      fallback
    );

  return {
    ...resolved,

    value:
      clamp(
        resolved.value,
        0,
        6
      )
  };
}

/* ==========================================
   RESOLUÇÃO DAS FINALIZAÇÕES
========================================== */

function resolveShotsOnTarget(
  team:
    TeamStatsCompatibility
): ResolvedOptionalStat {
  return resolveOptionalStat([
    {
      value:
        team.shotsOnTargetPerGame,

      source:
        "shotsOnTargetPerGame"
    },

    {
      value:
        team.avgShotsOnTarget,

      source:
        "avgShotsOnTarget"
    },

    {
      value:
        team.shotsOnTarget,

      source:
        "shotsOnTarget"
    },

    {
      value:
        team.shotsOnTargetPerMatch,

      source:
        "shotsOnTargetPerMatch"
    }
  ]);
}

function resolveShots(
  team:
    TeamStatsCompatibility
): ResolvedOptionalStat {
  return resolveOptionalStat([
    {
      value:
        team.shotsPerGame,

      source:
        "shotsPerGame"
    },

    {
      value:
        team.avgShots,

      source:
        "avgShots"
    },

    {
      value:
        team.shots,

      source:
        "shots"
    },

    {
      value:
        team.shotsPerMatch,

      source:
        "shotsPerMatch"
    }
  ]);
}

function resolveBigChances(
  team:
    TeamStatsCompatibility
): ResolvedOptionalStat {
  return resolveOptionalStat([
    {
      value:
        team.bigChancesPerGame,

      source:
        "bigChancesPerGame"
    },

    {
      value:
        team.avgBigChances,

      source:
        "avgBigChances"
    },

    {
      value:
        team.bigChances,

      source:
        "bigChances"
    },

    {
      value:
        team.bigChancesPerMatch,

      source:
        "bigChancesPerMatch"
    }
  ]);
}

function calculateRecentFormFactor({
  currentGoalsRate,
  recentGoalsPerGame,
  providedFactor
}: {
  currentGoalsRate: number;
  recentGoalsPerGame: number | null;
  providedFactor: number | null;
}): number {
  if (
    providedFactor !== null &&
    providedFactor > 0
  ) {
    return clamp(
      providedFactor,
      1 - RECENT_FORM_MAX_ADJUSTMENT,
      1 + RECENT_FORM_MAX_ADJUSTMENT
    );
  }

  if (
    recentGoalsPerGame === null ||
    currentGoalsRate <= 0
  ) {
    return 1;
  }

  const rawRatio =
    recentGoalsPerGame /
    currentGoalsRate;

  const compressed =
    1 +
    (
      rawRatio -
      1
    ) *
    0.35;

  return clamp(
    compressed,
    1 - RECENT_FORM_MAX_ADJUSTMENT,
    1 + RECENT_FORM_MAX_ADJUSTMENT
  );
}

function calculateVarianceFactor(
  variance: number | null
): number {
  if (
    variance === null ||
    variance < 0
  ) {
    return 1;
  }

  const normalizedVariance =
    clamp(
      variance / 2.5,
      0,
      1
    );

  return (
    1 -
    normalizedVariance *
      VARIANCE_MAX_ADJUSTMENT
  );
}

function calculateShotQualityFactor({
  goalsRate,
  shotsOnTarget,
  shots,
  bigChances,
  providedConversionRate
}: {
  goalsRate: number;
  shotsOnTarget: number | null;
  shots: number | null;
  bigChances: number | null;
  providedConversionRate: number | null;
}): {
  factor: number;
  conversionRate: number | null;
  valid: boolean;
} {
  const conversionRate =
    providedConversionRate !== null &&
    providedConversionRate >= 0
      ? providedConversionRate
      : shots !== null &&
        shots > 0
        ? goalsRate / shots
        : shotsOnTarget !== null &&
          shotsOnTarget > 0
          ? goalsRate /
            shotsOnTarget
          : null;

  const sotQuality =
    shotsOnTarget !== null
      ? clamp(
          shotsOnTarget / 5,
          0,
          1.6
        )
      : null;

  const bigChanceQuality =
    bigChances !== null
      ? clamp(
          bigChances / 2,
          0,
          1.6
        )
      : null;

  const conversionQuality =
    conversionRate !== null
      ? clamp(
          conversionRate / 0.12,
          0,
          1.6
        )
      : null;

  const components = [
    sotQuality,
    bigChanceQuality,
    conversionQuality
  ].filter(
    (
      value
    ): value is number =>
      value !== null
  );

  if (
    components.length === 0
  ) {
    return {
      factor: 1,
      conversionRate,
      valid: false
    };
  }

  const averageQuality =
    components.reduce(
      (
        sum,
        value
      ) =>
        sum +
        value,
      0
    ) /
    components.length;

  const compressed =
    1 +
    (
      averageQuality -
      1
    ) *
    SHOT_QUALITY_MAX_ADJUSTMENT;

  return {
    factor:
      clamp(
        compressed,
        1 - SHOT_QUALITY_MAX_ADJUSTMENT,
        1 + SHOT_QUALITY_MAX_ADJUSTMENT
      ),

    conversionRate,

    valid: true
  };
}

function buildContextualAttackFactors({
  team,
  goalsRate,
  shotsOnTarget,
  shots,
  bigChances
}: {
  team: TeamStatsCompatibility;
  goalsRate: number;
  shotsOnTarget: number | null;
  shots: number | null;
  bigChances: number | null;
}): ContextualAttackFactors {
  const recentGoalsPerGame =
    parseFiniteNumber(
      team.recentGoalsPerGame
    );

  const providedRecentFormFactor =
    parseFiniteNumber(
      team.recentFormFactor
    );

  const goalVariance =
    parseFiniteNumber(
      team.goalVariance
    );

  const providedConversionRate =
    parseFiniteNumber(
      team.conversionRate
    );

  const recentFormFactor =
    calculateRecentFormFactor({
      currentGoalsRate:
        goalsRate,

      recentGoalsPerGame,

      providedFactor:
        providedRecentFormFactor
    });

  const varianceFactor =
    calculateVarianceFactor(
      goalVariance
    );

  const shotQuality =
    calculateShotQualityFactor({
      goalsRate,
      shotsOnTarget,
      shots,
      bigChances,
      providedConversionRate
    });

  return {
    recentFormFactor,
    varianceFactor,

    shotQualityFactor:
      shotQuality.factor,

    recentGoalsPerGame,
    goalVariance,
    bigChancesPerGame:
      bigChances,

    conversionRate:
      shotQuality.conversionRate,

    diagnostics: {
      recentFormAvailable:
        recentGoalsPerGame !== null ||
        providedRecentFormFactor !== null,

      varianceAvailable:
        goalVariance !== null,

      shotQualityAvailable:
        shotQuality.valid
    }
  };
}

/* ==========================================
   PROVENIÊNCIA DE MANDO
========================================== */

/*
 * Um split de mando só é considerado verdadeiro
 * quando sua origem é explicitamente específica
 * de casa ou de fora.
 *
 * Médias gerais como goalsPerGame não podem ser
 * normalizadas contra leagueBaseHome ou
 * leagueBaseAway, pois isso favoreceria
 * artificialmente um dos lados.
 */
function isTrueVenueAttackSource(
  source: StatSource
): boolean {
  return (
    source ===
      "homeGoalsScoredPerMatch" ||
    source ===
      "awayGoalsScoredPerMatch"
  );
}

function isTrueVenueDefenseSource(
  source: StatSource
): boolean {
  return (
    source ===
      "homeGoalsConcededPerMatch" ||
    source ===
      "awayGoalsConcededPerMatch"
  );
}

/* ==========================================
   SHRINKAGE
========================================== */

function calculateAdaptiveShrinkFactor(
  matchesPlayed: number,
  inputQuality: number
): number {
  const safeMatches =
    clamp(
      matchesPlayed,
      0,
      100
    );

  const safeQuality =
    clamp(
      inputQuality,
      0,
      1
    );

  const sampleComponent =
    safeMatches <= 5
      ? 1
      : safeMatches >= 30
        ? 0
        : 1 -
          (
            safeMatches - 5
          ) /
          25;

  const qualityComponent =
    1 -
    safeQuality;

  const blendedSeverity =
    clamp(
      sampleComponent * 0.70 +
      qualityComponent * 0.30,
      0,
      1
    );

  return (
    MIN_ADAPTIVE_SHRINK +
    (
      MAX_ADAPTIVE_SHRINK -
      MIN_ADAPTIVE_SHRINK
    ) *
    blendedSeverity
  );
}

function shrinkStat(
  raw: unknown,
  leagueAverage: number,
  matchesPlayed: unknown,
  inputQuality = 1
): number {
  const safeLeagueAverage =
    safePositiveNumber(
      leagueAverage,
      1.25
    );

  const safeRaw =
    clamp(
      safeNumber(
        raw,
        safeLeagueAverage
      ),
      0,
      6
    );

  const safeMatches =
    clamp(
      safeNumber(
        matchesPlayed,
        0
      ),
      0,
      100
    );

  const adaptiveShrink =
    calculateAdaptiveShrinkFactor(
      safeMatches,
      inputQuality
    );

  const denominator =
    safeMatches +
    adaptiveShrink;

  const sampleWeight =
    denominator > 0
      ? safeMatches /
        denominator
      : 0;

  return (
    safeRaw *
      sampleWeight +
    safeLeagueAverage *
      (
        1 -
        sampleWeight
      )
  );
}

/* ==========================================
   POTÊNCIA SEGURA
========================================== */

function calculateDominanceFactor(
  ownAttackStrength: number,
  opponentAttackStrength: number,
  opponentDefensiveFragility: number,
  ownDefensiveFragility: number
): number {
  const offensiveRatio =
    ownAttackStrength /
    Math.max(
      opponentAttackStrength,
      0.01
    );

  const matchupRatio =
    opponentDefensiveFragility /
    Math.max(
      ownDefensiveFragility,
      0.01
    );

  const combinedRatio =
    Math.sqrt(
      Math.max(
        offensiveRatio *
        matchupRatio,
        0.01
      )
    );

  return clamp(
    safePower(
      combinedRatio,
      DOMINANCE_ELASTICITY
    ),
    0.88,
    1.12
  );
}

function safePower(
  base: number,
  exponent: number
): number {
  if (
    !Number.isFinite(
      base
    ) ||
    !Number.isFinite(
      exponent
    ) ||
    base <= 0
  ) {
    return 1;
  }

  const result =
    Math.pow(
      base,
      exponent
    );

  return Number.isFinite(
    result
  )
    ? result
    : 1;
}

/* ==========================================
   BASES DA LIGA
========================================== */

function resolveLeagueGoalBases(
  averageGoals: number,
  averageHomeGoals: number,
  averageAwayGoals: number
) {
  const safeAverageGoals =
    clamp(
      safePositiveNumber(
        averageGoals,
        2.55
      ),
      1.20,
      5
    );

  let safeHomeGoals =
    clamp(
      safePositiveNumber(
        averageHomeGoals,
        safeAverageGoals / 2
      ),
      0.30,
      3
    );

  let safeAwayGoals =
    clamp(
      safePositiveNumber(
        averageAwayGoals,
        safeAverageGoals / 2
      ),
      0.30,
      3
    );

  const configuredTotal =
    safeHomeGoals +
    safeAwayGoals;

  /*
   * Preserva a relação casa/fora configurada,
   * garantindo que a soma corresponda à média
   * total oficial da liga.
   */
  if (
    Number.isFinite(
      configuredTotal
    ) &&
    configuredTotal > 0
  ) {
    const correctionFactor =
      safeAverageGoals /
      configuredTotal;

    safeHomeGoals *=
      correctionFactor;

    safeAwayGoals *=
      correctionFactor;
  } else {
    safeHomeGoals =
      safeAverageGoals / 2;

    safeAwayGoals =
      safeAverageGoals / 2;
  }

  return {
    leagueAverageGoals:
      safeAverageGoals,

    leagueBaseHome:
      safeHomeGoals,

    leagueBaseAway:
      safeAwayGoals
  };
}

/* ==========================================
   LIMITE SUPERIOR DO TOTAL
========================================== */

function applyUpperTotalLimit(
  lambdaHome: number,
  lambdaAway: number,
  fallbackHome: number,
  fallbackAway: number
): LimitedLambdas {
  const total =
    lambdaHome +
    lambdaAway;

  if (
    !Number.isFinite(
      total
    ) ||
    total <= 0
  ) {
    return {
      home:
        fallbackHome,

      away:
        fallbackAway
    };
  }

  if (
    total <=
    MAX_TOTAL_LAMBDA
  ) {
    return {
      home:
        lambdaHome,

      away:
        lambdaAway
    };
  }

  const reductionFactor =
    MAX_TOTAL_LAMBDA /
    total;

  return {
    home:
      lambdaHome *
      reductionFactor,

    away:
      lambdaAway *
      reductionFactor
  };
}

/* ==========================================
   QUALIDADE DOS DADOS
========================================== */

function getSourceQuality(
  source: StatSource
): number {
  switch (
    source
  ) {
    /*
     * Splits específicos e reais de mando.
     */
    case "homeGoalsScoredPerMatch":
    case "awayGoalsScoredPerMatch":
    case "homeGoalsConcededPerMatch":
    case "awayGoalsConcededPerMatch":
      return 1;

    /*
     * Médias gerais por partida.
     *
     * São dados reais, mas menos específicos
     * para o contexto casa/fora.
     */
    case "goalsPerGame":
    case "goalsForPerGame":
    case "avgGoals":
    case "goalsPerMatch":
    case "goalsConcededPerGame":
    case "goalsAgainstPerGame":
    case "avgGoalsAgainst":
    case "goalsConcededPerMatch":
      return 0.78;

    /*
     * Médias derivadas de totais.
     */
    case "goalsForDividedByMatches":
    case "goalsAgainstDividedByMatches":
      return 0.72;

    /*
     * Amostra.
     */
    case "matchesPlayed":
    case "matches":
      return 0.90;

    /*
     * Dados opcionais de finalização.
     */
    case "shotsOnTargetPerGame":
    case "avgShotsOnTarget":
    case "shotsOnTargetPerMatch":
    case "shotsOnTarget":
    case "shotsPerGame":
    case "avgShots":
    case "shotsPerMatch":
    case "shots":
    case "bigChancesPerGame":
    case "avgBigChances":
    case "bigChancesPerMatch":
    case "bigChances":
      return 0.75;

    /*
     * Contexto recente.
     */
    case "recentGoalsPerGame":
    case "recentFormFactor":
    case "goalVariance":
    case "conversionRate":
      return 0.70;

    /*
     * Ausência ou fallback.
     */
    case "leagueFallback":
    case "missing":
      return 0;

    default:
      return 0.65;
  }
}

function calculateInputQuality(
  sources:
    ResolvedStat[]
): number {
  if (
    sources.length === 0
  ) {
    return 0;
  }

  const totalQuality =
    sources.reduce(
      (
        total,
        resolved
      ) => {
        if (
          resolved
            .usedLeagueFallback
        ) {
          return total;
        }

        const sourceQuality =
          getSourceQuality(
            resolved.source
          );

        /*
         * Proteção adicional caso algum campo
         * derivado de totais tenha origem antiga
         * ou incompatível.
         */
        const adjustedQuality =
          resolved
            .derivedFromTotals
            ? Math.min(
                sourceQuality,
                0.72
              )
            : sourceQuality;

        return (
          total +
          adjustedQuality
        );
      },
      0
    );

  return clamp(
    totalQuality /
      sources.length,
    0,
    1
  );
}

function calculateSampleReliability(
  homeMatches: number,
  awayMatches: number
): number {
  const homeReliability =
    clamp(
      homeMatches /
        MIN_RELIABLE_MATCHES,
      0,
      1
    );

  const awayReliability =
    clamp(
      awayMatches /
        MIN_RELIABLE_MATCHES,
      0,
      1
    );

  return (
    homeReliability +
    awayReliability
  ) / 2;
}

function buildWarnings({
  homeMatches,
  awayMatches,
  homeGoals,
  awayGoals,
  homeConceded,
  awayConceded,
  homeShotsOnTarget,
  awayShotsOnTarget,
  leagueAverageGoals
}: {
  homeMatches:
    ResolvedStat;

  awayMatches:
    ResolvedStat;

  homeGoals:
    ResolvedStat;

  awayGoals:
    ResolvedStat;

  homeConceded:
    ResolvedStat;

  awayConceded:
    ResolvedStat;

  homeShotsOnTarget:
    ResolvedOptionalStat;

  awayShotsOnTarget:
    ResolvedOptionalStat;

  leagueAverageGoals:
    number;
}): string[] {
  const warnings:
    string[] = [];

  if (
    homeMatches.source ===
    "missing"
  ) {
    warnings.push(
      "MISSING_HOME_MATCHES"
    );
  }

  if (
    awayMatches.source ===
    "missing"
  ) {
    warnings.push(
      "MISSING_AWAY_MATCHES"
    );
  }

  if (
    homeMatches.value <
    MIN_RELIABLE_MATCHES
  ) {
    warnings.push(
      "LOW_HOME_SAMPLE"
    );
  }

  if (
    awayMatches.value <
    MIN_RELIABLE_MATCHES
  ) {
    warnings.push(
      "LOW_AWAY_SAMPLE"
    );
  }

  if (
    homeGoals.usedLeagueFallback
  ) {
    warnings.push(
      "HOME_ATTACK_USING_LEAGUE_FALLBACK"
    );
  }

  if (
    awayGoals.usedLeagueFallback
  ) {
    warnings.push(
      "AWAY_ATTACK_USING_LEAGUE_FALLBACK"
    );
  }

  if (
    homeConceded.usedLeagueFallback
  ) {
    warnings.push(
      "HOME_DEFENSE_USING_LEAGUE_FALLBACK"
    );
  }

  if (
    awayConceded.usedLeagueFallback
  ) {
    warnings.push(
      "AWAY_DEFENSE_USING_LEAGUE_FALLBACK"
    );
  }

  if (
    !homeShotsOnTarget.available
  ) {
    warnings.push(
      "MISSING_HOME_SHOTS_ON_TARGET"
    );
  }

  if (
    !awayShotsOnTarget.available
  ) {
    warnings.push(
      "MISSING_AWAY_SHOTS_ON_TARGET"
    );
  }

  /*
   * Diagnóstico importante para impedir que uma
   * configuração anormal da liga passe despercebida.
   */
  if (
    leagueAverageGoals >
    3.8
  ) {
    warnings.push(
      "SUSPICIOUS_LEAGUE_AVERAGE_GOALS"
    );
  }

  return [
    ...new Set(
      warnings
    )
  ];
}

/* ==========================================
   BUILD LAMBDA
========================================== */

export function buildLambda(
  homeInput:
    TeamStats,

  awayInput:
    TeamStats,

  leagueKey:
    string
) {
  const home =
    homeInput as
      TeamStatsCompatibility;

  const away =
    awayInput as
      TeamStatsCompatibility;

  /* ========================================
     CONFIGURAÇÃO DA LIGA
  ======================================== */

 const leagueResolution =
    resolveLeagueStrength(
      leagueKey
    );

  const league =
    leagueResolution.config;

  /*
   * Fonte oficial única de confiabilidade da liga.
   * Propagada adiante — nunca recalculada por
   * outros pipelines.
   */
  const leagueReliability: LeagueReliability =
    buildLeagueReliability(
      leagueResolution
    );

  const {
    leagueAverageGoals,
    leagueBaseHome,
    leagueBaseAway
  } =
    resolveLeagueGoalBases(
      league.averageGoals,
      league.averageHomeGoals,
      league.averageAwayGoals
    );

  /*
   * Base neutra por equipe.
   *
   * Usada sempre que a estatística recebida for
   * uma média geral e não um split real de mando.
   */
  const leagueTeamBase =
    leagueAverageGoals /
    2;

  /*
   * Ajuste complementar centralizado em
   * leagueStrength.ts.
   */
  const leagueAdjustment =
    safePositiveNumber(
      getLeagueGoalAdjustment(
        leagueKey
      ),
      1
    );

  /* ========================================
     AMOSTRA
  ======================================== */

  const homeMatchesResult =
    resolveMatchesPlayed(
      home
    );

  const awayMatchesResult =
    resolveMatchesPlayed(
      away
    );

  const homeMatchesPlayed =
    homeMatchesResult.value;

  const awayMatchesPlayed =
    awayMatchesResult.value;

  /* ========================================
     TAXAS OBSERVADAS
  ======================================== */

  const homeGoalsResult =
    resolveHomeGoalsScored(
      home,
      leagueBaseHome,
      homeMatchesPlayed
    );

  const awayGoalsResult =
    resolveAwayGoalsScored(
      away,
      leagueBaseAway,
      awayMatchesPlayed
    );

  const homeConcededResult =
    resolveHomeGoalsConceded(
      home,
      leagueBaseAway,
      homeMatchesPlayed
    );

  const awayConcededResult =
    resolveAwayGoalsConceded(
      away,
      leagueBaseHome,
      awayMatchesPlayed
    );

  const homeGoalsRate =
    homeGoalsResult.value;

  const awayGoalsRate =
    awayGoalsResult.value;

  const homeGoalsConcededRate =
    homeConcededResult.value;

  const awayGoalsConcededRate =
    awayConcededResult.value;

  /* ========================================
     FINALIZAÇÕES E XG PROXY
  ======================================== */

  const homeShotsOnTargetResult =
    resolveShotsOnTarget(
      home
    );

  const awayShotsOnTargetResult =
    resolveShotsOnTarget(
      away
    );

  const homeShotsResult =
    resolveShots(
      home
    );

  const awayShotsResult =
    resolveShots(
      away
    );

  const homeBigChancesResult =
    resolveBigChances(
      home
    );

  const awayBigChancesResult =
    resolveBigChances(
      away
    );

  /*
   * Zero em chutes totais com chutes no alvo
   * positivos é tratado como ausência de dado.
   *
   * Exemplo impossível:
   * shots = 0 e shotsOnTarget = 4.3.
   */
  const homeShotsForModel =
    homeShotsResult.value !== null &&
    homeShotsResult.value > 0
      ? homeShotsResult.value
      : homeShotsOnTargetResult.value !== null &&
        homeShotsOnTargetResult.value > 0
        ? null
        : homeShotsResult.value;

  const awayShotsForModel =
    awayShotsResult.value !== null &&
    awayShotsResult.value > 0
      ? awayShotsResult.value
      : awayShotsOnTargetResult.value !== null &&
        awayShotsOnTargetResult.value > 0
        ? null
        : awayShotsResult.value;

  const homeFalseZeroShotsDetected =
    homeShotsResult.value === 0 &&
    homeShotsOnTargetResult.value !== null &&
    homeShotsOnTargetResult.value > 0;

  const awayFalseZeroShotsDetected =
    awayShotsResult.value === 0 &&
    awayShotsOnTargetResult.value !== null &&
    awayShotsOnTargetResult.value > 0;

  const homeXGResult =
    calculateXGProxyDetailed(
      homeShotsOnTargetResult
        .value,

      homeShotsForModel
    );

  const awayXGResult =
    calculateXGProxyDetailed(
      awayShotsOnTargetResult
        .value,

      awayShotsForModel
    );

  const homeXG =
    homeXGResult.xg;

  const awayXG =
    awayXGResult.xg;

  const homeContextualFactors =
    buildContextualAttackFactors({
      team:
        home,

      goalsRate:
        homeGoalsRate,

      shotsOnTarget:
        homeShotsOnTargetResult
          .value,

      shots:
        homeShotsForModel,

      bigChances:
        homeBigChancesResult
          .value
    });

  const awayContextualFactors =
    buildContextualAttackFactors({
      team:
        away,

      goalsRate:
        awayGoalsRate,

      shotsOnTarget:
        awayShotsOnTargetResult
          .value,

      shots:
        awayShotsForModel,

      bigChances:
        awayBigChancesResult
          .value
    });

  /* ========================================
     COMPOSIÇÃO OFENSIVA
  ======================================== */

  const homeShotQualityProxy =
    homeGoalsRate *
    homeContextualFactors
      .shotQualityFactor;

  const awayShotQualityProxy =
    awayGoalsRate *
    awayContextualFactors
      .shotQualityFactor;

  const homeAttackBaseComposite =
    homeXGResult.valid &&
    homeXG !== null
      ? (
          homeGoalsRate *
            GOALS_WEIGHT +
          homeXG *
            XG_PROXY_WEIGHT +
          homeShotQualityProxy *
            SHOT_QUALITY_WEIGHT
        )
      : (
          homeGoalsRate *
            (
              GOALS_WEIGHT +
              XG_PROXY_WEIGHT
            ) +
          homeShotQualityProxy *
            SHOT_QUALITY_WEIGHT
        );

  const awayAttackBaseComposite =
    awayXGResult.valid &&
    awayXG !== null
      ? (
          awayGoalsRate *
            GOALS_WEIGHT +
          awayXG *
            XG_PROXY_WEIGHT +
          awayShotQualityProxy *
            SHOT_QUALITY_WEIGHT
        )
      : (
          awayGoalsRate *
            (
              GOALS_WEIGHT +
              XG_PROXY_WEIGHT
            ) +
          awayShotQualityProxy *
            SHOT_QUALITY_WEIGHT
        );

  const homeAttackComposite =
    homeAttackBaseComposite *
    homeContextualFactors
      .recentFormFactor *
    homeContextualFactors
      .varianceFactor;

  const awayAttackComposite =
    awayAttackBaseComposite *
    awayContextualFactors
      .recentFormFactor *
    awayContextualFactors
      .varianceFactor;

  const preliminaryInputQuality =
    calculateInputQuality([
      homeGoalsResult,
      awayGoalsResult,
      homeConcededResult,
      awayConcededResult
    ]);

  /* ========================================
     REFERÊNCIAS ESTATÍSTICAS V7.2
  ======================================== */

  /*
   * Splits reais usam bases específicas de mando.
   *
   * Médias gerais usam a base neutra por equipe.
   * Isso impede que goalsPerGame do visitante seja
   * dividido por uma base visitante artificialmente
   * menor, criando força ofensiva falsa.
   */
  const homeAttackReference =
    isTrueVenueAttackSource(
      homeGoalsResult.source
    )
      ? leagueBaseHome
      : leagueTeamBase;

  const awayAttackReference =
    isTrueVenueAttackSource(
      awayGoalsResult.source
    )
      ? leagueBaseAway
      : leagueTeamBase;

  const homeDefenseReference =
    isTrueVenueDefenseSource(
      homeConcededResult.source
    )
      ? leagueBaseAway
      : leagueTeamBase;

  const awayDefenseReference =
    isTrueVenueDefenseSource(
      awayConcededResult.source
    )
      ? leagueBaseHome
      : leagueTeamBase;

  /* ========================================
     SHRINKAGE DO ATAQUE
  ======================================== */

  const homeAttackRaw =
    shrinkStat(
      homeAttackComposite,
      homeAttackReference,
      homeMatchesPlayed,
      preliminaryInputQuality
    );

  const awayAttackRaw =
    shrinkStat(
      awayAttackComposite,
      awayAttackReference,
      awayMatchesPlayed,
      preliminaryInputQuality
    );

  /* ========================================
     SHRINKAGE DA DEFESA
  ======================================== */

  const homeDefenseRaw =
    shrinkStat(
      homeGoalsConcededRate,
      homeDefenseReference,
      homeMatchesPlayed,
      preliminaryInputQuality
    );

  const awayDefenseRaw =
    shrinkStat(
      awayGoalsConcededRate,
      awayDefenseReference,
      awayMatchesPlayed,
      preliminaryInputQuality
    );

  /* ========================================
     FORÇAS RELATIVAS
  ======================================== */

  const homeAttackStrength =
    safePower(
      homeAttackRaw /
        homeAttackReference,
      ATTACK_ELASTICITY
    );

  const awayAttackStrength =
    safePower(
      awayAttackRaw /
        awayAttackReference,
      ATTACK_ELASTICITY
    );

  const homeDefensiveFragility =
    safePower(
      homeDefenseRaw /
        homeDefenseReference,
      DEFENSE_ELASTICITY
    );

  const awayDefensiveFragility =
    safePower(
      awayDefenseRaw /
        awayDefenseReference,
      DEFENSE_ELASTICITY
    );

  const homeDominanceFactor =
    calculateDominanceFactor(
      homeAttackStrength,
      awayAttackStrength,
      awayDefensiveFragility,
      homeDefensiveFragility
    );

  const awayDominanceFactor =
    calculateDominanceFactor(
      awayAttackStrength,
      homeAttackStrength,
      homeDefensiveFragility,
      awayDefensiveFragility
    );

  /* ========================================
     LAMBDAS ESTRUTURAIS
  ======================================== */

  let lambdaHome =
    leagueBaseHome *
    homeAttackStrength *
    awayDefensiveFragility *
    homeDominanceFactor;

  let lambdaAway =
    leagueBaseAway *
    awayAttackStrength *
    homeDefensiveFragility *
    awayDominanceFactor;

  /* ========================================
     AJUSTE COMPLEMENTAR DA LIGA
  ======================================== */

  lambdaHome *=
    leagueAdjustment;

  lambdaAway *=
    leagueAdjustment;

  /* ========================================
     PROTEÇÕES INDIVIDUAIS
  ======================================== */

  lambdaHome =
    clamp(
      safeNumber(
        lambdaHome,
        leagueBaseHome
      ),
      MIN_LAMBDA,
      MAX_LAMBDA
    );

  lambdaAway =
    clamp(
      safeNumber(
        lambdaAway,
        leagueBaseAway
      ),
      MIN_LAMBDA,
      MAX_LAMBDA
    );

  /* ========================================
     PROTEÇÃO DO TOTAL
  ======================================== */

  const limited =
    applyUpperTotalLimit(
      lambdaHome,
      lambdaAway,
      leagueBaseHome,
      leagueBaseAway
    );

  lambdaHome =
    clamp(
      safeNumber(
        limited.home,
        leagueBaseHome
      ),
      MIN_LAMBDA,
      MAX_LAMBDA
    );

  lambdaAway =
    clamp(
      safeNumber(
        limited.away,
        leagueBaseAway
      ),
      MIN_LAMBDA,
      MAX_LAMBDA
    );

  const totalLambda =
    lambdaHome +
    lambdaAway;

  /* ========================================
     QUALIDADE E WARNINGS
  ======================================== */

  const inputQuality =
    preliminaryInputQuality;

  const sampleReliability =
    calculateSampleReliability(
      homeMatchesPlayed,
      awayMatchesPlayed
    );

  const warnings =
    [
      ...buildWarnings({
        homeMatches:
          homeMatchesResult,

        awayMatches:
          awayMatchesResult,

        homeGoals:
          homeGoalsResult,

        awayGoals:
          awayGoalsResult,

        homeConceded:
          homeConcededResult,

        awayConceded:
          awayConcededResult,

        homeShotsOnTarget:
          homeShotsOnTargetResult,

        awayShotsOnTarget:
          awayShotsOnTargetResult,

        leagueAverageGoals
      }),

      ...(
        homeFalseZeroShotsDetected
          ? [
              "HOME_SHOTS_ZERO_TREATED_AS_MISSING"
            ]
          : []
      ),

      ...(
        awayFalseZeroShotsDetected
          ? [
              "AWAY_SHOTS_ZERO_TREATED_AS_MISSING"
            ]
          : []
      )
    ];

  const usedLeagueFallback =
    homeGoalsResult
      .usedLeagueFallback ||
    awayGoalsResult
      .usedLeagueFallback ||
    homeConcededResult
      .usedLeagueFallback ||
    awayConcededResult
      .usedLeagueFallback;

  /* ========================================
     LOG DE AUDITORIA
  ======================================== */

  console.group(
    "⚽ LAMBDA BUILDER — AUDIT"
  );

console.log(
    "LEAGUE BASES:",
    {
      leagueKey,
      leagueAverageGoals,
      leagueBaseHome,
      leagueBaseAway,
      leagueTeamBase,
      leagueAdjustment
    }
  );

  console.log(
    "LEAGUE RELIABILITY:",
    {
      requested:
        leagueReliability.requestedKey,

      resolved:
        leagueReliability.key,

      resolution:
        leagueReliability.resolution,

      dataReliability:
        leagueReliability.dataReliability,

      usedDefault:
        leagueReliability.usedDefault,

      found:
        leagueReliability.found
    }
  );

  console.log(
    "HOME INPUT RESOLUTION:",
    {
      matches:
        homeMatchesResult,

      goals:
        homeGoalsResult,

      conceded:
        homeConcededResult,

      shotsOnTarget:
        homeShotsOnTargetResult,

      shots:
        homeShotsResult,

      bigChances:
        homeBigChancesResult,

      contextualFactors:
        homeContextualFactors
    }
  );

  console.log(
    "AWAY INPUT RESOLUTION:",
    {
      matches:
        awayMatchesResult,

      goals:
        awayGoalsResult,

      conceded:
        awayConcededResult,

      shotsOnTarget:
        awayShotsOnTargetResult,

      shots:
        awayShotsResult,

      bigChances:
        awayBigChancesResult,

      contextualFactors:
        awayContextualFactors
    }
  );

  console.log(
    "FINAL LAMBDAS:",
    {
      lambdaHome,
      lambdaAway,
      totalLambda,

      homeDominanceFactor,
      awayDominanceFactor
    }
  );

  console.log(
    "INPUT QUALITY:",
    {
      inputQuality,
      sampleReliability,
      usedLeagueFallback,
      warnings
    }
  );

  console.groupEnd();

  /* ========================================
     RESULTADO
  ======================================== */

return {
    lambdaHome:
      roundNumber(
        lambdaHome
      ),

    lambdaAway:
      roundNumber(
        lambdaAway
      ),

    totalLambda:
      roundNumber(
        totalLambda
      ),

    /*
     * Contrato oficial único de confiabilidade
     * de liga. Consumido por ConfidencePipeline
     * e DecisionPipeline sem reconsulta.
     *
     * Não duplicado dentro de `diagnostics` —
     * já está disponível aqui no objeto principal.
     */
    leagueReliability,

    diagnostics: {
      leagueKey,

      leagueName:
        league.name,

      leagueAverageGoals:
        roundNumber(
          leagueAverageGoals
        ),

      leagueBaseHome:
        roundNumber(
          leagueBaseHome
        ),

      leagueBaseAway:
        roundNumber(
          leagueBaseAway
        ),

      leagueTeamBase:
        roundNumber(
          leagueTeamBase
        ),

      leagueAdjustment:
        roundNumber(
          leagueAdjustment
        ),

      /*
       * Qualidade geral da entrada.
       */
      inputQuality:
        roundNumber(
          inputQuality
        ),

      sampleReliability:
        roundNumber(
          sampleReliability
        ),

      usedLeagueFallback,

      warnings,

      /*
       * Amostra.
       */
      homeMatchesPlayed:
        roundNumber(
          homeMatchesPlayed
        ),

      awayMatchesPlayed:
        roundNumber(
          awayMatchesPlayed
        ),

      homeMatchesSource:
        homeMatchesResult.source,

      awayMatchesSource:
        awayMatchesResult.source,

      /*
       * Taxas observadas e suas origens.
       */
      homeGoalsRate:
        roundNumber(
          homeGoalsRate
        ),

      homeGoalsRateSource:
        homeGoalsResult.source,

      awayGoalsRate:
        roundNumber(
          awayGoalsRate
        ),

      awayGoalsRateSource:
        awayGoalsResult.source,

      homeGoalsConcededRate:
        roundNumber(
          homeGoalsConcededRate
        ),

      homeGoalsConcededRateSource:
        homeConcededResult.source,

      awayGoalsConcededRate:
        roundNumber(
          awayGoalsConcededRate
        ),

      awayGoalsConcededRateSource:
        awayConcededResult.source,

      /*
       * Indica se a média foi derivada de totais.
       */
      homeGoalsDerivedFromTotals:
        homeGoalsResult
          .derivedFromTotals,

      awayGoalsDerivedFromTotals:
        awayGoalsResult
          .derivedFromTotals,

      homeConcededDerivedFromTotals:
        homeConcededResult
          .derivedFromTotals,

      awayConcededDerivedFromTotals:
        awayConcededResult
          .derivedFromTotals,

      /*
       * Finalizações.
       */
      homeShotsOnTarget:
        homeShotsOnTargetResult
          .value,

      homeShotsOnTargetSource:
        homeShotsOnTargetResult
          .source,

      awayShotsOnTarget:
        awayShotsOnTargetResult
          .value,

      awayShotsOnTargetSource:
        awayShotsOnTargetResult
          .source,

      homeShots:
        homeShotsResult.value,

      homeShotsSource:
        homeShotsResult.source,

      awayShots:
        awayShotsResult.value,

      awayShotsSource:
        awayShotsResult.source,

      homeBigChances:
        homeBigChancesResult
          .value,

      homeBigChancesSource:
        homeBigChancesResult
          .source,

      awayBigChances:
        awayBigChancesResult
          .value,

      awayBigChancesSource:
        awayBigChancesResult
          .source,

      /*
       * xG proxy.
       */
      homeXG:
        homeXG === null
          ? null
          : roundNumber(
              homeXG
            ),

      awayXG:
        awayXG === null
          ? null
          : roundNumber(
              awayXG
            ),

      homeXGValid:
        homeXGResult.valid,

      awayXGValid:
        awayXGResult.valid,

      homeXGDiagnostics:
        homeXGResult.diagnostics,

      awayXGDiagnostics:
        awayXGResult.diagnostics,

      /*
       * Construção ofensiva e defensiva.
       */
      homeAttackComposite:
        roundNumber(
          homeAttackComposite
        ),

      awayAttackComposite:
        roundNumber(
          awayAttackComposite
        ),

      homeAttackBaseComposite:
        roundNumber(
          homeAttackBaseComposite
        ),

      awayAttackBaseComposite:
        roundNumber(
          awayAttackBaseComposite
        ),

      homeRecentFormFactor:
        roundNumber(
          homeContextualFactors
            .recentFormFactor
        ),

      awayRecentFormFactor:
        roundNumber(
          awayContextualFactors
            .recentFormFactor
        ),

      homeVarianceFactor:
        roundNumber(
          homeContextualFactors
            .varianceFactor
        ),

      awayVarianceFactor:
        roundNumber(
          awayContextualFactors
            .varianceFactor
        ),

      homeShotQualityFactor:
        roundNumber(
          homeContextualFactors
            .shotQualityFactor
        ),

      awayShotQualityFactor:
        roundNumber(
          awayContextualFactors
            .shotQualityFactor
        ),

      homeRecentGoalsPerGame:
        homeContextualFactors
          .recentGoalsPerGame,

      awayRecentGoalsPerGame:
        awayContextualFactors
          .recentGoalsPerGame,

      homeGoalVariance:
        homeContextualFactors
          .goalVariance,

      awayGoalVariance:
        awayContextualFactors
          .goalVariance,

      homeConversionRate:
        homeContextualFactors
          .conversionRate,

      awayConversionRate:
        awayContextualFactors
          .conversionRate,

      homeAttackReference:
        roundNumber(
          homeAttackReference
        ),

      awayAttackReference:
        roundNumber(
          awayAttackReference
        ),

      homeDefenseReference:
        roundNumber(
          homeDefenseReference
        ),

      awayDefenseReference:
        roundNumber(
          awayDefenseReference
        ),

      homeAttackUsesTrueVenueSplit:
        isTrueVenueAttackSource(
          homeGoalsResult.source
        ),

      awayAttackUsesTrueVenueSplit:
        isTrueVenueAttackSource(
          awayGoalsResult.source
        ),

      homeDefenseUsesTrueVenueSplit:
        isTrueVenueDefenseSource(
          homeConcededResult.source
        ),

      awayDefenseUsesTrueVenueSplit:
        isTrueVenueDefenseSource(
          awayConcededResult.source
        ),

      homeFalseZeroShotsDetected,

      awayFalseZeroShotsDetected,

      homeShotsUsedByModel:
        homeShotsForModel,

      awayShotsUsedByModel:
        awayShotsForModel,

      homeAttackRaw:
        roundNumber(
          homeAttackRaw
        ),

      awayAttackRaw:
        roundNumber(
          awayAttackRaw
        ),

      homeDefenseRaw:
        roundNumber(
          homeDefenseRaw
        ),

      awayDefenseRaw:
        roundNumber(
          awayDefenseRaw
        ),

      homeAttackStrength:
        roundNumber(
          homeAttackStrength
        ),

      awayAttackStrength:
        roundNumber(
          awayAttackStrength
        ),

      homeDefensiveFragility:
        roundNumber(
          homeDefensiveFragility
        ),

      awayDefensiveFragility:
        roundNumber(
          awayDefensiveFragility
        ),

      homeDominanceFactor:
        roundNumber(
          homeDominanceFactor
        ),

      awayDominanceFactor:
        roundNumber(
          awayDominanceFactor
        ),

      homeAdaptiveShrinkFactor:
        roundNumber(
          calculateAdaptiveShrinkFactor(
            homeMatchesPlayed,
            inputQuality
          )
        ),

      awayAdaptiveShrinkFactor:
        roundNumber(
          calculateAdaptiveShrinkFactor(
            awayMatchesPlayed,
            inputQuality
          )
        ),

      /*
       * Configuração matemática.
       */
      attackElasticity:
        ATTACK_ELASTICITY,

      defenseElasticity:
        DEFENSE_ELASTICITY,

      /*
       * Campo legado mantido para compatibilidade.
       * O shrink efetivo é adaptativo.
       */
      shrinkFactor:
        SHRINK_FACTOR,

      shrinkMode:
        "ADAPTIVE_V7_2",

      goalsWeight:
        GOALS_WEIGHT,

      xgProxyWeight:
        XG_PROXY_WEIGHT,

      shotQualityWeight:
        SHOT_QUALITY_WEIGHT,

      dominanceElasticity:
        DOMINANCE_ELASTICITY,

      recentFormMaxAdjustment:
        RECENT_FORM_MAX_ADJUSTMENT,

      varianceMaxAdjustment:
        VARIANCE_MAX_ADJUSTMENT,

      shotQualityMaxAdjustment:
        SHOT_QUALITY_MAX_ADJUSTMENT,

      minAdaptiveShrink:
        MIN_ADAPTIVE_SHRINK,

      maxAdaptiveShrink:
        MAX_ADAPTIVE_SHRINK,

      minLambda:
        MIN_LAMBDA,

      maxLambda:
        MAX_LAMBDA,

      maxTotalLambda:
        MAX_TOTAL_LAMBDA
    }
  };
}