import type {
  RiskComponent,
  RiskMarketType
} from "./types";

import { RISK_POLICY, STRUCTURE_THRESHOLDS } from "./policy";

import { roundNumber } from "./helpers";

import type { PipelineRecord } from "../pipelineRecord";

/* ==========================================
   FRAGILIDADE DO MERCADO
========================================== */

/*
 * Esta camada não concede bônus.
 *
 * Ela identifica apenas situações em que a
 * estrutura do jogo torna o mercado mais
 * sensível ou contraditório.
 */

export function addMarketFragilityComponents({
  components,

  marketType,

  data,

  probability,

  totalLambda,
  lambdaDifference,

  goalExpectationScore
}: {
  components:
    RiskComponent[];

  marketType:
    RiskMarketType;

  data: PipelineRecord;

  probability: number;

  totalLambda: number;
  lambdaDifference: number;

  goalExpectationScore:
    number | null;
}) {
  if (
    Boolean(
      data?.isLowGoalGame
    ) &&
    (
      marketType ===
        "OVER_1_5" ||
      marketType ===
        "OVER_2_5"
    )
  ) {
    components.push({
      source:
        "CONTEXT_LOW_GOAL_GAME_OVER",

      category:
        "CONTEXT",

      adjustment:
        RISK_POLICY
          .lowGoalGameOver,

      warning:
        "LOW_GOAL_GAME_OVER_RISK"
    });
  }

  /*
   * O goalExpectationScore não concede bônus.
   *
   * Ele só aumenta risco quando contradiz o
   * mercado ou contradiz fortemente os lambdas.
   */
  if (
    goalExpectationScore !== null
  ) {
    if (
      marketType === "OVER_1_5" ||
      marketType === "OVER_2_5"
    ) {
      if (
        goalExpectationScore <
        STRUCTURE_THRESHOLDS
          .lowGoalScore
      ) {
        components.push({
          source:
            "CONTEXT_GOAL_SCORE_CONTRADICTS_OVER",

          category:
            "CONTEXT",

          adjustment:
            RISK_POLICY
              .goalScoreContradictsOver,

          warning:
            "GOAL_SCORE_CONTRADICTS_OVER_MARKET"
        });
      } else if (
        goalExpectationScore <
        STRUCTURE_THRESHOLDS
          .moderateGoalScore
      ) {
        components.push({
          source:
            "CONTEXT_GOAL_SCORE_MODERATELY_CONTRADICTS_OVER",

          category:
            "CONTEXT",

          adjustment:
            RISK_POLICY
              .goalScoreModeratelyContradictsOver,

          warning:
            "GOAL_SCORE_MODERATELY_CONTRADICTS_OVER"
        });
      }
    }

    if (
      marketType === "BTTS_YES" &&
      goalExpectationScore <
        STRUCTURE_THRESHOLDS
          .lowGoalScoreBtts
    ) {
      components.push({
        source:
          "CONTEXT_GOAL_SCORE_CONTRADICTS_BTTS_YES",

        category:
          "CONTEXT",

        adjustment:
          RISK_POLICY
            .goalScoreContradictsBttsYes,

        warning:
          "GOAL_SCORE_CONTRADICTS_BTTS_YES"
      });
    }

    if (
      marketType === "BTTS_NO" &&
      goalExpectationScore >
        STRUCTURE_THRESHOLDS
          .highGoalScoreBttsNo
    ) {
      components.push({
        source:
          "CONTEXT_GOAL_SCORE_CONTRADICTS_BTTS_NO",

        category:
          "CONTEXT",

        adjustment:
          RISK_POLICY
            .goalScoreContradictsBttsNo,

        warning:
          "GOAL_SCORE_CONTRADICTS_BTTS_NO"
      });
    }

    /*
     * Inconsistência interna:
     *
     * lambda muito alto com score muito baixo;
     * lambda muito baixo com score muito alto.
     *
     * Este componente não interpreta qual
     * mercado é melhor. Ele detecta apenas que
     * duas saídas estruturais do modelo estão
     * se contradizendo.
     */
    const highLambdaLowGoalScore =
      totalLambda >=
        STRUCTURE_THRESHOLDS
          .highLambdaGoalScore &&
      goalExpectationScore <
        STRUCTURE_THRESHOLDS
          .lowGoalScore;

    const lowLambdaHighGoalScore =
      totalLambda <=
        STRUCTURE_THRESHOLDS
          .lowLambdaGoalScore &&
      goalExpectationScore >
        STRUCTURE_THRESHOLDS
          .highGoalScore;

    if (
      highLambdaLowGoalScore ||
      lowLambdaHighGoalScore
    ) {
      components.push({
        source:
          "CONTEXT_GOAL_SCORE_LAMBDA_CONTRADICTION",

        category:
          "CONTEXT",

        adjustment:
          RISK_POLICY
            .goalScoreLambdaContradiction,

        warning:
          "GOAL_EXPECTATION_SCORE_LAMBDA_CONTRADICTION",

        metadata: {
          totalLambda:
            roundNumber(
              totalLambda
            ),

          goalExpectationScore:
            roundNumber(
              goalExpectationScore
            )
        }
      });
    }
  }

  /*
   * Jogo equilibrado aumenta fragilidade em
   * mercados dependentes de dominância.
   *
   * Nenhum desconto é concedido quando há
   * desequilíbrio.
   */
  if (
    lambdaDifference <
    STRUCTURE_THRESHOLDS
      .balancedLambdaDifference
  ) {
    if (
      marketType === "RESULT"
    ) {
      components.push({
        source:
          "CONTEXT_BALANCED_RESULT",

        category:
          "CONTEXT",

        adjustment:
          RISK_POLICY
            .balancedResult,

        warning:
          "BALANCED_GAME_RESULT_RISK"
      });
    }

    if (
      marketType ===
      "DOUBLE_CHANCE"
    ) {
      components.push({
        source:
          "CONTEXT_BALANCED_DOUBLE_CHANCE",

        category:
          "CONTEXT",

        adjustment:
          RISK_POLICY
            .balancedDoubleChance,

        warning:
          "BALANCED_GAME_DOUBLE_CHANCE_RISK"
      });
    }

    if (
      marketType === "BTTS_NO"
    ) {
      components.push({
        source:
          "CONTEXT_BALANCED_BTTS_NO",

        category:
          "CONTEXT",

        adjustment:
          RISK_POLICY
            .balancedBttsNo,

        warning:
          "BALANCED_GAME_BTTS_NO_RISK"
      });
    }
  }

  /*
   * Probabilidade extrema exige histórico de
   * calibração.
   *
   * Esta penalização é pequena porque:
   *
   * eventLossRisk já considera a probabilidade;
   * marketDisagreement será analisado em outro
   * componente.
   *
   * O objetivo aqui é apenas registrar
   * sensibilidade a excesso de confiança.
   */
  if (
    probability >=
    STRUCTURE_THRESHOLDS
      .extremeProbability
  ) {
    components.push({
      source:
        "CONTEXT_EXTREME_MODEL_PROBABILITY",

      category:
        "CONTEXT",

      adjustment:
        RISK_POLICY
          .extremeProbability,

      warning:
        "EXTREME_MODEL_PROBABILITY_REQUIRES_CALIBRATION",

      metadata: {
        probability:
          roundNumber(
            probability
          )
      }
    });
  }
}
