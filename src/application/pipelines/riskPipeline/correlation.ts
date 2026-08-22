import type { RiskComponent } from "./types";

import { STRUCTURE_THRESHOLDS } from "./policy";

import { clamp, parseFiniteNumber, roundNumber } from "./helpers";

import type { PipelineRecord } from "../pipelineRecord";

/* ==========================================
   CORRELAÇÃO
========================================== */

export function addCorrelationComponent({
  components,
  market
}: {
  components:
    RiskComponent[];

  market: PipelineRecord;
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
