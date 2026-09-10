import {
  useState
} from "react";

import InputPanel, {
  type AnalysisPayload
} from "./ui/InputPanel";

import Dashboard from "./ui/Dashboard";
import GameAnalysisPanel from "./ui/GameAnalysisPanel";
import AiAnalystPanel from "./ui/AiAnalystPanel";
import { ErrorBoundary } from "./ui/ErrorBoundary";

import type { AnalystBriefQuantMarket } from "./domain/aiAnalyst/buildAnalystBrief";

import {
  eliteAnalyzer
} from "./application/orchestrator/eliteAnalyzer";

import {
  resetHistory
} from "./domain/tracking/trackingEngine";

import { DEFAULT_SIMULATIONS } from "./application/pipelines/simulationPipeline";
import { MODEL_VERSION } from "./domain/marketModels/goalsModel/constants";

/* ==========================================
   APP — QUANTIFY V7
========================================== */

/*
 * Responsabilidade:
 *
 * - receber os dados do InputPanel;
 * - adaptar o payload para o contrato do motor;
 * - executar o eliteAnalyzer;
 * - armazenar e exibir o resultado;
 * - permitir reset manual do histórico.
 *
 * O App não executa pipelines individualmente.
 *
 * Toda a orquestração pertence ao:
 *
 * eliteAnalyzer.ts
 */

/* ==========================================
   CONTRATOS
========================================== */

interface AppMarket {
  market?: string;

  probability?: number;
  impliedProbability?: number;

  odd?: number;
  fairOdd?: number;

  ev?: number;
  probabilityEdge?: number;
  edge?: number;

  risk?: number;
  riskScore?: number;

  confidence?: number;

  rankingScore?: number;
  score?: number;
  rank?: number;

  kelly?: number;
  stake?: number;

  classification?:
    | "SCALPER"
    | "ELITE"
    | "BET"
    | "WATCHLIST"
    | "NO BET";

  decisionValid?: boolean;
  rankingValid?: boolean;
  structureValid?: boolean;

  warnings?: string[];

  [key: string]: unknown;
}

interface AppAnalysisResult {
  match?: string;

  best?:
    AppMarket | null;

  finalBest?:
    AppMarket | null;

  markets?:
    AppMarket[];

  actionableMarkets?:
    AppMarket[];

  watchlist?:
    AppMarket[];

  discarded?:
    AppMarket[];

  elite?:
    AppMarket | null;

  scalper?:
    AppMarket | null;

  secondary?:
    AppMarket | null;

  combo?: unknown;

  noBet?: boolean;
  reason?: string;

  probabilityValid?: boolean;
  valueValid?: boolean;
  correlationValid?: boolean;
  riskValid?: boolean;
  rankingValid?: boolean;
  decisionValid?: boolean;

  warnings?: string[];

  debug?:
    Record<string, unknown>;

  [key: string]: unknown;
}

/* ==========================================
   COMPONENTE
========================================== */

