import type {
  DecisionClassification,
  CanonicalDecisionMarket,
  DecisionMarketPolicy,
  DecisionMarketDebug
} from "./types";

import { roundNumber } from "./helpers";

/* ==========================================
   CLASSIFICAÇÃO
========================================== */

export function classifyMarket({
  policy,

  probability,
  ev,
  risk,
  confidence,

  odd,
  probabilityEdge,
  rankingScore
}: {
  policy:
    DecisionMarketPolicy;

  probability:
    number;

  ev:
    number;

  risk:
    number;

  confidence:
    number;

  odd:
    number;

  probabilityEdge:
    number | null;

  rankingScore:
    number | null;
}): DecisionClassification {
  if (
    policy.scalper &&
    passesLevel({
      probability,
      ev,
      risk,
      confidence,

      level:
        policy.scalper
    })
  ) {
    return "SCALPER";
  }

  if (
    passesLevel({
      probability,
      ev,
      risk,
      confidence,

      level:
        policy.elite
    })
  ) {
    return "ELITE";
  }

  if (
    passesLevel({
      probability,
      ev,
      risk,
      confidence,

      level:
        policy.bet
    })
  ) {
    return "BET";
  }

  if (
    passesLevel({
      probability,
      ev,
      risk,
      confidence,

      level:
        policy.watchlist
    })
  ) {
    return "WATCHLIST";
  }

  /*
   * V7.2 — tolerância de fronteira.
   *
   * Uma diferença de até 1 ponto percentual na
   * probabilidade mínima não elimina automaticamente
   * um mercado que apresenta forte sustentação em:
   *
   * - EV;
   * - edge;
   * - risco;
   * - confiança;
   * - ranking.
   *
   * Essa tolerância pode gerar somente WATCHLIST.
   * Nunca promove diretamente a BET, ELITE ou SCALPER.
   */
  if (
    passesWatchlistBorderTolerance({
      policy,
      probability,
      ev,
      risk,
      confidence,
      odd,
      probabilityEdge,
      rankingScore
    })
  ) {
    return "WATCHLIST";
  }

  return "NO BET";
}

function passesWatchlistBorderTolerance({
  policy,
  probability,
  ev,
  risk,
  confidence,
  odd,
  probabilityEdge,
  rankingScore
}: {
  policy:
    DecisionMarketPolicy;

  probability:
    number;

  ev:
    number;

  risk:
    number;

  confidence:
    number;

  odd:
    number;

  probabilityEdge:
    number | null;

  rankingScore:
    number | null;
}): boolean {
  const level =
    policy.watchlist;

  const tolerance =
    getProbabilityBorderTolerance(
      odd
    );

  const shortfall =
    level.minimumProbability -
    probability;

  if (
    shortfall <= 0 ||
    shortfall > tolerance
  ) {
    return false;
  }

  const strongEv =
    ev >= Math.max(
      level.minimumEv * 2,
      0.08
    );

  const strongEdge =
    probabilityEdge !== null &&
    probabilityEdge >= 0.03;

  const comfortableRisk =
    risk <= Math.max(
      0,
      level.maximumRisk - 0.04
    );

  const confidencePassed =
    confidence >=
      level.minimumConfidence;

  const rankingPassed =
    rankingScore !== null &&
    rankingScore >= 0.60;

  return (
    strongEv &&
    strongEdge &&
    comfortableRisk &&
    confidencePassed &&
    rankingPassed
  );
}

function getProbabilityBorderTolerance(
  odd: number
): number {
  /*
   * Odds altas naturalmente trabalham com
   * probabilidades menores e maior variância.
   *
   * O limite permanece pequeno e serve apenas
   * para WATCHLIST.
   */
  if (odd >= 4) {
    return 0.015;
  }

  if (odd >= 2) {
    return 0.010;
  }

  return 0.0075;
}

export function buildThresholdDiagnostics({
  policy,
  probability,
  baseClassification
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

  risk:
    number | null;

  confidence:
    number | null;

  probabilityEdge:
    number | null;

  rankingScore:
    number | null;

  baseClassification:
    DecisionClassification;
}): DecisionMarketDebug["thresholdDiagnostics"] {
  const required =
    policy?.watchlist
      ?.minimumProbability ??
    null;

  const shortfall =
    required !== null &&
    probability !== null
      ? Math.max(
          0,
          required -
          probability
        )
      : null;

  return {
    watchlistProbabilityRequired:
      required,

    watchlistProbabilityActual:
      probability,

    watchlistProbabilityShortfall:
      shortfall === null
        ? null
        : roundNumber(
            shortfall
          ),

    borderToleranceApplied:
      baseClassification ===
        "WATCHLIST" &&
      shortfall !== null &&
      shortfall > 0
  };
}

function passesLevel({
  probability,
  ev,
  risk,
  confidence,
  level
}: {
  probability:
    number;

  ev:
    number;

  risk:
    number;

  confidence:
    number;

  level: {
    minimumProbability: number;
    minimumEv: number;
    maximumRisk: number;
    minimumConfidence: number;
  };
}): boolean {
  return (
    probability >=
      level.minimumProbability &&

    ev >=
      level.minimumEv &&

    risk <=
      level.maximumRisk &&

    confidence >=
      level.minimumConfidence
  );
}
