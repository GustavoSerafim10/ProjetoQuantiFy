import type { RiskPipelineDebug } from "./types";

export * from "./types";

import {
  parsePositiveNumber,
  parseProbability,
  roundNumber,
  roundNullableNumber
} from "./helpers";

import {
  extractLeagueAverageGoals,
  extractRecentGoalStd,
  extractSeasonGoalAverage,
  extractDataQualityScore
} from "./averages";

import {
  extractGlobalSamplingError,
  extractGlobalModelSimulationDivergence,
  extractMonteCarloMetadata
} from "./uncertaintyExtraction";

import { calculateMarketRisk } from "./marketRisk";

import { createInvalidPipelineResult } from "./invalidResults";

/* ==========================================
   RISK PIPELINE — QUANTIFY V7.2 ELITE
========================================== */

/*
 * Responsabilidade:
 *
 * - receber mercados já precificados;
 * - chamar o risco-base estatístico oficial;
 * - identificar fragilidades específicas
 *   de cada mercado;
 * - medir divergência modelo x mercado;
 * - incorporar erro de amostragem;
 * - incorporar divergência modelo x simulação;
 * - incorporar correlationNet uma única vez;
 * - produzir risk e riskScore finais;
 * - registrar todos os componentes.
 *
 * Este arquivo não:
 *
 * - recalcula probabilidades;
 * - altera EV;
 * - altera odds;
 * - altera confiança;
 * - seleciona mercados;
 * - classifica entradas;
 * - toma a decisão final;
 * - reduz risco porque o lambda favorece
 *   determinado mercado.
 */

/* ==========================================
   PIPELINE
========================================== */

export function riskPipeline(
  data: any
) {
  const inputMarkets =
    Array.isArray(
      data?.markets
    )
      ? data.markets
      : [];

  const lambdaHome =
    parsePositiveNumber(
      data?.lambdaHome
    );

  const lambdaAway =
    parsePositiveNumber(
      data?.lambdaAway
    );

  /*
   * Os lambdas oficiais são obrigatórios.
   *
   * Não utilizamos fallbacks artificiais como:
   *
   * lambdaHome = 1.20
   * lambdaAway = 1.00
   */
  if (
    lambdaHome === null ||
    lambdaAway === null
  ) {
    return createInvalidPipelineResult({
      data,
      inputMarkets,
      lambdaHome,
      lambdaAway,
      error:
        "INVALID_PIPELINE_LAMBDAS"
    });
  }

  const totalLambda =
    lambdaHome +
    lambdaAway;

  const lambdaDifference =
    Math.abs(
      lambdaHome -
      lambdaAway
    );

  const minimumLambda =
    Math.min(
      lambdaHome,
      lambdaAway
    );

  /*
   * Todos os campos abaixo devem representar
   * o total de gols por partida.
   *
   * Nenhum deles recebe totalLambda / 2 como
   * fallback.
   */
  const leagueAvgGoals =
    extractLeagueAverageGoals(
      data
    );

  const recentGoalStd =
    extractRecentGoalStd(
      data
    );

  const seasonGoalAvg =
    extractSeasonGoalAverage(
      data
    );

  const dataQualityResolution =
    extractDataQualityScore(
      data
    );

  const dataQualityScore =
    dataQualityResolution.value;

  /*
   * Deve ser o score oficial produzido pelo
   * modelPipeline.
   */
  const goalExpectationScore =
    parseProbability(
      data?.goalExpectationScore
    );

  /*
   * Valores globais são somente fallback.
   * Cada mercado prioriza erro e divergência
   * específicos da Simulation Pipeline V7.1.
   */
  const globalSamplingError =
    extractGlobalSamplingError(
      data
    );

  const globalModelSimulationDivergence =
    extractGlobalModelSimulationDivergence(
      data
    );

  const monteCarloMetadata =
    extractMonteCarloMetadata(
      data
    );

  let invalidMarkets =
    0;

  const markets =
    inputMarkets.map(
      (market: any) => {
        const result =
          calculateMarketRisk({
            market,

            data,

            lambdaHome,
            lambdaAway,

            totalLambda,
            lambdaDifference,
            minimumLambda,

            leagueAvgGoals,
            recentGoalStd,
            seasonGoalAvg,
            dataQualityScore,
            dataQualitySource:
              dataQualityResolution.source,

            goalExpectationScore,

            globalSamplingError,

            globalModelSimulationDivergence,

            monteCarloMetadata
          });

        if (!result.valid) {
          invalidMarkets++;
        }

        return result.market;
      }
    );

  const validMarkets =
    markets.length -
    invalidMarkets;

  const pipelineValid =
    inputMarkets.length > 0 &&
    validMarkets > 0;

  const debug:
    RiskPipelineDebug = {
      valid:
        pipelineValid,

      version:
        "V7.2_ELITE",

      inputMarkets:
        inputMarkets.length,

      outputMarkets:
        markets.length,

      validMarkets,

      invalidMarkets,

      lambdaHome:
        roundNumber(
          lambdaHome
        ),

      lambdaAway:
        roundNumber(
          lambdaAway
        ),

      totalLambda:
        roundNumber(
          totalLambda
        ),

      lambdaDifference:
        roundNumber(
          lambdaDifference
        ),

      leagueAvgGoals:
        roundNullableNumber(
          leagueAvgGoals
        ),

      recentGoalStd:
        roundNullableNumber(
          recentGoalStd
        ),

      seasonGoalAvg:
        roundNullableNumber(
          seasonGoalAvg
        ),

      dataQualityScore:
        roundNullableNumber(
          dataQualityScore
        ),

      dataQualitySource:
        dataQualityResolution.source,

      samplingError:
        roundNullableNumber(
          globalSamplingError.value
        ),

      samplingErrorSource:
        globalSamplingError.source,

      modelSimulationDivergence:
        roundNullableNumber(
          globalModelSimulationDivergence.value
        ),

      divergenceSource:
        globalModelSimulationDivergence.source,

      monteCarloValid:
        monteCarloMetadata.valid,

      monteCarloConverged:
        monteCarloMetadata.converged,

      simulationQuality:
        monteCarloMetadata.simulationQuality,

      ...(
        pipelineValid
          ? {}
          : {
              error:
                inputMarkets.length === 0
                  ? "NO_INPUT_MARKETS"
                  : "NO_VALID_RISK_MARKETS"
            }
      ),

      note:
        "Risk is consolidated once from statistical base risk, market fragility, uncertainty, market disagreement and correlation."
    };

  return {
    ...data,

    riskValid:
      pipelineValid,

    markets,

    debug: {
      ...(data?.debug ?? {}),

      riskPipeline:
        debug
    }
  };
}
