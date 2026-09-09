import { goalsModel } from "../../domain/marketModels/goalsModel";

import {
  calculateGlobalConfidence
} from "../../domain/confidence/globalConfidenceEngine";

import {
  computeMarketLambda
} from "./marketLambda";

import {
  type MultiBookOddsPayload
} from "../../domain/odds/multiBookOdds";

import { PIPELINE_DEBUG } from "../../shared/debugFlag";

import { sanitizeStats } from "./modelPipeline/sanitize";
import { extractMatrixMarkets } from "./modelPipeline/matrixExtraction";
import {
  calculateGoalExpectationScore,
  classifyGoalProfile
} from "./modelPipeline/goalProfile";
import { isObjectRecord } from "./modelPipeline/objectHelpers";
import { emptyResponse } from "./modelPipeline/fallback";
import { safeNumber } from "./modelPipeline/numericHelpers";

/* ==========================================
   MARKET MODEL PIPELINE — CONSENSO DE-VIG
========================================== */

/*
 * Achado real em 2026-09-08: um método validado manualmente pelo
 * usuário (odds médias de bet365/Betano/Superbet, de-vig
 * proporcional) acertou 5 de 6 entradas reais na Champions League —
 * muito melhor que o `modelPipeline` (Poisson a partir de stats de
 * temporada digitadas), que teve 25% de acerto real e já teve um
 * bug de dados corrompendo o proxy de xG (ver dataNormalizer.ts).
 *
 * Este pipeline SUBSTITUI a origem de lambdaHome/lambdaAway: em vez
 * de estimados a partir de stats, são ajustados para reproduzir as
 * probabilidades de consenso do mercado (`marketImpliedLambda.ts`).
 * `goalsModel` é uma função pura de (lambdaHome, lambdaAway) — os
 * parâmetros de stats nem são usados — então o resto do contrato de
 * saída é construído do mesmo jeito que `modelPipeline` já faz, e
 * todo o pipeline downstream (simulação, probabilidade, valor,
 * correlação, risco, confiança, ranking, decisão) funciona sem
 * nenhuma mudança.
 *
 * Diferente do `modelPipeline`:
 *
 * - não aplica ajuste contextual de tempo/pressão (contextEngine) —
 *   o mercado já precifica forma recente e desfalques públicos;
 *   tentar reajustar por cima disso foi exatamente o tipo de ajuste
 *   caseiro que já causou divergência e desconfiança antes;
 * - não roda gameSelector — a legitimidade da partida aqui é dada
 *   pela própria existência de odds reais de mercado, não por uma
 *   checagem de sanidade de stats;
 * - não penaliza confiança por "dados faltando" — este modo nunca
 *   pede stats de time, então não faz sentido tratá-las como
 *   ausência.
 *
 * Este caminho (consenso de-vig puro, sem stats) só é usado quando
 * NÃO há estatísticas utilizáveis dos dois times — ver o branch em
 * `eliteAnalyzer.ts`. Quando as duas coisas existem, quem decide é
 * `fusedModelPipeline.ts` (achado real em 2026-09-09), que reusa
 * `computeMarketLambda` daqui e funde com o lambda de stats. O
 * motor antigo (`modelPipeline`) continua existindo para quando não
 * há odds de múltiplas casas.
 */

interface MarketModelPipelineContext {
  homeStats?: unknown;
  awayStats?: unknown;

  league?: unknown;

  marketOdds?: MultiBookOddsPayload;

  [key: string]: unknown;
}

