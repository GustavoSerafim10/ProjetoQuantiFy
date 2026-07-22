/* ==========================================
   PROBABILITY CALIBRATION — QUANTIFY V7
========================================== */

/*
 * Responsabilidade:
 *
 * - receber uma probabilidade válida;
 * - aplicar a calibração oficial quando existir
 *   evidência histórica suficiente;
 * - preservar monotonicidade;
 * - nunca criar probabilidades artificiais.
 *
 * Estado atual:
 *
 * Ainda não existe uma curva de calibração
 * historicamente validada fora da amostra.
 *
 * Portanto, a transformação oficial permanece
 * como identidade:
 *
 * calibratedProbability = rawProbability
 *
 * Isso evita compressão arbitrária, dupla
 * correção e destruição artificial de EV.
 */

/* ==========================================
   CONTRATOS
========================================== */

export interface ProbabilityCalibrationResult {
  valid: boolean;

  raw: number | null;
  calibrated: number | null;

  applied: boolean;

  method:
    | "IDENTITY"
    | "EMPIRICAL_BUCKETS"
    | "ISOTONIC"
    | "PLATT";

  reason:
    | "NO_VALIDATED_CALIBRATION_MODEL"
    | "CALIBRATION_APPLIED"
    | "INVALID_PROBABILITY";
}

/* ==========================================
   FUNÇÃO PRINCIPAL DE COMPATIBILIDADE
========================================== */

/*
 * Mantém o contrato atual utilizado pelo
 * probabilityPipeline.
 *
 * Entradas inválidas retornam NaN para que o
 * pipeline superior possa bloquear a análise.
 *
 * Não retornamos 0.5, pois isso esconderia
 * uma falha do modelo.
 */
export function calibrateProbability(
  probability: number
): number {
  const parsed =
    parseProbability(
      probability
    );

  if (parsed === null) {
    return Number.NaN;
  }

  /*
   * Transformação identidade.
   *
   * Será substituída apenas quando houver uma
   * curva de calibração validada com histórico.
   */
  return parsed;
}

/* ==========================================
   FUNÇÃO DETALHADA PARA AUDITORIA
========================================== */

export function calibrateProbabilityDetailed(
  probability: number
): ProbabilityCalibrationResult {
  const parsed =
    parseProbability(
      probability
    );

  if (parsed === null) {
    return {
      valid: false,

      raw: null,
      calibrated: null,

      applied: false,

      method:
        "IDENTITY",

      reason:
        "INVALID_PROBABILITY"
    };
  }

  return {
    valid: true,

    raw:
      parsed,

    calibrated:
      parsed,

    applied:
      false,

    method:
      "IDENTITY",

    reason:
      "NO_VALIDATED_CALIBRATION_MODEL"
  };
}

/* ==========================================
   VALIDAÇÃO
========================================== */

function parseProbability(
  value: unknown
): number | null {
  const parsed =
    Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed < 0 ||
    parsed > 1
  ) {
    return null;
  }

  return parsed;
}