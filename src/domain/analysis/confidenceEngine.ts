/* ==========================================
   MARKET CONFIDENCE ENGINE — QUANTIFY V7
========================================== */

/*
 * Responsabilidade:
 *
 * - calcular confiança específica por mercado;
 * - combinar qualidade probabilística, valor,
 *   risco, estrutura e estabilidade do modelo;
 * - produzir uma métrica entre 0 e 1;
 * - não recalcular probabilidade, EV ou risco.
 *
 * Este arquivo não:
 *
 * - escolhe mercados;
 * - classifica apostas;
 * - modifica odds;
 * - modifica risco;
 * - executa Monte Carlo;
 * - calcula confiança global da partida.
 */

/* ==========================================
   CONTRATOS
========================================== */

export type ConfidenceMarket =
  | "HOME"
  | "DRAW"
  | "AWAY"
  | "OVER_1_5"
  | "OVER_2_5"
  | "BTTS_YES"
  | "BTTS_NO"
  | "DOUBLE_CHANCE_1X"
  | "DOUBLE_CHANCE_X2";

export interface MarketConfidenceInput {
  probability: number;
  odds: number;
  ev: number;

  kelly?: number | null;

  lambdaHome: number;
  lambdaAway: number;

  market: string;

  goalExpectationScore?: number | null;

  riskScore: number;

  trapScore?: number | null;

  monteCarloProb?: number | null;
  poissonProb?: number | null;

  globalConfidence?: number | null;
}

export interface MarketConfidenceComponent {
  source: string;
  adjustment: number;
}

export interface MarketConfidenceResult {
  valid: boolean;

  confidence: number;

  market:
    ConfidenceMarket | null;

  baseConfidence: number;

  structuralAdjustment: number;
  valueAdjustment: number;
  riskAdjustment: number;
  modelAgreementAdjustment: number;
  globalConfidenceAdjustment: number;

  totalAdjustment: number;

  components:
    MarketConfidenceComponent[];

  warnings:
    string[];
}

/* ==========================================
   POLÍTICA
========================================== */

/*
 * Os pesos abaixo representam política de
 * confiança operacional.
 *
 * Devem futuramente ser calibrados por:
 *
 * - Brier Score;
 * - taxa de acerto por faixa;
 * - ROI por confidence bucket;
 * - backtest fora da amostra.
 */

const CONFIDENCE_POLICY = {
  base:
    0.50,

  minimum:
    0.05,

  maximum:
    0.90,

  probabilityWeight:
    0.28,

  positiveEvMaximumBoost:
    0.08,

  kellyMaximumBoost:
    0.035,

  lowRiskBoost:
    0.045,

  moderateRiskBoost:
    0.020,

  highRiskPenalty:
    -0.075,

  veryHighRiskPenalty:
    -0.12,

  lowTrapBoost:
    0.025,

  highTrapPenalty:
    -0.055,

  modelAgreementStrong:
    0.055,

  modelAgreementGood:
    0.035,

  modelAgreementModerate:
    0.015,

  modelDisagreementPenalty:
    -0.060,

  globalConfidenceWeight:
    0.18
} as const;

/* ==========================================
   FUNÇÃO PRINCIPAL
========================================== */

export function calculateConfidence(
  input: MarketConfidenceInput
): number {
  return calculateMarketConfidence(
    input
  ).confidence;
}

/*
 * Versão detalhada para o confidencePipeline
 * registrar debug e warnings.
 */
