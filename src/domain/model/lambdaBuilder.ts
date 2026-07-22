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
 * valores extremos.
 *
 * Devem futuramente ser calibradas por backtest,
 * Log Loss e Brier Score.
 */
const ATTACK_ELASTICITY =
  0.82;

const DEFENSE_ELASTICITY =
  0.78;

/*
 * Quantidade de partidas equivalentes utilizadas
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
 * Proteção apenas para totais excessivamente altos.
 *
 * O limite não eleva jogos fechados.
 */
const MAX_TOTAL_LAMBDA =
  5.0;

/*
 * Composição ofensiva.
 *
 * O proxy de xG possui peso inferior aos gols
 * porque não considera localização, ângulo,
 * tipo de finalização ou qualidade da chance.
 */
const GOALS_WEIGHT =
  0.70;

const XG_PROXY_WEIGHT =
  0.30;

/* ==========================================
   TIPOS INTERNOS
========================================== */

interface LimitedLambdas {
  home: number;
  away: number;
}

interface TeamStatsCompatibility {
  matchesPlayed?: number;
  matches?: number;

  goalsPerMatch?: number;
  goalsConcededPerMatch?: number;

  homeGoalsScoredPerMatch?: number;
  homeGoalsConcededPerMatch?: number;

  awayGoalsScoredPerMatch?: number;
  awayGoalsConcededPerMatch?: number;

