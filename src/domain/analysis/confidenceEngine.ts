/* ==========================================
   MARKET CONFIDENCE ENGINE — QUANTIFY V7.1
========================================== */

/*
 * Responsabilidade:
 *
 * - calcular a confiabilidade da probabilidade
 *   estimada para cada mercado;
 * - avaliar coerência estrutural entre mercado,
 *   lambdas e expectativa de gols;
 * - considerar estabilidade entre modelos;
 * - considerar confiança global e qualidade dos dados;
 * - produzir uma métrica entre 0 e 1.
 *
 * Este arquivo não:
 *
 * - recalcula probabilidade;
 * - recalcula EV;
 * - avalia valor da odd;
 * - calcula Kelly;
 * - recalcula risco;
 * - avalia trap;
 * - escolhe mercados;
 * - classifica apostas;
 * - toma a decisão final.
 *
 * Compatibilidade:
 *
 * Os campos odds, ev, kelly, riskScore e trapScore
 * permanecem opcionais no contrato para evitar quebra
 * imediata de consumidores antigos, mas não participam
 * do cálculo de confiança.
 */

export type ConfidenceMarket =
  | "HOME"
  | "DRAW"
  | "AWAY"
  | "OVER_1_5"
  | "OVER_2_5"
  | "UNDER_1_5"
  | "UNDER_2_5"
  | "BTTS_YES"
  | "BTTS_NO"
  | "DOUBLE_CHANCE_1X"
  | "DOUBLE_CHANCE_X2"
  | "DNB_HOME"
  | "DNB_AWAY";

export interface MarketConfidenceInput {
  probability: number;
  lambdaHome: number;
  lambdaAway: number;
  market: string;

  goalExpectationScore?: number | null;
  contextualGoalExpectationScore?: number | null;

  monteCarloProb?: number | null;
  poissonProb?: number | null;
  globalConfidence?: number | null;

  sampleReliability?: number | null;
  leagueTrust?: number | null;

  // Legado: mantidos apenas para compatibilidade.
  odds?: number | null;
  ev?: number | null;
  kelly?: number | null;
  riskScore?: number | null;
  trapScore?: number | null;
}

export interface MarketConfidenceComponent {
  source: string;
  adjustment: number;
}

export interface MarketConfidenceResult {
  valid: boolean;
  confidence: number;
  market: ConfidenceMarket | null;
  baseConfidence: number;
  probabilityAdjustment: number;
  structuralAdjustment: number;
  modelAgreementAdjustment: number;
  globalConfidenceAdjustment: number;
  dataQualityAdjustment: number;
  totalAdjustment: number;

  /*
   * FASE 2 do Decision Intelligence Layer (2026-09-04): mesma
   * divergência |monteCarloProb - poissonProb| que já produzia os
   * componentes MODEL_* acima (e o cap de confiança em caso de
   * forte divergência), só que exposta como um número contínuo
   * 0–1 em vez de ficar implícita dentro do ajuste de confidence.
   *
   * Não substitui nem recalcula nada: quando os dois modelos não
   * estão disponíveis o valor é null (nenhuma opinião), e quando
   * estão, é só uma reformulação legível/auditável do mesmo sinal
   * que já influenciava `confidence`. Não introduz nenhum novo
   * ajuste numérico em `confidence` — é telemetria, não decisão.
   */
  modelAgreementScore: number | null;

  components: MarketConfidenceComponent[];
  warnings: string[];
}

interface StructuralMetrics {
  totalLambda: number;
  lambdaDifference: number;
  minimumLambda: number;
  directionalAdvantage: number | null;
}

const CONFIDENCE_POLICY = {
  base: 0.50,
  minimum: 0.05,
  maximum: 0.90,

  probabilityWeight: 0.14,

  modelAgreementStrong: 0.035,
  modelAgreementGood: 0.022,
  modelAgreementModerate: 0.010,
  modelDisagreementPenalty: -0.050,

  globalConfidenceWeight: 0.22,
  sampleReliabilityWeight: 0.16,
  leagueTrustWeight: 0.10,

  strongModelDivergenceCap: 0.62,
  lowSampleReliabilityCap: 0.60,
  lowLeagueTrustCap: 0.62
} as const;

export function calculateConfidence(
  input: MarketConfidenceInput
): number {
  return calculateMarketConfidence(input).confidence;
}

