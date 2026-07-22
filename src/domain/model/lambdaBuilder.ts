import type {
  TeamStats
} from "../types/TeamStats";

import {
  getLeagueGoalAdjustment,
  getLeagueStrength
} from "../rating/leagueStrength";

import {
  calculateXGProxyDetailed
} from "../math/xgProxy";

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
  0.70;

const XG_PROXY_WEIGHT =
  0.30;

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

/* ==========================================
   SHRINKAGE
========================================== */

function shrinkStat(
  raw: unknown,
  leagueAverage: number,
  matchesPlayed: unknown
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

  const denominator =
    safeMatches +
    SHRINK_FACTOR;

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

function calculateInputQuality(
  sources:
    ResolvedStat[]
): number {
  if (
    sources.length === 0
  ) {
    return 0;
  }

  let score =
    0;

  for (
    const resolved of sources
  ) {
    if (
      resolved.usedLeagueFallback
    ) {
      score +=
        0;
    } else if (
      resolved.derivedFromTotals
    ) {
      score +=
        0.8;
    } else {
      score +=
        1;
    }
  }

  return clamp(
    score /
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

  const league =
    getLeagueStrength(
      leagueKey
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

  const homeXGResult =
    calculateXGProxyDetailed(
      homeShotsOnTargetResult
        .value,

      homeShotsResult
        .value
    );

  const awayXGResult =
    calculateXGProxyDetailed(
      awayShotsOnTargetResult
        .value,

      awayShotsResult
        .value
    );

  const homeXG =
    homeXGResult.xg;

  const awayXG =
    awayXGResult.xg;

  /* ========================================
     COMPOSIÇÃO OFENSIVA
  ======================================== */

  const homeAttackComposite =
    homeXGResult.valid &&
    homeXG !== null
      ? (
          homeGoalsRate *
            GOALS_WEIGHT +
          homeXG *
            XG_PROXY_WEIGHT
        )
      : homeGoalsRate;

  const awayAttackComposite =
    awayXGResult.valid &&
    awayXG !== null
      ? (
          awayGoalsRate *
            GOALS_WEIGHT +
          awayXG *
            XG_PROXY_WEIGHT
        )
      : awayGoalsRate;

  /* ========================================
     SHRINKAGE DO ATAQUE
  ======================================== */

  const homeAttackRaw =
    shrinkStat(
      homeAttackComposite,
      leagueBaseHome,
      homeMatchesPlayed
    );

  const awayAttackRaw =
    shrinkStat(
      awayAttackComposite,
      leagueBaseAway,
      awayMatchesPlayed
    );

  /* ========================================
     SHRINKAGE DA DEFESA
  ======================================== */

  const homeDefenseRaw =
    shrinkStat(
      homeGoalsConcededRate,
      leagueBaseAway,
      homeMatchesPlayed
    );

  const awayDefenseRaw =
    shrinkStat(
      awayGoalsConcededRate,
      leagueBaseHome,
      awayMatchesPlayed
    );

  /* ========================================
     FORÇAS RELATIVAS
  ======================================== */

  const homeAttackStrength =
    safePower(
      homeAttackRaw /
        leagueBaseHome,
      ATTACK_ELASTICITY
    );

  const awayAttackStrength =
    safePower(
      awayAttackRaw /
        leagueBaseAway,
      ATTACK_ELASTICITY
    );

  const homeDefensiveFragility =
    safePower(
      homeDefenseRaw /
        leagueBaseAway,
      DEFENSE_ELASTICITY
    );

  const awayDefensiveFragility =
    safePower(
      awayDefenseRaw /
        leagueBaseHome,
      DEFENSE_ELASTICITY
    );

  /* ========================================
     LAMBDAS ESTRUTURAIS
  ======================================== */

  let lambdaHome =
    leagueBaseHome *
    homeAttackStrength *
    awayDefensiveFragility;

  let lambdaAway =
    leagueBaseAway *
    awayAttackStrength *
    homeDefensiveFragility;

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
    calculateInputQuality([
      homeGoalsResult,
      awayGoalsResult,
      homeConcededResult,
      awayConcededResult
    ]);

  const sampleReliability =
    calculateSampleReliability(
      homeMatchesPlayed,
      awayMatchesPlayed
    );

  const warnings =
    buildWarnings({
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
    });

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
      leagueAdjustment
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
        homeShotsResult
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
        awayShotsResult
    }
  );

  console.log(
    "FINAL LAMBDAS:",
    {
      lambdaHome,
      lambdaAway,
      totalLambda
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

      /*
       * Configuração matemática.
       */
      attackElasticity:
        ATTACK_ELASTICITY,

      defenseElasticity:
        DEFENSE_ELASTICITY,

      shrinkFactor:
        SHRINK_FACTOR,

      goalsWeight:
        GOALS_WEIGHT,

      xgProxyWeight:
        XG_PROXY_WEIGHT,

      minLambda:
        MIN_LAMBDA,

      maxLambda:
        MAX_LAMBDA,

      maxTotalLambda:
        MAX_TOTAL_LAMBDA
    }
  };
}