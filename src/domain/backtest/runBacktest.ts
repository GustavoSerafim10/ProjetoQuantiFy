import { generateHistoricalMatches } from "../simulation/matchGenerator";

import { modelPipeline } from "../../application/pipelines/modelPipeline";
import { simulationPipeline } from "../../application/pipelines/simulationPipeline";
import { correlationPipeline } from "../../application/pipelines/correlationPipeline";
import { decisionPipeline } from "../../application/pipelines/decisionPipeline";

import { generateStatReport } from "./statReport";

import { classifyMarket } from "../../domain/utils/marketClassifier";
import { calculateStakePro } from "../../domain/risk/kelly";

/* ===============================
   🧠 RESULT ENGINE
=============================== */
function resolveBet(
  market: string,
  match: any
) {
  const home = match.result.homeGoals || 0;
  const away = match.result.awayGoals || 0;
  const total = home + away;

  const m = market.toLowerCase();

  if (m.includes("over 2.5")) return total > 2.5;
  if (m.includes("over 1.5")) return total > 1.5;

  if (m.includes("btts")) return home > 0 && away > 0;

  if (m.includes("home")) return home > away;
  if (m.includes("away")) return away > home;
  if (m.includes("draw")) return home === away;

  if (m.includes("1x")) return home >= away;
  if (m.includes("x2")) return away >= home;

  return false;
}

/* ===============================
   BACKTEST
=============================== */
export function runBacktest(
  simulations: number = 1000,
  initialBankroll: number = 1000
) {
  let bankroll = initialBankroll;
  let peakBankroll = initialBankroll;
  let maxDrawdown = 0;

  let totalBets = 0;
  let wins = 0;
  let losses = 0;

  let totalStaked = 0;
  let totalProfit = 0;

  const bankrollHistory: number[] = [];
  const betHistory: any[] = [];

  const matches =
    generateHistoricalMatches(simulations);

  for (const match of matches) {
    /* ===========================
       1️⃣ MODEL
    ============================ */
    const model = modelPipeline(match);

    /* ===========================
       2️⃣ MONTE CARLO
    ============================ */
    const simulated =
      simulationPipeline(model);

    /* ===========================
       3️⃣ CORRELATION
    ============================ */
    const correlated =
      correlationPipeline({
        ...simulated,
        markets: []
      });

    /* ===========================
       4️⃣ DECISION
    ============================ */
    const decision =
      decisionPipeline({
        ...correlated,
        odds: match.odds,
        match: `Match_${Math.random()
          .toString(36)
          .slice(2, 6)}`
      });

    const best = decision?.best;

    /* ===========================
       FILTRO
    ============================ */
    if (!best) {
      bankrollHistory.push(bankroll);
      continue;
    }

    /*
    // EXTRA SAFETY FILTERS (OPCIONAL)
    if (best.ev < 0.05) continue;
    if (best.odd < 1.4 || best.odd > 3.5) continue;
    */

    /* ===========================
       STAKE
    ============================ */
    const stake =
      bankroll * calculateStakePro(best);

    if (stake <= 0) {
      bankrollHistory.push(bankroll);
      continue;
    }

    totalBets++;
    totalStaked += stake;

    /* ===========================
       RESULTADO REAL
    ============================ */
    const win =
      resolveBet(best.market, match);

    let profit = 0;

    if (win) {
      profit =
        stake * (best.odd - 1);

      bankroll += profit;
      totalProfit += profit;
      wins++;
    } else {
      profit = -stake;

      bankroll -= stake;
      totalProfit += stake * -1;
      losses++;
    }

    /* ===========================
       HISTÓRICO
    ============================ */
betHistory.push({
  market: best.market,

  marketType: classifyMarket(best.market),

  classification: best.classification,

  prob: best.probability,
  odd: best.odd,
  ev: best.ev,
  risk: best.risk,

  stake,
  result: win ? "win" : "loss",
  profit
});

    /* ===========================
       DRAWDOWN
    ============================ */
    if (bankroll > peakBankroll) {
      peakBankroll = bankroll;
    }

    const drawdown =
      (peakBankroll - bankroll) /
      peakBankroll;

    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }

    bankrollHistory.push(bankroll);
  }

  const roi =
    totalStaked > 0
      ? totalProfit / totalStaked
      : 0;

  const statReport =
    generateStatReport(betHistory);

  return {
    totalBets,
    wins,
    losses,

    totalStaked,
    totalProfit,

    roi,
    maxDrawdown,

    statReport,
    bankrollHistory
  };
}