import {
  buildCombo
} from "../../../domain/analysis/multiBetBuilder";

import type { EvaluatedDecisionMarket } from "./types";

/* ==========================================
   COMBO
========================================== */

export function safeBuildCombo(
  markets: EvaluatedDecisionMarket[],
  matchContext?: {
    lambdaHome?: number | null;
    lambdaAway?: number | null;
  }
) {
  if (
    !Array.isArray(markets) ||
    markets.length < 2
  ) {
    return null;
  }

  try {
    return buildCombo(
      markets,
      matchContext
    );
  } catch (error) {
    console.warn(
      "⚠️ buildCombo falhou",
      error
    );

    return null;
  }
}
