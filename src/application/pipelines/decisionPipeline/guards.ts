import type {
  CanonicalDecisionMarket,
  DecisionMarketPolicy,
  DecisionGuardResult
} from "./types";

import { GLOBAL_POLICY } from "./marketPolicies";

import { normalizeWarnings } from "./helpers";

import type { PipelineRecord } from "../pipelineRecord";

/* ==========================================
   GUARDS
========================================== */

export function evaluateDecisionGuards({
  marketName,
  policy,

  probability,
  odd,
  ev,
  probabilityEdge,
  risk,
  confidence,
  rankingScore,
  trapScore,

  structureValid,
  rankingValid,

  data
}: {
  marketName:
    CanonicalDecisionMarket | null;

  policy:
    DecisionMarketPolicy | null;

  probability:
    number | null;

  odd:
    number | null;

  ev:
    number | null;

  probabilityEdge:
    number | null;

  risk:
    number | null;

  confidence:
    number | null;

  rankingScore:
    number | null;

  trapScore:
    number | null;

  structureValid:
    boolean;

  rankingValid:
    boolean;

  data:
    PipelineRecord;
}): DecisionGuardResult {
  const blockers:
    string[] = [];

  const warnings:
    string[] = [];

  if (!marketName || !policy) {
    blockers.push(
      "UNSUPPORTED_MARKET"
    );
  }

  if (probability === null) {
    blockers.push(
      "INVALID_PROBABILITY"
    );
  } else {
    if (
      probability <
      GLOBAL_POLICY
        .hardMinimumProbability
    ) {
      blockers.push(
        "PROBABILITY_BELOW_GLOBAL_MINIMUM"
      );
    }
  }

  if (odd === null) {
    blockers.push(
      "INVALID_ODD"
    );
  } else if (
    odd <=
    GLOBAL_POLICY.hardMinimumOdd
  ) {
    blockers.push(
      "ODD_BELOW_GLOBAL_MINIMUM"
    );
  } else if (
    policy &&
    odd <
      policy.minimumOdd
  ) {
    blockers.push(
      "ODD_BELOW_MARKET_MINIMUM"
    );
  }

  if (ev === null) {
    blockers.push(
      "INVALID_EV"
    );
  } else if (
    ev <=
    GLOBAL_POLICY.hardMinimumEv
  ) {
    blockers.push(
      "NON_POSITIVE_EV"
    );
  }

  if (
    probabilityEdge === null
  ) {
    warnings.push(
      "PROBABILITY_EDGE_UNAVAILABLE"
    );
  } else if (
    probabilityEdge <= 0
  ) {
    blockers.push(
      "NON_POSITIVE_PROBABILITY_EDGE"
    );
  }

  if (risk === null) {
    blockers.push(
      "INVALID_RISK"
    );
  } else if (
    risk >
    GLOBAL_POLICY
      .hardMaximumRisk
  ) {
    blockers.push(
      "RISK_ABOVE_GLOBAL_MAXIMUM"
    );
  }

  if (confidence === null) {
    blockers.push(
      "INVALID_CONFIDENCE"
    );
  }

  if (rankingScore === null) {
    blockers.push(
      "INVALID_RANKING_SCORE"
    );
  }

  if (!rankingValid) {
    blockers.push(
      "RANKING_MARKED_INVALID"
    );
  }

  if (!structureValid) {
    blockers.push(
      "INVALID_MARKET_STRUCTURE"
    );
  }

  if (
    trapScore !== null &&
    trapScore >
      GLOBAL_POLICY
        .maximumTrapScore
  ) {
    blockers.push(
      "TRAP_SCORE_ABOVE_MAXIMUM"
    );
  }

  if (
    data?.correlationValid ===
    false
  ) {
    warnings.push(
      "CORRELATION_NOT_VALIDATED"
    );
  }

  if (
    data?.simulationValid ===
    false
  ) {
    warnings.push(
      "SIMULATION_NOT_VALIDATED"
    );
  }

  return {
    valid:
      blockers.length === 0,

    blockers:
      normalizeWarnings(
        blockers
      ),

    warnings:
      normalizeWarnings(
        warnings
      )
  };
}
