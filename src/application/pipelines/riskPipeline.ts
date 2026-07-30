import {
  calculateRiskScoreDetailed,
  type RiskScoreResult
} from "../../domain/risk/riskScore";

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
   CONTRATOS
========================================== */

export type RiskMarketType =
  | "RESULT"
  | "DOUBLE_CHANCE"
  | "OVER_1_5"
  | "OVER_2_5"
  | "BTTS_YES"
  | "BTTS_NO"
  | "OTHER";

export type RiskComponentCategory =
  | "CONTEXT"
  | "UNCERTAINTY"
  | "SIMULATION_QUALITY"
  | "MARKET_DISAGREEMENT"
  | "CORRELATION";

export interface RiskComponent {
  source: string;

  category:
    RiskComponentCategory;

  adjustment: number;

  warning?: string;

  metadata?: Record<
    string,
    unknown
  >;
}

export interface RiskPipelineMarketDebug {
  valid: boolean;

  marketName: string;

  marketType:
    RiskMarketType;

  probability:
    number | null;

  odd:
    number | null;

  impliedProbability:
    number | null;

  probabilityEdge:
    number | null;

  absoluteMarketDisagreement:
    number | null;

  baseRisk: number;

  contextualAdjustment: number;
  uncertaintyAdjustment: number;
  simulationQualityAdjustment: number;
  marketDisagreementAdjustment: number;
  correlationAdjustment: number;

  totalAdjustment: number;
  unclampedRisk: number;
  finalRisk: number;

  lambdaHome: number;
  lambdaAway: number;
  totalLambda: number;
  lambdaDifference: number;
  minimumLambda: number;

  goalExpectationScore:
    number | null;

  samplingError:
    number | null;

  samplingErrorSource:
    string;

  modelSimulationDivergence:
    number | null;

  divergenceSource:
    string;

  dataQualitySource:
    string;

  monteCarloValid:
    boolean | null;

  monteCarloConverged:
    boolean | null;

  simulationQuality:
    string | null;

  baseRiskDetails:
    RiskScoreResult;

  components:
    RiskComponent[];

  warnings:
    string[];

  error?: string;
}

export interface RiskPipelineDebug {
  valid: boolean;

  version: "V7.2_ELITE";

  inputMarkets: number;
  outputMarkets: number;
  validMarkets: number;
  invalidMarkets: number;

  lambdaHome:
    number | null;

  lambdaAway:
    number | null;

  totalLambda:
    number | null;

  lambdaDifference:
    number | null;

  leagueAvgGoals:
    number | null;

  recentGoalStd:
    number | null;

  seasonGoalAvg:
    number | null;

  dataQualityScore:
    number | null;

  dataQualitySource:
    string;

  samplingError:
    number | null;

  samplingErrorSource:
    string;

  modelSimulationDivergence:
    number | null;

  divergenceSource:
    string;

  monteCarloValid:
    boolean | null;

  monteCarloConverged:
    boolean | null;

  simulationQuality:
    string | null;

  error?: string;

  note:
    "Risk is consolidated once from statistical base risk, market fragility, uncertainty, market disagreement and correlation.";
}

interface ResolvedNumber {
  value: number | null;
  source: string;
}

interface MonteCarloMetadata {
  valid: boolean | null;
  converged: boolean | null;
  simulationQuality: string | null;
  warnings: string[];
}

/* ==========================================
   POLÍTICA PROVISÓRIA
========================================== */

/*
 * Os valores abaixo precisam ser validados
 * futuramente por:
 *
 * - Brier Score;
 * - Log Loss;
 * - calibração por mercado;
 * - ROI por faixa de risco;
 * - drawdown;
 * - backtest fora da amostra.
 *
 * Nenhuma regra abaixo concede bônus porque
 * determinado sinal favorece o mercado.
 *
 * O pipeline acrescenta apenas risco quando
 * identifica fragilidade ou inconsistência.
 *
 * A única redução possível vem de
 * correlationNet negativo, aplicado uma vez.
 */

const RISK_POLICY = {
  /* Fragilidades contextuais */

  balancedResult:
    0.06,

  balancedDoubleChance:
    0.03,

  balancedBttsNo:
    0.035,

  lowGoalGameOver:
    0.055,

  goalScoreContradictsOver:
    0.065,

  goalScoreModeratelyContradictsOver:
    0.035,

  goalScoreContradictsBttsYes:
    0.05,

  goalScoreContradictsBttsNo:
    0.05,

  goalScoreLambdaContradiction:
    0.045,

  extremeProbability:
    0.02,

  /* Informações ausentes */

  missingSamplingError:
    0.015,

  missingModelSimulationDivergence:
    0.015,

  missingGoalExpectationScore:
    0.01,

  missingOdd:
    0.025,

  monteCarloInvalid:
    0.05,

  monteCarloNotConverged:
    0.025,

  lowSimulationQuality:
    0.035,

  mediumSimulationQuality:
    0.015,

  /* Erro de Monte Carlo */

  moderateSamplingError:
    0.02,

  highSamplingError:
    0.04,

  extremeSamplingError:
    0.065,

  /* Modelo analítico x simulação */

  moderateModelSimulationDivergence:
    0.025,

  highModelSimulationDivergence:
    0.05,

  extremeModelSimulationDivergence:
    0.075,

  /* Modelo x mercado */

  moderateMarketDisagreement:
    0.025,

  highMarketDisagreement:
    0.06,

  extremeMarketDisagreement:
    0.11,

  severeMarketDisagreement:
    0.16
} as const;

/* ==========================================
   LIMITES ESTRUTURAIS
========================================== */

