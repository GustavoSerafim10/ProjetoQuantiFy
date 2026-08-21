import {
  buildCombo
} from "../../../domain/analysis/multiBetBuilder";

import type { EvaluatedDecisionMarket } from "./types";

/* ==========================================
   COMBO
========================================== */

export function safeBuildCombo(
  markets: EvaluatedDecisionMarket[]
) {
  if (
    !Array.isArray(markets) ||
    markets.length < 2
  ) {
    return null;
  }

  try {
    return buildCombo(
      markets
    );
  } catch (error) {
    console.warn(
      "⚠️ buildCombo falhou",
      error
    );

    return null;
  }
}
