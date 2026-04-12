import { getHistory, getDrawdown } from "./trackingEngine";
import type { Bet } from "./trackingEngine";

/* ===========================
   🔥 CALIBRATION ENGINE (EMBUTIDO)
=========================== */

function calibrationReport(history: Bet[]) {

  const buckets = [
    { min: 0.50, max: 0.60, label: "50-60%" },
    { min: 0.60, max: 0.70, label: "60-70%" },
    { min: 0.70, max: 0.80, label: "70-80%" },
    { min: 0.80, max: 1.00, label: "80%+" }
  ];

  const result: any = {};

  for (const bucket of buckets) {

    const bets = history.filter(b =>
      b.probability >= bucket.min &&
      b.probability < bucket.max &&
      b.result
    );

    if (bets.length === 0) {
      result[bucket.label] = {
        bets: 0,
        expected: 0,
        actual: 0,
        diff: 0
      };
      continue;
    }

    const wins = bets.filter(b => b.result === "win").length;

    const avgProb =
      bets.reduce((acc, b) => acc + b.probability, 0) / bets.length;

    const actualWinRate = wins / bets.length;

    result[bucket.label] = {
      bets: bets.length,
      expected: avgProb,
      actual: actualWinRate,
      diff: actualWinRate - avgProb
    };
  }

  return result;
}

/* ===========================
   🚀 MAIN REPORT
=========================== */

export function generatePerformanceReport() {

  const history = getHistory().filter(b => b.result) as Bet[];

  if (history.length === 0) {
    return { message: "Sem dados ainda" };
  }

  /* ===========================
     📊 GERAL
  ============================ */

  const totalBets = history.length;

  const wins = history.filter(b => b.result === "win").length;
  const losses = history.filter(b => b.result === "loss").length;

  const totalProfit = history.reduce((acc, b) => acc + (b.profit || 0), 0);
  const totalStake = history.reduce((acc, b) => acc + b.stake, 0);

  const roi = totalStake ? totalProfit / totalStake : 0;
  const winRate = totalBets ? wins / totalBets : 0;

  const avgProfit = totalBets ? totalProfit / totalBets : 0;

  /* ===========================
     📊 PROFIT FACTOR
  ============================ */

  const grossWin = history
    .filter(b => b.profit! > 0)
    .reduce((acc, b) => acc + (b.profit || 0), 0);

  const grossLoss = Math.abs(
    history
      .filter(b => b.profit! < 0)
      .reduce((acc, b) => acc + (b.profit || 0), 0)
  );

  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : 0;

  /* ===========================
     📉 DRAWDOWN
  ============================ */

  const drawdown = getDrawdown();

  /* ===========================
     📊 POR MERCADO
  ============================ */

  const marketMap: Record<string, Bet[]> = {};

  for (const b of history) {
    if (!marketMap[b.market]) {
      marketMap[b.market] = [];
    }
    marketMap[b.market].push(b);
  }

  const marketStats = Object.entries(marketMap).map(([market, bets]) => {

    const total = bets.length;
    const wins = bets.filter(b => b.result === "win").length;

    const profit = bets.reduce((acc, b) => acc + (b.profit || 0), 0);
    const stake = bets.reduce((acc, b) => acc + b.stake, 0);

    return {
      market,
      bets: total,
      winRate: total ? wins / total : 0,
      roi: stake ? profit / stake : 0,
      profit
    };
  });

  /* ===========================
     📊 POR ODDS
  ============================ */

  const oddsBuckets = {
    low: [] as Bet[],
    mid: [] as Bet[],
    high: [] as Bet[]
  };

  for (const b of history) {
    if (b.odd < 1.8) oddsBuckets.low.push(b);
    else if (b.odd < 2.5) oddsBuckets.mid.push(b);
    else oddsBuckets.high.push(b);
  }

  function analyzeBucket(list: Bet[]) {
    if (list.length === 0) return null;

    const profit = list.reduce((acc, b) => acc + (b.profit || 0), 0);
    const wins = list.filter(b => b.result === "win").length;
    const stake = list.reduce((acc, b) => acc + b.stake, 0);

    return {
      bets: list.length,
      winRate: list.length ? wins / list.length : 0,
      roi: stake ? profit / stake : 0,
      profit
    };
  }

  /* ===========================
     📊 EV vs REAL
  ============================ */

  const avgEV =
    history.reduce((acc, b) => acc + b.ev, 0) / totalBets;

  const realROI = roi;

  /* ===========================
     📊 STREAK
  ============================ */

  let streak = 0;
  let maxWinStreak = 0;
  let maxLossStreak = 0;

  for (const b of history) {
    if (b.result === "win") {
      streak = streak >= 0 ? streak + 1 : 1;
      maxWinStreak = Math.max(maxWinStreak, streak);
    } else {
      streak = streak <= 0 ? streak - 1 : -1;
      maxLossStreak = Math.min(maxLossStreak, streak);
    }
  }

  /* ===========================
     🔥 CALIBRATION (AQUI É O OURO)
  ============================ */

  const calibration = calibrationReport(history);

  /* ===========================
     🧠 DIAGNÓSTICO
  ============================ */

  const diagnosis: string[] = [];

  if (realROI > 0.10) {
    diagnosis.push("🔥 Modelo altamente lucrativo");
  } else if (realROI > 0) {
    diagnosis.push("🟢 Modelo positivo");
  } else {
    diagnosis.push("🔴 Modelo negativo — revisar estrutura");
  }

  if (profitFactor < 1) {
    diagnosis.push("⚠️ Profit Factor ruim");
  }

  if (drawdown > 0.25) {
    diagnosis.push("⚠️ Drawdown alto");
  }

  if (avgEV > 0.05 && realROI < 0) {
    diagnosis.push("⚠️ EV alto mas ROI negativo");
  }

  if (winRate < 0.45) {
    diagnosis.push("⚠️ WinRate baixo");
  }

  /* ===========================
     🏁 OUTPUT FINAL
  ============================ */

  return {
    geral: {
      totalBets,
      wins,
      losses,
      winRate,
      totalProfit,
      totalStake,
      roi,
      avgProfit,
      profitFactor,
      drawdown
    },

    mercados: marketStats,

    odds: {
      low: analyzeBucket(oddsBuckets.low),
      mid: analyzeBucket(oddsBuckets.mid),
      high: analyzeBucket(oddsBuckets.high)
    },

    evAnalysis: {
      avgEV,
      realROI
    },

    streaks: {
      maxWinStreak,
      maxLossStreak: Math.abs(maxLossStreak)
    },

    calibration, // 🔥 NOVO

    diagnosis
  };
}