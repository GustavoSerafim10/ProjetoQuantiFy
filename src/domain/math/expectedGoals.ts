/* ==========================================
   EXPECTED GOALS BASELINE — QUANTIFY V7
========================================== */

/*
 * Responsabilidade:
 *
 * - produzir uma estimativa auxiliar simples;
 * - comparar ataque da equipe com defesa adversária;
 * - servir como diagnóstico do lambda oficial;
 * - detectar possíveis divergências estruturais.
 *
 * Este arquivo NÃO:
 *
 * - produz o lambda oficial do sistema;
 * - aplica shrinkage;
 * - aplica ajuste de liga;
 * - aplica vantagem de casa;
 * - utiliza xG Proxy;
 * - substitui o lambdaBuilder.
 *
 * A fonte oficial dos lambdas é:
 *
 * buildLambda()
 * em lambdaBuilder.ts
 */

/* ==========================================
   CONTRATOS
========================================== */

export interface TeamStats {
  matches: number;

  goalsPerMatch: number;

  goalsConcededPerMatch: number;
}

export interface ExpectedGoalsConfig {
  /*
   * Utilizado apenas como fallback quando uma
   * estatística válida não estiver disponível.
   *
   * Este valor não regulariza os dados observados.
   */
  leagueAverageGoalsPerTeam?: number;

  minLambda?: number;

  maxLambda?: number;
}

export interface ExpectedGoalsResult {
  lambdaHome: number;

  lambdaAway: number;

  totalLambda: number;

  valid: boolean;

  diagnostics: {
    homeAttackRate: number | null;

    awayAttackRate: number | null;

    homeDefensiveRate: number | null;

    awayDefensiveRate: number | null;

    homeRawLambda: number;

    awayRawLambda: number;

    usedFallbacks: string[];

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

  const leagueAverageGoalsPerTeam =
    clamp(
      parsePositiveNumber(
        config
          .leagueAverageGoalsPerTeam
      ) ?? 1.35,

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

  const homeAttackObserved =
    parseNonNegativeNumber(
      home?.goalsPerMatch
    );

  const awayAttackObserved =
    parseNonNegativeNumber(
      away?.goalsPerMatch
    );

  const homeDefenseObserved =
    parseNonNegativeNumber(
      home
        ?.goalsConcededPerMatch
    );

  const awayDefenseObserved =
    parseNonNegativeNumber(
      away
        ?.goalsConcededPerMatch
    );

  const homeAttackRate =
    resolveRate(
      homeAttackObserved,

      leagueAverageGoalsPerTeam,

      "HOME_ATTACK_FALLBACK",

      usedFallbacks
    );

  const awayAttackRate =
    resolveRate(
      awayAttackObserved,

      leagueAverageGoalsPerTeam,

      "AWAY_ATTACK_FALLBACK",

      usedFallbacks
    );

  const homeDefensiveRate =
    resolveRate(
      homeDefenseObserved,

      leagueAverageGoalsPerTeam,

      "HOME_DEFENSE_FALLBACK",

      usedFallbacks
    );

  const awayDefensiveRate =
    resolveRate(
      awayDefenseObserved,

      leagueAverageGoalsPerTeam,

      "AWAY_DEFENSE_FALLBACK",

      usedFallbacks
    );

  /*
   * Baseline simples:
   *
   * ataque do time
   * ×
   * fragilidade defensiva adversária
   *
   * A média geométrica reduz a influência de um
   * único valor extremo.
   *
   * Não existe shrinkage neste arquivo.
   */
  const homeRawLambda =
    geometricMean(
      homeAttackRate,

      awayDefensiveRate
    );

  const awayRawLambda =
    geometricMean(
      awayAttackRate,

      homeDefensiveRate
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

  const valid =
    Number.isFinite(
      lambdaHome
    ) &&
    Number.isFinite(
      lambdaAway
    ) &&
    lambdaHome > 0 &&
    lambdaAway > 0;

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

    valid,

    diagnostics: {
      homeAttackRate:
        homeAttackObserved,

      awayAttackRate:
        awayAttackObserved,

      homeDefensiveRate:
        homeDefenseObserved,

      awayDefensiveRate:
        awayDefenseObserved,

      homeRawLambda:
        roundNumber(
          homeRawLambda
        ),

      awayRawLambda:
        roundNumber(
          awayRawLambda
        ),

      usedFallbacks:
        normalizeStrings(
          usedFallbacks
        ),

      note:
        "Diagnostic baseline only. Official lambdas must come from buildLambda()."
    }
  };
}

/* ==========================================
   RESOLUÇÃO DE TAXAS
========================================== */

function resolveRate(
  observed:
    number | null,

  fallback:
    number,

  warning:
    string,

  usedFallbacks:
    string[]
): number {
  if (
    observed !== null
  ) {
    return clamp(
      observed,

      0,

      6
    );
  }

  usedFallbacks.push(
    warning
  );

  return fallback;
}

/* ==========================================
   MÉDIA GEOMÉTRICA
========================================== */

function geometricMean(
  first:
    number,

  second:
    number
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
  value:
    unknown
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
    Number(value);

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
  value:
    unknown
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
    Number(value);

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
  value:
    number,

  minimum:
    number,

  maximum:
    number
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
  value:
    number,

  decimals =
    4
): number {
  if (
    !Number.isFinite(
      value
    )
  ) {
    return 0;
  }

  const factor =
    10 **
    decimals;

  return (
    Math.round(
      value *
      factor
    ) /
    factor
  );
}

function normalizeStrings(
  values:
    string[]
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