export function calculateMarketConfidence(
  input: MarketConfidenceInput
): MarketConfidenceResult {
  const warnings: string[] = [];

  const market = normalizeMarket(input?.market);
  const probability = parseProbability(input?.probability);
  const lambdaHome = parsePositiveNumber(input?.lambdaHome);
  const lambdaAway = parsePositiveNumber(input?.lambdaAway);

  if (!market) {
    warnings.push("UNSUPPORTED_CONFIDENCE_MARKET");
  }

  if (probability === null) {
    warnings.push("INVALID_CONFIDENCE_PROBABILITY");
  }

  if (lambdaHome === null || lambdaAway === null) {
    warnings.push("INVALID_CONFIDENCE_LAMBDAS");
  }

  if (
    !market ||
    probability === null ||
    lambdaHome === null ||
    lambdaAway === null
  ) {
    return createInvalidResult(market, warnings);
  }

  const goalExpectationScore =
    parseProbability(input?.goalExpectationScore);

  const contextualGoalExpectationScore =
    parseProbability(input?.contextualGoalExpectationScore);

  const monteCarloProb =
    parseProbability(input?.monteCarloProb);

  const poissonProb =
    parseProbability(input?.poissonProb);

  const globalConfidence =
    parseProbability(input?.globalConfidence);

  const sampleReliability =
    parseProbability(input?.sampleReliability);

  const leagueTrust =
    parseProbability(input?.leagueTrust);

  registerOptionalInputWarning(
    input?.goalExpectationScore,
    goalExpectationScore,
    "INVALID_GOAL_EXPECTATION_SCORE",
    warnings
  );

  registerOptionalInputWarning(
    input?.contextualGoalExpectationScore,
    contextualGoalExpectationScore,
    "INVALID_CONTEXTUAL_GOAL_EXPECTATION_SCORE",
    warnings
  );

  registerOptionalInputWarning(
    input?.monteCarloProb,
    monteCarloProb,
    "INVALID_MONTE_CARLO_PROBABILITY",
    warnings
  );

  registerOptionalInputWarning(
    input?.poissonProb,
    poissonProb,
    "INVALID_POISSON_PROBABILITY",
    warnings
  );

  registerOptionalInputWarning(
    input?.globalConfidence,
    globalConfidence,
    "INVALID_GLOBAL_CONFIDENCE",
    warnings
  );

  registerOptionalInputWarning(
    input?.sampleReliability,
    sampleReliability,
    "INVALID_SAMPLE_RELIABILITY",
    warnings
  );

  registerOptionalInputWarning(
    input?.leagueTrust,
    leagueTrust,
    "INVALID_LEAGUE_TRUST",
    warnings
  );

  if (
    goalExpectationScore === null &&
    contextualGoalExpectationScore !== null
  ) {
    warnings.push(
      "CONFIDENCE_USING_CONTEXTUAL_GOAL_SUPPORT_ONLY"
    );
  }

  const metrics =
    buildStructuralMetrics(
      market,
      lambdaHome,
      lambdaAway
    );

  const components: MarketConfidenceComponent[] = [];

  const probabilityAdjustment =
    (probability - 0.50) *
    CONFIDENCE_POLICY.probabilityWeight;

  addComponent(
    components,
    "PROBABILITY_SIGNAL",
    probabilityAdjustment
  );

  addModelAgreementComponents({
    components,
    monteCarloProb,
    poissonProb
  });

  addGlobalConfidenceComponent({
    components,
    globalConfidence
  });

  addDataQualityComponents({
    components,
    sampleReliability,
    leagueTrust
  });

  addMarketStructureComponents({
    components,
    market,
    lambdaHome,
    lambdaAway,
    metrics,
    goalExpectationScore,
    contextualGoalExpectationScore
  });

  const probabilityAdjustmentTotal =
    sumByPrefix(components, "PROBABILITY_");

  const structuralAdjustment =
    sumByPrefix(components, "STRUCTURE_");

  const modelAgreementAdjustment =
    sumByPrefix(components, "MODEL_");

  const globalConfidenceAdjustment =
    sumByPrefix(components, "GLOBAL_");

  const dataQualityAdjustment =
    sumByPrefix(components, "DATA_");

  const totalAdjustment =
    components.reduce(
      (total, component) =>
        total + component.adjustment,
      0
    );

  let confidence =
    CONFIDENCE_POLICY.base +
    totalAdjustment;

  if (
    monteCarloProb !== null &&
    poissonProb !== null &&
    Math.abs(monteCarloProb - poissonProb) >= 0.16
  ) {
    confidence = Math.min(
      confidence,
      CONFIDENCE_POLICY.strongModelDivergenceCap
    );

    warnings.push(
      "CONFIDENCE_CAPPED_BY_MODEL_DIVERGENCE"
    );
  }

  if (
    sampleReliability !== null &&
    sampleReliability < 0.50
  ) {
    confidence = Math.min(
      confidence,
      CONFIDENCE_POLICY.lowSampleReliabilityCap
    );

    warnings.push(
      "CONFIDENCE_CAPPED_BY_LOW_SAMPLE_RELIABILITY"
    );
  }

  if (
    leagueTrust !== null &&
    leagueTrust < 0.45
  ) {
    confidence = Math.min(
      confidence,
      CONFIDENCE_POLICY.lowLeagueTrustCap
    );

    warnings.push(
      "CONFIDENCE_CAPPED_BY_LOW_LEAGUE_TRUST"
    );
  }

  confidence = clamp(
    confidence,
    CONFIDENCE_POLICY.minimum,
    CONFIDENCE_POLICY.maximum
  );

  const modelAgreementScore =
    calculateModelAgreementScore(
      monteCarloProb,
      poissonProb
    );

  return {
    valid: true,
    confidence: roundNumber(confidence),
    market,
    baseConfidence: CONFIDENCE_POLICY.base,
    probabilityAdjustment:
      roundNumber(probabilityAdjustmentTotal),
    structuralAdjustment:
      roundNumber(structuralAdjustment),
    modelAgreementAdjustment:
      roundNumber(modelAgreementAdjustment),
    globalConfidenceAdjustment:
      roundNumber(globalConfidenceAdjustment),
    dataQualityAdjustment:
      roundNumber(dataQualityAdjustment),
    totalAdjustment:
      roundNumber(totalAdjustment),
    modelAgreementScore,
    components:
      components.map(component => ({
        ...component,
        adjustment:
          roundNumber(component.adjustment)
      })),
    warnings:
      normalizeWarnings(warnings)
  };
}