function App() {
  const [
    result,
    setResult
  ] = useState<
    AppAnalysisResult | null
  >(null);

  const [
    analysisError,
    setAnalysisError
  ] = useState<
    string | null
  >(null);

  const [
    isAnalyzing,
    setIsAnalyzing
  ] = useState(false);

  /*
   * Guarda o payload da última análise (times, liga, odds) para
   * que o AiAnalystPanel possa montar o prompt sem pedir de novo
   * dados que o usuário já digitou no InputPanel.
   */
  const [
    lastPayload,
    setLastPayload
  ] = useState<AnalysisPayload | null>(null);

  /*
   * Força o Dashboard a reler o histórico (via remount, trocando
   * sua `key`) depois que o AiAnalystPanel registra uma entrada —
   * o Dashboard controla sua própria releitura internamente
   * (historyVersion) e não expõe um jeito de acioná-la de fora.
   */
  const [
    historyRefreshKey,
    setHistoryRefreshKey
  ] = useState(0);

  /* ==========================================
     EXECUÇÃO DA ANÁLISE
  ========================================== */

  async function handleAnalyze(
    data: AnalysisPayload
  ) {
    setIsAnalyzing(
      true
    );

    setAnalysisError(
      null
    );

    try {
      console.log(
        "🔥 INPUT:",
        data
      );

      setLastPayload(
        data
      );

      /*
       * O InputPanel manda estatísticas dos times E odds de mercado
       * juntas (achado real em 2026-09-08 — o usuário quer ver os
       * dois lado a lado, não como modos separados). O eliteAnalyzer
       * decide sozinho qual motor usar (ver fusedModelPipeline.ts e
       * lambdaFusion.ts, achado de 2026-09-09):
       *
       * - odds de mercado + stats dos dois times → funde os dois
       *   lambdas (mercado como base, stats como ajuste limitado);
       * - só odds de mercado → consenso de-vig puro
       *   (marketModelPipeline);
       * - só stats → Poisson-de-stats legado (modelPipeline).
       */
      const analyzerInput = {
        ...data,

        homeStats:
          data.stats.home,

        awayStats:
          data.stats.away,

        league:
          data.match.league,

        marketOdds:
          data.marketOdds,

        odds:
          data.odds as Record<string, number>,

        match:
          data.match,

        /*
         * Ativa o robustnessScore (Fase 5 do Decision
         * Intelligence Layer — ver evaluateMarket.ts). É custoso
         * demais para o backtest sintético (milhares de partidas),
         * mas irrelevante para uma análise única ao vivo como esta.
         */
        computeRobustness:
          true
      };

      /*
       * O eliteAnalyzer executa a cadeia completa:
       *
       * context
       * model
       * simulation
       * probability
       * value
       * correlation
       * risk
       * ranking
       * decision
       */
      const output =
        eliteAnalyzer(
          analyzerInput
        ) as AppAnalysisResult;

      if (
        !output ||
        typeof output !==
          "object"
      ) {
        throw new Error(
          "O eliteAnalyzer não retornou um resultado válido."
        );
      }

      console.log(
        "📊 RESULTADO FINAL:",
        output
      );

      console.log(
        "🔍 VALIDAÇÃO DOS MERCADOS:",
        Array.isArray(
          output.markets
        )
          ? output.markets.map(
              market => ({
                market:
                  market.market,

                probability:
                  market.probability,

                odd:
                  market.odd,

                ev:
                  market.ev,

                probabilityEdge:
                  market.probabilityEdge,

                risk:
                  market.risk,

                rankingScore:
                  market.rankingScore,

                classification:
                  market.classification,

                decisionValid:
                  market.decisionValid
              })
            )
          : []
      );

      setResult(
        output
      );
    } catch (
      error
    ) {
      console.error(
        "❌ Falha na análise:",
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : "Ocorreu uma falha inesperada durante a análise.";

      setAnalysisError(
        message
      );
    } finally {
      setIsAnalyzing(
        false
      );
    }
  }

  /* ==========================================
     RESET
  ========================================== */

  function handleReset() {
    const confirmed =
      window.confirm(
        "⚠️ Deseja limpar todo o histórico e as execuções?"
      );

    if (!confirmed) {
      return;
    }

    resetHistory();

    setResult(
      null
    );

    setAnalysisError(
      null
    );

    window.location.reload();
  }

  const resultMarkets:
    AppMarket[] =
    Array.isArray(
      result?.markets
    )
      ? result.markets
      : [];

  const quantSummary:
    AnalystBriefQuantMarket[] =
    resultMarkets
      .filter(market => typeof market.market === "string")
      .map(market => ({
        market: market.market as string,
        probability: market.probability,
        odd: market.odd,
        ev: market.ev,
        classification: market.classification
      }));

  /* ==========================================
     INTERFACE
  ========================================== */

  return (
    <div className="min-h-screen bg-quantify-bg">

      {/* BARRA ESTILO PLACAR DE ESTÁDIO */}

      <div className="px-5 py-2 border-b border-white/5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] tracking-wider text-zinc-500 uppercase">
        <span className="text-quantify-ice font-bold">
          Quantify Sports
        </span>

        <span className="text-zinc-700">●</span>

        <span>Match Lab</span>

        <span className="text-zinc-700">●</span>

        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-quantify-green animate-pulse" />
          Model Online
        </span>

        <span className="text-zinc-700">●</span>

        <span>
          Monte Carlo {DEFAULT_SIMULATIONS / 1000}K
        </span>

        <span className="text-zinc-700">●</span>

        <span>
          {MODEL_VERSION.replace("_", " ")}
        </span>
      </div>

      {/* RESET */}

      <div className="p-5 pb-0">
        <button
          type="button"
          onClick={
            handleReset
          }
          className="bg-red-500 hover:bg-red-400 text-white px-4 py-2 rounded-lg border-none cursor-pointer font-bold transition"
        >
          🧹 Resetar Dados
        </button>
      </div>

      {/* INPUT */}

      <InputPanel
        onAnalyze={
          handleAnalyze
        }
      />

      {/* STATUS */}

      {isAnalyzing && (
        <div className="mx-6 mb-6 rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 text-blue-300">
          ⏳ Executando o motor quantitativo completo...
        </div>
      )}

      {/* ERRO */}

      {analysisError && (
        <div className="mx-6 mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <p className="font-semibold text-red-400">
            ⚠️ Falha ao analisar a partida
          </p>

          <p className="mt-1 text-sm text-zinc-400">
            {analysisError}
          </p>
        </div>
      )}

      {/* RESULTADOS */}

  {/* DASHBOARD E HISTÓRICO — SEMPRE VISÍVEIS */}

<ErrorBoundary>
  <Dashboard
    key={historyRefreshKey}
    data={result}
  />
</ErrorBoundary>

{/* ANÁLISE DETALHADA — SOMENTE APÓS ANALISAR */}

{result && (
  <ErrorBoundary>
    <GameAnalysisPanel
      markets={resultMarkets}
    />
  </ErrorBoundary>
)}

{/* ANALISTA IA — SOMENTE APÓS ANALISAR AO MENOS UMA VEZ */}

{lastPayload && (
  <ErrorBoundary>
    <AiAnalystPanel
      match={lastPayload.match}
      odds={lastPayload.odds}
      quantSummary={quantSummary}
      onRegistered={() =>
        setHistoryRefreshKey(
          key => key + 1
        )
      }
    />
  </ErrorBoundary>
)}

    </div>
  );
}

export default App;