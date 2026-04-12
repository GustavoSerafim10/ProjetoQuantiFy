export function cornerEngine(context: any) {
  const { homeStats, awayStats, lambdaHome, lambdaAway } = context;

  /* ===========================
     1️⃣ BASE
  ============================ */

  const baseCorners = 9.5;

  /* ===========================
     2️⃣ RITMO
  ============================ */

  const shotsHome = homeStats?.shots ?? 10;
  const shotsAway = awayStats?.shots ?? 10;

  const pace =
    (shotsHome + shotsAway) / 20;

  /* ===========================
     3️⃣ PRESSÃO
  ============================ */

  const pressure =
    (lambdaHome + lambdaAway) / 2;

  /* ===========================
     4️⃣ AJUSTES
  ============================ */

  const offensiveBoost =
    ((homeStats?.shotsOnTarget ?? 4) +
     (awayStats?.shotsOnTarget ?? 4)) / 8;

  const bigChancesBoost =
    ((homeStats?.bigChances ?? 1) +
     (awayStats?.bigChances ?? 1)) / 4;

  /* ===========================
     5️⃣ LAMBDA FINAL
  ============================ */

  let lambdaCorners =
    baseCorners *
    pace *
    (1 + pressure * 0.2) *
    (1 + offensiveBoost * 0.1) *
    (1 + bigChancesBoost * 0.1);

  // clamp final
  lambdaCorners = Math.max(5, Math.min(15, lambdaCorners));

  return {
    lambdaCorners
  };
}