const STRUCTURE_THRESHOLDS = {
  balancedLambdaDifference:
    0.25,

  lowGoalScore:
    0.45,

  moderateGoalScore:
    0.55,

  highGoalScore:
    0.65,

  lowGoalScoreBtts:
    0.50,

  highGoalScoreBttsNo:
    0.65,

  highLambdaGoalScore:
    3.4,

  lowLambdaGoalScore:
    2.0,

  extremeProbability:
    0.82,

  moderateSamplingError:
    0.006,

  highSamplingError:
    0.01,

  extremeSamplingError:
    0.02,

  moderateModelSimulationDivergence:
    0.05,

  highModelSimulationDivergence:
    0.1,

  extremeModelSimulationDivergence:
    0.18,

  moderateMarketDisagreement:
    0.1,

  highMarketDisagreement:
    0.2,

  extremeMarketDisagreement:
    0.3,

  severeMarketDisagreement:
    0.4,

  minimumRisk:
    0.05,

  maximumRisk:
    0.95,

  maximumCorrelationAdjustment:
    0.15,

  maximumPositivePipelineAdjustment:
    0.45,

  maximumNegativePipelineAdjustment:
    -0.15
} as const;

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

/* ==========================================
   CÁLCULO POR MERCADO
========================================== */

function calculateMarketRisk({
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
  dataQualitySource,

  goalExpectationScore,

  globalSamplingError,

  globalModelSimulationDivergence,

  monteCarloMetadata
}: {
  market: any;
  data: any;

  lambdaHome: number;
  lambdaAway: number;

  totalLambda: number;
  lambdaDifference: number;
  minimumLambda: number;

  leagueAvgGoals: number | null;
  recentGoalStd: number | null;
  seasonGoalAvg: number | null;
  dataQualityScore: number | null;
  dataQualitySource: string;

  goalExpectationScore:
    number | null;

  globalSamplingError:
    ResolvedNumber;

  globalModelSimulationDivergence:
    ResolvedNumber;

  monteCarloMetadata:
    MonteCarloMetadata;
}): {
  valid: boolean;
  market: any;
} {
  const marketName =
    normalizeMarketName(
      market?.market
    );

  const marketType =
    getMarketType(
      marketName
    );

  const probability =
    parseProbability(
      market?.probability
    );

  const odd =
    parseOdd(
      market?.odd
    );

  const existingWarnings =
    normalizeWarnings(
      market?.warnings
    );

  const marketSamplingError =
    extractMarketSamplingError({
      data,
      market,
      marketName,
      fallback:
        globalSamplingError
    });

  const marketModelSimulationDivergence =
    extractMarketModelSimulationDivergence({
      data,
      market,
      marketName,
      fallback:
        globalModelSimulationDivergence
    });

  const samplingError =
    marketSamplingError.value;

  const modelSimulationDivergence =
    marketModelSimulationDivergence.value;

  /*
   * Mercados não reconhecidos não devem
   * receber risco aparentemente válido.
   */
  if (
    marketType === "OTHER"
  ) {
    return createInvalidMarketRisk({
      market,

      marketName,
      marketType,

      probability,
      odd,

      lambdaHome,
      lambdaAway,
      totalLambda,
      lambdaDifference,
      minimumLambda,

      goalExpectationScore,
      samplingError,
      modelSimulationDivergence,

      warnings: [
        ...existingWarnings,
        "UNSUPPORTED_RISK_MARKET"
      ],

      error:
        "UNSUPPORTED_RISK_MARKET"
    });
  }

  if (
    probability === null
  ) {
    return createInvalidMarketRisk({
      market,

      marketName,
      marketType,

      probability,
      odd,

      lambdaHome,
      lambdaAway,
      totalLambda,
      lambdaDifference,
      minimumLambda,

      goalExpectationScore,
      samplingError,
      modelSimulationDivergence,

      warnings: [
        ...existingWarnings,
        "INVALID_MARKET_PROBABILITY_FOR_RISK"
      ],

      error:
        "INVALID_MARKET_PROBABILITY_FOR_RISK"
    });
  }

  /*
   * O risco-base estatístico não conhece:
   *
   * - mercado;
   * - odd;
   * - EV;
   * - correlação;
   * - contexto operacional.
   */
  const baseRiskDetails =
    calculateRiskScoreDetailed({
      lambdaHome,
      lambdaAway,

      eventProbability:
        probability,

      leagueAvgGoals,

      recentGoalStd,

      seasonGoalAvg,

      dataQualityScore
    });

  if (!baseRiskDetails.valid) {
    return createInvalidMarketRisk({
      market,

      marketName,
      marketType,

      probability,
      odd,

      lambdaHome,
      lambdaAway,
      totalLambda,
      lambdaDifference,
      minimumLambda,

      goalExpectationScore,
      samplingError,
      modelSimulationDivergence,

      warnings: [
        ...existingWarnings,
        ...baseRiskDetails
          .debug
          .warnings,
        "INVALID_STATISTICAL_BASE_RISK"
      ],

      error:
        "INVALID_STATISTICAL_BASE_RISK",

      baseRiskDetails
    });
  }

  const baseRisk =
    baseRiskDetails.risk;

  const impliedProbability =
    odd !== null
      ? clampProbability(
          1 /
          odd
        )
      : null;

  const probabilityEdge =
    impliedProbability !== null
      ? (
          probability -
          impliedProbability
        )
      : null;

  /*
   * A divergência utilizada como risco é
   * absoluta.
   *
   * A direção continua preservada em
   * probabilityEdge para diagnóstico.
   */
  const absoluteMarketDisagreement =
    probabilityEdge !== null
      ? Math.abs(
          probabilityEdge
        )
      : null;

  const components:
    RiskComponent[] = [];

  addMarketFragilityComponents({
    components,

    marketType,

    data,

    probability,

    totalLambda,
    lambdaDifference,

    goalExpectationScore
  });

  addUncertaintyComponents({
    components,

    samplingError,

    modelSimulationDivergence,

    goalExpectationScore
  });

  addSimulationQualityComponents({
    components,
    metadata:
      monteCarloMetadata
  });

  addMarketDisagreementComponents({
    components,

    probability,

    odd,

    impliedProbability,

    probabilityEdge,

    absoluteMarketDisagreement
  });

  /*
   * O correlationEngine deve produzir apenas:
   *
   * correlationPenalty
   * correlationBoost
   * correlationNet
   *
   * O risco é modificado uma única vez aqui.
   */
  addCorrelationComponent({
    components,
    market
  });

  const contextualAdjustment =
    sumComponentsByCategory(
      components,
      "CONTEXT"
    );

  const uncertaintyAdjustment =
    sumComponentsByCategory(
      components,
      "UNCERTAINTY"
    );

  const simulationQualityAdjustment =
    sumComponentsByCategory(
      components,
      "SIMULATION_QUALITY"
    );

  const marketDisagreementAdjustment =
    sumComponentsByCategory(
      components,
      "MARKET_DISAGREEMENT"
    );

  const correlationAdjustment =
    sumComponentsByCategory(
      components,
      "CORRELATION"
    );

  const rawTotalAdjustment =
    components.reduce(
      (
        total,
        component
      ) =>
        total +
        component.adjustment,

      0
    );

  /*
   * Proteção contra concentração excessiva de
   * ajustes no pipeline.
   *
   * O risco-base continua sendo a autoridade
   * estatística principal.
   */
  const totalAdjustment =
    clamp(
      rawTotalAdjustment,

      STRUCTURE_THRESHOLDS
        .maximumNegativePipelineAdjustment,

      STRUCTURE_THRESHOLDS
        .maximumPositivePipelineAdjustment
    );

  const unclampedRisk =
    baseRisk +
    totalAdjustment;

  const finalRisk =
    clamp(
      unclampedRisk,

      STRUCTURE_THRESHOLDS
        .minimumRisk,

      STRUCTURE_THRESHOLDS
        .maximumRisk
    );

  const componentWarnings =
    components
      .map(
        component =>
          component.warning
      )
      .filter(
        (
          warning
        ): warning is string =>
          Boolean(warning)
      );

  const finalWarnings =
    normalizeWarnings([
      ...existingWarnings,

      ...baseRiskDetails
        .debug
        .warnings,

      ...componentWarnings
    ]);

  const debug:
    RiskPipelineMarketDebug = {
      valid:
        true,

      marketName,

      marketType,

      probability:
        roundNumber(
          probability
        ),

      odd:
        roundNullableNumber(
          odd
        ),

      impliedProbability:
        roundNullableNumber(
          impliedProbability
        ),

      probabilityEdge:
        roundNullableNumber(
          probabilityEdge
        ),

      absoluteMarketDisagreement:
        roundNullableNumber(
          absoluteMarketDisagreement
        ),

      baseRisk:
        roundNumber(
          baseRisk
        ),

      contextualAdjustment:
        roundNumber(
          contextualAdjustment
        ),

      uncertaintyAdjustment:
        roundNumber(
          uncertaintyAdjustment
        ),

      simulationQualityAdjustment:
        roundNumber(
          simulationQualityAdjustment
        ),

      marketDisagreementAdjustment:
        roundNumber(
          marketDisagreementAdjustment
        ),

      correlationAdjustment:
        roundNumber(
          correlationAdjustment
        ),

      totalAdjustment:
        roundNumber(
          totalAdjustment
        ),

      unclampedRisk:
        roundNumber(
          unclampedRisk
        ),

      finalRisk:
        roundNumber(
          finalRisk
        ),

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

      minimumLambda:
        roundNumber(
          minimumLambda
        ),

      goalExpectationScore:
        roundNullableNumber(
          goalExpectationScore
        ),

      samplingError:
        roundNullableNumber(
          samplingError
        ),

      samplingErrorSource:
        marketSamplingError.source,

      modelSimulationDivergence:
        roundNullableNumber(
          modelSimulationDivergence
        ),

      divergenceSource:
        marketModelSimulationDivergence.source,

      dataQualitySource,

      monteCarloValid:
        monteCarloMetadata.valid,

      monteCarloConverged:
        monteCarloMetadata.converged,

      simulationQuality:
        monteCarloMetadata.simulationQuality,

      baseRiskDetails,

      components:
        components.map(
          component => ({
            ...component,

            adjustment:
              roundNumber(
                component.adjustment
              )
          })
        ),

      warnings:
        finalWarnings
    };

  return {
    valid:
      true,

    market: {
      ...market,

      risk:
        roundNumber(
          finalRisk
        ),

      riskScore:
        roundNumber(
          finalRisk
        ),

      warnings:
        finalWarnings,

      debug: {
        ...(market?.debug ?? {}),

        riskPipeline:
          debug
      }
    }
  };
}

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

