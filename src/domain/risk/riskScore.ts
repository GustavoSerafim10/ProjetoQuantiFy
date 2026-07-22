/* ==========================================
   RISK SCORE — QUANTIFY V7
========================================== */

/*
 * Responsabilidade:
 *
 * Calcular exclusivamente o risco-base
 * estatístico de uma previsão.
 *
 * Considera:
 *
 * - probabilidade estimada de falha;
 * - dispersão esperada da contagem de gols;
 * - volatilidade observada;
 * - anomalia do lambda em relação à liga;
 * - qualidade e disponibilidade dos dados.
 *
 * Este arquivo não:
 *
 * - conhece mercados;
 * - conhece odds;
 * - calcula EV;
 * - aplica correlação;
 * - aplica política operacional;
 * - classifica entradas;
 * - toma decisão;
 * - reduz risco porque o lambda favorece
 *   determinado mercado.
 */

/* ==========================================
   CONTRATOS
========================================== */

/*
 * IMPORTANTE SOBRE UNIDADES:
 *
 * leagueAvgGoals:
 * média TOTAL de gols por partida na liga.
 *
 * seasonGoalAvg:
 * média TOTAL de gols por partida na amostra
 * ou temporada analisada.
 *
 * recentGoalStd:
 * desvio-padrão da quantidade TOTAL de gols
 * por partida na amostra recente.
 *
 * Não utilizar média por equipe nesses campos.
 */

export interface RiskInput {
  lambdaHome: number;
  lambdaAway: number;

  eventProbability: number;

  leagueAvgGoals?:
    number | null;

  recentGoalStd?:
    number | null;

  seasonGoalAvg?:
    number | null;

  /*
   * Score opcional entre 0 e 1.
   *
   * 1 = dados completos e confiáveis.
   * 0 = dados extremamente frágeis.
   *
   * Quando ausente, o próprio módulo estima
   * a qualidade com base nos campos faltantes.
   */
  dataQualityScore?:
    number | null;
}

export interface RiskScoreComponents {
  eventLossRisk: number;
  goalDispersionRisk: number;
  volatilityRisk: number;
  lambdaAnomalyRisk: number;
  dataQualityRisk: number;
}

export interface RiskScoreWeights {
  eventLossRisk: number;
  goalDispersionRisk: number;
  volatilityRisk: number;
  lambdaAnomalyRisk: number;
  dataQualityRisk: number;
}

export interface RiskScoreDebug {
  valid: boolean;

  lambdaHome: number | null;
  lambdaAway: number | null;
  totalLambda: number | null;

  eventProbability: number | null;

  leagueAvgGoals: number | null;
  recentGoalStd: number | null;
  seasonGoalAvg: number | null;
  dataQualityScore: number | null;

  expectedGoalStd: number | null;
  volatilityRatio: number | null;
  lambdaToLeagueRatio: number | null;

  missingFields: string[];
  warnings: string[];

  error?: string;
}

export interface RiskScoreResult {
  valid: boolean;

  risk: number;
  riskScore: number;

  components:
    RiskScoreComponents;

  weightedComponents:
    RiskScoreComponents;

  weights:
    RiskScoreWeights;

  debug:
    RiskScoreDebug;
}

/* ==========================================
   POLÍTICA ESTATÍSTICA PROVISÓRIA
========================================== */

/*
 * Estes pesos não representam uma calibração
 * definitiva.
 *
 * Devem futuramente ser validados por:
 *
 * - Brier Score;
 * - Log Loss;
 * - calibração por faixa de probabilidade;
 * - ROI;
 * - drawdown;
 * - backtest fora da amostra.
 *
 * A soma deve permanecer igual a 1.
 */

const RISK_WEIGHTS:
  RiskScoreWeights = {
    eventLossRisk:
      0.34,

    goalDispersionRisk:
      0.12,

    volatilityRisk:
      0.22,

    lambdaAnomalyRisk:
      0.24,

    dataQualityRisk:
      0.08
  };

/*
 * Limites defensivos.
 *
 * Não devem ser interpretados como parâmetros
 * calibrados definitivamente.
 */