function buildStructuralMetrics(
  market: ConfidenceMarket,
  lambdaHome: number,
  lambdaAway: number
): StructuralMetrics {
  const totalLambda =
    lambdaHome + lambdaAway;

  const lambdaDifference =
    Math.abs(lambdaHome - lambdaAway);

  const minimumLambda =
    Math.min(lambdaHome, lambdaAway);

  let directionalAdvantage: number | null = null;

  if (
    market === "HOME" ||
    market === "DOUBLE_CHANCE_1X" ||
    market === "DNB_HOME"
  ) {
    directionalAdvantage =
      lambdaHome - lambdaAway;
  }

  if (
    market === "AWAY" ||
    market === "DOUBLE_CHANCE_X2" ||
    market === "DNB_AWAY"
  ) {
    directionalAdvantage =
      lambdaAway - lambdaHome;
  }

  return {
    totalLambda,
    lambdaDifference,
    minimumLambda,
    directionalAdvantage
  };
}

function addModelAgreementComponents({
  components,
  monteCarloProb,
  poissonProb
}: {
  components: MarketConfidenceComponent[];
  monteCarloProb: number | null;
  poissonProb: number | null;
}) {
  if (
    monteCarloProb === null ||
    poissonProb === null
  ) {
    return;
  }

  const difference =
    Math.abs(
      monteCarloProb - poissonProb
    );

  if (difference <= 0.04) {
    addComponent(
      components,
      "MODEL_STRONG_AGREEMENT",
      CONFIDENCE_POLICY.modelAgreementStrong
    );
    return;
  }

  if (difference <= 0.07) {
    addComponent(
      components,
      "MODEL_GOOD_AGREEMENT",
      CONFIDENCE_POLICY.modelAgreementGood
    );
    return;
  }

  if (difference <= 0.10) {
    addComponent(
      components,
      "MODEL_MODERATE_AGREEMENT",
      CONFIDENCE_POLICY.modelAgreementModerate
    );
    return;
  }

  if (difference >= 0.16) {
    addComponent(
      components,
      "MODEL_STRONG_DISAGREEMENT",
      CONFIDENCE_POLICY.modelDisagreementPenalty
    );
  }
}

function addGlobalConfidenceComponent({
  components,
  globalConfidence
}: {
  components: MarketConfidenceComponent[];
  globalConfidence: number | null;
}) {
  if (globalConfidence === null) {
    return;
  }

  addComponent(
    components,
    "GLOBAL_MODEL_CONFIDENCE",
    (globalConfidence - 0.50) *
      CONFIDENCE_POLICY.globalConfidenceWeight
  );
}