function addMarketFragilityComponents({
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

  data: any;

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

/* ==========================================
   INCERTEZA ESTATÍSTICA
========================================== */

function addUncertaintyComponents({
  components,

  samplingError,

  modelSimulationDivergence,

  goalExpectationScore
}: {
  components:
    RiskComponent[];

  samplingError:
    number | null;

  modelSimulationDivergence:
    number | null;

  goalExpectationScore:
    number | null;
}) {
  if (
    samplingError === null
  ) {
    components.push({
      source:
        "UNCERTAINTY_MISSING_MONTE_CARLO_ERROR",

      category:
        "UNCERTAINTY",

      adjustment:
        RISK_POLICY
          .missingSamplingError,

      warning:
        "MISSING_MONTE_CARLO_SAMPLING_ERROR"
    });
  } else if (
    samplingError >=
    STRUCTURE_THRESHOLDS
      .extremeSamplingError
  ) {
    components.push({
      source:
        "UNCERTAINTY_EXTREME_MONTE_CARLO_ERROR",

      category:
        "UNCERTAINTY",

      adjustment:
        RISK_POLICY
          .extremeSamplingError,

      warning:
        "EXTREME_MONTE_CARLO_SAMPLING_ERROR",

      metadata: {
        samplingError:
          roundNumber(
            samplingError
          )
      }
    });
  } else if (
    samplingError >=
    STRUCTURE_THRESHOLDS
      .highSamplingError
  ) {
    components.push({
      source:
        "UNCERTAINTY_HIGH_MONTE_CARLO_ERROR",

      category:
        "UNCERTAINTY",

      adjustment:
        RISK_POLICY
          .highSamplingError,

      warning:
        "HIGH_MONTE_CARLO_SAMPLING_ERROR",

      metadata: {
        samplingError:
          roundNumber(
            samplingError
          )
      }
    });
  } else if (
    samplingError >=
    STRUCTURE_THRESHOLDS
      .moderateSamplingError
  ) {
    components.push({
      source:
        "UNCERTAINTY_MODERATE_MONTE_CARLO_ERROR",

      category:
        "UNCERTAINTY",

      adjustment:
        RISK_POLICY
          .moderateSamplingError,

      warning:
        "MODERATE_MONTE_CARLO_SAMPLING_ERROR",

      metadata: {
        samplingError:
          roundNumber(
            samplingError
          )
      }
    });
  }

  if (
    modelSimulationDivergence === null
  ) {
    components.push({
      source:
        "UNCERTAINTY_MISSING_MODEL_SIMULATION_DIVERGENCE",

      category:
        "UNCERTAINTY",

      adjustment:
        RISK_POLICY
          .missingModelSimulationDivergence,

      warning:
        "MISSING_MODEL_SIMULATION_DIVERGENCE"
    });
  } else if (
    modelSimulationDivergence >=
    STRUCTURE_THRESHOLDS
      .extremeModelSimulationDivergence
  ) {
    components.push({
      source:
        "UNCERTAINTY_EXTREME_MODEL_SIMULATION_DIVERGENCE",

      category:
        "UNCERTAINTY",

      adjustment:
        RISK_POLICY
          .extremeModelSimulationDivergence,

      warning:
        "EXTREME_MODEL_SIMULATION_DIVERGENCE",

      metadata: {
        modelSimulationDivergence:
          roundNumber(
            modelSimulationDivergence
          )
      }
    });
  } else if (
    modelSimulationDivergence >=
    STRUCTURE_THRESHOLDS
      .highModelSimulationDivergence
  ) {
    components.push({
      source:
        "UNCERTAINTY_HIGH_MODEL_SIMULATION_DIVERGENCE",

      category:
        "UNCERTAINTY",

      adjustment:
        RISK_POLICY
          .highModelSimulationDivergence,

      warning:
        "HIGH_MODEL_SIMULATION_DIVERGENCE",

      metadata: {
        modelSimulationDivergence:
          roundNumber(
            modelSimulationDivergence
          )
      }
    });
  } else if (
    modelSimulationDivergence >=
    STRUCTURE_THRESHOLDS
      .moderateModelSimulationDivergence
  ) {
    components.push({
      source:
        "UNCERTAINTY_MODERATE_MODEL_SIMULATION_DIVERGENCE",

      category:
        "UNCERTAINTY",

      adjustment:
        RISK_POLICY
          .moderateModelSimulationDivergence,

      warning:
        "MODERATE_MODEL_SIMULATION_DIVERGENCE",

      metadata: {
        modelSimulationDivergence:
          roundNumber(
            modelSimulationDivergence
          )
      }
    });
  }

  if (
    goalExpectationScore === null
  ) {
    components.push({
      source:
        "UNCERTAINTY_MISSING_GOAL_EXPECTATION_SCORE",

      category:
        "UNCERTAINTY",

      adjustment:
        RISK_POLICY
          .missingGoalExpectationScore,

      warning:
        "MISSING_OFFICIAL_GOAL_EXPECTATION_SCORE"
    });
  }
}

/* ==========================================
   QUALIDADE DA SIMULAÇÃO
========================================== */

function addSimulationQualityComponents({
  components,
  metadata
}: {
  components: RiskComponent[];
  metadata: MonteCarloMetadata;
}) {
  if (metadata.valid === false) {
    components.push({
      source: "SIMULATION_QUALITY_INVALID",
      category: "SIMULATION_QUALITY",
      adjustment: RISK_POLICY.monteCarloInvalid,
      warning: "MONTE_CARLO_INVALID_FOR_RISK",
      metadata: {
        warnings: metadata.warnings
      }
    });

    return;
  }

  if (metadata.converged === false) {
    components.push({
      source: "SIMULATION_QUALITY_NOT_CONVERGED",
      category: "SIMULATION_QUALITY",
      adjustment: RISK_POLICY.monteCarloNotConverged,
      warning: "MONTE_CARLO_NOT_CONVERGED_FOR_RISK"
    });
  }

  if (
    metadata.simulationQuality === "LOW" ||
    metadata.simulationQuality === "POOR" ||
    metadata.simulationQuality === "WEAK"
  ) {
    components.push({
      source: "SIMULATION_QUALITY_LOW",
      category: "SIMULATION_QUALITY",
      adjustment: RISK_POLICY.lowSimulationQuality,
      warning: "LOW_SIMULATION_QUALITY_INCREASES_RISK",
      metadata: {
        simulationQuality: metadata.simulationQuality
      }
    });
  } else if (
    metadata.simulationQuality === "MEDIUM" ||
    metadata.simulationQuality === "MODERATE"
  ) {
    components.push({
      source: "SIMULATION_QUALITY_MEDIUM",
      category: "SIMULATION_QUALITY",
      adjustment: RISK_POLICY.mediumSimulationQuality,
      warning: "MEDIUM_SIMULATION_QUALITY_INCREASES_RISK",
      metadata: {
        simulationQuality: metadata.simulationQuality
      }
    });
  }
}

/* ==========================================
   DIVERGÊNCIA MODELO X MERCADO
========================================== */

function addMarketDisagreementComponents({
  components,

  probability,

  odd,

  impliedProbability,

  probabilityEdge,

  absoluteMarketDisagreement
}: {
  components:
    RiskComponent[];

  probability: number;

  odd: number | null;

  impliedProbability:
    number | null;

  probabilityEdge:
    number | null;

  absoluteMarketDisagreement:
    number | null;
}) {
  if (
    odd === null ||
    impliedProbability === null ||
    probabilityEdge === null ||
    absoluteMarketDisagreement === null
  ) {
    components.push({
      source:
        "MARKET_DISAGREEMENT_MISSING_ODD",

      category:
        "MARKET_DISAGREEMENT",

      adjustment:
        RISK_POLICY
          .missingOdd,

      warning:
        "MARKET_DISAGREEMENT_NOT_MEASURED_WITHOUT_VALID_ODD"
    });

    return;
  }

  const metadata = {
    probability:
      roundNumber(
        probability
      ),

    odd:
      roundNumber(
        odd
      ),

    impliedProbability:
      roundNumber(
        impliedProbability
      ),

    probabilityEdge:
      roundNumber(
        probabilityEdge
      ),

    absoluteMarketDisagreement:
      roundNumber(
        absoluteMarketDisagreement
      )
  };

  if (
    absoluteMarketDisagreement >=
    STRUCTURE_THRESHOLDS
      .severeMarketDisagreement
  ) {
    components.push({
      source:
        "MARKET_DISAGREEMENT_SEVERE",

      category:
        "MARKET_DISAGREEMENT",

      adjustment:
        RISK_POLICY
          .severeMarketDisagreement,

      warning:
        "SEVERE_MODEL_MARKET_DISAGREEMENT",

      metadata
    });

    return;
  }

  if (
    absoluteMarketDisagreement >=
    STRUCTURE_THRESHOLDS
      .extremeMarketDisagreement
  ) {
    components.push({
      source:
        "MARKET_DISAGREEMENT_EXTREME",

      category:
        "MARKET_DISAGREEMENT",

      adjustment:
        RISK_POLICY
          .extremeMarketDisagreement,

      warning:
        "EXTREME_MODEL_MARKET_DISAGREEMENT",

      metadata
    });

    return;
  }

  if (
    absoluteMarketDisagreement >=
    STRUCTURE_THRESHOLDS
      .highMarketDisagreement
  ) {
    components.push({
      source:
        "MARKET_DISAGREEMENT_HIGH",

      category:
        "MARKET_DISAGREEMENT",

      adjustment:
        RISK_POLICY
          .highMarketDisagreement,

      warning:
        "HIGH_MODEL_MARKET_DISAGREEMENT",

      metadata
    });

    return;
  }

  if (
    absoluteMarketDisagreement >=
    STRUCTURE_THRESHOLDS
      .moderateMarketDisagreement
  ) {
    components.push({
      source:
        "MARKET_DISAGREEMENT_MODERATE",

      category:
        "MARKET_DISAGREEMENT",

      adjustment:
        RISK_POLICY
          .moderateMarketDisagreement,

      warning:
        "MODERATE_MODEL_MARKET_DISAGREEMENT",

      metadata
    });
  }
}

/* ==========================================
   CORRELAÇÃO
========================================== */

function addCorrelationComponent({
  components,
  market
}: {
  components:
    RiskComponent[];

  market: any;
}) {
  const correlationNet =
    parseFiniteNumber(
      market?.correlationNet
    );

  if (
    correlationNet === null ||
    Math.abs(
      correlationNet
    ) <= 1e-9
  ) {
    return;
  }

  /*
   * correlationNet positivo:
   * aumenta risco.
   *
   * correlationNet negativo:
   * reduz risco.
   *
   * O ajuste é limitado para impedir que a
   * correlação domine o risco estatístico.
   */
  const boundedAdjustment =
    clamp(
      correlationNet,

      -STRUCTURE_THRESHOLDS
        .maximumCorrelationAdjustment,

      STRUCTURE_THRESHOLDS
        .maximumCorrelationAdjustment
    );

  components.push({
    source:
      "CORRELATION_ENGINE_NET",

    category:
      "CORRELATION",

    adjustment:
      boundedAdjustment,

    warning:
      boundedAdjustment > 0
        ? "CORRELATION_INCREASES_RISK"
        : "CORRELATION_SUPPORTS_MARKET",

    metadata: {
      rawCorrelationNet:
        roundNumber(
          correlationNet
        ),

      boundedCorrelationNet:
        roundNumber(
          boundedAdjustment
        )
    }
  });
}

/* ==========================================
   RESULTADO INVÁLIDO DO MERCADO
========================================== */

function createInvalidMarketRisk({
  market,

  marketName,
  marketType,

  probability,
  odd,

  lambdaHome,
  lambdaAway,
  totalLambda,
  lambdaDifference,
  minimumLambda,

  goalExpectationScore,
  samplingError,
  modelSimulationDivergence,

  warnings,
  error,

  baseRiskDetails
}: {
  market: any;

  marketName: string;
  marketType: RiskMarketType;

  probability: number | null;
  odd: number | null;

  lambdaHome: number;
  lambdaAway: number;
  totalLambda: number;
  lambdaDifference: number;
  minimumLambda: number;

  goalExpectationScore:
    number | null;

  samplingError:
    number | null;

  modelSimulationDivergence:
    number | null;

  warnings:
    string[];

  error:
    string;

  baseRiskDetails?:
    RiskScoreResult;
}): {
  valid: false;
  market: any;
} {
  const finalWarnings =
    normalizeWarnings(
      warnings
    );

  const fallbackBaseRiskDetails =
    baseRiskDetails ??
    createUnavailableBaseRiskDetails();

  const debug:
    RiskPipelineMarketDebug = {
      valid:
        false,

      marketName,

      marketType,

      probability:
        roundNullableNumber(
          probability
        ),

      odd:
        roundNullableNumber(
          odd
        ),

      impliedProbability:
        odd !== null
          ? roundNumber(
              1 /
              odd
            )
          : null,

      probabilityEdge:
        null,

      absoluteMarketDisagreement:
        null,

      baseRisk:
        0.95,

      contextualAdjustment:
        0,

      uncertaintyAdjustment:
        0,

      simulationQualityAdjustment:
        0,

      marketDisagreementAdjustment:
        0,

      correlationAdjustment:
        0,

      totalAdjustment:
        0,

      unclampedRisk:
        0.95,

      finalRisk:
        0.95,

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

      minimumLambda:
        roundNumber(
          minimumLambda
        ),

      goalExpectationScore:
        roundNullableNumber(
          goalExpectationScore
        ),

      samplingError:
        roundNullableNumber(
          samplingError
        ),

      samplingErrorSource:
        "unavailable",

      modelSimulationDivergence:
        roundNullableNumber(
          modelSimulationDivergence
        ),

      divergenceSource:
        "unavailable",

      dataQualitySource:
        "unavailable",

      monteCarloValid:
        null,

      monteCarloConverged:
        null,

      simulationQuality:
        null,

      baseRiskDetails:
        fallbackBaseRiskDetails,

      components:
        [],

      warnings:
        finalWarnings,

      error
    };

  return {
    valid:
      false,

    market: {
      ...market,

      risk:
        0.95,

      riskScore:
        0.95,

      warnings:
        finalWarnings,

      debug: {
        ...(market?.debug ?? {}),

        riskPipeline:
          debug
      }
    }
  };
}

/* ==========================================
   RESULTADO INVÁLIDO DO PIPELINE
========================================== */

function createInvalidPipelineResult({
  data,
  inputMarkets,
  lambdaHome,
  lambdaAway,
  error
}: {
  data: any;
  inputMarkets: any[];
  lambdaHome: number | null;
  lambdaAway: number | null;
  error: string;
}) {
  const markets =
    inputMarkets.map(
      (market: any) => {
        const warnings =
          normalizeWarnings([
            ...normalizeWarnings(
              market?.warnings
            ),

            "RISK_NOT_CALCULATED"
          ]);

        return {
          ...market,

          risk:
            0.95,

          riskScore:
            0.95,

          warnings,

          debug: {
            ...(market?.debug ?? {}),

            riskPipeline: {
              valid:
                false,

              error,

              finalRisk:
                0.95,

              warnings
            }
          }
        };
      }
    );

  const debug:
    RiskPipelineDebug = {
      valid:
        false,

      version:
        "V7.2_ELITE",

      inputMarkets:
        inputMarkets.length,

      outputMarkets:
        markets.length,

      validMarkets:
        0,

      invalidMarkets:
        markets.length,

      lambdaHome:
        roundNullableNumber(
          lambdaHome
        ),

      lambdaAway:
        roundNullableNumber(
          lambdaAway
        ),

      totalLambda:
        null,

      lambdaDifference:
        null,

      leagueAvgGoals:
        null,

      recentGoalStd:
        null,

      seasonGoalAvg:
        null,

      dataQualityScore:
        null,

      dataQualitySource:
        "unavailable",

      samplingError:
        null,

      samplingErrorSource:
        "unavailable",

      modelSimulationDivergence:
        null,

      divergenceSource:
        "unavailable",

      monteCarloValid:
        null,

      monteCarloConverged:
        null,

      simulationQuality:
        null,

      error,

      note:
        "Risk is consolidated once from statistical base risk, market fragility, uncertainty, market disagreement and correlation."
    };

  return {
    ...data,

    riskValid:
      false,

    markets,

    debug: {
      ...(data?.debug ?? {}),

      riskPipeline:
        debug
    }
  };
}

/* ==========================================
   RESULTADO-BASE INDISPONÍVEL
========================================== */

function createUnavailableBaseRiskDetails():
  RiskScoreResult {
  return {
    valid:
      false,

    risk:
      0.95,

    riskScore:
      0.95,

    components: {
      eventLossRisk:
        1,

      goalDispersionRisk:
        1,

      volatilityRisk:
        1,

      lambdaAnomalyRisk:
        1,

      dataQualityRisk:
        1
    },

    weightedComponents: {
      eventLossRisk:
        0,

      goalDispersionRisk:
        0,

      volatilityRisk:
        0,

      lambdaAnomalyRisk:
        0,

      dataQualityRisk:
        0
    },

    weights: {
      eventLossRisk:
        0,

      goalDispersionRisk:
        0,

      volatilityRisk:
        0,

      lambdaAnomalyRisk:
        0,

      dataQualityRisk:
        0
    },

    debug: {
      valid:
        false,

      lambdaHome:
        null,

      lambdaAway:
        null,

      totalLambda:
        null,

      eventProbability:
        null,

      leagueAvgGoals:
        null,

      recentGoalStd:
        null,

      seasonGoalAvg:
        null,

      dataQualityScore:
        null,

      expectedGoalStd:
        null,

      volatilityRatio:
        null,

      lambdaToLeagueRatio:
        null,

      missingFields:
        [],

      warnings: [
        "BASE_RISK_DETAILS_UNAVAILABLE"
      ],

      error:
        "BASE_RISK_DETAILS_UNAVAILABLE"
    }
  };
}

/* ==========================================
   MERCADOS
========================================== */

function normalizeMarketName(
  market: unknown
): string {
  return String(
    market ?? ""
  )
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/\./g, "_");
}

function getMarketType(
  market: string
): RiskMarketType {
  switch (market) {
    case "HOME":
    case "HOME_WIN":
    case "DRAW":
    case "AWAY":
    case "AWAY_WIN":
      return "RESULT";

    case "DOUBLE_CHANCE_1X":
    case "DOUBLE_CHANCE_X2":
    case "1X":
    case "X2":
      return "DOUBLE_CHANCE";

    case "OVER_1_5":
    case "OVER15":
      return "OVER_1_5";

    case "OVER_2_5":
    case "OVER25":
      return "OVER_2_5";

    case "BTTS_YES":
      return "BTTS_YES";

    case "BTTS_NO":
      return "BTTS_NO";

    default:
      return "OTHER";
  }
}

/* ==========================================
   EXTRAÇÃO DAS MÉDIAS
========================================== */

function extractLeagueAverageGoals(
  data: any
): number | null {
  const candidates = [
    data?.leagueAvgGoals,

    data?.leagueAverageGoals,

    data?.leagueConfig
      ?.averageGoals,

    data?.leagueConfig
      ?.avgGoals,

    data?.debug
      ?.modelPipeline
      ?.leagueAvgGoals
  ];

  return firstPositiveNumber(
    candidates
  );
}

function extractRecentGoalStd(
  data: any
): number | null {
  const candidates = [
    data?.recentGoalStd,

    data?.recentTotalGoalsStd,

    data?.volatility
      ?.recentGoalStd,

    data?.debug
      ?.contextPipeline
      ?.recentGoalStd
  ];

  return firstNonNegativeNumber(
    candidates
  );
}

function extractSeasonGoalAverage(
  data: any
): number | null {
  const candidates = [
    data?.seasonGoalAvg,

    data?.seasonAverageGoals,

    data?.seasonTotalGoalsAverage,

    data?.debug
      ?.contextPipeline
      ?.seasonGoalAvg
  ];

  return firstPositiveNumber(
    candidates
  );
}

function extractDataQualityScore(
  data: any
): ResolvedNumber {
  return firstResolvedProbability([
    [data?.dataQualityScore, "data.dataQualityScore"],
    [data?.inputQualityScore, "data.inputQualityScore"],
    [data?.statisticalDataQuality, "data.statisticalDataQuality"],
    [data?.debug?.dataNormalizer?.qualityScore, "debug.dataNormalizer.qualityScore"],
    [data?.debug?.contextPipeline?.dataQualityScore, "debug.contextPipeline.dataQualityScore"],
    [data?.debug?.modelPipeline?.lambdaBuilder?.inputQuality?.inputQuality, "debug.modelPipeline.lambdaBuilder.inputQuality.inputQuality"],
    [data?.debug?.modelPipeline?.lambdaBuilder?.inputQuality, "debug.modelPipeline.lambdaBuilder.inputQuality"]
  ]);
}

/* ==========================================
   EXTRAÇÃO DE INCERTEZA V7.2
========================================== */

function extractGlobalSamplingError(
  data: any
): ResolvedNumber {
  return firstResolvedNonNegative([
    [data?.maxSamplingError, "data.maxSamplingError"],
    [data?.simulation?.maxSamplingError, "data.simulation.maxSamplingError"],
    [data?.monteCarlo?.maxSamplingError, "data.monteCarlo.maxSamplingError"],
    [data?.debug?.simulationPipeline?.maxSamplingError, "debug.simulationPipeline.maxSamplingError"],
    [data?.monteCarlo?.maxStandardError, "data.monteCarlo.maxStandardError"]
  ]);
}

function extractGlobalModelSimulationDivergence(
  data: any
): ResolvedNumber {
  return firstResolvedNonNegative([
    [data?.modelSimulationDivergence?.maximum, "data.modelSimulationDivergence.maximum"],
    [data?.modelSimulationDivergence?.average, "data.modelSimulationDivergence.average"],
    [data?.modelDivergence?.maximum, "data.modelDivergence.maximum"],
    [data?.modelDivergence?.average, "data.modelDivergence.average"],
    [data?.simulationDivergence?.maximum, "data.simulationDivergence.maximum"],
    [data?.simulationDivergence?.average, "data.simulationDivergence.average"],
    [data?.debug?.simulationPipeline?.divergence?.maximum, "debug.simulationPipeline.divergence.maximum"],
    [data?.debug?.simulationPipeline?.divergence?.average, "debug.simulationPipeline.divergence.average"]
  ]);
}

function extractMarketSamplingError({
  data,
  market,
  marketName,
  fallback
}: {
  data: any;
  market: any;
  marketName: string;
  fallback: ResolvedNumber;
}): ResolvedNumber {
  const direct = firstResolvedNonNegative([
    [market?.samplingError, "market.samplingError"],
    [market?.monteCarloSamplingError, "market.monteCarloSamplingError"],
    [market?.debug?.simulationPipeline?.samplingError, "market.debug.simulationPipeline.samplingError"]
  ]);

  if (direct.value !== null) {
    return direct;
  }

  const aliases = getSimulationAliases(marketName);
  const containers: Array<[any, string]> = [
    [data?.monteCarlo?.samplingError, "data.monteCarlo.samplingError"],
    [data?.simulation?.samplingError, "data.simulation.samplingError"],
    [data?.debug?.simulationPipeline?.samplingError, "debug.simulationPipeline.samplingError"],
    [data?.debug?.simulationPipeline?.monteCarlo?.samplingError, "debug.simulationPipeline.monteCarlo.samplingError"]
  ];

  for (const [container, source] of containers) {
    for (const alias of aliases) {
      const value = parseNonNegativeNumber(container?.[alias]);

      if (value !== null) {
        return {
          value,
          source: `${source}.${alias}`
        };
      }
    }
  }

  return {
    value: fallback.value,
    source: fallback.value !== null
      ? `fallback:${fallback.source}`
      : "missing"
  };
}

function extractMarketModelSimulationDivergence({
  data,
  market,
  marketName,
  fallback
}: {
  data: any;
  market: any;
  marketName: string;
  fallback: ResolvedNumber;
}): ResolvedNumber {
  const direct = firstResolvedNonNegative([
    [market?.modelSimulationDivergence, "market.modelSimulationDivergence"],
    [market?.simulationDivergence, "market.simulationDivergence"],
    [market?.debug?.simulationPipeline?.difference, "market.debug.simulationPipeline.difference"],
    [market?.debug?.simulationPipeline?.diff, "market.debug.simulationPipeline.diff"]
  ]);

  if (direct.value !== null) {
    return direct;
  }

  const aliases = getSimulationAliases(marketName);
  const containers: Array<[any, string]> = [
    [data?.monteCarlo?.modelComparison, "data.monteCarlo.modelComparison"],
    [data?.debug?.simulationPipeline?.modelComparison, "debug.simulationPipeline.modelComparison"]
  ];

  for (const [container, source] of containers) {
    if (!container || typeof container !== "object") {
      continue;
    }

    for (const alias of aliases) {
      const entry = container[alias];
      const value = firstNonNegativeNumber([
        entry?.diff,
        entry?.difference,
        entry?.absoluteDifference,
        entry?.rawDifference
      ]);

      if (value !== null) {
        return {
          value,
          source: `${source}.${alias}`
        };
      }
    }
  }

  return {
    value: fallback.value,
    source: fallback.value !== null
      ? `fallback:${fallback.source}`
      : "missing"
  };
}

function extractMonteCarloMetadata(
  data: any
): MonteCarloMetadata {
  return {
    valid: firstBoolean([
      data?.monteCarlo?.valid,
      data?.simulation?.valid,
      data?.debug?.simulationPipeline?.valid
    ]),

    converged: firstBoolean([
      data?.monteCarlo?.converged,
      data?.monteCarlo?.convergence?.converged,
      data?.simulation?.converged,
      data?.debug?.simulationPipeline?.converged
    ]),

    simulationQuality: normalizeSimulationQuality(
      firstDefined([
        data?.monteCarlo?.simulationQuality,
        data?.simulation?.simulationQuality,
        data?.debug?.simulationPipeline?.simulationQuality
      ])
    ),

    warnings: normalizeWarnings([
      ...normalizeWarnings(data?.monteCarlo?.warnings),
      ...normalizeWarnings(data?.simulation?.warnings),
      ...normalizeWarnings(data?.debug?.simulationPipeline?.warnings)
    ])
  };
}

function getSimulationAliases(
  market: string
): string[] {
  switch (market) {
    case "HOME":
    case "HOME_WIN":
      return ["HOME_WIN", "HOME", "homeWin", "home"];

    case "DRAW":
      return ["DRAW", "draw"];

    case "AWAY":
    case "AWAY_WIN":
      return ["AWAY_WIN", "AWAY", "awayWin", "away"];

    case "OVER_1_5":
    case "OVER15":
      return ["OVER_1_5", "over15"];

    case "OVER_2_5":
    case "OVER25":
      return ["OVER_2_5", "over25"];

    case "BTTS_YES":
      return ["BTTS_YES", "bttsYes"];

    case "BTTS_NO":
      return ["BTTS_NO", "bttsNo"];

    case "DOUBLE_CHANCE_1X":
    case "1X":
      return ["DOUBLE_CHANCE_1X", "doubleChance1X", "oneX"];

    case "DOUBLE_CHANCE_X2":
    case "X2":
      return ["DOUBLE_CHANCE_X2", "doubleChanceX2", "xTwo"];

    default:
      return [];
  }
}

function normalizeSimulationQuality(
  value: unknown
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toUpperCase();
    return normalized || null;
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return normalizeSimulationQuality(
      (value as any)?.classification ??
      (value as any)?.level ??
      (value as any)?.quality
    );
  }

  return null;
}