const RISK_LIMITS = {
  minimumRisk:
    0.05,

  maximumRisk:
    0.95,

  minimumLambda:
    0.05,

  maximumLambda:
    6,

  minimumLeagueAverage:
    0.5,

  maximumLeagueAverage:
    6,

  minimumSeasonAverage:
    0.5,

  maximumSeasonAverage:
    6,

  maximumRecentStd:
    6,

  /*
   * Referência usada apenas para normalizar
   * a dispersão absoluta da Poisson.
   */
  dispersionNormalization:
    3,

  /*
   * Uma razão de aproximadamente 2,5 vezes
   * a referência já representa anomalia máxima
   * para este componente provisório.
   */
  anomalyRatioLimit:
    2.5,

  /*
   * Uma divergência de aproximadamente 2,5
   * vezes entre volatilidade observada e
   * esperada representa risco máximo.
   */
  volatilityRatioLimit:
    2.5
} as const;

/* ==========================================
   API PÚBLICA COMPATÍVEL
========================================== */

/*
 * Mantém compatibilidade com o contrato atual:
 *
 * calculateRiskScore(input) → number
 *
 * O novo riskPipeline poderá utilizar a função
 * detalhada para registrar componentes.
 */

export function calculateRiskScore(
  input: RiskInput
): number {
  return calculateRiskScoreDetailed(
    input
  ).risk;
}

/* ==========================================
   CÁLCULO DETALHADO
========================================== */