function addDataQualityComponents({
  components,
  sampleReliability,
  leagueTrust
}: {
  components: MarketConfidenceComponent[];
  sampleReliability: number | null;
  leagueTrust: number | null;
}) {
  if (sampleReliability !== null) {
    addComponent(
      components,
      "DATA_SAMPLE_RELIABILITY",
      (sampleReliability - 0.50) *
        CONFIDENCE_POLICY.sampleReliabilityWeight
    );
  }

  if (leagueTrust !== null) {
    addComponent(
      components,
      "DATA_LEAGUE_TRUST",
      (leagueTrust - 0.50) *
        CONFIDENCE_POLICY.leagueTrustWeight
    );
  }
}

function addMarketStructureComponents({
  components,
  market,
  lambdaHome,
  lambdaAway,
  metrics,
  goalExpectationScore,
  contextualGoalExpectationScore
}: {
  components: MarketConfidenceComponent[];
  market: ConfidenceMarket;
  lambdaHome: number;
  lambdaAway: number;
  metrics: StructuralMetrics;
  goalExpectationScore: number | null;
  contextualGoalExpectationScore: number | null;
}) {
  switch (market) {
    case "OVER_1_5":
    case "OVER_2_5":
      addOverStructure({
        components,
        market,
        totalLambda: metrics.totalLambda,
        minimumLambda: metrics.minimumLambda,
        goalExpectationScore,
        contextualGoalExpectationScore
      });
      return;

    case "UNDER_1_5":
    case "UNDER_2_5":
      addUnderStructure({
        components,
        market,
        totalLambda: metrics.totalLambda,
        goalExpectationScore,
        contextualGoalExpectationScore
      });
      return;

    case "BTTS_YES":
      addBttsYesStructure({
        components,
        totalLambda: metrics.totalLambda,
        lambdaDifference: metrics.lambdaDifference,
        minimumLambda: metrics.minimumLambda,
        goalExpectationScore,
        contextualGoalExpectationScore
      });
      return;

    case "BTTS_NO":
      addBttsNoStructure({
        components,
        totalLambda: metrics.totalLambda,
        minimumLambda: metrics.minimumLambda,
        goalExpectationScore,
        contextualGoalExpectationScore
      });
      return;

    case "HOME":
    case "AWAY":
      addResultStructure({
        components,
        market,
        lambdaHome,
        lambdaAway,
        directionalAdvantage:
          metrics.directionalAdvantage as number
      });
      return;

    case "DRAW":
      addDrawStructure({
        components,
        totalLambda: metrics.totalLambda,
        lambdaDifference: metrics.lambdaDifference
      });
      return;

    case "DOUBLE_CHANCE_1X":
    case "DOUBLE_CHANCE_X2":
      addDoubleChanceStructure({
        components,
        market,
        lambdaHome,
        lambdaAway,
        directionalAdvantage:
          metrics.directionalAdvantage as number
      });
      return;

    case "DNB_HOME":
    case "DNB_AWAY":
      addDnbStructure({
        components,
        market,
        lambdaHome,
        lambdaAway,
        directionalAdvantage:
          metrics.directionalAdvantage as number
      });
      return;
  }
}