export function calculateMarketConfidence(
  input: MarketConfidenceInput
): MarketConfidenceResult {
  const warnings:
    string[] = [];

  const market =
    normalizeMarket(
      input?.market
    );

  const probability =
    parseProbability(
      input?.probability
    );

  const odds =
    parseOdd(
      input?.odds
    );

  const ev =
    parseFiniteNumber(
      input?.ev
    );

  const risk =
    parseProbability(
      input?.riskScore
    );

  const lambdaHome =
    parsePositiveNumber(
      input?.lambdaHome
    );

  const lambdaAway =
    parsePositiveNumber(
      input?.lambdaAway
    );

  if (!market) {
    warnings.push(
      "UNSUPPORTED_CONFIDENCE_MARKET"
    );
  }

  if (probability === null) {
    warnings.push(
      "INVALID_CONFIDENCE_PROBABILITY"
    );
  }

  if (odds === null) {
    warnings.push(
      "INVALID_CONFIDENCE_ODD"
    );
  }

  if (ev === null) {
    warnings.push(
      "INVALID_CONFIDENCE_EV"
    );
  }

  if (risk === null) {
    warnings.push(
      "INVALID_CONFIDENCE_RISK"
    );
  }

  if (
    lambdaHome === null ||
    lambdaAway === null
  ) {
    warnings.push(
      "INVALID_CONFIDENCE_LAMBDAS"
    );
  }

  if (
    !market ||
    probability === null ||
    odds === null ||
    ev === null ||
    risk === null ||
    lambdaHome === null ||
    lambdaAway === null
  ) {
    return createInvalidResult(
      market,
      warnings
    );
  }

  const kelly =
    parseNonNegativeNumber(
      input?.kelly
    );

  const goalExpectationScore =
    parseProbability(
      input?.goalExpectationScore
    );

  const trapScore =
    parseProbability(
      input?.trapScore
    );

  const monteCarloProb =
    parseProbability(
      input?.monteCarloProb
    );

  const poissonProb =
    parseProbability(
      input?.poissonProb
    );

  const globalConfidence =
    parseProbability(
      input?.globalConfidence
    );

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

  const components:
    MarketConfidenceComponent[] = [];

  /* ==========================================
     BASE PROBABILÍSTICA
  ========================================== */

  /*
   * Probabilidade não é confiança sozinha.
   *
   * Ela apenas desloca moderadamente a base.
   */
  const probabilityAdjustment =
    (
      probability -
      0.50
    ) *
    CONFIDENCE_POLICY
      .probabilityWeight;

  addComponent(
    components,
    "PROBABILITY_SIGNAL",
    probabilityAdjustment
  );

  /* ==========================================
     VALOR
  ========================================== */

  addValueComponents({
    components,
    probability,
    odds,
    ev,
    kelly
  });

  /* ==========================================
     RISCO
  ========================================== */

  addRiskComponents({
    components,
    risk,
    trapScore
  });

  /* ==========================================
     ACORDO ENTRE MODELOS
  ========================================== */

  addModelAgreementComponents({
    components,
    monteCarloProb,
    poissonProb
  });

  /* ==========================================
     CONFIANÇA GLOBAL
  ========================================== */

  addGlobalConfidenceComponent({
    components,
    globalConfidence
  });

  /* ==========================================
     ESTRUTURA POR MERCADO
  ========================================== */

  addMarketStructureComponents({
    components,

    market,

    probability,
    odds,
    ev,
    risk,

    totalLambda,
    lambdaDifference,
    minimumLambda,

    goalExpectationScore
  });

  const structuralAdjustment =
    sumByPrefix(
      components,
      "STRUCTURE_"
    );

  const valueAdjustment =
    sumByPrefix(
      components,
      "VALUE_"
    );

  const riskAdjustment =
    sumByPrefix(
      components,
      "RISK_"
    );

  const modelAgreementAdjustment =
    sumByPrefix(
      components,
      "MODEL_"
    );

  const globalConfidenceAdjustment =
    sumByPrefix(
      components,
      "GLOBAL_"
    );

  const totalAdjustment =
    components.reduce(
      (
        total,
        component
      ) =>
        total +
        component.adjustment,
      0
    );

  let confidence =
    CONFIDENCE_POLICY.base +
    totalAdjustment;

  /* ==========================================
     TETOS DEFENSIVOS
  ========================================== */

  /*
   * Mercados de alto risco não podem atingir
   * confiança máxima apenas por EV elevado.
   */
  if (risk >= 0.70) {
    confidence =
      Math.min(
        confidence,
        0.58
      );

    warnings.push(
      "CONFIDENCE_CAPPED_BY_HIGH_RISK"
    );
  } else if (risk >= 0.60) {
    confidence =
      Math.min(
        confidence,
        0.68
      );

    warnings.push(
      "CONFIDENCE_CAPPED_BY_MODERATE_HIGH_RISK"
    );
  }

  /*
   * EV pequeno limita a confiança operacional.
   */
  if (ev < 0.04) {
    confidence =
      Math.min(
        confidence,
        0.60
      );

    warnings.push(
      "CONFIDENCE_CAPPED_BY_LOW_EV"
    );
  }

  /*
   * Divergência forte entre modelos limita a
   * confiança, mesmo que outros sinais sejam bons.
   */
  if (
    monteCarloProb !== null &&
    poissonProb !== null &&
    Math.abs(
      monteCarloProb -
      poissonProb
    ) >= 0.16
  ) {
    confidence =
      Math.min(
        confidence,
        0.62
      );

    warnings.push(
      "CONFIDENCE_CAPPED_BY_MODEL_DIVERGENCE"
    );
  }

  /*
   * Trap só limita quando realmente existe.
   * Ausência de trapScore não é tratada como 0.5.
   */
  if (
    trapScore !== null &&
    trapScore >= 0.60
  ) {
    confidence =
      Math.min(
        confidence,
        0.58
      );

    warnings.push(
      "CONFIDENCE_CAPPED_BY_TRAP_SCORE"
    );
  }

  confidence =
    clamp(
      confidence,
      CONFIDENCE_POLICY.minimum,
      CONFIDENCE_POLICY.maximum
    );

  return {
    valid:
      true,

    confidence:
      roundNumber(
        confidence
      ),

    market,

    baseConfidence:
      CONFIDENCE_POLICY.base,

    structuralAdjustment:
      roundNumber(
        structuralAdjustment
      ),

    valueAdjustment:
      roundNumber(
        valueAdjustment
      ),

    riskAdjustment:
      roundNumber(
        riskAdjustment
      ),

    modelAgreementAdjustment:
      roundNumber(
        modelAgreementAdjustment
      ),

    globalConfidenceAdjustment:
      roundNumber(
        globalConfidenceAdjustment
      ),

    totalAdjustment:
      roundNumber(
        totalAdjustment
      ),

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
      normalizeWarnings(
        warnings
      )
  };
}

