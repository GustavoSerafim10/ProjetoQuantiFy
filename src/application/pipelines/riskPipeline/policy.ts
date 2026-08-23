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

  /*
   * Empate Anula (DNB): jogo equilibrado é MENOS arriscado
   * aqui do que em DOUBLE_CHANCE, porque o próprio cenário
   * que mais preocupa num jogo equilibrado — o empate — é
   * justamente anulado (stake devolvido), não perdido. Por
   * isso o valor é bem mais leve, não uma cópia direta.
   */
  balancedDnb:
    0.015,

  balancedBttsNo:
    0.035,

  lowGoalGameOver:
    0.055,

  goalScoreContradictsOver:
    0.065,

  goalScoreModeratelyContradictsOver:
    0.035,

  /*
   * Espelha goalScoreContradictsOver para os mercados
   * Under (mesma magnitude, sinal invertido: aqui é
   * goalExpectationScore alto demais que contradiz).
   */
  goalScoreContradictsUnder:
    0.065,

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

  /*
   * Modelo x mercado.
   *
   * Auditoria 2026-08-22: mercado de longshot (Fluminense
   * x Remo, AWAY a 18,9% de probabilidade contra 13,3%
   * implícito na odd 7.50) mostrou EV de 42% sem nenhuma
   * penalidade de divergência, porque o gap absoluto
   * (5,57 p.p.) ficava abaixo do limiar "moderado" (10 p.p.)
   * calibrado para mercados perto de 50%. Em termos
   * proporcionais esse mesmo gap é uma divergência de 42%
   * sobre a probabilidade implícita do mercado — nada
   * moderado. Ver divergence.ts: a comparação passou a usar
   * relativeMarketDisagreement (proporcional à probabilidade
   * implícita) em vez do gap absoluto, então estes valores
   * também mudaram de escala (de pontos percentuais para
   * fração relativa).
   */

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

  /*
   * Escala relativa (fração da probabilidade implícita da
   * odd), não mais pontos percentuais absolutos — ver nota
   * em RISK_POLICY acima.
   */
  moderateMarketDisagreement:
    0.15,

  highMarketDisagreement:
    0.30,

  extremeMarketDisagreement:
    0.50,

  severeMarketDisagreement:
    0.75,

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
