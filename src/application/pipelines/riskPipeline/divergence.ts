import type { RiskComponent } from "./types";

import { RISK_POLICY, STRUCTURE_THRESHOLDS } from "./policy";

import { roundNumber } from "./helpers";

/* ==========================================
   DIVERGÊNCIA MODELO X MERCADO
========================================== */

export function addMarketDisagreementComponents({
  components,

  probability,

  odd,

  impliedProbability,

  probabilityEdge,

  absoluteMarketDisagreement
}: {
  components:
    RiskComponent[];

  probability: number;

  odd: number | null;

  impliedProbability:
    number | null;

  probabilityEdge:
    number | null;

  absoluteMarketDisagreement:
    number | null;
}) {
  if (
    odd === null ||
    impliedProbability === null ||
    probabilityEdge === null ||
    absoluteMarketDisagreement === null
  ) {
    components.push({
      source:
        "MARKET_DISAGREEMENT_MISSING_ODD",

      category:
        "MARKET_DISAGREEMENT",

      adjustment:
        RISK_POLICY
          .missingOdd,

      warning:
        "MARKET_DISAGREEMENT_NOT_MEASURED_WITHOUT_VALID_ODD"
    });

    return;
  }

  const metadata = {
    probability:
      roundNumber(
        probability
      ),

    odd:
      roundNumber(
        odd
      ),

    impliedProbability:
      roundNumber(
        impliedProbability
      ),

    probabilityEdge:
      roundNumber(
        probabilityEdge
      ),

    absoluteMarketDisagreement:
      roundNumber(
        absoluteMarketDisagreement
      )
  };

  if (
    absoluteMarketDisagreement >=
    STRUCTURE_THRESHOLDS
      .severeMarketDisagreement
  ) {
    components.push({
      source:
        "MARKET_DISAGREEMENT_SEVERE",

      category:
        "MARKET_DISAGREEMENT",

      adjustment:
        RISK_POLICY
          .severeMarketDisagreement,

      warning:
        "SEVERE_MODEL_MARKET_DISAGREEMENT",

      metadata
    });

    return;
  }

  if (
    absoluteMarketDisagreement >=
    STRUCTURE_THRESHOLDS
      .extremeMarketDisagreement
  ) {
    components.push({
      source:
        "MARKET_DISAGREEMENT_EXTREME",

      category:
        "MARKET_DISAGREEMENT",

      adjustment:
        RISK_POLICY
          .extremeMarketDisagreement,

      warning:
        "EXTREME_MODEL_MARKET_DISAGREEMENT",

      metadata
    });

    return;
  }

  if (
    absoluteMarketDisagreement >=
    STRUCTURE_THRESHOLDS
      .highMarketDisagreement
  ) {
    components.push({
      source:
        "MARKET_DISAGREEMENT_HIGH",

      category:
        "MARKET_DISAGREEMENT",

      adjustment:
        RISK_POLICY
          .highMarketDisagreement,

      warning:
        "HIGH_MODEL_MARKET_DISAGREEMENT",

      metadata
    });

    return;
  }

  if (
    absoluteMarketDisagreement >=
    STRUCTURE_THRESHOLDS
      .moderateMarketDisagreement
  ) {
    components.push({
      source:
        "MARKET_DISAGREEMENT_MODERATE",

      category:
        "MARKET_DISAGREEMENT",

      adjustment:
        RISK_POLICY
          .moderateMarketDisagreement,

      warning:
        "MODERATE_MODEL_MARKET_DISAGREEMENT",

      metadata
    });
  }
}