/* ==========================================
   VALOR
========================================== */

function addValueComponents({
  components,
  probability,
  odds,
  ev,
  kelly
}: {
  components:
    MarketConfidenceComponent[];

  probability:
    number;

  odds:
    number;

  ev:
    number;

  kelly:
    number | null;
}) {
  if (
    ev > 0 &&
    probability >= 0.55
  ) {
    addComponent(
      components,
      "VALUE_POSITIVE_EV",

      Math.min(
        CONFIDENCE_POLICY
          .positiveEvMaximumBoost,
        ev * 0.20
      )
    );
  }

  if (
    ev >= 0.15 &&
    probability >= 0.58 &&
    odds >= 1.50
  ) {
    addComponent(
      components,
      "VALUE_STRONG_EV",
      0.030
    );
  }

  if (
    kelly !== null &&
    kelly > 0 &&
    probability >= 0.55
  ) {
    addComponent(
      components,
      "VALUE_KELLY_SUPPORT",

      Math.min(
        CONFIDENCE_POLICY
          .kellyMaximumBoost,
        kelly * 0.12
      )
    );
  }

  if (ev <= 0) {
    addComponent(
      components,
      "VALUE_NON_POSITIVE_EV",
      -0.10
    );
  }
}

/* ==========================================
   RISCO E TRAP
========================================== */

function addRiskComponents({
  components,
  risk,
  trapScore
}: {
  components:
    MarketConfidenceComponent[];

  risk:
    number;

  trapScore:
    number | null;
}) {
  if (risk <= 0.35) {
    addComponent(
      components,
      "RISK_LOW",
      CONFIDENCE_POLICY
        .lowRiskBoost
    );
  } else if (risk <= 0.45) {
    addComponent(
      components,
      "RISK_MODERATE",
      CONFIDENCE_POLICY
        .moderateRiskBoost
    );
  } else if (risk >= 0.75) {
    addComponent(
      components,
      "RISK_VERY_HIGH",
      CONFIDENCE_POLICY
        .veryHighRiskPenalty
    );
  } else if (risk >= 0.65) {
    addComponent(
      components,
      "RISK_HIGH",
      CONFIDENCE_POLICY
        .highRiskPenalty
    );
  }

  if (trapScore === null) {
    return;
  }

  if (trapScore <= 0.20) {
    addComponent(
      components,
      "RISK_LOW_TRAP",
      CONFIDENCE_POLICY
        .lowTrapBoost
    );
  } else if (trapScore >= 0.60) {
    addComponent(
      components,
      "RISK_HIGH_TRAP",
      CONFIDENCE_POLICY
        .highTrapPenalty
    );
  }
}

