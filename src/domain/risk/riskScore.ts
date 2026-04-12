/* ===============================
   📊 TYPES
=============================== */

interface RiskInput {
  lambdaHome: number;
  lambdaAway: number;

  eventProbability: number;

  leagueAvgGoals: number;
  recentGoalStd: number;
  seasonGoalAvg: number;

  goalExpectationScore?: number;
  totalLambda?: number;
  marketType?: string;
}

/* ===============================
   🛡️ SAFE
=============================== */

const safe = (v: any, fallback: number) =>
  v === undefined || v === null || isNaN(v) ? fallback : v;

/* ===============================
   🎲 POISSON SAMPLE
=============================== */

function poissonSample(lambda: number): number {
  const L = Math.exp(-lambda);
  let p = 1;
  let k = 0;

  do {
    k++;
    p *= Math.random();
  } while (p > L);

  return k - 1;
}

/* ===============================
   🎯 MONTE CARLO SIMULATION
=============================== */

function simulateMatch(lambdaHome: number, lambdaAway: number, iterations = 4000) {

  let totalGoals = 0;
  let extremeGames = 0;

  const results: number[] = [];

  for (let i = 0; i < iterations; i++) {

    const homeGoals = poissonSample(lambdaHome);
    const awayGoals = poissonSample(lambdaAway);

    const total = homeGoals + awayGoals;

    totalGoals += total;
    results.push(total);

    if (total >= 5) extremeGames++;
  }

  const avgGoals = totalGoals / iterations;

  const variance =
    results.reduce((acc, g) => acc + Math.pow(g - avgGoals, 2), 0) / iterations;

  const stdDev = Math.sqrt(variance);
  const extremeRate = extremeGames / iterations;

  return {
    avgGoals,
    variance,
    stdDev,
    extremeRate
  };
}

/* ===============================
   🚀 RISK SCORE 4.2 (BALANCED FIX)
=============================== */

export function calculateRiskScore(input: RiskInput): number {

  const lambdaHome = safe(input.lambdaHome, 1.2);
  const lambdaAway = safe(input.lambdaAway, 1.0);

  const prob = Math.max(0.0001, Math.min(0.9999, safe(input.eventProbability, 0.5)));

  const leagueAvgGoals = safe(input.leagueAvgGoals, 1.3);
  const recentStd = safe(input.recentGoalStd, 1.0);
  const seasonAvg = safe(input.seasonGoalAvg, 1.2);

  const goalScore = input.goalExpectationScore ?? 0.5;
  const totalLambda = input.totalLambda ?? (lambdaHome + lambdaAway);
  const marketType = input.marketType ?? "OTHER";

  /* ===========================
     🎲 1. SIMULAÇÃO
  ============================ */

  const sim = simulateMatch(lambdaHome, lambdaAway);

  /* ===========================
     📊 2. COMPONENTES BASE
  ============================ */

  const varianceRisk = Math.min(1, sim.stdDev / 2.8);
  const tailRisk = Math.min(1, sim.extremeRate * 1.2);

  // 🔥 CORREÇÃO PRINCIPAL (NÃO INFLAR JOGO EQUILIBRADO)
  const probInstability = Math.abs(prob - 0.5);

  const volatility =
    recentStd / (seasonAvg || 1);

  const volatilityClamped = Math.min(1, volatility);

  const leagueFactor =
    leagueAvgGoals > 3 ? 1 :
    leagueAvgGoals < 2 ? 0.75 :
    0.85;

  /* ===========================
     🧠 3. BASE RISK
  ============================ */

  let risk =
    (varianceRisk * 0.22) +
    (tailRisk * 0.12) +
    (probInstability * 0.20) +
    (volatilityClamped * 0.26) +
    (leagueFactor * 0.20);

  /* ===========================
     🔥 4. AJUSTES INTELIGENTES
  ============================ */

  const balance = Math.abs(lambdaHome - lambdaAway);

  // menos agressivo
  if (balance < 0.25) {
    risk *= 1.06;
  }

  /* ===== OVER ===== */
  if (marketType === "OVER") {

    if (goalScore < 0.45) risk *= 1.18;
    else if (goalScore < 0.55) risk *= 1.08;
    else if (goalScore > 0.65) risk *= 0.95;

    if (totalLambda < 2.2) risk *= 1.12;
    if (totalLambda > 3.3) risk *= 0.95;
  }

  /* ===== BTTS ===== */
  if (marketType === "BTTS") {

    if (goalScore < 0.50) risk *= 1.08;
    if (balance > 0.9) risk *= 1.05;
  }

  /* ===== RESULT ===== */
  if (marketType === "RESULT") {
    risk *= 1.02;
  }

  /* ===========================
     🔥 NORMALIZAÇÃO FINAL
  ============================ */

  risk *= 0.88;

  /* ===========================
     🎯 CLAMP FINAL
  ============================ */

  risk = Math.max(0.05, Math.min(risk, 0.95));

  return Number(risk.toFixed(4));
}