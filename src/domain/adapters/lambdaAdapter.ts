export function calculateLambda(
  team: any,
  opponent: any,
  odds?: any,
  leagueData?: any,
  isHome: boolean = false
) {
  const safe = (v: any, fallback = 0) => {
    const n = Number(v);
    return isNaN(n) ? fallback : n;
  };

  const toDecimal = (v: any, fallback = 0.5) => {
    if (v === undefined || v === null || v === "") return fallback;

    if (typeof v === "string" && v.includes("%")) {
      const parsed = parseFloat(v);
      return isNaN(parsed) ? fallback : parsed / 100;
    }

    const n = Number(v);
    if (isNaN(n)) return fallback;

    return n > 1 ? n / 100 : n;
  };

  const clamp = (v: number, min: number, max: number) =>
    Math.max(min, Math.min(max, v));

  const div = (a: number, b: number, fallback = 0) =>
    b === 0 ? fallback : a / b;

  const weightedAverage = (values: Array<[number, number]>, fallback = 1) => {
    let totalWeight = 0;
    let total = 0;

    for (const [value, weight] of values) {
      if (Number.isFinite(value) && Number.isFinite(weight) && weight > 0) {
        total += value * weight;
        totalWeight += weight;
      }
    }

    return totalWeight > 0 ? total / totalWeight : fallback;
  };

  const ratio = (
    value: number,
    base: number,
    min = 0.65,
    max = 1.45,
    fallback = 1
  ) => {
    if (!Number.isFinite(value) || !Number.isFinite(base) || base <= 0) {
      return fallback;
    }

    return clamp(value / base, min, max);
  };

  const shrinkToOne = (value: number, strength = 0.15) => {
    return 1 + (value - 1) * (1 - strength);
  };

  const getImpliedProb = (odd?: number) => {
    if (!odd || odd <= 1) return 0;
    return 1 / odd;
  };

  const getMarketLeanFactor = () => {
    if (!odds?.home || !odds?.away) return 1;

    const impliedHome = getImpliedProb(Number(odds.home));
    const impliedAway = getImpliedProb(Number(odds.away));

    if (impliedHome <= 0 || impliedAway <= 0) return 1;

    const teamProb = isHome ? impliedHome : impliedAway;
    const oppProb = isHome ? impliedAway : impliedHome;

    const strength = teamProb / (teamProb + oppProb);

    // mercado ajuda, mas não manda
    const lean = 1 + (strength - 0.5) * 0.32;

    return clamp(lean, 0.90, 1.10);
  };

  const leagueAvgGoals = safe(leagueData?.avgGoals, 2.6);
  const leagueHomeGoals = safe(leagueData?.avgHomeGoals, 1.45);
  const leagueAwayGoals = safe(leagueData?.avgAwayGoals, 1.15);
  const leagueShots = safe(leagueData?.avgShots, 12);
  const leagueSOT = safe(leagueData?.avgShotsOnTarget, 4.2);
  const leagueBigChances = safe(leagueData?.avgBigChances, 1.8);

  const leagueTeamGoalBase = leagueAvgGoals / 2;
  const leagueBaseLambda = isHome ? leagueHomeGoals : leagueAwayGoals;

  /* ===========================
     1. BASE DE DISTRIBUIÇÃO
  ============================ */

  const distributionBase = weightedAverage(
    [
      [toDecimal(team.over05, 0.75), 0.20],
      [toDecimal(team.over15, 0.55), 0.35],
      [toDecimal(team.over25, 0.35), 0.30],
      [toDecimal(team.over35, 0.18), 0.15],
    ],
    0.50
  );

  // transforma distribuição em um fator leve
  const distributionFactor = clamp(0.82 + distributionBase * 0.55, 0.88, 1.16);

  /* ===========================
     2. FORÇA OFENSIVA
  ============================ */

  const attackStrengthRaw = weightedAverage(
    [
      [ratio(safe(team.goalsFor, leagueTeamGoalBase), leagueTeamGoalBase, 0.65, 1.55), 0.38],
      [ratio(safe(team.last5GoalsFor, safe(team.goalsFor, leagueTeamGoalBase)), leagueTeamGoalBase, 0.60, 1.65), 0.22],
      [ratio(safe(team.shots, leagueShots), leagueShots, 0.75, 1.30), 0.16],
      [ratio(safe(team.shotsOnTarget, leagueSOT), leagueSOT, 0.70, 1.40), 0.16],
      [ratio(safe(team.bigChances, leagueBigChances), leagueBigChances, 0.65, 1.45), 0.08],
    ],
    1
  );

  const attackStrength = shrinkToOne(attackStrengthRaw, 0.12);

  /* ===========================
     3. FRAGILIDADE DEFENSIVA ADVERSÁRIA
  ============================ */

  const defenseWeaknessRaw = weightedAverage(
    [
      [ratio(safe(opponent.goalsAgainst, leagueTeamGoalBase), leagueTeamGoalBase, 0.70, 1.55), 0.48],
      [ratio(safe(opponent.last5GoalsAgainst, safe(opponent.goalsAgainst, leagueTeamGoalBase)), leagueTeamGoalBase, 0.65, 1.65), 0.28],
      [ratio(safe(opponent.bigChancesAgainst, leagueBigChances), leagueBigChances, 0.70, 1.45), 0.24],
    ],
    1
  );

  const defenseWeakness = shrinkToOne(defenseWeaknessRaw, 0.10);

  /* ===========================
     4. FORMA RECENTE
  ============================ */

  const teamRecentAttack = safe(team.last5GoalsFor, safe(team.goalsFor, leagueTeamGoalBase));
  const oppRecentDefense = safe(
    opponent.last5GoalsAgainst,
    safe(opponent.goalsAgainst, leagueTeamGoalBase)
  );

  const formDelta = teamRecentAttack - oppRecentDefense;
  const formFactor = clamp(1 + formDelta * 0.045, 0.90, 1.14);

  /* ===========================
     5. PRESSÃO OFENSIVA
  ============================ */

  const pressureIndex =
    (ratio(safe(team.bigChances, leagueBigChances), leagueBigChances, 0.70, 1.50) * 0.55) +
    (ratio(safe(team.shotsOnTarget, leagueSOT), leagueSOT, 0.70, 1.40) * 0.45);

  const pressureFactor = clamp(pressureIndex, 0.90, 1.16);

  /* ===========================
     6. RITMO
  ============================ */

  const totalShots = safe(team.shots, leagueShots) + safe(opponent.shots, leagueShots);
  const gameTempo = div(totalShots, leagueShots * 2, 1);

  const tempoFactor =
    gameTempo > 1.18 ? 1.07 :
    gameTempo > 1.08 ? 1.03 :
    gameTempo < 0.82 ? 0.93 :
    gameTempo < 0.92 ? 0.97 :
    1;

  /* ===========================
     7. VIÉS DE MERCADO
  ============================ */

  const marketFactor = getMarketLeanFactor();

  /* ===========================
     8. FORÇA RELATIVA REAL
  ============================ */

  const offensivePower =
    (safe(team.goalsFor, leagueTeamGoalBase) * 0.45) +
    (safe(team.last5GoalsFor, safe(team.goalsFor, leagueTeamGoalBase)) * 0.20) +
    (safe(team.bigChances, leagueBigChances) * 0.20) +
    (safe(team.shotsOnTarget, leagueSOT) * 0.15);

  const opponentWeakness =
    (safe(opponent.goalsAgainst, leagueTeamGoalBase) * 0.50) +
    (safe(opponent.last5GoalsAgainst, safe(opponent.goalsAgainst, leagueTeamGoalBase)) * 0.25) +
    (safe(opponent.bigChancesAgainst, leagueBigChances) * 0.25);

  const relativeStrengthScore = div(
    offensivePower,
    Math.max(opponentWeakness, 0.15),
    1
  );

  const strengthFactor = clamp(0.78 + relativeStrengthScore * 0.26, 0.88, 1.18);

  /* ===========================
     9. MANDO
  ============================ */

  const venueFactor = isHome ? 1.07 : 0.95;

  /* ===========================
     10. COMBINAÇÃO FINAL
  ============================ */

  let rawLambda =
    leagueBaseLambda *
    attackStrength *
    defenseWeakness *
    distributionFactor *
    formFactor *
    pressureFactor *
    tempoFactor *
    marketFactor *
    strengthFactor *
    venueFactor;

  /* ===========================
     11. SHRINK FINAL
  ============================ */

  // shrink mais leve para não matar favoritismo real
  const shrinkFactor = 0.93;

  let lambda =
    (rawLambda * shrinkFactor) +
    (leagueBaseLambda * (1 - shrinkFactor));

  /* ===========================
     12. CLAMP
  ============================ */

  lambda = clamp(lambda, 0.35, 3.4);

  if (isNaN(lambda)) {
    console.warn("⚠️ Lambda NaN detectado → fallback aplicado");
    return Number(leagueBaseLambda.toFixed(4));
  }

  return Number(lambda.toFixed(4));
}