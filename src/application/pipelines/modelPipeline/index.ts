import {
  goalsModel
} from "../../../domain/marketModels/goalsModel";

import { PIPELINE_DEBUG } from "../../../shared/debugFlag";

import {
  contextEngine
} from "../../../domain/context/contextEngine";

import {
  calculateGlobalConfidence
} from "../../../domain/confidence/globalConfidenceEngine";

import {
  buildLambda
} from "../../../domain/model/lambdaBuilder";

import {
  gameSelector
} from "../../engines/gameSelector";

import {
  type RawTeamStats
} from "./types";

import {
  clamp,
  safeNumber
} from "./numericHelpers";

import {
  sanitizeStats
} from "./sanitize";

import {
  applyBoundedContextAdjustment
} from "./contextAdjustment";

import {
  extractMatrixMarkets
} from "./matrixExtraction";

import {
  calculateGoalExpectationScore,
  classifyGoalProfile
} from "./goalProfile";

import {
  getObjectValue,
  isObjectRecord
} from "./objectHelpers";

import {
  emptyResponse
} from "./fallback";

/* ==========================================
   MODEL PIPELINE — QUANTIFY V7
========================================== */

/*
 * Responsabilidade:
 *
 * - preparar o contrato estatístico do modelo;
 * - preservar totais e médias separadamente;
 * - encaminhar dados confiáveis ao buildLambda();
 * - aplicar contexto com limite conservador;
 * - executar o goalsModel;
 * - extrair os mercados da matriz oficial;
 * - calcular perfil e expectativa de gols;
 * - produzir diagnósticos de coerência.
 *
 * Este arquivo NÃO:
 *
 * - calcula EV;
 * - calcula odds justas;
 * - toma a decisão final;
 * - substitui o lambdaBuilder;
 * - transforma totais em médias diretamente;
 * - inventa dados ausentes como se fossem reais.
 */

/* ==========================================
   PIPELINE
========================================== */

