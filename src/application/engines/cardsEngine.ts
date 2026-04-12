export function cardsEngine(context: any) {

  const { homeStats, awayStats } = context;

  /* ===========================
     🧼 EXTRAÇÃO SEGURA
  ============================ */

  const foulsHome = safe(homeStats.fouls, 12);
  const foulsAway = safe(awayStats.fouls, 12);

  const yellowsHome = safe(homeStats.yellowCards, 2);
  const yellowsAway = safe(awayStats.yellowCards, 2);

  /* ===========================
     1️⃣ BASE DE AGRESSIVIDADE
  ============================ */

  const totalFouls = foulsHome + foulsAway;
  const totalYellows = yellowsHome + yellowsAway;

  /* ===========================
     2️⃣ INTENSIDADE
  ============================ */

  const intensity =
    totalFouls / 25; // normalização média

  /* ===========================
     3️⃣ DISCIPLINA (EFICIÊNCIA)
  ============================ */

  const discipline =
    totalYellows / (totalFouls || 1);

  /* ===========================
     4️⃣ AJUSTE FINAL
  ============================ */

  let lambdaCards =
    totalYellows *
    (1 + intensity * 0.3) *
    (1 + discipline * 0.5);

  /* ===========================
     🛡️ CLAMP
  ============================ */

  lambdaCards = Math.max(2, Math.min(8, lambdaCards));

  return {
    lambdaCards,
    intensity,
    discipline
  };
}

/* ===========================
   🛠 HELPER
=========================== */

function safe(n: any, fallback = 0) {
  const num = Number(n);
  return isNaN(num) ? fallback : num;
}