import type {
  EvaluatedDecisionMarket,
  DecisionPipelineDebug
} from "./types";

import { normalizeWarnings } from "./helpers";

import { GLOBAL_POLICY } from "./marketPolicies";

import { buildDecisionContextMetrics } from "./context";

import { evaluateMarket } from "./evaluateMarket";

import { compareDecisionMarkets } from "./ranking";

import { safeBuildCombo } from "./combo";

import { createNoBetResult } from "./noBet";

import type { PipelineRecord } from "../pipelineRecord";

export * from "./types";

export type {
  MarketPolicyOverrides,
  DecisionMarketPolicyOverride
} from "./marketPolicies";

/* ==========================================
   DECISION PIPELINE — QUANTIFY V7.2 ELITE
========================================== */

/*
 * Responsabilidade:
 *
 * - receber mercados já calculados;
 * - validar os resultados dos pipelines anteriores;
 * - aplicar critérios operacionais por mercado;
 * - receber sampleReliability, leagueTrust,
 *   globalConfidence e expectativa contextual;
 * - classificar candidatos;
 * - selecionar a melhor entrada;
 * - produzir NO BET quando necessário;
 * - preparar watchlist, descartados e combo.
 *
 * Este arquivo não:
 *
 * - recalcula probabilidades;
 * - recalibra probabilidades;
 * - executa Monte Carlo;
 * - recalcula EV;
 * - recalcula risco;
 * - altera confidence;
 * - refaz ranking;
 * - registra apostas automaticamente.
 */

/* ==========================================
   PIPELINE
========================================== */

