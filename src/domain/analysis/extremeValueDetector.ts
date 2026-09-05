/* ==========================================
   EXTREME VALUE DETECTOR — DECISION INTELLIGENCE
========================================== */

/*
 * Responsabilidade:
 *
 * - classificar a magnitude do EV de um mercado em
 *   NORMAL_VALUE / STRONG_VALUE / EXTREME_VALUE / SUSPICIOUS_VALUE;
 * - EV muito alto não é automaticamente bom — pode ser preço
 *   errado, input digitado errado, ou o modelo fora de
 *   distribuição. Isso NUNCA reduz a exigência de evidência,
 *   só aumenta.
 *
 * Este arquivo não:
 *
 * - recalcula EV;
 * - decide classificação — é telemetria (ver explain.ts). Um EV
 *   classificado como SUSPICIOUS_VALUE não vira NO BET
 *   automaticamente aqui; a decisão de quanto pesar isso cabe a
 *   quem consome o diagnóstico.
 *
 * Referência dos limites: NORMALIZATION_POLICY.evPositiveMaximum
 * (rankingPipeline.ts) = 0.25 já é o ponto em que o próprio
 * ranking considera o EV "totalmente creditado" — não precisa de
 * mais além disso para pontuar bem. Os limites abaixo são
 * múltiplos dessa referência já calibrada, não um número novo
 * inventado do zero.
 */

export type ExtremeValueClassification =
  | "NORMAL_VALUE"
  | "STRONG_VALUE"
  | "EXTREME_VALUE"
  | "SUSPICIOUS_VALUE";

export interface ExtremeValueResult {
  valid: boolean;

  classification: ExtremeValueClassification | null;

  /*
   * true quando probability alta (favorito claro) coincide com
   * EV fora do normal — mercados eficientes raramente erram tanto
   * o preço de um favorito quanto o de um azarão; a MESMA
   * magnitude de EV é mais suspeita num favorito.
   */
  escalatedByHighProbability: boolean;

  warnings: string[];
}

const THRESHOLDS = {
  /*
   * = NORMALIZATION_POLICY.evPositiveMaximum em rankingPipeline.ts.
   */
  normalMaximum: 0.25,
  strongMaximum: 0.50,
  extremeMaximum: 1.00
} as const;

/*
 * Probabilidade a partir da qual o mercado já é um favorito claro
 * o suficiente para que o mesmo EV mereça mais desconfiança.
 */
const HIGH_PROBABILITY_ESCALATION_THRESHOLD = 0.65;

export function detectExtremeValue({
  ev,
  probability
}: {
  ev: number | null;
  probability?: number | null;
}): ExtremeValueResult {
  const warnings: string[] = [];

  if (ev === null || !Number.isFinite(ev)) {
    return {
      valid: false,
      classification: null,
      escalatedByHighProbability: false,
      warnings: ["INVALID_EV_FOR_EXTREME_VALUE_DETECTION"]
    };
  }

  if (ev <= 0) {
    return {
      valid: true,
      classification: "NORMAL_VALUE",
      escalatedByHighProbability: false,
      warnings: []
    };
  }

  const baseClassification = classifyMagnitude(ev);

  const isHighProbabilityFavorite =
    probability !== null &&
    probability !== undefined &&
    Number.isFinite(probability) &&
    probability >= HIGH_PROBABILITY_ESCALATION_THRESHOLD;

  const escalatedByHighProbability =
    isHighProbabilityFavorite &&
    baseClassification !== "NORMAL_VALUE" &&
    baseClassification !== "SUSPICIOUS_VALUE";

  const classification =
    escalatedByHighProbability
      ? escalateOnce(baseClassification)
      : baseClassification;

  if (classification === "EXTREME_VALUE") {
    warnings.push("EXTREME_VALUE_REQUIRES_ADDITIONAL_EVIDENCE");
  }

  if (classification === "SUSPICIOUS_VALUE") {
    warnings.push("SUSPICIOUS_VALUE_LIKELY_INPUT_OR_MODEL_ERROR");
  }

  return {
    valid: true,
    classification,
    escalatedByHighProbability,
    warnings
  };
}

function classifyMagnitude(
  ev: number
): ExtremeValueClassification {
  if (ev <= THRESHOLDS.normalMaximum) {
    return "NORMAL_VALUE";
  }

  if (ev <= THRESHOLDS.strongMaximum) {
    return "STRONG_VALUE";
  }

  if (ev <= THRESHOLDS.extremeMaximum) {
    return "EXTREME_VALUE";
  }

  return "SUSPICIOUS_VALUE";
}

function escalateOnce(
  classification: ExtremeValueClassification
): ExtremeValueClassification {
  switch (classification) {
    case "STRONG_VALUE":
      return "EXTREME_VALUE";

    case "EXTREME_VALUE":
      return "SUSPICIOUS_VALUE";

    default:
      return classification;
  }
}
