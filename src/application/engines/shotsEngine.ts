export function shotsEngine(context: any) {

  const { homeStats, awayStats } = context;

  /* ===========================
     🧼 EXTRAÇÃO SEGURA
  ============================ */

  const homeShots = safe(homeStats.shots, 10);
  const awayShots = safe(awayStats.shots, 10);

  const homeOnTarget = safe(homeStats.shotsOnTarget, 4);
  const awayOnTarget = safe(awayStats.shotsOnTarget, 4);

  /* ===========================
     1️⃣ BASE DE VOLUME
  ============================ */

  const totalShots = homeShots + awayShots;

  /* ===========================
     2️⃣ QUALIDADE (PRECISÃO)
  ============================ */

  const totalOnTarget = homeOnTarget + awayOnTarget;

  const accuracy =
    totalOnTarget / (totalShots || 1);

  /* ===========================
     3️⃣ PRESSÃO OFENSIVA
  ============================ */

  const pressure =
    totalShots / 20; // normalização média

  /* ===========================
     4️⃣ AJUSTE FINAL
  ============================ */

  let expectedShots =
    totalShots *
    (1 + accuracy * 0.3) *
    (1 + pressure * 0.2);

  /* ===========================
     🛡️ CLAMP
  ============================ */

  expectedShots = Math.max(10, Math.min(35, expectedShots));

  return {
    expectedShots,
    totalShots,
    accuracy,
    pressure
  };
}

/* ===========================
   🛠 HELPER
=========================== */

function safe(n: any, fallback = 0) {
  const num = Number(n);
  return isNaN(num) ? fallback : num;
}