/* ==========================================
   CORRELATION ENGINE — QUANTIFY V7
========================================== */

/*
 * Responsabilidade:
 *
 * - receber mercados candidatos;
 * - preservar os valores produzidos anteriormente;
 * - registrar diagnóstico estrutural relevante;
 * - expor um contrato compatível de correlação;
 * - não modificar risco ou confiança.
 *
 * Importante:
 *
 * A mera presença de dois mercados na lista
 * não significa exposição simultânea.
 *
 * Correlação entre picks deve ser aplicada
 * somente depois que as seleções forem realmente
 * escolhidas para uma combinação ou carteira.
 *
 * Este arquivo não:
 *
 * - recalcula probabilidades;
 * - recalcula EV;
 * - modifica risk/riskScore;
 * - modifica confidence;
 * - remove mercados;
 * - escolhe o melhor mercado;
 * - penaliza candidatos apenas por coexistirem.
 */

/* ==========================================
   CONTRATOS
========================================== */

export interface CorrelationEngineContext {
  lambdaHome?: number | null;
  lambdaAway?: number | null;
  goalExpectationScore?: number | null;
}

export interface CorrelationStructuralContext {
  valid: boolean;

  lambdaHome: number | null;
  lambdaAway: number | null;

  totalLambda: number | null;
  lambdaDifference: number | null;
  minimumLambda: number | null;

  goalExpectationScore: number | null;
}

export interface CorrelationDiagnostic {
  code: string;

  type:
    | "INFO"
    | "SUPPORT"
    | "RISK";

  description: string;
}

export interface CorrelationEngineMarketDebug {
  valid: boolean;

  mode:
    "CANDIDATE_DIAGNOSTIC";

  structuralContext:
    CorrelationStructuralContext;

  diagnostics:
    CorrelationDiagnostic[];

  penalty: number;
  boost: number;
  netAdjustment: number;

  riskModified: false;
  confidenceModified: false;

  note:
    "Candidate coexistence is not treated as portfolio exposure.";
}

/* ==========================================
   FUNÇÃO PRINCIPAL
========================================== */

export function applyCorrelationAdjustments(
  markets: any[],
  context: CorrelationEngineContext
) {
  if (!Array.isArray(markets)) {
    return [];
  }

  const structuralContext =
    buildStructuralContext(
      context
    );

  return markets.map(
    (
      market: any,
      index: number
    ) => {
      const marketName =
        normalizeMarketName(
          market?.market
        );

      const existingWarnings =
        normalizeWarnings(
          market?.warnings
        );

      const diagnostics =
        evaluateStructuralDiagnostics(
          marketName,
          structuralContext
        );

      /*
       * Neste estágio não existe carteira final.
       *
       * Portanto, não aplicamos penalidade ou
       * boost por correlação entre candidatos.
       */
      const correlationPenalty =
        0;

      const correlationBoost =
        0;

      const correlationNet =
        0;


      const debug:
        CorrelationEngineMarketDebug = {
          valid:
            Boolean(
              marketName
            ) &&
            structuralContext.valid,

          mode:
            "CANDIDATE_DIAGNOSTIC",

          structuralContext,

          diagnostics,

          penalty:
            correlationPenalty,

          boost:
            correlationBoost,

          netAdjustment:
            correlationNet,

          riskModified:
            false,

          confidenceModified:
            false,

          note:
            "Candidate coexistence is not treated as portfolio exposure."
        };

      return {
  ...market,

  correlationPenalty,
  correlationBoost,
  correlationNet,

  // Apenas informa que o engine foi executado
  correlationEvaluated: true,

  // Só será true quando realmente existir ajuste
  correlationAdjusted:
    correlationNet !== 0,

  correlationMode:
    "CANDIDATE_DIAGNOSTIC",

  // Ainda não existe análise de carteira
  correlationPortfolioApplied:
    false,

  // Mantém apenas os warnings que já existiam
  warnings:
    existingWarnings,

  debug: {
    ...(market?.debug ?? {}),

    correlationEngine: {
      ...debug,

      marketIndex:
        index,

      market:
        marketName
    }
  }
};
    }
  );
}

/* ==========================================
   CONTEXTO ESTRUTURAL
========================================== */

function buildStructuralContext(
  context: CorrelationEngineContext
): CorrelationStructuralContext {
  const lambdaHome =
    parsePositiveNumber(
      context?.lambdaHome
    );

  const lambdaAway =
    parsePositiveNumber(
      context?.lambdaAway
    );

  const goalExpectationScore =
    parseProbability(
      context?.goalExpectationScore
    );

  if (
    lambdaHome === null ||
    lambdaAway === null
  ) {
    return {
      valid:
        false,

      lambdaHome,
      lambdaAway,

      totalLambda:
        null,

      lambdaDifference:
        null,

      minimumLambda:
        null,

      goalExpectationScore
    };
  }

  return {
    valid:
      true,

    lambdaHome,
    lambdaAway,

    totalLambda:
      roundNumber(
        lambdaHome +
        lambdaAway
      ),

    lambdaDifference:
      roundNumber(
        Math.abs(
          lambdaHome -
          lambdaAway
        )
      ),

    minimumLambda:
      roundNumber(
        Math.min(
          lambdaHome,
          lambdaAway
        )
      ),

    goalExpectationScore
  };
}