function addOverStructure({
  components,
  market,
  totalLambda,
  minimumLambda,
  goalExpectationScore,
  contextualGoalExpectationScore
}: {
  components: MarketConfidenceComponent[];
  market: "OVER_1_5" | "OVER_2_5";
  totalLambda: number;
  minimumLambda: number;
  goalExpectationScore: number | null;
  contextualGoalExpectationScore: number | null;
}) {
  if (market === "OVER_1_5") {
    addComponent(
      components,
      "STRUCTURE_OVER_1_5_TOTAL_LAMBDA",
      clamp(
        (totalLambda - 2.20) * 0.065,
        -0.060,
        0.070
      )
    );
  }

  if (market === "OVER_2_5") {
    addComponent(
      components,
      "STRUCTURE_OVER_2_5_TOTAL_LAMBDA",
      clamp(
        (totalLambda - 2.65) * 0.075,
        -0.075,
        0.080
      )
    );

    if (
      minimumLambda < 0.65 &&
      totalLambda < 2.80
    ) {
      addComponent(
        components,
        "STRUCTURE_OVER_2_5_FRAGILE_DISTRIBUTION",
        -0.035
      );
    }
  }

  addGoalExpectationComponent({
    components,
    source:
      market === "OVER_1_5"
        ? "STRUCTURE_OVER_1_5_GOAL_SCORE"
        : "STRUCTURE_OVER_2_5_GOAL_SCORE",
    score: goalExpectationScore,
    neutralPoint:
      market === "OVER_1_5"
        ? 0.52
        : 0.57,
    weight:
      market === "OVER_1_5"
        ? 0.13
        : 0.15,
    minimum: -0.050,
    maximum: 0.060
  });

  addGoalExpectationComponent({
    components,
    source:
      market === "OVER_1_5"
        ? "STRUCTURE_OVER_1_5_CONTEXTUAL_GOAL_SCORE"
        : "STRUCTURE_OVER_2_5_CONTEXTUAL_GOAL_SCORE",
    score: contextualGoalExpectationScore,
    neutralPoint:
      market === "OVER_1_5"
        ? 0.52
        : 0.57,
    weight: 0.06,
    minimum: -0.020,
    maximum: 0.025
  });
}

/*
 * Espelha addOverStructure com sinal invertido: totalLambda
 * mais baixo (menos gols esperados) é o sinal alinhado para
 * Under, não penalidade. Segue o mesmo padrão de inversão
 * que addBttsNoStructure já usa contra addBttsYesStructure
 * (goalExpectationScore vira 1 - score).
 */
function addUnderStructure({
  components,
  market,
  totalLambda,
  goalExpectationScore,
  contextualGoalExpectationScore
}: {
  components: MarketConfidenceComponent[];
  market: "UNDER_1_5" | "UNDER_2_5";
  totalLambda: number;
  goalExpectationScore: number | null;
  contextualGoalExpectationScore: number | null;
}) {
  if (market === "UNDER_1_5") {
    addComponent(
      components,
      "STRUCTURE_UNDER_1_5_TOTAL_LAMBDA",
      clamp(
        (2.20 - totalLambda) * 0.065,
        -0.060,
        0.070
      )
    );
  }

  if (market === "UNDER_2_5") {
    addComponent(
      components,
      "STRUCTURE_UNDER_2_5_TOTAL_LAMBDA",
      clamp(
        (2.65 - totalLambda) * 0.075,
        -0.075,
        0.080
      )
    );
  }

  addGoalExpectationComponent({
    components,
    source:
      market === "UNDER_1_5"
        ? "STRUCTURE_UNDER_1_5_GOAL_SCORE"
        : "STRUCTURE_UNDER_2_5_GOAL_SCORE",
    score:
      goalExpectationScore === null
        ? null
        : 1 - goalExpectationScore,
    neutralPoint:
      market === "UNDER_1_5"
        ? 0.48
        : 0.43,
    weight:
      market === "UNDER_1_5"
        ? 0.13
        : 0.15,
    minimum: -0.050,
    maximum: 0.060
  });

  addGoalExpectationComponent({
    components,
    source:
      market === "UNDER_1_5"
        ? "STRUCTURE_UNDER_1_5_CONTEXTUAL_GOAL_SCORE"
        : "STRUCTURE_UNDER_2_5_CONTEXTUAL_GOAL_SCORE",
    score:
      contextualGoalExpectationScore === null
        ? null
        : 1 - contextualGoalExpectationScore,
    neutralPoint:
      market === "UNDER_1_5"
        ? 0.48
        : 0.43,
    weight: 0.06,
    minimum: -0.020,
    maximum: 0.025
  });
}

function addBttsYesStructure({
  components,
  totalLambda,
  lambdaDifference,
  minimumLambda,
  goalExpectationScore,
  contextualGoalExpectationScore
}: {
  components: MarketConfidenceComponent[];
  totalLambda: number;
  lambdaDifference: number;
  minimumLambda: number;
  goalExpectationScore: number | null;
  contextualGoalExpectationScore: number | null;
}) {
  addComponent(
    components,
    "STRUCTURE_BTTS_YES_TOTAL_LAMBDA",
    clamp(
      (totalLambda - 2.55) * 0.045,
      -0.040,
      0.045
    )
  );

  addComponent(
    components,
    "STRUCTURE_BTTS_YES_MINIMUM_LAMBDA",
    clamp(
      (minimumLambda - 0.90) * 0.10,
      -0.075,
      0.055
    )
  );

  if (lambdaDifference > 1.20) {
    addComponent(
      components,
      "STRUCTURE_BTTS_YES_UNBALANCED_LAMBDAS",
      clamp(
        -(lambdaDifference - 1.20) * 0.045,
        -0.055,
        0
      )
    );
  }

  addGoalExpectationComponent({
    components,
    source: "STRUCTURE_BTTS_YES_GOAL_SCORE",
    score: goalExpectationScore,
    neutralPoint: 0.52,
    weight: 0.13,
    minimum: -0.045,
    maximum: 0.050
  });

  addGoalExpectationComponent({
    components,
    source:
      "STRUCTURE_BTTS_YES_CONTEXTUAL_GOAL_SCORE",
    score: contextualGoalExpectationScore,
    neutralPoint: 0.52,
    weight: 0.055,
    minimum: -0.020,
    maximum: 0.022
  });
}

