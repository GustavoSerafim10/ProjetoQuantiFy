import { getStructureInsights } from "../learning/structureLearning";

export function validateStructure(m: any, context: any) {

  const reasons: string[] = [];
  let score = 0.5; // 🔥 BASE NEUTRA

  const insights = getStructureInsights();

  const home = context?.stats?.home || {};
  const away = context?.stats?.away || {};

  const lambdaHome = context?.lambdaHome ?? 1.2;
  const lambdaAway = context?.lambdaAway ?? 1.0;

  const totalLambda = lambdaHome + lambdaAway;

  /* ===========================
     🎯 GAME TYPE
  ============================ */

  let gameType: "open" | "balanced" | "closed" = "balanced";

  if (totalLambda >= 2.8) gameType = "open";
  else if (totalLambda <= 2.2) gameType = "closed";

  /* ===========================
     🧠 LEARNING BIAS
  ============================ */

  const overStrict = insights.overBias < 0.52;
  const bttsStrict = insights.bttsBias < 0.52;

  /* ===========================
     🧤 CLEAN SHEET
  ============================ */

  const homeCS = home.cleanSheet ?? 0;
  const awayCS = away.cleanSheet ?? 0;

  const defensiveGame =
    homeCS > 0.4 && awayCS > 0.4;

  /* ===========================
     ⚡ PRESSÃO
  ============================ */

  const totalPressure =
    (home.pressure ?? 0) +
    (away.pressure ?? 0);

  const lowPressure =
    totalPressure < (overStrict ? 22 : 18);

  /* ===========================
     ⚖️ EQUILÍBRIO
  ============================ */

  const balanced =
    Math.abs((home.goalsFor ?? 0) - (away.goalsFor ?? 0)) < 1.2;

  /* ===========================
     🔥 OVER
  ============================ */

  if (m.market.includes("Over")) {

    if (gameType === "open") score += 0.15;
    if (gameType === "closed") {
      score -= 0.2;
      reasons.push("Jogo fechado");
    }

    if (defensiveGame) {
      score -= 0.15;
      reasons.push("Defesas fortes");
    }

    if (lowPressure) {
      score -= 0.15;
      reasons.push("Pressão insuficiente");
    } else {
      score += 0.1;
    }

    if (overStrict && m.probability < 0.65) {
      score -= 0.1;
      reasons.push("Over em fase ruim (learning)");
    }
  }

  /* ===========================
     🔥 BTTS
  ============================ */

  if (m.market === "BTTS Yes") {

    if (balanced) score += 0.1;
    else {
      score -= 0.15;
      reasons.push("Desequilíbrio");
    }

    if (homeCS > 0.4 || awayCS > 0.4) {
      score -= 0.15;
      reasons.push("Clean sheet alto");
    }

    if (gameType === "closed") {
      score -= 0.2;
      reasons.push("Jogo fechado");
    }

    if (bttsStrict && m.probability < 0.65) {
      score -= 0.1;
      reasons.push("BTTS em fase ruim");
    }
  }

  /* ===========================
     🏁 RESULTADO
  ============================ */

  if (
    m.market === "Home Win" ||
    m.market === "Away Win"
  ) {

    if (!balanced) score += 0.1;
    else {
      score -= 0.15;
      reasons.push("Sem dominância");
    }

    if (gameType === "open") {
      score -= 0.1;
      reasons.push("Alta variância");
    }
  }

  /* ===========================
     🧊 MERCADOS FRÁGEIS
  ============================ */

  if (
    m.market === "Correct Score" ||
    m.market === "HT Score"
  ) {
    score -= 0.3;
    reasons.push("Alta variância");
  }

  /* ===========================
     🔒 NORMALIZAÇÃO
  ============================ */

  score = Math.max(0, Math.min(1, score));

  /* ===========================
     🧠 NOVA LÓGICA DE VALIDADE
  ============================ */

  const valid = score >= 0.45; // 🔥 NÃO É MAIS BINÁRIO RÍGIDO

  return {
    valid,
    score, // 🔥 NOVO (CRÍTICO)
    reasons,
    meta: {
      gameType,
      defensiveGame,
      pressure: totalPressure,
      learning: insights
    }
  };
}