export function marketModelPipeline(
  context: unknown
) {
  const safeContext =
    isObjectRecord(context)
      ? (context as MarketModelPipelineContext)
      : {};

  const marketOdds =
    safeContext.marketOdds;

  const marketLambda = computeMarketLambda(marketOdds);

  if (!marketLambda) {
    console.warn(
      "⚠️ marketModelPipeline chamado sem odds de múltiplas casas utilizáveis"
    );

    return emptyResponse();
  }

  const {
    lambdaHome,
    lambdaAway,
    totalLambda,
    bookmakerCount,
    devig,
    fit
  } = marketLambda;

  const { oneXTwo, overUnder15, overUnder25, btts } = devig;

  /* ========================================
     GOALS MODEL (mesma matriz Poisson/Dixon-Coles)
  ======================================== */

  const homeStats =
    sanitizeStats(
      isObjectRecord(safeContext.homeStats) ? safeContext.homeStats : {},
      "HOME"
    );

  const awayStats =
    sanitizeStats(
      isObjectRecord(safeContext.awayStats) ? safeContext.awayStats : {},
      "AWAY"
    );

  const goals =
    goalsModel(
      lambdaHome,
      lambdaAway,
      homeStats,
      awayStats
    );

  const markets =
    extractMatrixMarkets(
      goals.matrix
    );

  const result = {
    home: markets.home,
    draw: markets.draw,
    away: markets.away
  };

  const bttsResult = {
    yes: markets.bttsYes,
    no: markets.bttsNo
  };

  const doubleChance = {
    oneX: markets.doubleChance1X,
    xTwo: markets.doubleChanceX2
  };

  /* ========================================
     PERFIL E CONFIANÇA
  ======================================== */

  const goalExpectationScore =
    calculateGoalExpectationScore(
      lambdaHome,
      lambdaAway
    );

  const goalProfile =
    classifyGoalProfile(
      lambdaHome,
      lambdaAway
    );

  /*
   * Sem penalidade por "dados faltando": este modo nunca pede
   * stats de time, então ausência delas não é um problema de
   * qualidade de entrada aqui.
   */
  const confidence =
    safeNumber(
      calculateGlobalConfidence({
        goals,
        btts: bttsResult,
        result,
        lambdaHome,
        lambdaAway
      }),
      0.5
    );

  if (PIPELINE_DEBUG) {
    console.group("🧮 MARKET MODEL PIPELINE — AUDIT");
    console.log("MARKET ODDS:", marketOdds);
    console.log("DE-VIG TARGETS:", { oneXTwo, overUnder15, overUnder25, btts });
    console.log("FIT:", fit);
    console.log("MARKETS:", markets);
    console.groupEnd();
  }

  /* ========================================
     RESULTADO
  ======================================== */

  return {
    ...safeContext,

    homeStats,
    awayStats,

    markets,

    blocked: false,
    blockReason: null,

    lambdaHome,
    lambdaAway,
    totalLambda,

    goalExpectationScore,
    goalProfile,
    isLowGoalGame: goalProfile === "LOW_GOAL",

    goals: {
      ...goals,

      over15: markets.over15,
      over25: markets.over25,

      under15: 1 - markets.over15,
      under25: 1 - markets.over25
    },

    dixonColes: {
      matrix: goals.matrix,
      rho: goals.meta.rho,

      bttsYesProb: markets.bttsYes,
      bttsNoProb: markets.bttsNo
    },

    btts: bttsResult,
    result,
    doubleChance,

    handicap: {},
    corners: {},
    cards: {},
    shots: {},
    engines: {},

    /*
     * Neutro: sem ajuste contextual de tempo/pressão neste modo —
     * ver comentário no topo do arquivo.
     */
    tempoFactor: 1,
    pressureFactor: 1,

    confidence,

    /*
     * Confiança na liga substituída por confiança no consenso: mais
     * casas concordando entre si = mais confiável. Mesma forma do
     * contrato `LeagueReliability` (leagueStrength.ts), construída
     * localmente para não acoplar este arquivo a configuração de
     * liga que não se aplica aqui.
     */
    leagueReliability: {
      key: "MARKET_CONSENSUS",
      requestedKey: String(safeContext.league ?? ""),
      found: true,
      usedDefault: false,
      resolution: "configured" as const,

      dataReliability:
        bookmakerCount >= 3
          ? 0.9
          : bookmakerCount === 2
            ? 0.75
            : 0.55
    },

    debug: {
      ...(isObjectRecord(safeContext.debug) ? safeContext.debug : {}),

      marketModelPipeline: {
        marketOdds,

        devig: {
          oneXTwo,
          overUnder15,
          overUnder25,
          btts
        },

        bookmakerCount,

        fit,

        lambda: {
          home: lambdaHome,
          away: lambdaAway,
          total: totalLambda
        },

        markets,

        goalExpectationScore,
        goalProfile
      }
    }
  };
}