function addBttsNoStructure({
  components,
  totalLambda,
  minimumLambda,
  goalExpectationScore,
  contextualGoalExpectationScore
}: {
  components: MarketConfidenceComponent[];
  totalLambda: number;
  minimumLambda: number;
  goalExpectationScore: number | null;
  contextualGoalExpectationScore: number | null;
}) {
  addComponent(
    components,
    "STRUCTURE_BTTS_NO_TOTAL_LAMBDA",
    clamp(
      (2.35 - totalLambda) * 0.060,
      -0.070,
      0.060
    )
  );

  addComponent(
    components,
    "STRUCTURE_BTTS_NO_MINIMUM_LAMBDA",
    clamp(
      (0.80 - minimumLambda) * 0.10,
      -0.060,
      0.060
    )
  );

  addGoalExpectationComponent({
    components,
    source: "STRUCTURE_BTTS_NO_GOAL_SCORE",
    score:
      goalExpectationScore === null
        ? null
        : 1 - goalExpectationScore,
    neutralPoint: 0.50,
    weight: 0.12,
    minimum: -0.045,
    maximum: 0.045
  });

  addGoalExpectationComponent({
    components,
    source:
      "STRUCTURE_BTTS_NO_CONTEXTUAL_GOAL_SCORE",
    score:
      contextualGoalExpectationScore === null
        ? null
        : 1 - contextualGoalExpectationScore,
    neutralPoint: 0.50,
    weight: 0.05,
    minimum: -0.020,
    maximum: 0.020
  });
}

function addResultStructure({
  components,
  market,
  lambdaHome,
  lambdaAway,
  directionalAdvantage
}: {
  components: MarketConfidenceComponent[];
  market: "HOME" | "AWAY";
  lambdaHome: number;
  lambdaAway: number;
  directionalAdvantage: number;
}) {
  addComponent(
    components,
    "STRUCTURE_RESULT_DIRECTIONAL_ADVANTAGE",
    clamp(
      directionalAdvantage * 0.075,
      -0.090,
      0.080
    )
  );

  const selectedLambda =
    market === "HOME"
      ? lambdaHome
      : lambdaAway;

  const opponentLambda =
    market === "HOME"
      ? lambdaAway
      : lambdaHome;

  if (
    selectedLambda < 0.90 &&
    selectedLambda <= opponentLambda
  ) {
    addComponent(
      components,
      "STRUCTURE_RESULT_LOW_SELECTED_LAMBDA",
      -0.045
    );
  }

  if (
    Math.abs(
      selectedLambda - opponentLambda
    ) < 0.25
  ) {
    addComponent(
      components,
      "STRUCTURE_RESULT_BALANCED_GAME",
      -0.035
    );
  }
}

function addDrawStructure({
  components,
  totalLambda,
  lambdaDifference
}: {
  components: MarketConfidenceComponent[];
  totalLambda: number;
  lambdaDifference: number;
}) {
  addComponent(
    components,
    "STRUCTURE_DRAW_LAMBDA_BALANCE",
    clamp(
      (0.35 - lambdaDifference) * 0.11,
      -0.060,
      0.045
    )
  );

  if (totalLambda > 3.30) {
    addComponent(
      components,
      "STRUCTURE_DRAW_HIGH_TOTAL_LAMBDA",
      clamp(
        -(totalLambda - 3.30) * 0.035,
        -0.045,
        0
      )
    );
  }

  if (totalLambda <= 2.10) {
    addComponent(
      components,
      "STRUCTURE_DRAW_LOW_TOTAL_LAMBDA",
      clamp(
        (2.10 - totalLambda) * 0.025 + 0.010,
        0,
        0.035
      )
    );
  }
}

