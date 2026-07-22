import {
  useState
} from "react";

import InputPanel, {
  type AnalysisPayload
} from "./ui/InputPanel";

import Dashboard from "./ui/Dashboard";
import GameAnalysisPanel from "./ui/GameAnalysisPanel";

import {
  eliteAnalyzer
} from "./application/orchestrator/eliteAnalyzer";

import {
  resetHistory
} from "./domain/tracking/trackingEngine";

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

      /*
       * O InputPanel produz:
       *
       * data.stats.home
       * data.stats.away
       *
       * Os pipelines internos utilizam:
       *
       * homeStats
       * awayStats
       *
       * Portanto, fazemos apenas a adaptação
       * estrutural antes do eliteAnalyzer.
       */
      const analyzerInput = {
        ...data,

        homeStats:
          data.stats.home,

        awayStats:
          data.stats.away,

        league:
          data.match.league,

        odds:
          data.odds,

        match:
          data.match
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

  /* ==========================================
     INTERFACE
  ========================================== */

  return (
    <div className="min-h-screen bg-[#050816]">

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

<Dashboard
  data={result}
/>

{/* ANÁLISE DETALHADA — SOMENTE APÓS ANALISAR */}

{result && (
  <GameAnalysisPanel
    markets={resultMarkets}
  />
)}

    </div>
  );
}

export default App;