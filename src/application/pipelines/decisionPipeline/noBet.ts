import type { DecisionPipelineDebug } from "./types";

/* ==========================================
   NO BET
========================================== */

export function createNoBetResult({
  data,
  inputMarkets,
  gameWarnings,
  upstream,
  reason
}: {
  data: any;
  inputMarkets: any[];
  gameWarnings: string[];

  upstream: {
    probabilityValid: boolean;
    valueValid: boolean;
    riskValid: boolean;
    confidenceValid: boolean;
    rankingValid: boolean;
    correlationValid: boolean;
  };

  reason: string;
}) {
  const debug:
    DecisionPipelineDebug = {
      valid:
        false,

      version:
        "V7.2_ELITE",

      inputMarkets:
        inputMarkets.length,

      eligibleMarkets: 0,
      actionableMarkets: 0,

      eliteMarkets: 0,
      scalperMarkets: 0,
      betMarkets: 0,
      watchlistMarkets: 0,
      noBetMarkets:
        inputMarkets.length,

      discardedMarkets:
        inputMarkets.length,

      bestMarket:
        null,

      bestClassification:
        null,

      upstream,

      reason
    };

  return {
    ...data,

    decisionValid:
      false,

    elite:
      null,

    scalper:
      null,

    best:
      null,

    finalBest:
      null,

    operationalBets:
      [],

    watchlist:
      [],

    secondary:
      null,

    combo:
      null,

    actionableMarkets:
      [],

    discarded:
      inputMarkets,

    noBet:
      true,

    reason,

    warnings:
      gameWarnings,

    trackingPending:
      false,

    debug: {
      ...(data?.debug ?? {}),

      decisionPipeline:
        debug
    }
  };
}
