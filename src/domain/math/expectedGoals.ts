/* ==========================================
   EXPECTED GOALS BASELINE — QUANTIFY V7
========================================== */

/*
 * Responsabilidade:
 *
 * - produzir uma estimativa auxiliar simples;
 * - comparar ataque da equipe com defesa adversária;
 * - servir como diagnóstico independente;
 * - detectar divergência em relação ao lambda oficial.
 *
 * Este arquivo NÃO:
 *
 * - produz o lambda oficial;
 * - aplica shrinkage;
 * - aplica ajuste da liga;
 * - aplica vantagem de casa;
 * - utiliza xG Proxy;
 * - calcula probabilidades;
 * - calcula EV;
 * - toma decisões.
 *
 * A fonte oficial das lambdas é:
 *
 * buildLambda()
 * em lambdaBuilder.ts.
 */

/* ==========================================
   CONTRATOS
========================================== */

export interface TeamStats {
  matchesPlayed?: number;
  matches?: number;

  goalsFor?: number;
  goalsAgainst?: number;

  goalsPerGame?: number;
  goalsForPerGame?: number;
  avgGoals?: number;
  goalsPerMatch?: number;

  goalsConcededPerGame?: number;
  goalsAgainstPerGame?: number;
  avgGoalsAgainst?: number;
  goalsConcededPerMatch?: number;

  homeGoalsScoredPerMatch?: number;
  homeGoalsConcededPerMatch?: number;

  awayGoalsScoredPerMatch?: number;
  awayGoalsConcededPerMatch?: number;
}

export interface ExpectedGoalsConfig {
  /*
   * Média por equipe, não média total da partida.
   *
   * Exemplo:
   *
   * liga com 2.55 gols por partida
   * ≈ 1.275 por equipe.
   */
  leagueAverageGoalsPerTeam?: number;

  minLambda?: number;
  maxLambda?: number;
}

type RateSource =
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

  | "leagueFallback";

interface ResolvedRate {
  value: number;
  source: RateSource;

  usedFallback: boolean;
  derivedFromTotals: boolean;
}

export interface ExpectedGoalsResult {
  lambdaHome: number;
  lambdaAway: number;
  totalLambda: number;

  /*
   * Validade numérica da operação.
   */
  valid: boolean;

  /*
   * Indica se ao menos parte relevante dos dados
   * veio das equipes.
   */
  dataValid: boolean;

  diagnostics: {
    homeAttackObserved: number | null;
    awayAttackObserved: number | null;

    homeDefensiveObserved: number | null;
    awayDefensiveObserved: number | null;

    homeAttackRateUsed: number;
    awayAttackRateUsed: number;

    homeDefensiveRateUsed: number;
    awayDefensiveRateUsed: number;

    homeAttackSource: RateSource;
    awayAttackSource: RateSource;

    homeDefensiveSource: RateSource;
    awayDefensiveSource: RateSource;

    homeRawLambda: number;
    awayRawLambda: number;

    inputQuality: number;
    usedOnlyFallbacks: boolean;

    usedFallbacks: string[];
    warnings: string[];

    note:
      "Diagnostic baseline only. Official lambdas must come from buildLambda().";
  };
}

/* ==========================================
   FUNÇÃO PRINCIPAL
========================================== */

