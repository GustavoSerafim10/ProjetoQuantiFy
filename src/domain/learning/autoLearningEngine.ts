import { getHistory } from "./learningStore";

/* ===============================
   AUTO LEARNING ENGINE (ELITE)
=============================== */

export function autoLearningEngine() {

  const history = getHistory();

  if (history.length < 30) {
    return {
      ready: false
    };
  }

  /* ===========================
     📊 BASE
  ============================ */

  const total = history.length;

  let wins = 0;
  let totalProfit = 0;
  let totalStake = 0;

  const marketMap: Record<string, number> = {};

  for (const h of history) {

    if (h.result === "win") wins++;

    totalProfit += h.profit || 0;
    totalStake += h.stake || 0;

    if (!marketMap[h.market]) {
      marketMap[h.market] = 0;
    }

    marketMap[h.market] += h.profit || 0;
  }

  const winRate = wins / total;
  const roi = totalStake > 0 ? totalProfit / totalStake : 0;

  /* ===========================
     🔥 PROB CALIBRATION
  ============================ */

  let probBias = 0;

  if (roi < 0) probBias = -0.03;
  else if (roi > 0.10) probBias = 0.01;

  /* ===========================
     🔥 RHO AJUSTE
  ============================ */

  let rhoShift = 0;

  if (winRate < 0.45) rhoShift -= 0.02;
  if (winRate > 0.60) rhoShift += 0.01;

  /* ===========================
     🔥 MARKET BOOST
  ============================ */

  const marketBoost: Record<string, number> = {};

  for (const market in marketMap) {

    const profit = marketMap[market];

    if (profit > 0) {
      marketBoost[market] = 1 + Math.min(0.10, profit / 100);
    } else {
      marketBoost[market] = 0.95; // penaliza
    }
  }

  /* ===========================
     🏁 OUTPUT
  ============================ */

  return {
    ready: true,

    probBias,
    rhoShift,
    marketBoost,

    metrics: {
      winRate,
      roi
    }
  };
}