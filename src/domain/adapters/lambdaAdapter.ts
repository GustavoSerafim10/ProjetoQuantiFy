export function calculateLambda(
  team: any,
  opponent: any,
  odds?: any,
  leagueData?: any
) {

  /* ===========================
     🛡️ HELPERS (CRÍTICO)
  ============================ */

  const safe = (v: any, fallback = 0) => {
    const n = Number(v);
    return isNaN(n) ? fallback : n;
  };

  const toDecimal = (v: any) => {
    if (typeof v === "string" && v.includes("%")) {
      return parseFloat(v) / 100;
    }
    const n = Number(v);
    return n > 1 ? n / 100 : n;
  };

  const clamp = (v: number, min: number, max: number) =>
    Math.max(min, Math.min(max, v));

  const div = (a: number, b: number) => (b === 0 ? 0 : a / b);

  /* ===========================
     📊 LIGA BASE
  ============================ */

  const leagueShots = safe(leagueData?.avgShots, 10);
  const leagueSOT = safe(leagueData?.avgShotsOnTarget, 4);
  const leagueGoals = safe(leagueData?.avgGoals, 1.3);

  /* ===========================
     🔥 1. BASE (OVER DISTRIBUTION)
  ============================ */

  const distributionBase =
    toDecimal(team.over05) * 0.45 +
    toDecimal(team.over15) * 1.15 +
    toDecimal(team.over25) * 1.75 +
    toDecimal(team.over35) * 2.35;

  /* ===========================
     ⚔️ 2. ATAQUE
  ============================ */

  const attackStrength =
    div(safe(team.shots), leagueShots) * 0.30 +
    div(safe(team.shotsOnTarget), leagueSOT) * 0.45 +
    div(safe(team.goalsFor), leagueGoals) * 0.25;

  /* ===========================
     🧱 3. DEFESA ADVERSÁRIA
  ============================ */

  const defenseWeakness =
    div(safe(opponent.goalsAgainst), leagueGoals) * 0.65 +
    div(safe(opponent.shotsOnTarget), leagueSOT) * 0.35;

  /* ===========================
     📈 4. FORMA (MELHORADA)
  ============================ */

  const formAttack = div(safe(team.last5GoalsFor), 5);
  const formDefense = div(safe(opponent.last5GoalsAgainst), 5);

  const form =
    div(formAttack, leagueGoals) * 0.6 +
    div(formDefense, leagueGoals) * 0.4;

  /* ===========================
     🔥 5. PRESSÃO OFENSIVA
  ============================ */

  const pressure =
    safe(team.bigChances) * 0.10 +
    safe(team.shotsOnTarget) * 0.05;

  /* ===========================
     🧠 6. RITMO DE JOGO
  ============================ */

  const totalShots =
    safe(team.shots) + safe(opponent.shots);

  const gameTempo = div(totalShots, leagueShots * 2);

  const tempoFactor =
    gameTempo > 1.15 ? 1.12 :
    gameTempo < 0.85 ? 0.88 :
    1;

  /* ===========================
     💰 7. MERCADO (ODDS)
  ============================ */

  let marketBias = 1;

  if (odds?.home && odds?.away) {
    const impliedHome = div(1, odds.home);
    const impliedAway = div(1, odds.away);

    const diff = impliedHome - impliedAway;

    if (diff > 0.20) marketBias = 1.12;
    else if (diff < -0.20) marketBias = 0.92;
  }

  /* ===========================
     🧠 8. FORÇA RELATIVA
  ============================ */

  const strengthDiff =
    safe(team.goalsFor) - safe(opponent.goalsFor);

  const strengthFactor =
    strengthDiff > 0.6 ? 1.08 :
    strengthDiff < -0.6 ? 0.92 :
    1;

  /* ===========================
     🔥 9. COMBINAÇÃO FINAL
  ============================ */

  let rawLambda =
    (distributionBase * 0.35) +
    (attackStrength * 0.22) +
    (defenseWeakness * 0.20) +
    (form * 0.12) +
    (pressure * 0.11);

  rawLambda *= tempoFactor;
  rawLambda *= marketBias;
  rawLambda *= strengthFactor;

  /* ===========================
     🧊 10. SHRINK (ANTI-OVERFIT)
  ============================ */

  const shrinkFactor = 0.70;

  let lambda =
    (rawLambda * shrinkFactor) +
    (leagueGoals * (1 - shrinkFactor));

  /* ===========================
     🎯 11. CLAMP FINAL (MUITO IMPORTANTE)
  ============================ */

  lambda = clamp(lambda, 0.35, 3.8);

  /* ===========================
     🛡️ FAILSAFE FINAL
  ============================ */

  if (isNaN(lambda)) {
    console.warn("⚠️ Lambda NaN detectado → fallback aplicado");
    return leagueGoals;
  }

  return lambda;
}