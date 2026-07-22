import {
  memo,
  useCallback,
  useState
} from "react";

import ComparisonPanel from "./ComparisonPanel";
import InputPanel, {
  type AnalysisPayload
} from "./InputPanel";
import Dashboard from "./Dashboard";
import GameAnalysisPanel from "./GameAnalysisPanel";

/* ==========================================
   MATCH CENTER — QUANTIFY V7
========================================== */

/*
 * Responsabilidade:
 *
 * - receber dados comparativos;
 * - encaminhá-los ao formulário principal;
 * - executar a análise quantitativa;
 * - armazenar o resultado;
 * - exibir Dashboard e GameAnalysisPanel;
 * - tratar falhas de execução sem derrubar a tela.
 *
 * Este componente não:
 *
 * - calcula probabilidades;
 * - recalcula mercados;
 * - altera o resultado do motor;
 * - escolhe entradas.
 */

/* ==========================================
   CONTRATOS
========================================== */

type NumericPayload =
  Record<string, number>;

interface AnalysisMarket {
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

interface AnalysisResult {
  match?: string;

  best?:
    AnalysisMarket | null;

  finalBest?:
    AnalysisMarket | null;

  markets?:
    AnalysisMarket[];

  actionableMarkets?:
    AnalysisMarket[];

  watchlist?:
    AnalysisMarket[];

  discarded?:
    AnalysisMarket[];

  noBet?: boolean;
  reason?: string;

  decisionValid?: boolean;
  probabilityValid?: boolean;
  valueValid?: boolean;
  riskValid?: boolean;
  rankingValid?: boolean;
  correlationValid?: boolean;

  warnings?: string[];

  debug?:
    Record<string, unknown>;

  [key: string]: unknown;
}

interface MatchCenterProps {
  runAnalysis: (
    data: AnalysisPayload
  ) =>
    AnalysisResult |
    Promise<AnalysisResult>;
}

/* ==========================================
   COMPONENTES MEMORIZADOS
========================================== */

const MemoComparisonPanel =
  memo(
    ComparisonPanel
  );

const MemoInputPanel =
  memo(
    InputPanel
  );

/* ==========================================
   COMPONENTE
========================================== */

export default function MatchCenter({
  runAnalysis
}: MatchCenterProps) {
  const [
    comparisonData,
    setComparisonData
  ] = useState<
    NumericPayload | null
  >(null);

  const [
    result,
    setResult
  ] = useState<
    AnalysisResult | null
  >(null);

  const [
    isAnalyzing,
    setIsAnalyzing
  ] = useState(false);

  const [
    analysisError,
    setAnalysisError
  ] = useState<
    string | null
  >(null);

  /* ==========================================
     CARREGAR DADOS COMPARATIVOS
  ========================================== */

  const handleLoadData =
    useCallback(
      (
        data:
          NumericPayload
      ) => {
        setComparisonData(
          data
        );

        /*
         * Ao carregar novos dados, removemos
         * erros antigos, mas preservamos o
         * último resultado até nova análise.
         */
        setAnalysisError(
          null
        );
      },
      []
    );

  /* ==========================================
     EXECUTAR ANÁLISE
  ========================================== */

const handleAnalyze =
  useCallback(
    async (
      data:
        AnalysisPayload
    ) => {
        setIsAnalyzing(
          true
        );

        setAnalysisError(
          null
        );

        try {
          const output =
            await Promise.resolve(
              runAnalysis(
                data
              )
            );

          if (
            !output ||
            typeof output !==
              "object"
          ) {
            throw new Error(
              "O motor não retornou um resultado válido."
            );
          }

          setResult(
            output
          );
        } catch (
          error
        ) {
          const message =
            getErrorMessage(
              error
            );

          console.error(
            "Falha ao executar a análise:",
            error
          );

          /*
           * Não apagamos silenciosamente o
           * resultado anterior. A interface
           * mostra o erro e preserva o último
           * resultado válido.
           */
          setAnalysisError(
            message
          );
        } finally {
          setIsAnalyzing(
            false
          );
        }
      },
      [
        runAnalysis
      ]
    );

  const resultMarkets:
    AnalysisMarket[] =
    Array.isArray(
      result?.markets
    )
      ? result.markets
      : [];

  return (
    <div className="space-y-6">

      {/* COMPARAÇÃO */}

      <MemoComparisonPanel
        onLoadData={
          handleLoadData
        }
      />

      {/* ENTRADA PRINCIPAL */}

      <MemoInputPanel
        onAnalyze={
          handleAnalyze
        }
        externalData={
          comparisonData
        }
      />

      {/* STATUS DA ANÁLISE */}

      {isAnalyzing && (
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-sm text-blue-300">
          ⏳ Executando análise quantitativa...
        </div>
      )}

      {/* ERRO CONTROLADO */}

      {analysisError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <p className="font-semibold text-red-400">
            ⚠️ Não foi possível concluir a análise
          </p>

          <p className="mt-1 text-sm text-zinc-400">
            {analysisError}
          </p>
        </div>
      )}

      {/* RESULTADOS */}

      {result && (
        <>
          <Dashboard
            data={
              result
            }
          />

          <GameAnalysisPanel
            markets={
              resultMarkets
            }
          />
        </>
      )}

    </div>
  );
}

/* ==========================================
   HELPERS
========================================== */

function getErrorMessage(
  error: unknown
): string {
  if (
    error instanceof Error &&
    error.message
  ) {
    return error.message;
  }

  if (
    typeof error ===
      "string" &&
    error.trim()
  ) {
    return error;
  }

  return (
    "Ocorreu uma falha inesperada durante a análise."
  );
}