/* ==========================================
   ACORDO ENTRE MODELOS
========================================== */

function addModelAgreementComponents({
  components,
  monteCarloProb,
  poissonProb
}: {
  components:
    MarketConfidenceComponent[];

  monteCarloProb:
    number | null;

  poissonProb:
    number | null;
}) {
  /*
   * Ausência de um dos modelos não gera
   * penalização automática.
   */
  if (
    monteCarloProb === null ||
    poissonProb === null
  ) {
    return;
  }

  const difference =
    Math.abs(
      monteCarloProb -
      poissonProb
    );

  if (difference <= 0.04) {
    addComponent(
      components,
      "MODEL_STRONG_AGREEMENT",
      CONFIDENCE_POLICY
        .modelAgreementStrong
    );
  } else if (difference <= 0.07) {
    addComponent(
      components,
      "MODEL_GOOD_AGREEMENT",
      CONFIDENCE_POLICY
        .modelAgreementGood
    );
  } else if (difference <= 0.10) {
    addComponent(
      components,
      "MODEL_MODERATE_AGREEMENT",
      CONFIDENCE_POLICY
        .modelAgreementModerate
    );
  } else if (difference >= 0.16) {
    addComponent(
      components,
      "MODEL_STRONG_DISAGREEMENT",
      CONFIDENCE_POLICY
        .modelDisagreementPenalty
    );
  }
}

/* ==========================================
   CONFIANÇA GLOBAL
========================================== */

function addGlobalConfidenceComponent({
  components,
  globalConfidence
}: {
  components:
    MarketConfidenceComponent[];

  globalConfidence:
    number | null;
}) {
  if (globalConfidence === null) {
    return;
  }

  /*
   * Confiança global é moderadora, não deve
   * dominar a confiança do mercado.
   *
   * 0.50 é neutro.
   */
  const adjustment =
    (
      globalConfidence -
      0.50
    ) *
    CONFIDENCE_POLICY
      .globalConfidenceWeight;

  addComponent(
    components,
    "GLOBAL_MODEL_CONFIDENCE",
    adjustment
  );
}

/* ==========================================
   ESTRUTURA POR MERCADO
========================================== */

function addMarketStructureComponents({
  components,

  market,

  probability,
  odds,
  ev,
  risk,

  totalLambda,
  lambdaDifference,
  minimumLambda,

  goalExpectationScore
}: {
  components:
    MarketConfidenceComponent[];

  market:
    ConfidenceMarket;

  probability:
    number;

  odds:
    number;

  ev:
    number;

  risk:
    number;

  totalLambda:
    number;

  lambdaDifference:
    number;

  minimumLambda:
    number;

  goalExpectationScore:
    number | null;
}) {
  switch (market) {
    case "OVER_1_5":
    case "OVER_2_5":
      addOverStructure({
        components,

        market,

        probability,
        odds,
        ev,
        risk,

        totalLambda,
        goalExpectationScore
      });

      break;

    case "BTTS_YES":
      addBttsYesStructure({
        components,

        probability,
        ev,
        risk,

        totalLambda,
        lambdaDifference,
        minimumLambda,

        goalExpectationScore
      });

      break;

    case "BTTS_NO":
      addBttsNoStructure({
        components,

        probability,
        risk,

        totalLambda,
        minimumLambda,

        goalExpectationScore
      });

      break;

    case "HOME":
    case "AWAY":
      addResultStructure({
        components,

        probability,
        odds,

        lambdaDifference
      });

      break;

    case "DRAW":
      addDrawStructure({
        components,

        probability,
        odds,

        lambdaDifference
      });

      break;

    case "DOUBLE_CHANCE_1X":
    case "DOUBLE_CHANCE_X2":
      addDoubleChanceStructure({
        components,

        probability,
        odds,
        ev,
        risk,

        lambdaDifference
      });

      break;
  }
}

/* ==========================================
   OVER
========================================== */

