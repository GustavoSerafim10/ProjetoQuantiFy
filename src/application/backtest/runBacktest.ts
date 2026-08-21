import { generateHistoricalMatches } from "../../domain/simulation/matchGenerator";

import { modelPipeline } from "../pipelines/modelPipeline";
import { simulationPipeline } from "../pipelines/simulationPipeline";
import { probabilityPipeline } from "../pipelines/probabilityPipeline";
import { valuePipeline } from "../pipelines/valuePipeline";
import { correlationPipeline } from "../pipelines/correlationPipeline";
import { riskPipeline } from "../pipelines/riskPipeline";
import { confidencePipeline } from "../pipelines/confidencePipeline";
import { rankingPipeline } from "../pipelines/rankingPipeline";
import { decisionPipeline } from "../pipelines/decisionPipeline";

import { generateStatReport } from "./statReport";

import { classifyMarket } from "../../domain/utils/marketClassifier";
import { calculateStakePro } from "../../domain/risk/kelly";

import type { MarketCode } from "../../shared/types/marketCode";
import type { MarketPolicyOverrides } from "../pipelines/decisionPipeline";

/* ===============================
   🧠 RESULT ENGINE
=============================== */
export function resolveBet(
  market: MarketCode | string,
  match: {
    result: {
      homeGoals: number;
      awayGoals: number;
    };
  }
) {
  const home = match.result.homeGoals || 0;
  const away = match.result.awayGoals || 0;
  const total = home + away;

  switch (market) {
    case "HOME": return home > away;
    case "AWAY": return away > home;
    case "DRAW": return home === away;

    case "DOUBLE_CHANCE_1X": return home >= away;
    case "DOUBLE_CHANCE_X2": return away >= home;

    case "OVER_1_5": return total > 1.5;
    case "OVER_2_5": return total > 2.5;
    case "UNDER_2_5": return total < 2.5;

    case "BTTS_YES": return home > 0 && away > 0;
    case "BTTS_NO": return !(home > 0 && away > 0);

    default: return false;
  }
}

/* ===============================
   BACKTEST
=============================== */
export interface RunBacktestOptions {
  /*
   * Controla apenas o comparador diagnóstico interno do
   * simulationPipeline (campo `monteCarlo`), que não é lido por
   * correlationPipeline/decisionPipeline nesta cadeia — só por
   * riskPipeline/confidencePipeline, que não são chamados aqui. Por
   * isso pode ficar bem menor que os 50.000 usados na análise ao
   * vivo sem alterar nenhum resultado de aposta do backtest.
   */
  monteCarloSimulations?: number;

  /* Somado ao EV mínimo dinâmico (getDynamicMinimumEv) por mercado. */
  evFloor?: number;

  /* Teto de stake (fração da banca) repassado ao calculateStakePro. */
  stakeCap?: number;

  /*
   * Sobrescreve, por mercado, os thresholds de MARKET_POLICIES
   * (ex.: minimumProbability por nível) — usado para calibração.
   * Sem isso, o backtest usa exatamente a política de produção.
   */
  marketPolicyOverrides?: MarketPolicyOverrides;
}

export function runBacktest(
  simulations: number = 1000,
  initialBankroll: number = 1000,
  options: RunBacktestOptions = {}
) {
  const monteCarloSimulations =
    options.monteCarloSimulations ?? 500;
  const evFloor = options.evFloor ?? 0;
  const stakeCap = options.stakeCap;
  const marketPolicyOverrides = options.marketPolicyOverrides;
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
      simulationPipeline(model, monteCarloSimulations);

    /* ===========================
       3️⃣ PROBABILIDADES OFICIAIS
    ============================ */
    const probabilities =
      probabilityPipeline(simulated);

    /* ===========================
       4️⃣ VALOR ECONÔMICO
       (aqui nasce o array `markets`
       com probability/odd/ev por mercado)
    ============================ */
    const valued =
      valuePipeline(
        probabilities,
        match.odds
      );

    /* ===========================
       5️⃣ CORRELAÇÃO
    ============================ */
    const correlated =
      correlationPipeline(valued);

    /* ===========================
       6️⃣ RISCO
    ============================ */
    const risked =
      riskPipeline(correlated);

    /* ===========================
       7️⃣ CONFIANÇA
    ============================ */
    const confident =
      confidencePipeline(risked);

    /* ===========================
       8️⃣ RANKING
    ============================ */
    const ranked =
      rankingPipeline(confident);

    /* ===========================
       9️⃣ DECISÃO
    ============================ */
    const decision =
      decisionPipeline({
        ...ranked,
        evFloor,
        marketPolicyOverrides,
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
      bankroll *
      calculateStakePro(best, { stakeCap });

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