function addDoubleChanceStructure({
  components,
  market,
  lambdaHome,
  lambdaAway,
  directionalAdvantage
}: {
  components: MarketConfidenceComponent[];
  market:
    | "DOUBLE_CHANCE_1X"
    | "DOUBLE_CHANCE_X2";
  lambdaHome: number;
  lambdaAway: number;
  directionalAdvantage: number;
}) {
  addComponent(
    components,
    "STRUCTURE_DOUBLE_CHANCE_DIRECTIONAL_ADVANTAGE",
    clamp(
      directionalAdvantage * 0.055,
      -0.065,
      0.060
    )
  );

  const selectedLambda =
    market === "DOUBLE_CHANCE_1X"
      ? lambdaHome
      : lambdaAway;

  const opponentLambda =
    market === "DOUBLE_CHANCE_1X"
      ? lambdaAway
      : lambdaHome;

  if (
    selectedLambda + 0.35 <
    opponentLambda
  ) {
    addComponent(
      components,
      "STRUCTURE_DOUBLE_CHANCE_WEAK_SELECTED_SIDE",
      -0.050
    );
  }

  if (
    Math.abs(
      selectedLambda - opponentLambda
    ) <= 0.20
  ) {
    addComponent(
      components,
      "STRUCTURE_DOUBLE_CHANCE_BALANCED_SUPPORT",
      0.015
    );
  }
}

/*
 * Reaproveita a mesma vantagem direcional de
 * addDoubleChanceStructure (DNB é estruturalmente idêntico
 * a Dupla Chance nesse eixo — só sem o componente do
 * empate, já que aqui o empate anula em vez de ganhar).
 *
 * Tinha ficado sem o bônus de "jogo equilibrado" que Dupla
 * Chance já tem (STRUCTURE_DOUBLE_CHANCE_BALANCED_SUPPORT) —
 * uma omissão sem justificativa registrada, não uma decisão
 * deliberada. Faz ainda mais sentido aqui: DNB existe
 * especificamente para remover o risco de empate, e é em
 * jogos equilibrados (lambdas próximos) que esse risco é
 * maior — logo é onde o mercado mais entrega valor, não onde
 * a confiança deveria ficar mais pobre em componentes do que
 * o mercado irmão. Medido empiricamente (2026-09-03): sem
 * este bônus, DNB_HOME/DNB_AWAY nunca alcançavam o
 * minimumConfidence de produção e ficavam com zero apostas no
 * backtest sintético.
 */
function addDnbStructure({
  components,
  market,
  lambdaHome,
  lambdaAway,
  directionalAdvantage
}: {
  components: MarketConfidenceComponent[];
  market:
    | "DNB_HOME"
    | "DNB_AWAY";
  lambdaHome: number;
  lambdaAway: number;
  directionalAdvantage: number;
}) {
  addComponent(
    components,
    "STRUCTURE_DNB_DIRECTIONAL_ADVANTAGE",
    clamp(
      directionalAdvantage * 0.055,
      -0.065,
      0.060
    )
  );

  const selectedLambda =
    market === "DNB_HOME"
      ? lambdaHome
      : lambdaAway;

  const opponentLambda =
    market === "DNB_HOME"
      ? lambdaAway
      : lambdaHome;

  if (
    selectedLambda + 0.35 <
    opponentLambda
  ) {
    addComponent(
      components,
      "STRUCTURE_DNB_WEAK_SELECTED_SIDE",
      -0.050
    );
  }

  if (
    Math.abs(
      selectedLambda - opponentLambda
    ) <= 0.20
  ) {
    addComponent(
      components,
      "STRUCTURE_DNB_BALANCED_SUPPORT",
      0.015
    );
  }
}

function addGoalExpectationComponent({
  components,
  source,
  score,
  neutralPoint,
  weight,
  minimum,
  maximum
}: {
  components: MarketConfidenceComponent[];
  source: string;
  score: number | null;
  neutralPoint: number;
  weight: number;
  minimum: number;
  maximum: number;
}) {
  if (score === null) {
    return;
  }

  addComponent(
    components,
    source,
    clamp(
      (score - neutralPoint) * weight,
      minimum,
      maximum
    )
  );
}

