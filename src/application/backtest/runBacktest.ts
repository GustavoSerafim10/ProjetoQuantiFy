import seedrandom from "seedrandom";

import {
  generateHistoricalMatches,
  resetMatchGeneratorSeed
} from "../../domain/simulation/matchGenerator";

import { modelPipeline } from "../pipelines/modelPipeline";
import { simulationPipeline } from "../pipelines/simulationPipeline";
import { probabilityPipeline } from "../pipelines/probabilityPipeline";
import { valuePipeline } from "../pipelines/valuePipeline";
import { correlationPipeline } from "../pipelines/correlationPipeline";
import { riskPipeline } from "../pipelines/riskPipeline";
import { confidencePipeline } from "../pipelines/confidencePipeline";
import { rankingPipeline } from "../pipelines/rankingPipeline";
import { decisionPipeline } from "../pipelines/decisionPipeline";

import { generateStatReport, type BetRecord } from "./statReport";

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
   * NOTA (2026-08-22): este comentário estava errado — dizia que
   * confidencePipeline "não é chamado aqui", mas é (linha do loop
   * abaixo). confidencePipeline lê `monteCarlo.probabilities` e
   * penaliza `confidence` quando a simulação diverge do modelo
   * analítico; `confidence` decide classificação (BET/ELITE/...).
   * Antes da correção abaixo, isso tornava o backtest inteiro
   * não-determinístico: o mesmo threshold rodado duas vezes podia
   * dar contagens de aposta e ROI diferentes, porque monteCarloPoisson
   * usa Math.random() sem seed por padrão. runBacktest() agora passa
   * um RNG seedado (ver `monteCarloRandom` abaixo), então o valor
   * aqui pode continuar bem menor que os 50.000 da análise ao vivo
   * sem introduzir ruído — a diferença passa a ser só velocidade,
   * não mais reprodutibilidade.
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
  const betHistory: BetRecord[] = [];

  /*
   * Reproducibilidade: sem isso, chamadas sucessivas de
   * runBacktest() no mesmo processo (ex.: comparar dois
   * thresholds, ou os multiplos it() de um sweep) avancam o
   * RNG compartilhado do matchGenerator e cada uma acaba
   * comparando um lote DIFERENTE de partidas sinteticas -
   * invalidando a comparacao. resetMatchGeneratorSeed() garante
   * que toda chamada comeca do mesmo ponto da sequencia.
   */
  resetMatchGeneratorSeed();

  const matches =
    generateHistoricalMatches(simulations);

  /*
   * Idem para a simulacao Monte Carlo: monteCarloPoisson usa
   * Math.random() por padrao (nao seedado), e confidencePipeline
   * usa a divergencia entre a probabilidade analitica e a da
   * simulacao para penalizar confidence - que por sua vez decide
   * classificacao (BET/ELITE/...). Sem seed, o mesmo threshold
   * podia gerar contagens de aposta e ROI diferentes a cada
   * execucao. Um gerador seedado, criado uma vez por chamada de
   * runBacktest() e reutilizado em sequencia por todas as
   * partidas, torna o resultado inteiro deterministico.
   */
  const monteCarloRandom =
    seedrandom("quantify-backtest-montecarlo-v1");

  for (const [matchIndex, match] of matches.entries()) {
    /* ===========================
       1️⃣ MODEL
    ============================ */
    const model = modelPipeline(match);

    /* ===========================
       2️⃣ MONTE CARLO
    ============================ */
    const simulated =
      simulationPipeline(
        model,
        monteCarloSimulations,
        monteCarloRandom
      );

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
        match: `Match_${matchIndex}`
      });

    const best = decision?.best;

    /* ===========================
       FILTRO
    ============================ */
    if (
      !best ||
      best.market === undefined ||
      best.odd === undefined
    ) {
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

  probability: best.probability,
  odd: best.odd,
  ev: best.ev,

  stake,
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