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
 * Estado atual (2026-09-03):
 *
 * A curva de calibração agora existe, mas é
 * deliberadamente simples e conservadora: um
 * viés aditivo constante por mercado (não uma
 * curva por faixa de probabilidade — isso exigiria
 * amostra muito maior do que o histórico real deste
 * app tem hoje), calculado a partir do histórico de
 * apostas já liquidadas (trackingEngine), e só
 * aplicado quando:
 *
 * 1. o mercado específico tem pelo menos
 *    MIN_SAMPLE_PER_MARKET apostas liquidadas;
 * 2. o desvio entre a probabilidade média que o
 *    modelo previu e o winRate real observado é
 *    estatisticamente significativo (teste de
 *    proporção, 95% — ver significance.ts), não
 *    só "parece diferente".
 *
 * Sem isso (a esmagadora maioria dos casos hoje,
 * dado o tamanho da amostra real), a transformação
 * permanece identidade:
 *
 * calibratedProbability = rawProbability
 *
 * Isso evita compressão arbitrária, dupla correção
 * e destruição artificial de EV a partir de ruído de
 * amostra pequena.
 *
 * Em ambiente de backtest/teste (Node, sem
 * localStorage), trackingEngine.getHistory() sempre
 * retorna vazio — a calibração fica automaticamente
 * inerte lá, sem nenhum código condicional dedicado a
 * isso. O backtest sintético nunca é afetado por
 * viés aprendido de apostas reais.
 */

import { buildCalibrationReport } from "../tracking/calibrationReport";
import { getHistory } from "../tracking/trackingEngine";
import { isSignificantDeviation } from "./significance";

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

  /*
   * Diagnóstico — presentes só quando um mercado foi
   * informado e havia histórico suficiente para avaliar
   * (independente de a correção ter sido de fato
   * aplicada).
   */
  sampleSize?: number;
  observedWinRate?: number;
  expectedWinRate?: number;
  appliedBias?: number;
}

/* ==========================================
   POLÍTICA
========================================== */

const MIN_SAMPLE_PER_MARKET = 30;

/*
 * Nunca aplica a correção inteira — só uma fração do
 * viés medido. Mesmo com significância estatística
 * confirmada a 95%, a média usada como referência ainda
 * é um resumo de uma amostra real (não uma verdade
 * populacional conhecida); amortecer é a postura mais
 * conservadora, no mesmo espírito de kellyFraction=0.25
 * em GLOBAL_POLICY (nunca aposta o Kelly cheio, mesmo
 * quando a estimativa parece boa).
 */
const CORRECTION_SHRINKAGE = 0.5;

/*
 * Teto absoluto da correção, em pontos percentuais de
 * probabilidade — evita que uma amostra pequena porém
 * estatisticamente "significativa" desloque a
 * probabilidade de forma desproporcional.
 */
const MAX_ADJUSTMENT = 0.08;

/* ==========================================
   FUNÇÃO PRINCIPAL DE COMPATIBILIDADE
========================================== */

/*
 * Mantém o contrato atual utilizado por eventuais
 * consumidores legados que só passam a probabilidade,
 * sem mercado — sem mercado não há como buscar
 * histórico específico, então esta função permanece
 * identidade. O pipeline oficial (probabilityPipeline)
 * usa calibrateProbabilityDetailed(), que recebe o
 * mercado.
 *
 * Entradas inválidas retornam NaN para que o pipeline
 * superior possa bloquear a análise.
 *
 * Não retornamos 0.5, pois isso esconderia uma falha do
 * modelo.
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

  return parsed;
}

/* ==========================================
   FUNÇÃO DETALHADA PARA AUDITORIA
========================================== */

export function calibrateProbabilityDetailed(
  probability: number,
  market?: string
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

  const correction =
    market
      ? computeMarketBias(market)
      : null;

  if (!correction) {
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

  const {
    sampleSize,
    observedWinRate,
    expectedWinRate,
    significant
  } = correction;

  if (!significant) {
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
        "NO_VALIDATED_CALIBRATION_MODEL",

      sampleSize,
      observedWinRate,
      expectedWinRate
    };
  }

  const rawBias =
    observedWinRate -
    expectedWinRate;

  const appliedBias =
    clamp(
      rawBias *
        CORRECTION_SHRINKAGE,
      -MAX_ADJUSTMENT,
      MAX_ADJUSTMENT
    );

  const calibrated =
    clampProbability(
      parsed +
        appliedBias
    );

  return {
    valid: true,

    raw:
      parsed,

    calibrated,

    applied:
      true,

    method:
      "EMPIRICAL_BUCKETS",

    reason:
      "CALIBRATION_APPLIED",

    sampleSize,
    observedWinRate,
    expectedWinRate,
    appliedBias
  };
}

/* ==========================================
   VIÉS HISTÓRICO POR MERCADO
========================================== */

function computeMarketBias(
  market: string
): {
  sampleSize: number;
  observedWinRate: number;
  expectedWinRate: number;
  significant: boolean;
} | null {
  const report =
    buildCalibrationReport(
      getHistory()
    );

  const bucket =
    report.byMarket[market];

  if (
    !bucket ||
    bucket.bets <
      MIN_SAMPLE_PER_MARKET
  ) {
    return null;
  }

  const significant =
    isSignificantDeviation(
      bucket.bets,
      bucket.winRate,
      bucket.avgProbability
    );

  return {
    sampleSize:
      bucket.bets,

    observedWinRate:
      bucket.winRate,

    expectedWinRate:
      bucket.avgProbability,

    significant
  };
}

/* ==========================================
   VALIDAÇÃO
========================================== */

function parseProbability(
  value: unknown
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value === "boolean"
  ) {
    return null;
  }

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

function clampProbability(
  value: number
): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(
    0.01,
    Math.min(
      value,
      0.99
    )
  );
}

function clamp(
  value: number,
  minimum: number,
  maximum: number
): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(
    minimum,
    Math.min(
      value,
      maximum
    )
  );
}