export function calculateRiskScoreDetailed(
  input: RiskInput
): RiskScoreResult {
  const warnings:
    string[] = [];

  const missingFields:
    string[] = [];

  const lambdaHome =
    parseBoundedPositiveNumber(
      input?.lambdaHome,
      RISK_LIMITS.minimumLambda,
      RISK_LIMITS.maximumLambda
    );

  const lambdaAway =
    parseBoundedPositiveNumber(
      input?.lambdaAway,
      RISK_LIMITS.minimumLambda,
      RISK_LIMITS.maximumLambda
    );

  const eventProbability =
    parseProbability(
      input?.eventProbability
    );

  /*
   * Sem os lambdas oficiais ou sem a
   * probabilidade oficial, o risco-base não
   * pode ser calculado com confiabilidade.
   */
  if (
    lambdaHome === null ||
    lambdaAway === null ||
    eventProbability === null
  ) {
    if (lambdaHome === null) {
      warnings.push(
        "INVALID_RISK_LAMBDA_HOME"
      );
    }

    if (lambdaAway === null) {
      warnings.push(
        "INVALID_RISK_LAMBDA_AWAY"
      );
    }

    if (
      eventProbability === null
    ) {
      warnings.push(
        "INVALID_RISK_EVENT_PROBABILITY"
      );
    }

    return createInvalidRiskResult({
      lambdaHome,
      lambdaAway,
      eventProbability,
      warnings
    });
  }

  const totalLambda =
    lambdaHome +
    lambdaAway;

  const leagueAvgGoals =
    parseBoundedPositiveNumber(
      input?.leagueAvgGoals,
      RISK_LIMITS
        .minimumLeagueAverage,
      RISK_LIMITS
        .maximumLeagueAverage
    );

  const recentGoalStd =
    parseBoundedNonNegativeNumber(
      input?.recentGoalStd,
      0,
      RISK_LIMITS.maximumRecentStd
    );

  const seasonGoalAvg =
    parseBoundedPositiveNumber(
      input?.seasonGoalAvg,
      RISK_LIMITS
        .minimumSeasonAverage,
      RISK_LIMITS
        .maximumSeasonAverage
    );

  const suppliedDataQualityScore =
    parseProbability(
      input?.dataQualityScore
    );

  registerMissingField({
    field:
      "leagueAvgGoals",

    value:
      leagueAvgGoals,

    missingFields,
    warnings
  });

  registerMissingField({
    field:
      "recentGoalStd",

    value:
      recentGoalStd,

    missingFields,
    warnings
  });

  registerMissingField({
    field:
      "seasonGoalAvg",

    value:
      seasonGoalAvg,

    missingFields,
    warnings
  });

  /*
   * 1. RISCO DE FALHA DO EVENTO
   *
   * É a chance prevista de o evento não ocorrer.
   *
   * Esse componente não é utilizado novamente
   * em bônus ou descontos adicionais.
   */
  const eventLossRisk =
    clamp01(
      1 -
      eventProbability
    );

  /*
   * 2. DISPERSÃO ESPERADA DOS GOLS
   *
   * Em uma Poisson:
   *
   * variância = lambda
   * desvio-padrão = sqrt(lambda)
   *
   * Este componente representa dispersão
   * absoluta da contagem, não uma direção
   * favorável ou desfavorável a algum mercado.
   */
  const expectedGoalStd =
    Math.sqrt(
      totalLambda
    );

  const goalDispersionRisk =
    clamp01(
      expectedGoalStd /
      RISK_LIMITS
        .dispersionNormalization
    );

  /*
   * 3. VOLATILIDADE OBSERVADA
   *
   * Compara o desvio-padrão recente com o
   * desvio-padrão esperado pela referência
   * estrutural disponível.
   *
   * Não inventamos recentGoalStd quando o dado
   * está ausente. A ausência será considerada
   * no componente de qualidade.
   */

  const volatilityBaselineGoals =
    seasonGoalAvg ??
    leagueAvgGoals;

  const expectedBaselineStd =
    volatilityBaselineGoals !== null
      ? Math.sqrt(
          volatilityBaselineGoals
        )
      : null;

  const volatilityRatio =
    recentGoalStd !== null &&
    expectedBaselineStd !== null &&
    expectedBaselineStd > 0
      ? (
          recentGoalStd /
          expectedBaselineStd
        )
      : null;

  const volatilityRisk =
    calculateVolatilityRisk(
      volatilityRatio
    );

  /*
   * 4. ANOMALIA DO LAMBDA
   *
   * Mede o afastamento do totalLambda em
   * relação à média TOTAL de gols da liga.
   *
   * Exemplo:
   *
   * totalLambda = 4.60
   * leagueAvgGoals = 2.30
   *
   * ratio = 2.00
   *
   * Isso não invalida automaticamente a
   * previsão, mas representa forte extrapolação
   * e deve aumentar a incerteza.
   */
  const lambdaToLeagueRatio =
    leagueAvgGoals !== null
      ? (
          totalLambda /
          leagueAvgGoals
        )
      : null;

  const lambdaAnomalyRisk =
    calculateRatioAnomalyRisk(
      lambdaToLeagueRatio
    );

  /*
   * 5. QUALIDADE DOS DADOS
   *
   * Quando dataQualityScore é fornecido:
   *
   * risco = 1 - qualidade
   *
   * Quando não é fornecido:
   *
   * estimamos a fragilidade pela quantidade
   * de campos estatísticos ausentes.
   */
  const dataQualityRisk =
    calculateDataQualityRisk({
      suppliedDataQualityScore,
      missingFields
    });

  const components:
    RiskScoreComponents = {
      eventLossRisk:
        roundNumber(
          eventLossRisk
        ),

      goalDispersionRisk:
        roundNumber(
          goalDispersionRisk
        ),

      volatilityRisk:
        roundNumber(
          volatilityRisk
        ),

      lambdaAnomalyRisk:
        roundNumber(
          lambdaAnomalyRisk
        ),

      dataQualityRisk:
        roundNumber(
          dataQualityRisk
        )
    };

  const weightedComponents:
    RiskScoreComponents = {
      eventLossRisk:
        components
          .eventLossRisk *
        RISK_WEIGHTS
          .eventLossRisk,

      goalDispersionRisk:
        components
          .goalDispersionRisk *
        RISK_WEIGHTS
          .goalDispersionRisk,

      volatilityRisk:
        components
          .volatilityRisk *
        RISK_WEIGHTS
          .volatilityRisk,

      lambdaAnomalyRisk:
        components
          .lambdaAnomalyRisk *
        RISK_WEIGHTS
          .lambdaAnomalyRisk,

      dataQualityRisk:
        components
          .dataQualityRisk *
        RISK_WEIGHTS
          .dataQualityRisk
    };

  const rawRisk =
    weightedComponents
      .eventLossRisk +
    weightedComponents
      .goalDispersionRisk +
    weightedComponents
      .volatilityRisk +
    weightedComponents
      .lambdaAnomalyRisk +
    weightedComponents
      .dataQualityRisk;

  const finalRisk =
    clamp(
      rawRisk,
      RISK_LIMITS.minimumRisk,
      RISK_LIMITS.maximumRisk
    );

  addStructuralWarnings({
    warnings,

    eventProbability,
    totalLambda,

    leagueAvgGoals,
    lambdaToLeagueRatio,

    volatilityRatio,

    dataQualityRisk
  });

  return {
    valid:
      true,

    risk:
      roundNumber(
        finalRisk,
        4
      ),

    riskScore:
      roundNumber(
        finalRisk,
        4
      ),

    components,

    weightedComponents: {
      eventLossRisk:
        roundNumber(
          weightedComponents
            .eventLossRisk
        ),

      goalDispersionRisk:
        roundNumber(
          weightedComponents
            .goalDispersionRisk
        ),

      volatilityRisk:
        roundNumber(
          weightedComponents
            .volatilityRisk
        ),

      lambdaAnomalyRisk:
        roundNumber(
          weightedComponents
            .lambdaAnomalyRisk
        ),

      dataQualityRisk:
        roundNumber(
          weightedComponents
            .dataQualityRisk
        )
    },

    weights: {
      ...RISK_WEIGHTS
    },

    debug: {
      valid:
        true,

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

      eventProbability:
        roundNumber(
          eventProbability
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
          suppliedDataQualityScore
        ),

      expectedGoalStd:
        roundNumber(
          expectedGoalStd
        ),

      volatilityRatio:
        roundNullableNumber(
          volatilityRatio
        ),

      lambdaToLeagueRatio:
        roundNullableNumber(
          lambdaToLeagueRatio
        ),

      missingFields:
        [...missingFields],

      warnings:
        normalizeWarnings(
          warnings
        )
    }
  };
}