export function modelPipeline(
  context: unknown
) {
  if (
    !isObjectRecord(
      context
    ) ||
    !isObjectRecord(
      context.homeStats
    ) ||
    !isObjectRecord(
      context.awayStats
    )
  ) {
    console.warn(
      "⚠️ Dados insuficientes no modelPipeline"
    );

    return emptyResponse();
  }

  const rawHomeStats =
    context.homeStats as
      RawTeamStats;

  const rawAwayStats =
    context.awayStats as
      RawTeamStats;

  const league =
    String(
      context.league ??
      ""
    );

  const home =
    sanitizeStats(
      rawHomeStats,
      "HOME"
    );

  const away =
    sanitizeStats(
      rawAwayStats,
      "AWAY"
    );

  if (PIPELINE_DEBUG) {
  console.group(
    "🧠 MODEL PIPELINE — SANITIZATION AUDIT"
  );

  console.log(
    "RAW HOME STATS:",
    rawHomeStats
  );

  console.log(
    "SANITIZED HOME STATS:",
    home
  );

  console.log(
    "RAW AWAY STATS:",
    rawAwayStats
  );

  console.log(
    "SANITIZED AWAY STATS:",
    away
  );

  console.groupEnd();
  }

  /* ========================================
     SELEÇÃO DO JOGO
  ======================================== */

  const gameCheck =
    gameSelector({
      homeStats:
        home,

      awayStats:
        away
    });

  const gameBlocked =
    !gameCheck.allowed;

  /* ========================================
     LAMBDA BUILDER OFICIAL
  ======================================== */

  const lambdaBuild =
    buildLambda(
      home as never,
      away as never,
      league
    );

  const baseLambdaHome =
    safeNumber(
      lambdaBuild.lambdaHome,
      1.32
    );

  const baseLambdaAway =
    safeNumber(
      lambdaBuild.lambdaAway,
      1.23
    );

  /* ========================================
     AJUSTE CONTEXTUAL CONTROLADO
  ======================================== */

  const contextAdjusted =
    contextEngine({
      homeStats:
        home,

      awayStats:
        away,

      baseLambdaHome,
      baseLambdaAway,

      leagueData: {
        leagueKey:
          league
      }
    });

  const contextualLambdas =
    applyBoundedContextAdjustment(
      baseLambdaHome,
      baseLambdaAway,
      contextAdjusted
    );

  const lambdaHome =
    contextualLambdas.lambdaHome;

  const lambdaAway =
    contextualLambdas.lambdaAway;

  const totalLambda =
    lambdaHome +
    lambdaAway;

  /* ========================================
     GOALS MODEL
  ======================================== */

  const goals =
    goalsModel(
      lambdaHome,
      lambdaAway,
      home,
      away
    );

  /* ========================================
     MERCADOS OFICIAIS
  ======================================== */

  const markets =
    extractMatrixMarkets(
      goals.matrix
    );

  const result = {
    home:
      markets.home,

    draw:
      markets.draw,

    away:
      markets.away
  };

  const btts = {
    yes:
      markets.bttsYes,

    no:
      markets.bttsNo
  };

  const doubleChance = {
    oneX:
      markets.doubleChance1X,

    xTwo:
      markets.doubleChanceX2
  };

  const goalMarkets = {
    over15:
      markets.over15,

    over25:
      markets.over25
  };

  /* ========================================
     PERFIL E SCORE
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

  const isLowGoalGame =
    goalProfile ===
    "LOW_GOAL";

  /* ========================================
     CONFIANÇA
  ======================================== */

  const missingDataCount =
    home.missingFields.length +
    away.missingFields.length;

  const baseConfidence =
    safeNumber(
      calculateGlobalConfidence({
        goals,
        btts,
        result,
        lambdaHome,
        lambdaAway
      }),
      0.5
    );

  /*
   * Penalidade por ausência factual.
   *
   * Warnings de coerência são registrados,
   * mas não alteram probabilidades neste módulo.
   */
  const missingDataPenalty =
    Math.min(
      missingDataCount *
        0.025,
      0.20
    );

  const confidence =
    clamp(
      baseConfidence -
        missingDataPenalty,
      0,
      1
    );

  /* ========================================
     LOG FINAL
  ======================================== */

  if (PIPELINE_DEBUG) {
  console.group(
    "⚽ MODEL PIPELINE — FINAL AUDIT"
  );

  console.log(
    "LAMBDA BUILDER:",
    {
      lambdaBuild,

      baseLambdaHome,
      baseLambdaAway
    }
  );

  console.log(
    "CONTEXTUAL LAMBDAS:",
    {
      contextAdjusted,
      lambdaHome,
      lambdaAway,
      totalLambda
    }
  );

  console.log(
    "GOAL PROFILE:",
    {
      goalExpectationScore,
      goalProfile,
      isLowGoalGame
    }
  );

  console.log(
    "MARKETS:",
    markets
  );

  console.groupEnd();
  }

  /* ========================================
     RESULTADO
  ======================================== */

return {
  ...context,

  homeStats:
    home,

  awayStats:
    away,

  /*
   * Mercados consolidados extraídos da matriz.
   * Mantido no retorno público por compatibilidade
   * com eliteAnalyzer e diagnósticos do pipeline.
   */
  markets,

  blocked:
    gameBlocked,

    blockReason:
      gameBlocked
        ? gameCheck.reason
        : null,

    lambdaHome,
    lambdaAway,
    totalLambda,

    goalExpectationScore,
    goalProfile,
    isLowGoalGame,

    goals: {
      ...goals,

      over15:
        goalMarkets.over15,

      over25:
        goalMarkets.over25,

      under15:
        1 -
        goalMarkets.over15,

      under25:
        1 -
        goalMarkets.over25
    },

    dixonColes: {
      matrix:
        goals.matrix,

      rho:
        goals.meta.rho,

      bttsYesProb:
        markets.bttsYes,

      bttsNoProb:
        markets.bttsNo
    },

    btts,
    result,
    doubleChance,

    handicap: {},
    corners: {},
    cards: {},
    shots: {},
    engines: {},

    tempoFactor:
      safeNumber(
        getObjectValue(
          contextAdjusted,
          "tempoFactor"
        ),
        1
      ),

    pressureFactor:
      safeNumber(
        getObjectValue(
          contextAdjusted,
          "pressureFactor"
        ),
        1
      ),

  confidence,

    /*
     * Fonte oficial única de confiabilidade de
     * liga, propagada do lambdaBuilder. Nenhum
     * pipeline posterior deve reconsultar a liga.
     */
    leagueReliability:
      lambdaBuild.leagueReliability,

    debug: {
      ...(
        isObjectRecord(
          context.debug
        )
          ? context.debug
          : {}
      ),

      modelPipeline: {
        league,

        sanitization: {
          home: {
            sources:
              home.sources,

            inputQuality:
              home.inputQuality,

            missingFields:
              home.missingFields,

            warnings:
              home.warnings
          },

          away: {
            sources:
              away.sources,

            inputQuality:
              away.inputQuality,

            missingFields:
              away.missingFields,

            warnings:
              away.warnings
          }
        },

        homeSanitized:
          home,

        awaySanitized:
          away,

        missingData: {
          home:
            home.missingFields,

          away:
            away.missingFields,

          total:
            missingDataCount,

          confidencePenalty:
            missingDataPenalty
        },

        gameSelector:
          gameCheck,

        gameBlocked,

        lambda: {
          builder:
            lambdaBuild.diagnostics,

          base: {
            home:
              baseLambdaHome,

            away:
              baseLambdaAway,

            total:
              baseLambdaHome +
              baseLambdaAway
          },

          contextAdjusted: {
            proposedHome:
              getObjectValue(
                contextAdjusted,
                "lambdaHome"
              ),

            proposedAway:
              getObjectValue(
                contextAdjusted,
                "lambdaAway"
              ),

            tempoFactor:
              getObjectValue(
                contextAdjusted,
                "tempoFactor"
              ) ?? 1,

            pressureFactor:
              getObjectValue(
                contextAdjusted,
                "pressureFactor"
              ) ?? 1,

            minFactor:
              contextualLambdas
                .minContextFactor,

            maxFactor:
              contextualLambdas
                .maxContextFactor
          },

          final: {
            home:
              lambdaHome,

            away:
              lambdaAway,

            total:
              totalLambda,

            diff:
              Math.abs(
                lambdaHome -
                lambdaAway
              )
          }
        },

        markets,

        coherence: {
          resultSum:
            markets.home +
            markets.draw +
            markets.away,

          bttsSum:
            markets.bttsYes +
            markets.bttsNo,

          oneXCheck:
            markets.home +
            markets.draw,

          xTwoCheck:
            markets.away +
            markets.draw,

          modelOver15:
            goals.over15,

          matrixOver15:
            markets.over15,

          modelOver25:
            goals.over25,

          matrixOver25:
            markets.over25
        },

        goalExpectationScore,
        goalProfile,
        isLowGoalGame,

        confidence: {
          base:
            baseConfidence,

          missingDataPenalty,

          final:
            confidence
        }
      }
    }
  };
}
