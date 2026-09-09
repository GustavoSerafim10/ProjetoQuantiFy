import { goalsModel } from "../../domain/marketModels/goalsModel";

import {
  calculateGlobalConfidence
} from "../../domain/confidence/globalConfidenceEngine";

import {
  fuseLambdas
} from "../../domain/model/lambdaFusion";

import {
  hasUsableMultiBookOdds,
  type MultiBookOddsPayload
} from "../../domain/odds/multiBookOdds";

import { PIPELINE_DEBUG } from "../../shared/debugFlag";

import { computeMarketLambda } from "./marketLambda";
import { computeStatsLambda } from "./modelPipeline/statsLambda";
import { extractMatrixMarkets } from "./modelPipeline/matrixExtraction";
import {
  calculateGoalExpectationScore,
  classifyGoalProfile
} from "./modelPipeline/goalProfile";
import { isObjectRecord } from "./modelPipeline/objectHelpers";
import { emptyResponse } from "./modelPipeline/fallback";
import { safeNumber } from "./modelPipeline/numericHelpers";
import { type RawTeamStats } from "./modelPipeline/types";

/* ==========================================
   FUSED MODEL PIPELINE — STATS + MERCADO
========================================== */

/*
 * Achado real em 2026-09-09: o usuário quer estatísticas de time E
 * odds de mercado pesando no MESMO número, não um "se tiver odds,
 * ignora as stats" (esse era o comportamento de eliteAnalyzer.ts até
 * aqui — ver marketModelPipeline.ts). Este pipeline roda os dois
 * lados (stats → lambdaBuilder/contextEngine; odds → de-vig →
 * fitMarketImpliedLambda) e funde os dois lambdas com fuseLambdas()
 * (domain/model/lambdaFusion.ts).
 *
 * A fusão NÃO é uma média 50/50: o consenso de-vig validado
 * manualmente pelo usuário acertou 5/6 entradas reais, contra 25%
 * do Poisson-de-stats — então o mercado é a base, e as estatísticas
 * só podem puxar o lambda até ±15% do valor de mercado, e menos
 * ainda quando os dados de time estão incompletos (ver
 * lambdaFusion.ts para a fórmula exata).
 *
 * eliteAnalyzer.ts só chama este pipeline quando há odds de
 * múltiplas casas utilizáveis E as duas equipes têm estatísticas
 * (objeto presente) — caso contrário, continua caindo em
 * marketModelPipeline (só odds) ou modelPipeline (só stats), sem
 * nenhuma mudança de comportamento nesses dois caminhos.
 */

interface FusedModelPipelineContext {
  homeStats?: unknown;
  awayStats?: unknown;

  league?: unknown;

  marketOdds?: MultiBookOddsPayload;

  [key: string]: unknown;
}

