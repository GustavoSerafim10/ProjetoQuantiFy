import {
  applyCorrelationAdjustments
} from "../../domain/correlation/correlationEngine";

import type { PipelineRecord } from "./pipelineRecord";

/* ==========================================
   CORRELATION PIPELINE — QUANTIFY V7
========================================== */

/*
 * Responsabilidade:
 *
 * - receber os mercados produzidos pelos
 *   pipelines anteriores;
 * - construir o contexto de correlação;
 * - executar o correlationEngine uma única vez;
 * - padronizar warnings e penalidades;
 * - preservar mercados originais para auditoria;
 * - anexar diagnóstico ao resultado.
 *
 * Este arquivo não:
 *
 * - cria regras matemáticas de correlação;
 * - escolhe mercados;
 * - remove mercados;
 * - calcula probabilidade;
 * - calcula EV;
 * - detecta exposição de uma carteira final;
 * - aplica penalidades adicionais.
 */

/* ==========================================
   CONTRATOS
========================================== */

export interface CorrelationContext {
  lambdaHome: number | null;
  lambdaAway: number | null;
  goalExpectationScore: number | null;
}

export interface CorrelationPipelineDebug {
  valid: boolean;

  source:
    "correlationEngine";

  inputMarkets: number;
  outputMarkets: number;

  adjustedMarkets: number;
  penalizedMarkets: number;
  warnedMarkets: number;

  removedMarkets: number;

  context: CorrelationContext;

  error?: string;

  note:
    "Correlation engine adjusts diagnostics and penalties without selecting the final market.";
}

/* ==========================================
   PIPELINE
========================================== */

export function correlationPipeline(
  data: PipelineRecord
) {
  const rawMarkets =
    Array.isArray(data?.markets)
      ? data.markets
      : [];

  const context:
    CorrelationContext = {
      lambdaHome:
        parseFiniteNumber(
          data?.lambdaHome
        ),

      lambdaAway:
        parseFiniteNumber(
          data?.lambdaAway
        ),

      goalExpectationScore:
        parseFiniteNumber(
          data?.goalExpectationScore
        )
    };

  /*
   * Sem mercados não existe correlação
   * para aplicar.
   */
  if (rawMarkets.length === 0) {
    const debug:
      CorrelationPipelineDebug = {
        valid: false,

        source:
          "correlationEngine",

        inputMarkets: 0,
        outputMarkets: 0,

        adjustedMarkets: 0,
        penalizedMarkets: 0,
        warnedMarkets: 0,

        removedMarkets: 0,

        context,

        error:
          "NO_MARKETS_TO_CORRELATE",

        note:
          "Correlation engine adjusts diagnostics and penalties without selecting the final market."
      };

    return {
      ...data,

      rawMarkets:
        rawMarkets,

      markets:
        rawMarkets,

      correlationApplied:
        false,

      correlationValid:
        false,

      debug: {
        ...(data?.debug ?? {}),

        correlationPipeline:
          debug
      }
    };
  }

  try {
    /*
     * Toda regra de correlação pertence ao
     * correlationEngine.
     *
     * O pipeline apenas orquestra.
     */
    const engineResult =
      applyCorrelationAdjustments(
        rawMarkets,

        {
          lambdaHome:
            context.lambdaHome,

          lambdaAway:
            context.lambdaAway,

          goalExpectationScore:
            context.goalExpectationScore
        }
      );

    /*
     * Se o engine retornar algo inesperado,
     * não inventamos mercados.
     */
    if (!Array.isArray(engineResult)) {
      return createFailedResult(
        data,
        rawMarkets,
        context,
        "INVALID_CORRELATION_ENGINE_OUTPUT"
      );
    }

    const correlatedMarkets =
      engineResult.map(
        (
          market: PipelineRecord,
          index: number
        ) =>
          normalizeCorrelatedMarket(
            market,
            index
          )
      );

    const adjustedMarkets =
      countAdjustedMarkets(
        rawMarkets,
        correlatedMarkets
      );

    const penalizedMarkets =
      correlatedMarkets.filter(
        market =>
          market.correlationPenalty > 0
      ).length;

    const warnedMarkets =
      correlatedMarkets.filter(
        market =>
          market.warnings.length > 0
      ).length;

    const debug:
      CorrelationPipelineDebug = {
        valid: true,

        source:
          "correlationEngine",

        inputMarkets:
          rawMarkets.length,

        outputMarkets:
          correlatedMarkets.length,

        adjustedMarkets,
        penalizedMarkets,
        warnedMarkets,

        removedMarkets:
          Math.max(
            0,
            rawMarkets.length -
              correlatedMarkets.length
          ),

        context,

        note:
          "Correlation engine adjusts diagnostics and penalties without selecting the final market."
      };

    return {
      ...data,

      /*
       * Preserva a entrada real do pipeline
       * para comparação e auditoria.
       */
      rawMarkets,

      markets:
        correlatedMarkets,

      correlationApplied:
        true,

      correlationValid:
        true,

      debug: {
        ...(data?.debug ?? {}),

        correlationPipeline:
          debug
      }
    };
  } catch (error) {
    /*
     * Uma falha de correlação não deve derrubar
     * toda a análise.
     *
     * Entretanto, ela deve ser explicitamente
     * sinalizada para que o risk/decision pipeline
     * possa bloquear ou reduzir confiança.
     */
    return createFailedResult(
      data,
      rawMarkets,
      context,
      getErrorMessage(error)
    );
  }
}

