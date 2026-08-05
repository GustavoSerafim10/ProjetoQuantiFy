/* ==========================================
   CONFIGURAÇÃO ESTRUTURAL DAS LIGAS
========================================== */

export interface LeagueStrength {
  name: string;
  season?: string;

  averageGoals: number;
  averageHomeGoals: number;
  averageAwayGoals: number;

  attackFactor: number;
  defenseFactor: number;
  homeAdvantage: number;

  leagueStrength: number;

  over15Factor: number;
  over25Factor: number;

  bttsYesFactor: number;
  bttsNoFactor: number;

  homeWinFactor: number;
  drawFactor: number;
  awayWinFactor: number;

  volatilityFactor: number;
  dataReliability: number;
}

export interface ResolvedLeagueStrength {
  key: string;
  requestedKey: string;
  config: LeagueStrength;

  found: boolean;
  usedDefault: boolean;

  warnings: string[];
}

/* ==========================================
   CONFIGURAÇÃO PADRÃO
========================================== */

export const defaultLeagueStrength:
  LeagueStrength = {
    name:
      "Liga Padrão",

    averageGoals:
      2.55,

    averageHomeGoals:
      1.32,

    averageAwayGoals:
      1.23,

    attackFactor:
      1,

    defenseFactor:
      1,

    homeAdvantage:
      1.06,

    leagueStrength:
      1,

    over15Factor:
      1,

    over25Factor:
      1,

    bttsYesFactor:
      1,

    bttsNoFactor:
      1,

    homeWinFactor:
      1,

    drawFactor:
      1,

    awayWinFactor:
      1,

    volatilityFactor:
      1,

    dataReliability:
      0.75
  };

/* ==========================================
   MAPA DAS LIGAS
========================================== */

export const leagueStrengthMap:
  Record<string, LeagueStrength> = {
    premierleague: {
      name:
        "Premier League",

      averageGoals:
        2.55,

      averageHomeGoals:
        1.32,

      averageAwayGoals:
        1.23,

      attackFactor:
        1.02,

      defenseFactor:
        1.01,

      homeAdvantage:
        1.06,

      leagueStrength:
        1,

      over15Factor:
        1,

      over25Factor:
        1,

      bttsYesFactor:
        1,

      bttsNoFactor:
        1,

      homeWinFactor:
        1,

      drawFactor:
        1,

      awayWinFactor:
        1,

      volatilityFactor:
        1,

      dataReliability:
        1
    },

    laliga: {
      name:
        "La Liga",

      averageGoals:
        2.55,

      averageHomeGoals:
        1.32,

      averageAwayGoals:
        1.23,

      attackFactor:
        0.99,

      defenseFactor:
        1,

      homeAdvantage:
        1.06,

      leagueStrength:
        1,

      over15Factor:
        1,

      over25Factor:
        1,

      bttsYesFactor:
        1,

      bttsNoFactor:
        1,

      homeWinFactor:
        1,

      drawFactor:
        1,

      awayWinFactor:
        1,

      volatilityFactor:
        1,

      dataReliability:
        1
    },

    brasileiraoserieb: {
      name:
        "Brasileirão Série B",

      /*
       * Valores neutros provisórios.
       *
       * Devem ser substituídos por médias
       * históricas reais após backtest.
       */
      averageGoals:
        2.35,

      averageHomeGoals:
        1.28,

      averageAwayGoals:
        1.07,

      attackFactor:
        0.97,

      defenseFactor:
        1.02,

      homeAdvantage:
        1.07,

      leagueStrength:
        0.96,

      over15Factor:
        1,

      over25Factor:
        1,

      bttsYesFactor:
        1,

      bttsNoFactor:
        1,

      homeWinFactor:
        1,

      drawFactor:
        1,

      awayWinFactor:
        1,

      volatilityFactor:
        1.04,

      dataReliability:
        0.9
    }
  };

/* ==========================================
   ALIASES
========================================== */

const leagueAliases:
  Record<string, string> = {
    premierleague:
      "premierleague",

    englishpremierleague:
      "premierleague",

    epl:
      "premierleague",

    laliga:
      "laliga",

    laligasantander:
      "laliga",

    brasileiraoserieb:
      "brasileiraoserieb",

    serieb:
      "brasileiraoserieb",

    brasileiraob:
      "brasileiraoserieb",

    campeonatobrasileiroserieb:
      "brasileiraoserieb"
  };
/* ==========================================
   NORMALIZAÇÃO DA CHAVE
========================================== */

function normalizeLeagueKey(
  value:
    string
): string {
  return value
    .normalize(
      "NFD"
    )
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .replace(
      /[^a-z0-9]/g,
      ""
    );
}

/* ==========================================
   VALIDAÇÃO DA CONFIGURAÇÃO
========================================== */

