import type { TeamStats } from "../types/TeamStats";
import { leagueStrengthMap } from "../rating/leagueStrength";
import { calculateXGProxy } from "../math/xgProxy";

/* ==========================================
   PARÂMETROS ESTRUTURAIS
========================================== */

const LEAGUE_AVG_GOALS = 2.7;
const BASE_HOME_ADVANTAGE = 1.07;

const ATTACK_ELASTICITY = 0.90;
const DEFENSE_ELASTICITY = 0.85;

const SHRINK_FACTOR = 8;

const MIN_LAMBDA = 0.30;
const MAX_LAMBDA = 3.80;

/* ==========================================
   UTIL
========================================== */

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function shrinkStat(
  raw: number,
  leagueAvg: number,
  matchesPlayed?: number
) {
  const safeMatches = matchesPlayed ?? 10;
  const weight = safeMatches / (safeMatches + SHRINK_FACTOR);
  return raw * weight + leagueAvg * (1 - weight);
}

/* ==========================================
   🔥 NOVO: BALANCEAMENTO SUAVE
========================================== */

function applyBalanceAdjustment(home: number, away: number) {
  const diff = Math.abs(home - away);

  // jogo muito equilibrado → leve redução (evita over fake)
  if (diff < 0.25) {
    return {
      home: home * 0.96,
      away: away * 0.96
    };
  }

  return { home, away };
}

/* ==========================================
   🔥 NOVO: BOOST POR VOLUME (xG)
========================================== */

function applyVolumeBoost(lambda: number, xg: number) {
  if (xg > 1.6) return lambda * 1.05;
  if (xg < 0.8) return lambda * 0.95;
  return lambda;
}

/* ==========================================
   BUILD LAMBDA 6.0 — REFINADO
========================================== */

export function buildLambda(
  home: TeamStats,
  away: TeamStats,
  leagueKey: string
) {

  const leagueHalf = LEAGUE_AVG_GOALS / 2;

  /* ==========================================
     🔥 XG PROXY
  ========================================== */

  const homeXG = calculateXGProxy(
    home.shotsOnTargetPerMatch ?? 0,
    home.shotsPerMatch ?? 0
  );

  const awayXG = calculateXGProxy(
    away.shotsOnTargetPerMatch ?? 0,
    away.shotsPerMatch ?? 0
  );

  /* ==========================================
     SHRINK (COM XG)
  ========================================== */

  const homeAttackRaw =
    shrinkStat(
      (home.homeGoalsScoredPerMatch * 0.6 + homeXG * 0.4),
      leagueHalf,
      home.matchesPlayed
    );

  const awayAttackRaw =
    shrinkStat(
      (away.awayGoalsScoredPerMatch * 0.6 + awayXG * 0.4),
      leagueHalf,
      away.matchesPlayed
    );

  const homeDefenseRaw =
    shrinkStat(
      home.homeGoalsConcededPerMatch,
      leagueHalf,
      home.matchesPlayed
    );

  const awayDefenseRaw =
    shrinkStat(
      away.awayGoalsConcededPerMatch,
      leagueHalf,
      away.matchesPlayed
    );

  /* ==========================================
     ELASTICIDADE
  ========================================== */

  const homeAttackStrength =
    Math.pow(homeAttackRaw / leagueHalf, ATTACK_ELASTICITY);

  const awayAttackStrength =
    Math.pow(awayAttackRaw / leagueHalf, ATTACK_ELASTICITY);

  const homeDefFragility =
    Math.pow(homeDefenseRaw / leagueHalf, DEFENSE_ELASTICITY);

  const awayDefFragility =
    Math.pow(awayDefenseRaw / leagueHalf, DEFENSE_ELASTICITY);

  /* ==========================================
     λ BASE
  ========================================== */

  let lambdaHome =
    leagueHalf *
    homeAttackStrength *
    awayDefFragility *
    BASE_HOME_ADVANTAGE;

  let lambdaAway =
    leagueHalf *
    awayAttackStrength *
    homeDefFragility;

  /* ==========================================
     🔥 AJUSTE POR VOLUME (xG)
  ========================================== */

  lambdaHome = applyVolumeBoost(lambdaHome, homeXG);
  lambdaAway = applyVolumeBoost(lambdaAway, awayXG);

  /* ==========================================
     LEAGUE STRENGTH
  ========================================== */

  const league = leagueStrengthMap[leagueKey];

  if (league) {
    lambdaHome *= league.attackFactor;
    lambdaAway *= league.attackFactor;

    lambdaHome /= league.defenseFactor;
    lambdaAway /= league.defenseFactor;
  }

  /* ==========================================
     🔥 BALANCEAMENTO FINAL
  ========================================== */

  const balanced = applyBalanceAdjustment(lambdaHome, lambdaAway);
  lambdaHome = balanced.home;
  lambdaAway = balanced.away;

  /* ==========================================
     NORMALIZAÇÃO GLOBAL
  ========================================== */

  const total = lambdaHome + lambdaAway;

  if (isFinite(total) && total > 0.1) {
    const scale = LEAGUE_AVG_GOALS / total;
    lambdaHome *= scale;
    lambdaAway *= scale;
  }

  /* ==========================================
     LIMITES
  ========================================== */

  lambdaHome = clamp(lambdaHome, MIN_LAMBDA, MAX_LAMBDA);
  lambdaAway = clamp(lambdaAway, MIN_LAMBDA, MAX_LAMBDA);

  return {
    lambdaHome,
    lambdaAway,
    totalLambda: lambdaHome + lambdaAway // 🔥 NOVO (IMPORTANTE)
  };
}