function createInvalidResult(
  market: ConfidenceMarket | null,
  warnings: string[]
): MarketConfidenceResult {
  return {
    valid: false,
    confidence: 0,
    market,
    baseConfidence: 0,
    probabilityAdjustment: 0,
    structuralAdjustment: 0,
    modelAgreementAdjustment: 0,
    globalConfidenceAdjustment: 0,
    dataQualityAdjustment: 0,
    totalAdjustment: 0,
    modelAgreementScore: null,
    components: [],
    warnings:
      normalizeWarnings(warnings)
  };
}

/* ==========================================
   MODEL AGREEMENT SCORE — FASE 2
========================================== */

/*
 * Transforma a mesma divergência absoluta já usada nos
 * componentes MODEL_* e no cap de divergência forte (0.16) num
 * score contínuo 0–1, alinhado aos mesmos pontos de corte:
 *
 * diff 0.00 → 1.00 (concordância total)
 * diff 0.16 → 0.00 (a mesma referência do cap de divergência)
 * diff > 0.16 → 0 (sem piso negativo; ausência de concordância)
 *
 * Sem os dois modelos, não existe opinião — null, não 0 (0
 * significaria "os modelos discordam ao máximo", o que é uma
 * afirmação diferente de "não sabemos").
 */
const MODEL_AGREEMENT_REFERENCE_DIFF = 0.16;

function calculateModelAgreementScore(
  monteCarloProb: number | null,
  poissonProb: number | null
): number | null {
  if (
    monteCarloProb === null ||
    poissonProb === null
  ) {
    return null;
  }

  const diff =
    Math.abs(
      monteCarloProb - poissonProb
    );

  return roundNumber(
    clamp(
      1 - (diff / MODEL_AGREEMENT_REFERENCE_DIFF),
      0,
      1
    )
  );
}

function normalizeMarket(
  value: unknown
): ConfidenceMarket | null {
  const market =
    String(value ?? "")
      .trim()
      .toUpperCase()
      .replace(/\./g, "_")
      .replace(/\s+/g, "_");

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
      return "OVER_1_5";

    case "OVER_2_5":
    case "OVER25":
      return "OVER_2_5";

    case "UNDER_1_5":
    case "UNDER15":
      return "UNDER_1_5";

    case "UNDER_2_5":
    case "UNDER25":
      return "UNDER_2_5";

    case "BTTS_YES":
      return "BTTS_YES";

    case "BTTS_NO":
      return "BTTS_NO";

    case "DOUBLE_CHANCE_1X":
    case "1X":
      return "DOUBLE_CHANCE_1X";

    case "DOUBLE_CHANCE_X2":
    case "X2":
      return "DOUBLE_CHANCE_X2";

    case "DNB_HOME":
    case "DNB1":
      return "DNB_HOME";

    case "DNB_AWAY":
    case "DNB2":
      return "DNB_AWAY";

    default:
      return null;
  }
}

function registerOptionalInputWarning(
  rawValue: unknown,
  parsedValue: number | null,
  warning: string,
  warnings: string[]
) {
  if (
    rawValue !== null &&
    rawValue !== undefined &&
    rawValue !== "" &&
    parsedValue === null
  ) {
    warnings.push(warning);
  }
}

function addComponent(
  components: MarketConfidenceComponent[],
  source: string,
  adjustment: number
) {
  if (
    !Number.isFinite(adjustment) ||
    Math.abs(adjustment) <= 1e-12
  ) {
    return;
  }

  components.push({
    source,
    adjustment
  });
}

function sumByPrefix(
  components: MarketConfidenceComponent[],
  prefix: string
): number {
  return components
    .filter(component =>
      component.source.startsWith(prefix)
    )
    .reduce(
      (total, component) =>
        total + component.adjustment,
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

  const parsed = Number(value);

  if (
    !Number.isFinite(parsed) ||
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
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value === "boolean"
  ) {
    return null;
  }

  const parsed = Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed <= 0
  ) {
    return null;
  }

  return parsed;
}

function normalizeWarnings(
  warnings: string[]
): string[] {
  return [
    ...new Set(
      warnings
        .map(warning =>
          String(warning ?? "").trim()
        )
        .filter(Boolean)
    )
  ];
}

function clamp(
  value: number,
  minimum: number,
  maximum: number
): number {
  if (!Number.isFinite(value)) {
    return minimum;
  }

  return Math.max(
    minimum,
    Math.min(value, maximum)
  );
}

function roundNumber(
  value: number,
  decimals = 4
): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const factor = 10 ** decimals;

  return (
    Math.round(value * factor) /
    factor
  );
}
