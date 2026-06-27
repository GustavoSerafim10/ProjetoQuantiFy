// src/domain/probability/logisticRegression.ts

export interface LogisticInput {
  probability: number;
  slope?: number;
  intercept?: number;
}

function clamp(value: number) {
  return Math.max(0.01, Math.min(0.99, value));
}

/**
 * Ajusta probabilidades utilizando regressão logística.
 * Objetivo:
 * corrigir pequenas distorções do modelo matemático
 * sem alterar drasticamente sua distribuição.
 */
export function logisticRegression({
  probability,
  slope = 1,
  intercept = 0
}: LogisticInput): number {

  const p = clamp(probability);

  const logit =
    Math.log(p / (1 - p));

  const adjusted =
    intercept +
    slope * logit;

  const calibrated =
    1 /
    (1 + Math.exp(-adjusted));

  return clamp(calibrated);
}