export function fusedModelPipeline(
  context: unknown
) {
  const safeContext =
    isObjectRecord(context)
      ? (context as FusedModelPipelineContext)
      : {};

  const marketLambda = computeMarketLambda(safeContext.marketOdds);

  if (!marketLambda) {
    console.warn(
      "⚠️ fusedModelPipeline chamado sem odds de múltiplas casas utilizáveis"
    );

    return emptyResponse();
  }

  if (
    !isObjectRecord(safeContext.homeStats) ||
    !isObjectRecord(safeContext.awayStats)
  ) {
    console.warn(
      "⚠️ fusedModelPipeline chamado sem estatísticas dos dois times"
    );

    return emptyResponse();
  }

  const league = String(safeContext.league ?? "");

  const statsLambda = computeStatsLambda(
    safeContext.homeStats as RawTeamStats,
    safeContext.awayStats as RawTeamStats,
    league
  );

  /* ========================================
     FUSÃO DOS LAMBDAS
  ======================================== */

  const fusion = fuseLambdas({
    statsLambdaHome: statsLambda.lambdaHome,
    statsLambdaAway: statsLambda.lambdaAway,

    marketLambdaHome: marketLambda.lambdaHome,
    marketLambdaAway: marketLambda.lambdaAway,

    bookmakerCount: marketLambda.bookmakerCount,
    fitError: marketLambda.fitError,

    missingDataPenalty: statsLambda.missingDataPenalty
  });

  const lambdaHome = fusion.lambdaHome;
  const lambdaAway = fusion.lambdaAway;
  const totalLambda = lambdaHome + lambdaAway;

  /* ========================================
     GOALS MODEL COM LAMBDA FUNDIDO
  ======================================== */

  const goals = goalsModel(
    lambdaHome,
    lambdaAway,
    statsLambda.home,
    statsLambda.away
  );

  const markets = extractMatrixMarkets(goals.matrix);

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

  const goalExpectationScore = calculateGoalExpectationScore(
    lambdaHome,
    lambdaAway
  );

  const goalProfile = classifyGoalProfile(lambdaHome, lambdaAway);

  /*
   * Confiança final segue o mesmo peso da fusão do lambda: se o
   * mercado domina o número, a confiança do mercado domina também.
   */
  const marketOnlyGoals = goalsModel(
    marketLambda.lambdaHome,
    marketLambda.lambdaAway
  );

  const marketOnlyMarkets = extractMatrixMarkets(marketOnlyGoals.matrix);

  const marketConfidence = safeNumber(
    calculateGlobalConfidence({
      goals: marketOnlyGoals,

      btts: {
        yes: marketOnlyMarkets.bttsYes
      },

      result: {
        home: marketOnlyMarkets.home,
        draw: marketOnlyMarkets.draw,
        away: marketOnlyMarkets.away
      },

      lambdaHome: marketLambda.lambdaHome,
      lambdaAway: marketLambda.lambdaAway
    }),
    0.5
  );

  const confidence = safeNumber(
    fusion.marketWeight * marketConfidence +
      fusion.statsWeight * statsLambda.confidence,
    0.5
  );

  if (PIPELINE_DEBUG) {
    console.group("🔀 FUSED MODEL PIPELINE — AUDIT");
    console.log("STATS LAMBDA:", {
      home: statsLambda.lambdaHome,
      away: statsLambda.lambdaAway,
      confidence: statsLambda.confidence,
      missingDataPenalty: statsLambda.missingDataPenalty
    });
    console.log("MARKET LAMBDA:", {
      home: marketLambda.lambdaHome,
      away: marketLambda.lambdaAway,
      bookmakerCount: marketLambda.bookmakerCount,
      fitError: marketLambda.fitError
    });
    console.log("FUSION:", fusion);
    console.log("FUSED LAMBDA:", { lambdaHome, lambdaAway });
    console.log("MARKETS:", markets);
    console.groupEnd();
  }

  /* ========================================
     RESULTADO
  ======================================== */

  return {
    ...safeContext,

    homeStats: statsLambda.home,
    awayStats: statsLambda.away,

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
     * Sem ajuste contextual extra aqui — o contextEngine já rodou
     * dentro de computeStatsLambda() e sua influência já está
     * embutida no lambdaHome/lambdaAway de stats antes da fusão.
     */
    tempoFactor: statsLambda.tempoFactor,
    pressureFactor: statsLambda.pressureFactor,

    confidence,

    leagueReliability: {
      key: "STATS_MARKET_FUSION",
      requestedKey: league,
      found: true,
      usedDefault: false,
      resolution: "configured" as const,

      dataReliability: confidence
    },

    debug: {
      ...(isObjectRecord(safeContext.debug) ? safeContext.debug : {}),

      fusedModelPipeline: {
        statsLambda: {
          home: statsLambda.lambdaHome,
          away: statsLambda.lambdaAway,
          confidence: statsLambda.confidence,
          missingDataPenalty: statsLambda.missingDataPenalty
        },

        marketLambda: {
          home: marketLambda.lambdaHome,
          away: marketLambda.lambdaAway,
          bookmakerCount: marketLambda.bookmakerCount,
          fitError: marketLambda.fitError
        },

        fusion,

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

export function shouldUseFusedModel(context: {
  marketOdds?: MultiBookOddsPayload;
  homeStats?: unknown;
  awayStats?: unknown;
}): boolean {
  return (
    hasUsableMultiBookOdds(context.marketOdds) &&
    isObjectRecord(context.homeStats) &&
    isObjectRecord(context.awayStats)
  );
}