export function calculateExpectedGoals(
  home: TeamStats,

  away: TeamStats,

  config: ExpectedGoalsConfig = {}
): ExpectedGoalsResult {
  const usedFallbacks:
    string[] = [];

  const warnings:
    string[] = [];

  const leagueAverageGoalsPerTeam =
    clamp(
      parsePositiveNumber(
        config
          .leagueAverageGoalsPerTeam
      ) ?? 1.275,

      0.60,

      2.50
    );

  const minLambda =
    clamp(
      parsePositiveNumber(
        config.minLambda
      ) ?? 0.20,

      0.05,

      1
    );

  const maxLambda =
    clamp(
      parsePositiveNumber(
        config.maxLambda
      ) ?? 3.50,

      1.50,

      6
    );

  const homeMatches =
    resolveMatches(
      home
    );

  const awayMatches =
    resolveMatches(
      away
    );

  const homeAttack =
    resolveHomeAttackRate(
      home,
      homeMatches,
      leagueAverageGoalsPerTeam
    );

  const awayAttack =
    resolveAwayAttackRate(
      away,
      awayMatches,
      leagueAverageGoalsPerTeam
    );

  const homeDefense =
    resolveHomeDefensiveRate(
      home,
      homeMatches,
      leagueAverageGoalsPerTeam
    );

  const awayDefense =
    resolveAwayDefensiveRate(
      away,
      awayMatches,
      leagueAverageGoalsPerTeam
    );

  registerFallback(
    homeAttack,
    "HOME_ATTACK_FALLBACK",
    usedFallbacks
  );

  registerFallback(
    awayAttack,
    "AWAY_ATTACK_FALLBACK",
    usedFallbacks
  );

  registerFallback(
    homeDefense,
    "HOME_DEFENSE_FALLBACK",
    usedFallbacks
  );

  registerFallback(
    awayDefense,
    "AWAY_DEFENSE_FALLBACK",
    usedFallbacks
  );

  /*
   * Baseline diagnóstica:
   *
   * ataque da equipe
   * ×
   * fragilidade defensiva adversária.
   *
   * A média geométrica reduz a dominância
   * de um único valor extremo.
   */
  const homeRawLambda =
    geometricMean(
      homeAttack.value,
      awayDefense.value
    );

  const awayRawLambda =
    geometricMean(
      awayAttack.value,
      homeDefense.value
    );

  const lambdaHome =
    clamp(
      homeRawLambda,
      minLambda,
      maxLambda
    );

  const lambdaAway =
    clamp(
      awayRawLambda,
      minLambda,
      maxLambda
    );

  const totalLambda =
    lambdaHome +
    lambdaAway;

  const numericValid =
    Number.isFinite(
      lambdaHome
    ) &&
    Number.isFinite(
      lambdaAway
    ) &&
    lambdaHome > 0 &&
    lambdaAway > 0;

  const resolvedRates = [
    homeAttack,
    awayAttack,
    homeDefense,
    awayDefense
  ];

  const realDataCount =
    resolvedRates.filter(
      rate =>
        !rate.usedFallback
    ).length;

  const inputQuality =
    realDataCount /
    resolvedRates.length;

  const usedOnlyFallbacks =
    realDataCount === 0;

  const dataValid =
    realDataCount > 0;

  if (
    usedOnlyFallbacks
  ) {
    warnings.push(
      "EXPECTED_GOALS_USING_ONLY_LEAGUE_FALLBACKS"
    );
  }

  if (
    inputQuality < 0.5
  ) {
    warnings.push(
      "LOW_EXPECTED_GOALS_INPUT_QUALITY"
    );
  }

  if (
    homeMatches <= 0
  ) {
    warnings.push(
      "MISSING_HOME_MATCH_SAMPLE"
    );
  }

  if (
    awayMatches <= 0
  ) {
    warnings.push(
      "MISSING_AWAY_MATCH_SAMPLE"
    );
  }

  console.group(
    "📐 EXPECTED GOALS — DIAGNOSTIC"
  );

  console.log(
    "HOME RESOLUTION:",
    {
      matches:
        homeMatches,

      attack:
        homeAttack,

      defense:
        homeDefense
    }
  );

  console.log(
    "AWAY RESOLUTION:",
    {
      matches:
        awayMatches,

      attack:
        awayAttack,

      defense:
        awayDefense
    }
  );

  console.log(
    "EXPECTED GOALS RESULT:",
    {
      lambdaHome,
      lambdaAway,
      totalLambda,
      inputQuality,
      usedOnlyFallbacks
    }
  );

  console.groupEnd();

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

    valid:
      numericValid,

    dataValid,

    diagnostics: {
      homeAttackObserved:
        extractObservedRate(
          homeAttack
        ),

      awayAttackObserved:
        extractObservedRate(
          awayAttack
        ),

      homeDefensiveObserved:
        extractObservedRate(
          homeDefense
        ),

      awayDefensiveObserved:
        extractObservedRate(
          awayDefense
        ),

      homeAttackRateUsed:
        roundNumber(
          homeAttack.value
        ),

      awayAttackRateUsed:
        roundNumber(
          awayAttack.value
        ),

      homeDefensiveRateUsed:
        roundNumber(
          homeDefense.value
        ),

      awayDefensiveRateUsed:
        roundNumber(
          awayDefense.value
        ),

      homeAttackSource:
        homeAttack.source,

      awayAttackSource:
        awayAttack.source,

      homeDefensiveSource:
        homeDefense.source,

      awayDefensiveSource:
        awayDefense.source,

      homeRawLambda:
        roundNumber(
          homeRawLambda
        ),

      awayRawLambda:
        roundNumber(
          awayRawLambda
        ),

      inputQuality:
        roundNumber(
          inputQuality
        ),

      usedOnlyFallbacks,

      usedFallbacks:
        normalizeStrings(
          usedFallbacks
        ),

      warnings:
        normalizeStrings(
          warnings
        ),

      note:
        "Diagnostic baseline only. Official lambdas must come from buildLambda()."
    }
  };
}