function firstResolvedProbability(
  candidates: Array<[unknown, string]>
): ResolvedNumber {
  for (const [candidate, source] of candidates) {
    const value = parseProbability(candidate);

    if (value !== null) {
      return { value, source };
    }
  }

  return { value: null, source: "missing" };
}

function firstResolvedNonNegative(
  candidates: Array<[unknown, string]>
): ResolvedNumber {
  for (const [candidate, source] of candidates) {
    const value = parseNonNegativeNumber(candidate);

    if (value !== null) {
      return { value, source };
    }
  }

  return { value: null, source: "missing" };
}

function firstBoolean(
  candidates: unknown[]
): boolean | null {
  for (const candidate of candidates) {
    if (typeof candidate === "boolean") {
      return candidate;
    }
  }

  return null;
}

function firstDefined(
  candidates: unknown[]
): unknown {
  for (const candidate of candidates) {
    if (candidate !== null && candidate !== undefined) {
      return candidate;
    }
  }

  return null;
}

function firstPositiveNumber(
  candidates: unknown[]
): number | null {
  for (
    const candidate of candidates
  ) {
    const parsed =
      parsePositiveNumber(
        candidate
      );

    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
}

function firstNonNegativeNumber(
  candidates: unknown[]
): number | null {
  for (
    const candidate of candidates
  ) {
    const parsed =
      parseNonNegativeNumber(
        candidate
      );

    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
}

/* ==========================================
   SOMATÓRIO DOS COMPONENTES
========================================== */

function sumComponentsByCategory(
  components: RiskComponent[],
  category:
    RiskComponentCategory
): number {
  return components
    .filter(
      component =>
        component.category ===
        category
    )
    .reduce(
      (
        total,
        component
      ) =>
        total +
        component.adjustment,

      0
    );
}

/* ==========================================
   WARNINGS
========================================== */

function normalizeWarnings(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const warnings =
    value
      .map(
        warning =>
          String(
            warning ?? ""
          ).trim()
      )
      .filter(Boolean);

  return [
    ...new Set(
      warnings
    )
  ];
}

/* ==========================================
   PARSERS
========================================== */

function parseProbability(
  value: unknown
): number | null {
  const parsed =
    parseFiniteNumber(
      value
    );

  if (
    parsed === null ||
    parsed < 0 ||
    parsed > 1
  ) {
    return null;
  }

  return parsed;
}

function parsePositiveNumber(
  value: unknown
): number | null {
  const parsed =
    parseFiniteNumber(
      value
    );

  if (
    parsed === null ||
    parsed <= 0
  ) {
    return null;
  }

  return parsed;
}

function parseNonNegativeNumber(
  value: unknown
): number | null {
  const parsed =
    parseFiniteNumber(
      value
    );

  if (
    parsed === null ||
    parsed < 0
  ) {
    return null;
  }

  return parsed;
}

function parseOdd(
  value: unknown
): number | null {
  const parsed =
    parseFiniteNumber(
      value
    );

  if (
    parsed === null ||
    parsed <= 1
  ) {
    return null;
  }

  return parsed;
}

function parseFiniteNumber(
  value: unknown
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value === "boolean"
  ) {
    return null;
  }

  const parsed =
    Number(
      value
    );

  return Number.isFinite(
    parsed
  )
    ? parsed
    : null;
}

/* ==========================================
   HELPERS NUMÉRICOS
========================================== */

function clampProbability(
  value: number
): number {
  return clamp(
    value,
    0,
    1
  );
}

function clamp(
  value: number,
  minimum: number,
  maximum: number
): number {
  if (
    !Number.isFinite(value)
  ) {
    return maximum;
  }

  return Math.max(
    minimum,
    Math.min(
      value,
      maximum
    )
  );
}

function roundNullableNumber(
  value: number | null,
  decimals = 6
): number | null {
  if (value === null) {
    return null;
  }

  return roundNumber(
    value,
    decimals
  );
}

function roundNumber(
  value: number,
  decimals = 6
): number {
  if (
    !Number.isFinite(value)
  ) {
    return 0;
  }

  const factor =
    10 ** decimals;

  return (
    Math.round(
      value *
      factor
    ) /
    factor
  );
}