function addOverStructure({
  components,

  market,

  probability,
  odds,
  ev,
  risk,

  totalLambda,
  goalExpectationScore
}: {
  components:
    MarketConfidenceComponent[];

  market:
    "OVER_1_5" |
    "OVER_2_5";

  probability:
    number;

  odds:
    number;

  ev:
    number;

  risk:
    number;

  totalLambda:
    number;

  goalExpectationScore:
    number | null;
}) {
  addComponent(
    components,
    "STRUCTURE_OVER_TOTAL_LAMBDA",

    clamp(
      (
        totalLambda -
        2.45
      ) * 0.07,
      -0.055,
      0.075
    )
  );

  if (
    goalExpectationScore !== null
  ) {
    addComponent(
      components,
      "STRUCTURE_OVER_GOAL_SCORE",

      clamp(
        (
          goalExpectationScore -
          0.55
        ) * 0.16,
        -0.050,
        0.060
      )
    );
  }

  if (
    market === "OVER_1_5" &&
    probability >= 0.78 &&
    totalLambda >= 2.70 &&
    ev >= 0.08 &&
    risk <= 0.48
  ) {
    addComponent(
      components,
      "STRUCTURE_OVER_1_5_STRONG_SETUP",
      0.045
    );
  }

  if (
    market === "OVER_2_5" &&
    probability >= 0.63 &&
    totalLambda >= 2.80 &&
    ev >= 0.10 &&
    risk <= 0.52
  ) {
    addComponent(
      components,
      "STRUCTURE_OVER_2_5_STRONG_SETUP",
      0.040
    );
  }

  /*
   * Odd muito baixa torna o mercado sensível a
   * pequenos erros de probabilidade.
   */
  if (
    market === "OVER_1_5" &&
    odds < 1.40
  ) {
    addComponent(
      components,
      "STRUCTURE_OVER_1_5_LOW_ODD",
      -0.055
    );
  }

  if (
    market === "OVER_2_5" &&
    totalLambda < 2.35
  ) {
    addComponent(
      components,
      "STRUCTURE_OVER_2_5_LOW_LAMBDA",
      -0.060
    );
  }
}

/* ==========================================
   BTTS YES
========================================== */

function addBttsYesStructure({
  components,

  probability,
  ev,
  risk,

  totalLambda,
  lambdaDifference,
  minimumLambda,

  goalExpectationScore
}: {
  components:
    MarketConfidenceComponent[];

  probability:
    number;

  ev:
    number;

  risk:
    number;

  totalLambda:
    number;

  lambdaDifference:
    number;

  minimumLambda:
    number;

  goalExpectationScore:
    number | null;
}) {
  if (totalLambda >= 2.75) {
    addComponent(
      components,
      "STRUCTURE_BTTS_YES_TOTAL_LAMBDA",
      0.030
    );
  }

  if (minimumLambda >= 1.0) {
    addComponent(
      components,
      "STRUCTURE_BTTS_YES_MINIMUM_LAMBDA",
      0.040
    );
  }

  if (
    goalExpectationScore !== null
  ) {
    addComponent(
      components,
      "STRUCTURE_BTTS_YES_GOAL_SCORE",

      clamp(
        (
          goalExpectationScore -
          0.50
        ) * 0.14,
        -0.045,
        0.055
      )
    );
  }

  if (
    probability >= 0.60 &&
    totalLambda >= 2.70 &&
    minimumLambda >= 0.95 &&
    risk <= 0.48 &&
    ev >= 0.08
  ) {
    addComponent(
      components,
      "STRUCTURE_BTTS_YES_STRONG_SETUP",
      0.045
    );
  }

  if (minimumLambda < 0.80) {
    addComponent(
      components,
      "STRUCTURE_BTTS_YES_LOW_TEAM_LAMBDA",
      -0.070
    );
  }

  if (lambdaDifference > 1.20) {
    addComponent(
      components,
      "STRUCTURE_BTTS_YES_UNBALANCED",
      -0.040
    );
  }
}

/* ==========================================
   BTTS NO
========================================== */