/* ==========================================
   NORMALIZAÇÃO DO MERCADO
========================================== */

function normalizeCorrelatedMarket(
  market: PipelineRecord,
  index: number
) {
  const warnings =
    normalizeWarnings(
      market?.warnings
    );

  const correlationPenalty =
    parseNonNegativeNumber(
      market?.correlationPenalty
    ) ?? 0;

  return {
    ...market,

    correlationPenalty:
      roundNumber(
        correlationPenalty
      ),

    warnings,

    debug: {
      ...(market?.debug ?? {}),

      correlationPipeline: {
        marketIndex:
          index,

        correlationPenalty:
          roundNumber(
            correlationPenalty
          ),

        warnings
      }
    }
  };
}

/* ==========================================
   RESULTADO DE FALHA
========================================== */

function createFailedResult(
  data: PipelineRecord,
  rawMarkets: PipelineRecord[],
  context: CorrelationContext,
  error: string
) {
  const unchangedMarkets =
    rawMarkets.map(
      (
        market: PipelineRecord,
        index: number
      ) => {
        const warnings =
          normalizeWarnings([
            ...normalizeWarnings(
              market?.warnings
            ),

            "CORRELATION_NOT_APPLIED"
          ]);

        return {
          ...market,

          warnings,

          debug: {
            ...(market?.debug ?? {}),

            correlationPipeline: {
              marketIndex:
                index,

              correlationPenalty:
                parseNonNegativeNumber(
                  market?.correlationPenalty
                ) ?? 0,

              warnings,

              error
            }
          }
        };
      }
    );

  const debug:
    CorrelationPipelineDebug = {
      valid: false,

      source:
        "correlationEngine",

      inputMarkets:
        rawMarkets.length,

      outputMarkets:
        unchangedMarkets.length,

      adjustedMarkets: 0,
      penalizedMarkets: 0,

      warnedMarkets:
        unchangedMarkets.length,

      removedMarkets: 0,

      context,

      error,

      note:
        "Correlation engine adjusts diagnostics and penalties without selecting the final market."
    };

  return {
    ...data,

    rawMarkets,

    markets:
      unchangedMarkets,

    correlationApplied:
      false,

    correlationValid:
      false,

    debug: {
      ...(data?.debug ?? {}),

      correlationPipeline:
        debug
    }
  };
}

/* ==========================================
   CONTAGEM DE ALTERAÇÕES
========================================== */

function countAdjustedMarkets(
  rawMarkets: PipelineRecord[],
  correlatedMarkets: PipelineRecord[]
): number {
  const count =
    Math.min(
      rawMarkets.length,
      correlatedMarkets.length
    );

  let adjusted = 0;

  for (
    let index = 0;
    index < count;
    index++
  ) {
    const rawPenalty =
      parseNonNegativeNumber(
        rawMarkets[index]
          ?.correlationPenalty
      ) ?? 0;

    const adjustedPenalty =
      parseNonNegativeNumber(
        correlatedMarkets[index]
          ?.correlationPenalty
      ) ?? 0;

    const rawWarnings =
      normalizeWarnings(
        rawMarkets[index]
          ?.warnings
      );

    const adjustedWarnings =
      normalizeWarnings(
        correlatedMarkets[index]
          ?.warnings
      );

    const penaltyChanged =
      Math.abs(
        rawPenalty -
        adjustedPenalty
      ) > 1e-9;

    const warningsChanged =
      rawWarnings.join("|") !==
      adjustedWarnings.join("|");

    if (
      penaltyChanged ||
      warningsChanged
    ) {
      adjusted++;
    }
  }

  /*
   * Caso o engine altere a quantidade de mercados,
   * isso também é considerado uma modificação.
   */
  adjusted +=
    Math.abs(
      rawMarkets.length -
      correlatedMarkets.length
    );

  return adjusted;
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

  const normalized =
    value
      .map(warning =>
        String(warning ?? "")
          .trim()
      )
      .filter(Boolean);

  return [
    ...new Set(normalized)
  ];
}

function parseFiniteNumber(
  value: unknown
): number | null {
  const parsed =
    Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
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

function getErrorMessage(
  error: unknown
): string {
  if (
    error instanceof Error &&
    error.message
  ) {
    return error.message;
  }

  return (
    "CORRELATION_ENGINE_EXECUTION_FAILED"
  );
}

function roundNumber(
  value: number,
  decimals = 4
): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const factor =
    10 ** decimals;

  return (
    Math.round(
      value * factor
    ) / factor
  );
}