function validateLeagueConfiguration(
  config:
    LeagueStrength
): string[] {
  const warnings:
    string[] = [];

  const configuredTotal =
    config.averageHomeGoals +
    config.averageAwayGoals;

  if (
    Math.abs(
      configuredTotal -
      config.averageGoals
    ) > 0.05
  ) {
    warnings.push(
      "LEAGUE_GOAL_BASES_INCONSISTENT"
    );
  }

  if (
    config.averageGoals < 1.2 ||
    config.averageGoals > 4
  ) {
    warnings.push(
      "SUSPICIOUS_LEAGUE_AVERAGE_GOALS"
    );
  }

  if (
    config.averageHomeGoals <= 0
  ) {
    warnings.push(
      "INVALID_AVERAGE_HOME_GOALS"
    );
  }

  if (
    config.averageAwayGoals <= 0
  ) {
    warnings.push(
      "INVALID_AVERAGE_AWAY_GOALS"
    );
  }

  if (
    config.attackFactor < 0.85 ||
    config.attackFactor > 1.15
  ) {
    warnings.push(
      "SUSPICIOUS_ATTACK_FACTOR"
    );
  }

  if (
    config.defenseFactor < 0.85 ||
    config.defenseFactor > 1.15
  ) {
    warnings.push(
      "SUSPICIOUS_DEFENSE_FACTOR"
    );
  }

  return [
    ...new Set(
      warnings
    )
  ];
}

/* ==========================================
   RESOLUÇÃO COMPLETA DA LIGA
========================================== */

export function resolveLeagueStrength(
  leagueKey?: string
): ResolvedLeagueStrength {
  const requestedKey =
    String(
      leagueKey ??
      ""
    ).trim();

  const normalized =
    normalizeLeagueKey(
      requestedKey
    );

  const resolvedKey =
    leagueAliases[
      normalized
    ] ??
    normalized;

  const config =
    leagueStrengthMap[
      resolvedKey
    ];

  if (!config) {
    const warnings = [
      "UNKNOWN_LEAGUE_USING_DEFAULT",
      ...validateLeagueConfiguration(
        defaultLeagueStrength
      )
    ];

    console.warn(
      "⚠️ LEAGUE FALLBACK:",
      {
        requestedKey,
        normalized,
        resolvedKey,
        used:
          defaultLeagueStrength.name,

        warnings
      }
    );

    return {
      key:
        "default",

      requestedKey,

      config:
        defaultLeagueStrength,

      found:
        false,

      usedDefault:
        true,

      warnings
    };
  }

  const warnings =
    validateLeagueConfiguration(
      config
    );

  return {
    key:
      resolvedKey,

    requestedKey,

    config,

    found:
      true,

    usedDefault:
      false,

    warnings
  };
}

/* ==========================================
   COMPATIBILIDADE COM O CÓDIGO ATUAL
========================================== */

export function getLeagueStrength(
  leagueKey?: string
): LeagueStrength {
  return resolveLeagueStrength(
    leagueKey
  ).config;
}

/* ==========================================
   AJUSTE DE GOLS
========================================== */

export function getLeagueGoalAdjustment(
  leagueKey?: string
): number {
  const resolved =
    resolveLeagueStrength(
      leagueKey
    );

  const league =
    resolved.config;

  const attackFactor =
    Number.isFinite(
      league.attackFactor
    )
      ? league.attackFactor
      : 1;

  const defenseFactor =
    Number.isFinite(
      league.defenseFactor
    ) &&
    league.defenseFactor > 0
      ? league.defenseFactor
      : 1;

  const adjustment =
    attackFactor /
    defenseFactor;

  return Math.max(
    0.85,
    Math.min(
      1.15,
      adjustment
    )
  );
}

/* ==========================================
   CONTRATO OFICIAL — LEAGUE RELIABILITY
========================================== */

export type LeagueReliabilityResolution =
  | "configured"
  | "default";

export interface LeagueReliability {
  key: string;
  requestedKey: string;
  found: boolean;
  usedDefault: boolean;
  resolution: LeagueReliabilityResolution;
  dataReliability: number;
}

/*
 * Única função autorizada a construir o contrato
 * leagueReliability. Nenhum outro pipeline deve
 * recalculá-lo — apenas propagá-lo adiante.
 *
 * Warnings de resolução permanecem em
 * ResolvedLeagueStrength.warnings, disponíveis
 * para diagnóstico — não fazem parte deste
 * contrato operacional.
 */
export function buildLeagueReliability(
  resolved: ResolvedLeagueStrength
): LeagueReliability {
  return {
    key: resolved.key,
    requestedKey: resolved.requestedKey,
    found: resolved.found,
    usedDefault: resolved.usedDefault,

    resolution:
      resolved.usedDefault
        ? "default"
        : "configured",

    dataReliability:
      resolved.config.dataReliability
  };
}