  shotsOnTargetPerMatch?: number;
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
  if (!Number.isFinite(value)) {
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
    Number(value);

  return Number.isFinite(parsed)
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

function firstFiniteNumber(
  values: unknown[],
  fallback: number
): number {
  for (const value of values) {
    if (
      value === null ||
      value === undefined ||
      value === "" ||
      typeof value === "boolean"
    ) {
      continue;
    }

    const parsed =
      Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function roundNumber(
  value: number,
  decimals = 4
): number {
  if (!Number.isFinite(value)) {
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
   RESOLUÇÃO DE CONTRATOS
========================================== */

function resolveMatchesPlayed(
  team: TeamStatsCompatibility
): number {
  return clamp(
    firstFiniteNumber(
      [
        team.matchesPlayed,
        team.matches
      ],
      10
    ),
    0,
    100
  );
}

function resolveHomeGoalsScored(
  team: TeamStatsCompatibility,
  fallback: number
): number {
  return clamp(
    firstFiniteNumber(
      [
        team.homeGoalsScoredPerMatch,
        team.goalsPerMatch
      ],
      fallback
    ),
    0,
    6
  );
}

function resolveAwayGoalsScored(
  team: TeamStatsCompatibility,
  fallback: number
): number {
  return clamp(
    firstFiniteNumber(
      [
        team.awayGoalsScoredPerMatch,
        team.goalsPerMatch
      ],
      fallback
    ),
    0,
    6
  );
}

function resolveHomeGoalsConceded(
  team: TeamStatsCompatibility,
  fallback: number
): number {
  return clamp(
    firstFiniteNumber(
      [
        team.homeGoalsConcededPerMatch,
        team.goalsConcededPerMatch
      ],
      fallback
    ),
    0,
    6
  );
}

function resolveAwayGoalsConceded(
  team: TeamStatsCompatibility,
  fallback: number
): number {
  return clamp(
    firstFiniteNumber(
      [
        team.awayGoalsConcededPerMatch,
        team.goalsConcededPerMatch
      ],
      fallback
    ),
    0,
    6
  );
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
        10
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
    !Number.isFinite(base) ||
    !Number.isFinite(exponent) ||
    base <= 0
  ) {
    return 1;
  }

  const result =
    Math.pow(
      base,
      exponent
    );

  return Number.isFinite(result)
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
   * Preserva a proporção casa/fora cadastrada,
   * mas garante que a soma corresponde ao total
   * médio oficial da liga.
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
    !Number.isFinite(total) ||
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

  /*
   * Quando o total excede o limite,
   * reduzimos proporcionalmente.
   */
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
   BUILD LAMBDA
========================================== */

export function buildLambda(
  homeInput: TeamStats,
  awayInput: TeamStats,
  leagueKey: string
) {
  const home =
    homeInput as
      TeamStatsCompatibility;

  const away =
    awayInput as
      TeamStatsCompatibility;

  /* ==========================================
     CONFIGURAÇÃO DA LIGA
  ========================================== */

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
   * Deve representar somente ajuste complementar
   * da liga. A lógica permanece centralizada em
   * leagueStrength.ts.
   */
  const leagueAdjustment =
    safePositiveNumber(
      getLeagueGoalAdjustment(
        leagueKey
      ),
      1
    );

  /* ==========================================
     AMOSTRA
  ========================================== */

  const homeMatchesPlayed =
    resolveMatchesPlayed(
      home
    );

  const awayMatchesPlayed =
    resolveMatchesPlayed(
      away
    );

  /* ==========================================
     XG PROXY
  ========================================== */

  const homeXGResult =
    calculateXGProxyDetailed(
      home.shotsOnTargetPerMatch,
      home.shotsPerMatch
    );

  const awayXGResult =
    calculateXGProxyDetailed(
      away.shotsOnTargetPerMatch,
      away.shotsPerMatch
    );

  const homeXG =
    homeXGResult.xg;

  const awayXG =
    awayXGResult.xg;

  /* ==========================================
     TAXAS OBSERVADAS DE GOLS
  ========================================== */

  const homeGoalsRate =
    resolveHomeGoalsScored(
      home,
      leagueBaseHome
    );

  const awayGoalsRate =
    resolveAwayGoalsScored(
      away,
      leagueBaseAway
    );

  const homeGoalsConcededRate =
    resolveHomeGoalsConceded(
      home,
      leagueBaseAway
    );

  const awayGoalsConcededRate =
    resolveAwayGoalsConceded(
      away,
      leagueBaseHome
    );

  /* ==========================================
     COMPOSIÇÃO OFENSIVA
  ========================================== */

  /*
   * Quando o xG Proxy é válido:
   *
   * 70% gols observados
   * 30% proxy de xG
   *
   * Quando os dados de finalizações não existem,
   * utilizamos somente os gols observados.
   */
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

  /* ==========================================
     SHRINKAGE DO ATAQUE
  ========================================== */

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

  /* ==========================================
     SHRINKAGE DA DEFESA
  ========================================== */

  /*
   * Defesa do mandante:
   * comparada à referência ofensiva visitante.
   *
   * Defesa do visitante:
   * comparada à referência ofensiva mandante.
   */
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

  /* ==========================================
     FORÇAS RELATIVAS
  ========================================== */

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

  /* ==========================================
     LAMBDAS ESTRUTURAIS
  ========================================== */

  let lambdaHome =
    leagueBaseHome *
    homeAttackStrength *
    awayDefensiveFragility;

  let lambdaAway =
    leagueBaseAway *
    awayAttackStrength *
    homeDefensiveFragility;

  /* ==========================================
     AJUSTE COMPLEMENTAR DA LIGA
  ========================================== */

  lambdaHome *=
    leagueAdjustment;

  lambdaAway *=
    leagueAdjustment;

  /* ==========================================
     PROTEÇÕES INDIVIDUAIS
  ========================================== */

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

  /* ==========================================
     PROTEÇÃO DO TOTAL
  ========================================== */

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

  /* ==========================================
     RESULTADO
  ========================================== */

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

      homeMatchesPlayed,
      awayMatchesPlayed,

      homeGoalsRate:
        roundNumber(
          homeGoalsRate
        ),

      awayGoalsRate:
        roundNumber(
          awayGoalsRate
        ),

      homeGoalsConcededRate:
        roundNumber(
          homeGoalsConcededRate
        ),

      awayGoalsConcededRate:
        roundNumber(
          awayGoalsConcededRate
        ),

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

      attackElasticity:
        ATTACK_ELASTICITY,

      defenseElasticity:
        DEFENSE_ELASTICITY,

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