export function decisionPipeline(
  data: PipelineRecord
) {
  const inputMarkets: PipelineRecord[] =
    Array.isArray(data?.markets)
      ? data.markets
      : [];

  const gameWarnings =
    normalizeWarnings(
      data?.warnings
    );

  const upstream = {
    probabilityValid:
      data?.probabilityValid !== false,

    valueValid:
      data?.valueValid !== false,

    riskValid:
      data?.riskValid !== false,

    confidenceValid:
      data?.confidenceValid !== false,

    rankingValid:
      data?.rankingValid !== false,

    correlationValid:
      data?.correlationValid !== false
  };

  /*
   * Bloqueios estruturais da partida devem
   * prevalecer sobre qualquer mercado.
   */
  if (data?.blocked === true) {
    const blockReason =
      String(
        data?.blockReason ??
        "GAME_FILTER_BLOCKED"
      );

    return createNoBetResult({
      data,
      inputMarkets,

      gameWarnings:
        normalizeWarnings([
          ...gameWarnings,
          blockReason
        ]),

      upstream,

      reason:
        blockReason
    });
  }

  if (inputMarkets.length === 0) {
    return createNoBetResult({
      data,
      inputMarkets,
      gameWarnings,
      upstream,

      reason:
        "NO_MARKETS_AVAILABLE"
    });
  }

  /*
   * Os pipelines matemáticos fundamentais
   * precisam estar válidos.
   *
   * correlationValid pode ser false sem invalidar
   * automaticamente a análise, mas isso gera warning.
   */
  if (
    !upstream.probabilityValid ||
    !upstream.valueValid ||
    !upstream.riskValid ||
    !upstream.confidenceValid ||
    !upstream.rankingValid
  ) {
    return createNoBetResult({
      data,
      inputMarkets,

      gameWarnings:
        normalizeWarnings([
          ...gameWarnings,
          "INVALID_UPSTREAM_PIPELINE"
        ]),

      upstream,

      reason:
        "INVALID_UPSTREAM_PIPELINE"
    });
  }

const decisionContext =
  buildDecisionContextMetrics(
    data
  );

const evaluatedMarkets:
  EvaluatedDecisionMarket[] =
  inputMarkets.map(
    (
      market: PipelineRecord,
      index: number
    ) =>
      evaluateMarket(
        market,
        index,
        data,
        decisionContext
      )
  );

  /*
   * O ranking anterior é preservado.
   *
   * A ordenação abaixo serve apenas para garantir
   * estabilidade caso o array chegue fora de ordem.
   */
  const sortedMarkets =
    [...evaluatedMarkets].sort(
      compareDecisionMarkets
    );

  const actionableMarkets =
    sortedMarkets.filter(
      market =>
        market.decisionValid === true &&
        (
          market.classification ===
            "SCALPER" ||
          market.classification ===
            "ELITE" ||
          market.classification ===
            "BET"
        )
    );

  const watchlist =
    sortedMarkets
      .filter(
        market =>
          market.decisionValid === true &&
          market.classification ===
            "WATCHLIST"
      )
      .slice(
        0,
        GLOBAL_POLICY.maximumWatchlist
      );

  const discarded =
    sortedMarkets.filter(
      market =>
        market.decisionValid !== true ||
        market.classification ===
          "NO BET"
    );

  /*
   * A melhor entrada é o primeiro mercado
   * operacionalmente válido após o ranking.
   */
  const best =
    actionableMarkets[0] ??
    null;

  const elite =
    actionableMarkets.find(
      market =>
        market.classification ===
        "ELITE"
    ) ??
    null;

  const scalper =
    actionableMarkets.find(
      market =>
        market.classification ===
        "SCALPER"
    ) ??
    null;

  const operationalBets =
    actionableMarkets.filter(
      market =>
        market.classification ===
        "BET"
    );

  const secondary =
    actionableMarkets[1] ??
    watchlist[0] ??
    null;

  /*
   * Combo recebe somente entradas acionáveis.
   *
   * O próprio multiBetBuilder deverá validar
   * correlação entre as seleções finais.
   */
  const comboCandidates =
    actionableMarkets.slice(
      0,
      GLOBAL_POLICY.maximumComboMarkets
    );

  const combo =
    safeBuildCombo(
      comboCandidates,
      {
        lambdaHome:
          decisionContext.lambdaHome,

        lambdaAway:
          decisionContext.lambdaAway
      }
    );

  const noBet =
    best === null;

  const reason =
    best
      ? best.classification
      : watchlist.length > 0
        ? "WATCHLIST_ONLY"
        : discarded.length > 0
          ? "NO_MARKET_PASSED_DECISION_POLICY"
          : "NO_VALID_MARKET";

  const pipelineWarnings =
    normalizeWarnings([
      ...gameWarnings,

      ...(
        upstream.correlationValid
          ? []
          : [
              "CORRELATION_PIPELINE_INVALID"
            ]
      )
    ]);

  const debug:
    DecisionPipelineDebug = {
      valid:
        true,

      version:
        "V7.2_ELITE",

      inputMarkets:
        inputMarkets.length,

      eligibleMarkets:
        evaluatedMarkets.filter(
          market =>
            market.decisionValid === true
        ).length,

      actionableMarkets:
        actionableMarkets.length,

      eliteMarkets:
        evaluatedMarkets.filter(
          market =>
            market.classification ===
            "ELITE"
        ).length,

      scalperMarkets:
        evaluatedMarkets.filter(
          market =>
            market.classification ===
            "SCALPER"
        ).length,

      betMarkets:
        evaluatedMarkets.filter(
          market =>
            market.classification ===
            "BET"
        ).length,

      watchlistMarkets:
        evaluatedMarkets.filter(
          market =>
            market.classification ===
            "WATCHLIST"
        ).length,

      noBetMarkets:
        evaluatedMarkets.filter(
          market =>
            market.classification ===
            "NO BET"
        ).length,

      discardedMarkets:
        discarded.length,

      bestMarket:
        best
          ? String(
              best.market ??
              ""
            )
          : null,

      bestClassification:
        best?.classification ??
        null,

      upstream,

      reason
    };

  return {
    ...data,

    decisionValid:
      true,

    elite,
    scalper,

    best,

    finalBest:
      best,

    operationalBets,

    watchlist,

    secondary,

    combo,

    markets:
      sortedMarkets,

    actionableMarkets,

    discarded,

    noBet,
    reason,

    warnings:
      pipelineWarnings,

    /*
     * A aposta não é registrada aqui.
     *
     * O front-end ou um executionPipeline deve
     * chamar trackingEngine somente após a
     * confirmação real da entrada.
     */
    trackingPending:
      Boolean(best),

    debug: {
      ...(data?.debug ?? {}),

      decisionPipeline:
        debug
    }
  };
}
