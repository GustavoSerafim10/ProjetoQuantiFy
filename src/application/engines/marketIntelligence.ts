/* ===========================
   🧠 MARKET INTELLIGENCE ENGINE (ELITE v2)
=========================== */

export function analyzeMarketContext(data: any) {

  const lambdaHome = data.lambdaHome || 1;
  const lambdaAway = data.lambdaAway || 1;

  const totalLambda = lambdaHome + lambdaAway;
  const diff = Math.abs(lambdaHome - lambdaAway);

  const goalScore = data.goalExpectationScore ?? 0.5;

  /* ===========================
     ⚡ GAME PACE
  ============================ */

  const shots = data.engines?.shotsData?.shots ?? 0;
  const dangerous = data.engines?.shotsData?.dangerousAttacks ?? 0;
  const possession = data.engines?.shotsData?.possession ?? 50;

  const paceRaw =
    (shots * 0.35) +
    (dangerous * 0.45) +
    ((possession / 100) * 0.2);

  const gamePace = Math.min(1, paceRaw / 40);

  let paceLevel: "low" | "medium" | "high" = "medium";

  if (gamePace > 0.65) paceLevel = "high";
  else if (gamePace < 0.35) paceLevel = "low";

  /* ===========================
     🎯 CLASSIFICAÇÃO DO JOGO
  ============================ */

  let gameType: "open" | "balanced" | "closed" | "dominant" = "balanced";

  if (goalScore > 0.65 && paceLevel === "high") {
    gameType = "open";
  }
  else if (diff > 0.9 && totalLambda >= 2.2) {
    gameType = "dominant";
  }
  else if (goalScore < 0.45 && paceLevel === "low") {
    gameType = "closed";
  }

  /* ===========================
     🏆 PESOS POR MERCADO (MULTI)
  ============================ */

  const bothStrongAttack =
    lambdaHome > 1.1 && lambdaAway > 1.1;

  const dominantSide =
    lambdaHome > lambdaAway
      ? "HOME"
      : "AWAY";

  const weights: Record<string, number> = {

    /* 🔥 OVER 1.5 (leve, não forçado) */
    "OVER 1.5":
      goalScore > 0.55
        ? 1.10
        : 1,

    /* 🔥 OVER 2.5 (mais seletivo) */
    "OVER 2.5":
      (gameType === "open" && paceLevel === "high")
        ? 1.20
        : (goalScore > 0.62 ? 1.08 : 1),

    /* 🔥 BTTS (MELHORADO) */
    "BTTS YES":
      (bothStrongAttack && paceLevel !== "low")
        ? 1.18
        : 1,

    /* 🏁 RESULTADO (MELHORADO) */
    "HOME WIN":
      (dominantSide === "HOME" && diff > 0.6)
        ? 1.18
        : 1,

    "AWAY WIN":
      (dominantSide === "AWAY" && diff > 0.6)
        ? 1.18
        : 1,

    /* 🔥 DOUBLE CHANCE (CONSISTENTE) */
    "1X":
      (dominantSide === "HOME" && diff > 0.5)
        ? 1.12
        : 1,

    "X2":
      (dominantSide === "AWAY" && diff > 0.5)
        ? 1.12
        : 1
  };

  /* ===========================
     🚫 BLOQUEIOS INTELIGENTES
  ============================ */

  const isBadOverGame =
    goalScore < 0.45 ||
    totalLambda < 2.2 ||
    paceLevel === "low";

  const isBadBTTSGame =
    lambdaHome < 0.9 ||
    lambdaAway < 0.9;

  return {
    gameType,
    paceLevel,
    gamePace,
    weights,
    isBadOverGame,
    isBadBTTSGame // 🔥 NOVO (pode usar no sniper)
  };
}