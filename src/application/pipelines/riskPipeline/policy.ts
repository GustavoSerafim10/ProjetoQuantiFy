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

export const RISK_POLICY = {
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

export const STRUCTURE_THRESHOLDS = {
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