/* ==========================================
   RESOLUÇÃO DA AMOSTRA
========================================== */

function resolveMatches(
  team: TeamStats
): number {
  const matchesPlayed =
    parseNonNegativeNumber(
      team.matchesPlayed
    );

  if (
    matchesPlayed !== null
  ) {
    return matchesPlayed;
  }

  const matches =
    parseNonNegativeNumber(
      team.matches
    );

  return matches ?? 0;
}

/* ==========================================
   RESOLUÇÃO DO ATAQUE
========================================== */

function resolveHomeAttackRate(
  team: TeamStats,
  matches: number,
  fallback: number
): ResolvedRate {
  return resolveRate(
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
          deriveRate(
            team.goalsFor,
            matches
          ),

        source:
          "goalsForDividedByMatches"
      }
    ],

    fallback
  );
}

function resolveAwayAttackRate(
  team: TeamStats,
  matches: number,
  fallback: number
): ResolvedRate {
  return resolveRate(
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
          deriveRate(
            team.goalsFor,
            matches
          ),

        source:
          "goalsForDividedByMatches"
      }
    ],

    fallback
  );
}

/* ==========================================
   RESOLUÇÃO DA DEFESA
========================================== */

function resolveHomeDefensiveRate(
  team: TeamStats,
  matches: number,
  fallback: number
): ResolvedRate {
  return resolveRate(
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
          deriveRate(
            team.goalsAgainst,
            matches
          ),

        source:
          "goalsAgainstDividedByMatches"
      }
    ],

    fallback
  );
}

function resolveAwayDefensiveRate(
  team: TeamStats,
  matches: number,
  fallback: number
): ResolvedRate {
  return resolveRate(
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
          deriveRate(
            team.goalsAgainst,
            matches
          ),

        source:
          "goalsAgainstDividedByMatches"
      }
    ],

    fallback
  );
}

/* ==========================================
   RESOLVEDOR GENÉRICO
========================================== */

function resolveRate(
  candidates: Array<{
    value: unknown;
    source: RateSource;
  }>,

  fallback: number
): ResolvedRate {
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
            6
          ),

        source:
          candidate.source,

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
      "leagueFallback",

    usedFallback:
      true,

    derivedFromTotals:
      false
  };
}

/* ==========================================
   MÉDIA DERIVADA DE TOTAIS
========================================== */

function deriveRate(
  total:
    unknown,

  matches:
    number
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
   REGISTRO DE FALLBACK
========================================== */

function registerFallback(
  rate:
    ResolvedRate,

  warning:
    string,

  usedFallbacks:
    string[]
): void {
  if (
    rate.usedFallback
  ) {
    usedFallbacks.push(
      warning
    );
  }
}

function extractObservedRate(
  rate:
    ResolvedRate
): number | null {
  return rate.usedFallback
    ? null
    : roundNumber(
        rate.value
      );
}

/* ==========================================
   MÉDIA GEOMÉTRICA
========================================== */

function geometricMean(
  first: number,
  second: number
): number {
  if (
    !Number.isFinite(
      first
    ) ||
    !Number.isFinite(
      second
    ) ||
    first < 0 ||
    second < 0
  ) {
    return 0;
  }

  return Math.sqrt(
    first *
    second
  );
}

/* ==========================================
   PARSERS
========================================== */

function parseNonNegativeNumber(
  value: unknown
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value ===
      "boolean"
  ) {
    return null;
  }

  const parsed =
    Number(
      value
    );

  if (
    !Number.isFinite(
      parsed
    ) ||
    parsed < 0
  ) {
    return null;
  }

  return parsed;
}

function parsePositiveNumber(
  value: unknown
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value ===
      "boolean"
  ) {
    return null;
  }

  const parsed =
    Number(
      value
    );

  if (
    !Number.isFinite(
      parsed
    ) ||
    parsed <= 0
  ) {
    return null;
  }

  return parsed;
}

/* ==========================================
   HELPERS
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
        .filter(
          Boolean
        )
    )
  ];
}