/* ==========================================
   VOLATILIDADE
========================================== */

function calculateVolatilityRisk(
  volatilityRatio: number | null
): number {
  if (
    volatilityRatio === null ||
    volatilityRatio <= 0
  ) {
    return 0;
  }

  /*
   * Usamos o logaritmo para tratar de forma
   * simétrica relações como:
   *
   * 2.0 vezes a referência
   * 0.5 vez a referência
   *
   * Ambas representam afastamento estrutural.
   */
  const absoluteLogDeviation =
    Math.abs(
      Math.log(
        volatilityRatio
      )
    );

  const normalization =
    Math.log(
      RISK_LIMITS
        .volatilityRatioLimit
    );

  if (
    !Number.isFinite(
      absoluteLogDeviation
    ) ||
    normalization <= 0
  ) {
    return 1;
  }

  return clamp01(
    absoluteLogDeviation /
    normalization
  );
}

/* ==========================================
   ANOMALIA DO LAMBDA
========================================== */

function calculateRatioAnomalyRisk(
  ratio: number | null
): number {
  if (
    ratio === null ||
    ratio <= 0
  ) {
    return 0;
  }

  /*
   * O uso do logaritmo evita tratar de forma
   * totalmente diferente:
   *
   * lambda duas vezes maior que a liga
   * lambda duas vezes menor que a liga.
   */
  const absoluteLogDeviation =
    Math.abs(
      Math.log(
        ratio
      )
    );

  const normalization =
    Math.log(
      RISK_LIMITS
        .anomalyRatioLimit
    );

  if (
    !Number.isFinite(
      absoluteLogDeviation
    ) ||
    normalization <= 0
  ) {
    return 1;
  }

  return clamp01(
    absoluteLogDeviation /
    normalization
  );
}

/* ==========================================
   QUALIDADE DOS DADOS
========================================== */

function calculateDataQualityRisk({
  suppliedDataQualityScore,
  missingFields
}: {
  suppliedDataQualityScore:
    number | null;

  missingFields:
    string[];
}): number {
  if (
    suppliedDataQualityScore !== null
  ) {
    return clamp01(
      1 -
      suppliedDataQualityScore
    );
  }

  /*
   * Três campos auxiliares são esperados:
   *
   * - leagueAvgGoals;
   * - recentGoalStd;
   * - seasonGoalAvg.
   *
   * Não ter nenhum deles representa risco
   * máximo neste componente específico.
   */
  const expectedFields =
    3;

  return clamp01(
    missingFields.length /
    expectedFields
  );
}

/* ==========================================
   WARNINGS
========================================== */

