import type { DecisionClassification } from "./types";

import { getClassificationPriority } from "./ranking";

/* ==========================================
   LIMITADOR DE CLASSIFICAÇÃO
========================================== */

export function capClassification(
  classification:
    DecisionClassification,

  maximumAllowed:
    DecisionClassification | null
): DecisionClassification {
  if (
    maximumAllowed === null
  ) {
    return classification;
  }

  const currentPriority =
    getClassificationPriority(
      classification
    );

  const maximumPriority =
    getClassificationPriority(
      maximumAllowed
    );

  /*
   * Se a classificação original já for mais
   * conservadora, ela é preservada.
   *
   * Exemplo:
   * original = NO BET
   * limite = WATCHLIST
   * resultado = NO BET
   */
  if (
    currentPriority <=
    maximumPriority
  ) {
    return classification;
  }

  return maximumAllowed;
}

export function restrictClassification(
  currentLimit:
    DecisionClassification | null,

  newLimit:
    DecisionClassification
): DecisionClassification {
  if (
    currentLimit === null
  ) {
    return newLimit;
  }

  const currentPriority =
    getClassificationPriority(
      currentLimit
    );

  const newPriority =
    getClassificationPriority(
      newLimit
    );

  /*
   * Mantém sempre o limite mais conservador.
   */
  return newPriority <
    currentPriority
      ? newLimit
      : currentLimit;
}