function addBttsNoStructure({
  components,

  probability,
  risk,

  totalLambda,
  minimumLambda,

  goalExpectationScore
}: {
  components:
    MarketConfidenceComponent[];

  probability:
    number;

  risk:
    number;

  totalLambda:
    number;

  minimumLambda:
    number;

  goalExpectationScore:
    number | null;
}) {
  if (totalLambda <= 2.25) {
    addComponent(
      components,
      "STRUCTURE_BTTS_NO_LOW_TOTAL_LAMBDA",
      0.045
    );
  }

  if (minimumLambda < 0.75) {
    addComponent(
      components,
      "STRUCTURE_BTTS_NO_LOW_TEAM_LAMBDA",
      0.045
    );
  }

  if (
    goalExpectationScore !== null &&
    goalExpectationScore <= 0.45
  ) {
    addComponent(
      components,
      "STRUCTURE_BTTS_NO_LOW_GOAL_SCORE",
      0.035
    );
  }

  if (
    totalLambda >= 3.00 &&
    minimumLambda >= 0.90
  ) {
    addComponent(
      components,
      "STRUCTURE_BTTS_NO_DISTRIBUTED_GOALS",
      -0.075
    );
  }

  if (
    probability >= 0.60 &&
    risk <= 0.50 &&
    totalLambda <= 2.40
  ) {
    addComponent(
      components,
      "STRUCTURE_BTTS_NO_STRONG_SETUP",
      0.035
    );
  }
}

/* ==========================================
   RESULTADO
========================================== */

function addResultStructure({
  components,

  probability,
  odds,

  lambdaDifference
}: {
  components:
    MarketConfidenceComponent[];

  probability:
    number;

  odds:
    number;

  lambdaDifference:
    number;
}) {
  addComponent(
    components,
    "STRUCTURE_RESULT_LAMBDA_DIFFERENCE",

    clamp(
      lambdaDifference * 0.045,
      -0.020,
      0.055
    )
  );

  if (lambdaDifference < 0.30) {
    addComponent(
      components,
      "STRUCTURE_RESULT_BALANCED_GAME",
      -0.055
    );
  }

  if (probability < 0.42) {
    addComponent(
      components,
      "STRUCTURE_RESULT_LOW_PROBABILITY",
      -0.040
    );
  }

  if (
    odds > 3.20 &&
    probability < 0.45
  ) {
    addComponent(
      components,
      "STRUCTURE_RESULT_LONG_ODD",
      -0.060
    );
  }
}

/* ==========================================
   EMPATE
========================================== */

function addDrawStructure({
  components,

  probability,
  odds,

  lambdaDifference
}: {
  components:
    MarketConfidenceComponent[];

  probability:
    number;

  odds:
    number;

  lambdaDifference:
    number;
}) {
  if (lambdaDifference < 0.25) {
    addComponent(
      components,
      "STRUCTURE_DRAW_BALANCED_GAME",
      0.035
    );
  } else {
    addComponent(
      components,
      "STRUCTURE_DRAW_UNBALANCED_GAME",
      -0.035
    );
  }

  if (probability < 0.25) {
    addComponent(
      components,
      "STRUCTURE_DRAW_LOW_PROBABILITY",
      -0.040
    );
  }

  if (odds < 2.80) {
    addComponent(
      components,
      "STRUCTURE_DRAW_LOW_ODD",
      -0.030
    );
  }
}

/* ==========================================
   DUPLA CHANCE
========================================== */

function addDoubleChanceStructure({
  components,

  probability,
  odds,
  ev,
  risk,

  lambdaDifference
}: {
  components:
    MarketConfidenceComponent[];

  probability:
    number;

  odds:
    number;

  ev:
    number;

  risk:
    number;

  lambdaDifference:
    number;
}) {
  addComponent(
    components,
    "STRUCTURE_DOUBLE_CHANCE_LAMBDA_DIFFERENCE",

    clamp(
      lambdaDifference * 0.035,
      -0.025,
      0.045
    )
  );

  if (odds < 1.30) {
    addComponent(
      components,
      "STRUCTURE_DOUBLE_CHANCE_LOW_ODD",
      -0.080
    );
  }

  if (probability < 0.62) {
    addComponent(
      components,
      "STRUCTURE_DOUBLE_CHANCE_LOW_PROBABILITY",
      -0.045
    );
  }

  if (odds > 1.85) {
    addComponent(
      components,
      "STRUCTURE_DOUBLE_CHANCE_HIGH_ODD",
      -0.040
    );
  }

  if (odds > 2.20) {
    addComponent(
      components,
      "STRUCTURE_DOUBLE_CHANCE_VERY_HIGH_ODD",
      -0.070
    );
  }

  if (
    probability >= 0.66 &&
    ev >= 0.07 &&
    risk <= 0.52 &&
    odds >= 1.35 &&
    odds <= 1.85
  ) {
    addComponent(
      components,
      "STRUCTURE_DOUBLE_CHANCE_STRONG_SETUP",
      0.045
    );
  }
}