/* ==========================================
   DIAGNÓSTICOS ESTRUTURAIS
========================================== */

/*
 * Estes diagnósticos não alteram o risco.
 *
 * O riskPipeline já possui responsabilidade
 * sobre os ajustes quantitativos.
 *
 * Aqui registramos somente informações que podem
 * ser úteis posteriormente para auditoria,
 * combinação de picks e exposição.
 */
function evaluateStructuralDiagnostics(
  market:
    string,

  context:
    CorrelationStructuralContext
): CorrelationDiagnostic[] {
  const diagnostics:
    CorrelationDiagnostic[] = [];

  if (!market) {
    diagnostics.push({
      code:
        "CORRELATION_UNKNOWN_MARKET",

      type:
        "INFO",

      description:
        "The market could not be normalized for correlation diagnostics."
    });

    return diagnostics;
  }

  if (!context.valid) {
    diagnostics.push({
      code:
        "CORRELATION_CONTEXT_UNAVAILABLE",

      type:
        "INFO",

      description:
        "Valid lambdas were unavailable for structural correlation diagnostics."
    });

    return diagnostics;
  }

  const totalLambda =
    context.totalLambda as number;

  const lambdaDifference =
    context.lambdaDifference as number;

  const minimumLambda =
    context.minimumLambda as number;

  /*
   * Estes sinais são apenas descrições da
   * estrutura da partida.
   *
   * Eles não somam penalidades porque essas
   * condições já são consideradas pelo risco.
   */

  if (
    (
      market ===
        "BTTS_YES" ||
      market ===
        "OVER_2_5"
    ) &&
    minimumLambda >= 1 &&
    totalLambda >= 2.75
  ) {
    diagnostics.push({
      code:
        "GOAL_MARKETS_SHARE_STRONG_STRUCTURE",

      type:
        "SUPPORT",

      description:
        "Both teams have sufficient scoring expectation and the total lambda supports goal-related markets."
    });
  }

  if (
    market ===
      "BTTS_YES" &&
    minimumLambda < 0.80
  ) {
    diagnostics.push({
      code:
        "BTTS_YES_DEPENDS_ON_LOW_LAMBDA_TEAM",

      type:
        "RISK",

      description:
        "BTTS Yes depends on a team whose scoring expectation is structurally low."
    });
  }

  if (
    market ===
      "OVER_2_5" &&
    lambdaDifference > 1.65 &&
    minimumLambda < 0.85
  ) {
    diagnostics.push({
      code:
        "OVER_2_5_CONCENTRATED_SCORING_STRUCTURE",

      type:
        "INFO",

      description:
        "The expected goals are heavily concentrated in one team, which may favor one-sided high-score outcomes."
    });
  }

  if (
    market ===
      "BTTS_NO" &&
    totalLambda >= 3.20 &&
    minimumLambda >= 0.90
  ) {
    diagnostics.push({
      code:
        "BTTS_NO_OPPOSES_DISTRIBUTED_GOAL_STRUCTURE",

      type:
        "RISK",

      description:
        "The total and minimum lambdas indicate meaningful scoring expectation for both teams."
    });
  }

  if (
    (
      market ===
        "HOME" ||
      market ===
        "AWAY"
    ) &&
    lambdaDifference < 0.30
  ) {
    diagnostics.push({
      code:
        "RESULT_MARKET_IN_BALANCED_STRUCTURE",

      type:
        "RISK",

      description:
        "The teams have similar scoring expectations, making directional result exposure structurally less distinct."
    });
  }

  if (
    market ===
      "OVER_1_5" &&
    totalLambda < 2
  ) {
    diagnostics.push({
      code:
        "OVER_1_5_LOW_TOTAL_LAMBDA_STRUCTURE",

      type:
        "RISK",

      description:
        "The total expected goals are relatively low for an Over 1.5 position."
    });
  }

  return diagnostics;
}

/* ==========================================
   MERCADOS
========================================== */

function normalizeMarketName(
  value: unknown
): string {
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
      return market;
  }
}

/* ==========================================
   HELPERS
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
            warning ??
            ""
          ).trim()
      )
      .filter(Boolean);

  return [
    ...new Set(
      warnings
    )
  ];
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
function roundNumber(
  value: number,
  decimals = 6
): number {
  if (!Number.isFinite(value)) {
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