function addStructuralWarnings({
  warnings,

  eventProbability,
  totalLambda,

  leagueAvgGoals,
  lambdaToLeagueRatio,

  volatilityRatio,

  dataQualityRisk
}: {
  warnings: string[];

  eventProbability: number;
  totalLambda: number;

  leagueAvgGoals: number | null;
  lambdaToLeagueRatio: number | null;

  volatilityRatio: number | null;

  dataQualityRisk: number;
}) {
  if (
    eventProbability >= 0.80
  ) {
    warnings.push(
      "HIGH_MODEL_PROBABILITY_REQUIRES_CALIBRATION"
    );
  }

  if (
    totalLambda >= 4
  ) {
    warnings.push(
      "EXTREME_TOTAL_LAMBDA"
    );
  }

  if (
    leagueAvgGoals === null
  ) {
    warnings.push(
      "LAMBDA_ANOMALY_NOT_MEASURED_WITHOUT_LEAGUE_AVERAGE"
    );
  }

  if (
    lambdaToLeagueRatio !== null &&
    (
      lambdaToLeagueRatio >= 1.6 ||
      lambdaToLeagueRatio <= 0.625
    )
  ) {
    warnings.push(
      "HIGH_LAMBDA_LEAGUE_DEVIATION"
    );
  }

  if (
    volatilityRatio !== null &&
    (
      volatilityRatio >= 1.6 ||
      volatilityRatio <= 0.625
    )
  ) {
    warnings.push(
      "HIGH_OBSERVED_VOLATILITY_DEVIATION"
    );
  }

  if (
    dataQualityRisk >= 0.67
  ) {
    warnings.push(
      "LOW_STATISTICAL_DATA_QUALITY"
    );
  }
}

/* ==========================================
   RESULTADO INVÁLIDO
========================================== */

function createInvalidRiskResult({
  lambdaHome,
  lambdaAway,
  eventProbability,
  warnings
}: {
  lambdaHome: number | null;
  lambdaAway: number | null;
  eventProbability: number | null;
  warnings: string[];
}): RiskScoreResult {
  const maximumRisk =
    RISK_LIMITS.maximumRisk;

  return {
    valid:
      false,

    risk:
      maximumRisk,

    riskScore:
      maximumRisk,

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
        RISK_WEIGHTS.eventLossRisk,

      goalDispersionRisk:
        RISK_WEIGHTS
          .goalDispersionRisk,

      volatilityRisk:
        RISK_WEIGHTS.volatilityRisk,

      lambdaAnomalyRisk:
        RISK_WEIGHTS
          .lambdaAnomalyRisk,

      dataQualityRisk:
        RISK_WEIGHTS.dataQualityRisk
    },

    weights: {
      ...RISK_WEIGHTS
    },

    debug: {
      valid:
        false,

      lambdaHome:
        roundNullableNumber(
          lambdaHome
        ),

      lambdaAway:
        roundNullableNumber(
          lambdaAway
        ),

      totalLambda:
        lambdaHome !== null &&
        lambdaAway !== null
          ? roundNumber(
              lambdaHome +
              lambdaAway
            )
          : null,

      eventProbability:
        roundNullableNumber(
          eventProbability
        ),

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

      warnings:
        normalizeWarnings(
          warnings
        ),

      error:
        "INVALID_RISK_SCORE_INPUT"
    }
  };
}

/* ==========================================
   CAMPOS AUSENTES
========================================== */

function registerMissingField({
  field,
  value,
  missingFields,
  warnings
}: {
  field: string;
  value: number | null;
  missingFields: string[];
  warnings: string[];
}) {
  if (value !== null) {
    return;
  }

  missingFields.push(
    field
  );

  warnings.push(
    `MISSING_${field
      .replace(
        /([a-z])([A-Z])/g,
        "$1_$2"
      )
      .toUpperCase()}`
  );
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

function parseBoundedPositiveNumber(
  value: unknown,
  minimum: number,
  maximum: number
): number | null {
  const parsed =
    parseFiniteNumber(
      value
    );

  if (
    parsed === null ||
    parsed <= 0 ||
    parsed < minimum ||
    parsed > maximum
  ) {
    return null;
  }

  return parsed;
}

function parseBoundedNonNegativeNumber(
  value: unknown,
  minimum: number,
  maximum: number
): number | null {
  const parsed =
    parseFiniteNumber(
      value
    );

  if (
    parsed === null ||
    parsed < 0 ||
    parsed < minimum ||
    parsed > maximum
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
   HELPERS
========================================== */

function normalizeWarnings(
  warnings: string[]
): string[] {
  return [
    ...new Set(
      warnings
        .map(
          warning =>
            String(
              warning ?? ""
            ).trim()
        )
        .filter(Boolean)
    )
  ];
}

function clamp01(
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