/* ==========================================
   RESULTADO INVÁLIDO
========================================== */

function createInvalidResult(
  market:
    ConfidenceMarket | null,

  warnings:
    string[]
): MarketConfidenceResult {
  return {
    valid:
      false,

    confidence:
      0,

    market,

    baseConfidence:
      0,

    structuralAdjustment:
      0,

    valueAdjustment:
      0,

    riskAdjustment:
      0,

    modelAgreementAdjustment:
      0,

    globalConfidenceAdjustment:
      0,

    totalAdjustment:
      0,

    components:
      [],

    warnings:
      normalizeWarnings(
        warnings
      )
  };
}

/* ==========================================
   MERCADOS
========================================== */

function normalizeMarket(
  value: unknown
): ConfidenceMarket | null {
  const market =
    String(
      value ??
      ""
    )
      .trim()
      .toUpperCase();

  switch (market) {
    case "HOME":
    case "HOME_WIN":
      return "HOME";

    case "DRAW":
      return "DRAW";

    case "AWAY":
    case "AWAY_WIN":
      return "AWAY";

    case "OVER_1_5":
    case "OVER15":
    case "OVER 1.5":
      return "OVER_1_5";

    case "OVER_2_5":
    case "OVER25":
    case "OVER 2.5":
      return "OVER_2_5";

    case "BTTS_YES":
    case "BTTS YES":
      return "BTTS_YES";

    case "BTTS_NO":
    case "BTTS NO":
      return "BTTS_NO";

    case "DOUBLE_CHANCE_1X":
    case "1X":
      return "DOUBLE_CHANCE_1X";

    case "DOUBLE_CHANCE_X2":
    case "X2":
      return "DOUBLE_CHANCE_X2";

    default:
      return null;
  }
}

/* ==========================================
   HELPERS
========================================== */

function addComponent(
  components:
    MarketConfidenceComponent[],

  source:
    string,

  adjustment:
    number
) {
  if (
    !Number.isFinite(
      adjustment
    ) ||
    Math.abs(
      adjustment
    ) <= 1e-12
  ) {
    return;
  }

  components.push({
    source,
    adjustment
  });
}

function sumByPrefix(
  components:
    MarketConfidenceComponent[],

  prefix:
    string
): number {
  return components
    .filter(
      component =>
        component.source
          .startsWith(
            prefix
          )
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

function parseProbability(
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
    Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed < 0 ||
    parsed > 1
  ) {
    return null;
  }

  return parsed;
}

function parseOdd(
  value: unknown
): number | null {
  const parsed =
    Number(value);

  if (
    !Number.isFinite(parsed) ||
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
    Number(value);

  return Number.isFinite(
    parsed
  )
    ? parsed
    : null;
}

function parsePositiveNumber(
  value: unknown
): number | null {
  const parsed =
    Number(value);

  if (
    !Number.isFinite(parsed) ||
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
    Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed < 0
  ) {
    return null;
  }

  return parsed;
}

function normalizeWarnings(
  warnings:
    string[]
): string[] {
  return [
    ...new Set(
      warnings
        .map(
          warning =>
            String(
              warning ??
              ""
            ).trim()
        )
        .filter(Boolean)
    )
  ];
}

function clamp(
  value:
    number,

  minimum:
    number,

  maximum:
    number
): number {
  if (
    !Number.isFinite(
      value
    )
  ) {
    return minimum;
  }

  return Math.max(
    minimum,
    Math.min(
      value,
      maximum
    )
  );
}

function roundNumber(
  value:
    number,

  decimals =
    4
): number {
  if (
    !Number.isFinite(
      value
    )
  ) {
    return 0;
  }

  const factor =
    10 **
    decimals;

  return (
    Math.round(
      value *
      factor
    ) /
    factor
  );
}