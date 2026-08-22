/* VERIFIED BUILD: PROBABILITY PIPELINE V7.1 ELITE — CALIBRATION METADATA + PROBABILITY DELTA */
import {
  calibrateProbabilityDetailed,
  type ProbabilityCalibrationResult
} from "../../domain/calibration/probabilityCalibration";

import type { MarketCode } from "../../shared/types/marketCode";
import type { PipelineRecord } from "./pipelineRecord";

/* ==========================================
   PROBABILITY PIPELINE — QUANTIFY V7.1 ELITE
========================================== */

/*
 * Responsabilidade:
 *
 * - receber probabilidades analíticas do modelo;
 * - validar contratos e relações matemáticas;
 * - normalizar o mercado 1X2;
 * - aplicar a calibração oficial uma única vez;
 * - registrar metadados e deltas de calibração;
 * - preservar coerência entre mercados;
 * - derivar mercados complementares;
 * - produzir o mapa canônico de probabilidades;
 * - disponibilizar auditoria detalhada no debug.
 *
 * Este arquivo não:
 *
 * - reconstrói lambdas;
 * - aplica baseline arbitrário;
 * - realiza shrinkage amostral;
 * - utiliza odds;
 * - calcula EV;
 * - ranqueia mercados;
 * - escolhe mercado;
 * - toma decisão de aposta.
 *
 * Filosofia:
 *
 * O pipeline organiza e valida probabilidades.
 * Ele não deve criar vantagem artificial nem
 * corrigir silenciosamente o modelo analítico.
 */

/* ==========================================
   CONTRATOS — MERCADOS
========================================== */

export type ProbabilityMarket = MarketCode;

export type IndependentCalibrationMarket =
  | "HOME"
  | "DRAW"
  | "AWAY"
  | "OVER_1_5"
  | "OVER_2_5"
  | "BTTS_YES";

export type ProbabilityMap = Record<
  ProbabilityMarket,
  number
>;

export type ProbabilityDeltaMap = Record<
  ProbabilityMarket,
  number
>;

/* ==========================================
   CONTRATOS — MODELO ANALÍTICO
========================================== */

interface ResultProbabilities {
  homeWin: number;
  draw: number;
  awayWin: number;
}

interface GoalsProbabilities {
  over15: number;
  over25: number;
}

interface BttsProbabilities {
  yes: number;
  no: number;
}

/* ==========================================
   CONTRATOS — CALIBRAÇÃO
========================================== */

interface CalibrationMetadataEntry {
  market: IndependentCalibrationMarket;

  valid: boolean;

  raw: number | null;
  calibrated: number | null;

  output: number;

  applied: boolean;
  fallbackUsed: boolean;

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

export type CalibrationMetadata = Record<
  IndependentCalibrationMarket,
  CalibrationMetadataEntry
>;

interface CalibrationExecution {
  value: number;
  metadata: CalibrationMetadataEntry;
}

interface IndependentCalibratedValues {
  HOME: number;
  DRAW: number;
  AWAY: number;

  OVER_1_5: number;
  OVER_2_5: number;

  BTTS_YES: number;
}

/* ==========================================
   CONTRATOS — COERÊNCIA
========================================== */

interface OverHierarchyResult {
  over15: number;
  over25: number;

  adjusted: boolean;
  minimumGap: number;
  gapBefore: number;
  gapAfter: number;

  method:
    | "NONE"
    | "BOUNDED_ISOTONIC_MIN_GAP";
}

interface ProbabilityCoherenceDebug {
  resultNormalized: boolean;
  resultNormalizationAdjusted: boolean;

  bttsDerivedFromYes: boolean;
  doubleChanceDerivedFromResult: boolean;

  overHierarchyAdjusted: boolean;
  overHierarchyMethod:
    | "NONE"
    | "BOUNDED_ISOTONIC_MIN_GAP";

  overMinimumGap: number;
  overGapBefore: number;
  overGapAfter: number;
}

/* ==========================================
   CONTRATO — DEBUG
========================================== */

interface ProbabilityPipelineDebug {
  valid: boolean;

  version: "V7.1_ELITE";
  source: "analytical_model";

  calibrationApplied: boolean;
  calibrationFallbackUsed: boolean;

  calibration: CalibrationMetadata;

  raw: ProbabilityMap;

  calibratedIndependent:
    IndependentCalibratedValues;

  final: ProbabilityMap;

  probabilityDelta:
    ProbabilityDeltaMap;

  coherence:
    ProbabilityCoherenceDebug;

  warnings: string[];
}

/* ==========================================
   CONTRATOS — BUILDERS
========================================== */

interface ProbabilityMapsInput {
  normalizedRawResult:
    ResultProbabilities;

  rawGoals:
    GoalsProbabilities;

  rawBtts:
    BttsProbabilities;

  calibratedResult:
    ResultProbabilities;

  coherentGoals:
    OverHierarchyResult;

  calibratedBtts:
    BttsProbabilities;
}

interface ProbabilityMapsResult {
  raw: ProbabilityMap;
  final: ProbabilityMap;
}

interface DebugOutputInput {
  rawProbabilities:
    ProbabilityMap;

  finalProbabilities:
    ProbabilityMap;

  calibratedIndependent:
    IndependentCalibratedValues;

  calibration:
    CalibrationMetadata;

  normalizedRawResult:
    ResultProbabilities;

  rawResult:
    ResultProbabilities;

  coherentGoals:
    OverHierarchyResult;

  warnings:
    string[];
}

/* ==========================================
   CONSTANTES
========================================== */

/*
 * Diferença estrutural mínima entre os mercados:
 *
 * P(Over 1.5) >= P(Over 2.5) + gap
 *
 * O valor é pequeno para não inventar uma grande
 * separação quando o modelo apresenta inversão.
 */
const OVER_HIERARCHY_MIN_GAP = 0.02;

const PROBABILITY_DECIMALS = 6;

/* ==========================================
   RESULTADO SEGURO INVÁLIDO
========================================== */

/*
 * Em falha estrutural, retornamos zero em todos
 * os mercados e marcamos probabilityValid=false.
 *
 * Isso evita criar oportunidade artificial.
 * Os pipelines seguintes devem tratar esse estado
 * obrigatoriamente como NO BET.
 */
const INVALID_PROBABILITIES: ProbabilityMap = {
  HOME: 0,
  DRAW: 0,
  AWAY: 0,

  OVER_1_5: 0,
  OVER_2_5: 0,

  BTTS_YES: 0,
  BTTS_NO: 0,

  DOUBLE_CHANCE_1X: 0,
  DOUBLE_CHANCE_X2: 0
};

const ZERO_INDEPENDENT_VALUES:
  IndependentCalibratedValues = {
    HOME: 0,
    DRAW: 0,
    AWAY: 0,

    OVER_1_5: 0,
    OVER_2_5: 0,

    BTTS_YES: 0
  };

/* ==========================================
   PIPELINE PRINCIPAL
========================================== */

export function probabilityPipeline(
  data: PipelineRecord
) {
  const warnings: string[] = [];

  /* ========================================
     1. EXTRAÇÃO DOS BLOCOS ANALÍTICOS
  ======================================== */

  const rawResult =
    extractResultProbabilities(
      data?.result
    );

  const rawGoals =
    extractGoalsProbabilities(
      data?.goals
    );

  const rawBtts =
    extractBttsProbabilities(
      data?.btts
    );

  collectExtractionWarnings(
    rawResult,
    rawGoals,
    rawBtts,
    warnings
  );

  /*
   * Não fabricamos probabilidades quando algum
   * bloco fundamental está ausente ou inválido.
   */
  if (
    !rawResult ||
    !rawGoals ||
    !rawBtts
  ) {
    return createInvalidPipelineResult(
      data,
      warnings
    );
  }

  /* ========================================
     2. NORMALIZAÇÃO BRUTA DO 1X2
  ======================================== */

  const normalizedRawResult =
    normalizeResultProbabilities(
      rawResult
    );

  /* ========================================
     3. CALIBRAÇÃO DOS MERCADOS INDEPENDENTES
  ======================================== */

  const homeCalibration =
    calibrateMarket(
      "HOME",
      normalizedRawResult.homeWin
    );

  const drawCalibration =
    calibrateMarket(
      "DRAW",
      normalizedRawResult.draw
    );

  const awayCalibration =
    calibrateMarket(
      "AWAY",
      normalizedRawResult.awayWin
    );

  /*
   * HOME, DRAW e AWAY formam uma distribuição.
   * Depois da calibração individual, a soma pode
   * deixar de ser 1 em futuras curvas empíricas.
   * Por isso, normalizamos uma única vez novamente.
   *
   * Atualmente a calibração oficial é identidade,
   * portanto essa etapa preserva os valores.
   */
  const calibratedResult =
    normalizeResultProbabilities({
      homeWin:
        homeCalibration.value,

      draw:
        drawCalibration.value,

      awayWin:
        awayCalibration.value
    });

  const over15Calibration =
    calibrateMarket(
      "OVER_1_5",
      rawGoals.over15
    );

  const over25Calibration =
    calibrateMarket(
      "OVER_2_5",
      rawGoals.over25
    );

  const coherentGoals =
    enforceOverHierarchy(
      over15Calibration.value,
      over25Calibration.value
    );

  const bttsYesCalibration =
    calibrateMarket(
      "BTTS_YES",
      rawBtts.yes
    );

  /*
   * BTTS_YES é o mercado independente calibrado.
   * BTTS_NO é obrigatoriamente seu complemento.
   */
  const calibratedBtts:
    BttsProbabilities = {
      yes:
        bttsYesCalibration.value,

      no:
        1 - bttsYesCalibration.value
    };

  /* ========================================
     4. METADADOS DE CALIBRAÇÃO
  ======================================== */

  const calibrationMetadata =
    createCalibrationMetadata({
      HOME:
        homeCalibration.metadata,

      DRAW:
        drawCalibration.metadata,

      AWAY:
        awayCalibration.metadata,

      OVER_1_5:
        over15Calibration.metadata,

      OVER_2_5:
        over25Calibration.metadata,

      BTTS_YES:
        bttsYesCalibration.metadata
    });

  /* ========================================
     5. MAPAS RAW E FINAL
  ======================================== */

  const probabilityMaps =
    buildProbabilityMaps({
      normalizedRawResult,
      rawGoals,
      rawBtts,
      calibratedResult,
      coherentGoals,
      calibratedBtts
    });

  /* ========================================
     6. VALORES INDEPENDENTES CALIBRADOS
  ======================================== */

  const calibratedIndependent:
    IndependentCalibratedValues = {
      HOME:
        homeCalibration.value,

      DRAW:
        drawCalibration.value,

      AWAY:
        awayCalibration.value,

      OVER_1_5:
        over15Calibration.value,

      OVER_2_5:
        over25Calibration.value,

      BTTS_YES:
        bttsYesCalibration.value
    };

  /* ========================================
     7. DEBUG CANÔNICO
  ======================================== */

  const debug =
    createDebugOutput({
      rawProbabilities:
        probabilityMaps.raw,

      finalProbabilities:
        probabilityMaps.final,

      calibratedIndependent,
      calibration:
        calibrationMetadata,

      normalizedRawResult,
      rawResult,
      coherentGoals,
      warnings
    });

  /* ========================================
     8. SAÍDA
  ======================================== */

  return {
    ...data,

    probabilityValid:
      true,

    probs:
      roundProbabilityMap(
        probabilityMaps.final
      ),

    debug: {
      ...(data?.debug ?? {}),

      probabilityPipeline:
        debug
    }
  };
}

/* ==========================================
   WARNINGS DE EXTRAÇÃO
========================================== */

function collectExtractionWarnings(
  rawResult:
    ResultProbabilities | null,

  rawGoals:
    GoalsProbabilities | null,

  rawBtts:
    BttsProbabilities | null,

  warnings:
    string[]
): void {
  if (!rawResult) {
    warnings.push(
      "INVALID_ANALYTICAL_RESULT_PROBABILITIES"
    );
  }

  if (!rawGoals) {
    warnings.push(
      "INVALID_ANALYTICAL_GOALS_PROBABILITIES"
    );
  }

  if (!rawBtts) {
    warnings.push(
      "INVALID_ANALYTICAL_BTTS_PROBABILITIES"
    );
  }
}

/* ==========================================
   EXTRAÇÃO — RESULTADO 1X2
========================================== */

function extractResultProbabilities(
  result: PipelineRecord
): ResultProbabilities | null {
  /*
   * Compatibilidade com os contratos atuais:
   *
   * Canônico:
   * homeWin, draw, awayWin
   *
   * goalsModel:
   * home, draw, away
   *
   * Legado:
   * homeProbability, drawProbability,
   * awayProbability
   */
  const homeWin =
    firstValidProbability([
      result?.homeWin,
      result?.home,
      result?.homeProbability
    ]);

  const draw =
    firstValidProbability([
      result?.draw,
      result?.drawProbability
    ]);

  const awayWin =
    firstValidProbability([
      result?.awayWin,
      result?.away,
      result?.awayProbability
    ]);

  if (
    homeWin === null ||
    draw === null ||
    awayWin === null
  ) {
    return null;
  }

  const total =
    homeWin +
    draw +
    awayWin;

  if (
    !Number.isFinite(total) ||
    total <= 0
  ) {
    return null;
  }

  return {
    homeWin,
    draw,
    awayWin
  };
}

/* ==========================================
   EXTRAÇÃO — GOLS
========================================== */

function extractGoalsProbabilities(
  goals: PipelineRecord
): GoalsProbabilities | null {
  const over15 =
    firstValidProbability([
      goals?.over15,
      goals?.over1_5,
      goals?.overOneFive
    ]);

  const over25 =
    firstValidProbability([
      goals?.over25,
      goals?.over2_5,
      goals?.overTwoFive
    ]);

  if (
    over15 === null ||
    over25 === null
  ) {
    return null;
  }

  return {
    over15,
    over25
  };
}

/* ==========================================
   EXTRAÇÃO — BTTS
========================================== */

function extractBttsProbabilities(
  btts: PipelineRecord
): BttsProbabilities | null {
  const explicitYes =
    firstValidProbability([
      btts?.yes,
      btts?.bttsYes,
      btts?.bothTeamsScore
    ]);

  const explicitNo =
    firstValidProbability([
      btts?.no,
      btts?.bttsNo
    ]);

  /*
   * BTTS_YES é a probabilidade principal.
   * BTTS_NO é derivado como complemento para
   * garantir que os dois resultados somem 1.
   */
  if (explicitYes !== null) {
    return {
      yes:
        explicitYes,

      no:
        1 - explicitYes
    };
  }

  /*
   * Caso somente BTTS_NO esteja disponível,
   * reconstruímos BTTS_YES como complemento.
   */
  if (explicitNo !== null) {
    return {
      yes:
        1 - explicitNo,

      no:
        explicitNo
    };
  }

  return null;
}

/* ==========================================
   NORMALIZAÇÃO 1X2
========================================== */

/*
 * Esta função não aplica baseline, shrinkage,
 * odds ou qualquer alteração externa.
 *
 * Ela garante apenas:
 *
 * HOME + DRAW + AWAY = 1
 */
function normalizeResultProbabilities(
  result: ResultProbabilities
): ResultProbabilities {
  const total =
    result.homeWin +
    result.draw +
    result.awayWin;

  if (
    !Number.isFinite(total) ||
    total <= 0
  ) {
    return {
      homeWin: 0,
      draw: 0,
      awayWin: 0
    };
  }

  return {
    homeWin:
      result.homeWin /
      total,

    draw:
      result.draw /
      total,

    awayWin:
      result.awayWin /
      total
  };
}

/* ==========================================
   CALIBRAÇÃO POR MERCADO
========================================== */

function calibrateMarket(
  market:
    IndependentCalibrationMarket,

  probability:
    number
): CalibrationExecution {
  const detailed =
    calibrateProbabilityDetailed(
      probability
    );

  const calibrated =
    parseProbability(
      detailed.calibrated
    );

  const raw =
    parseProbability(
      probability
    );

  /*
   * Se a função detalhada falhar, preservamos a
   * probabilidade analítica válida. Não aplicamos
   * baseline de 50% nem qualquer valor sintético.
   */
  const fallbackValue =
    raw ?? 0;

  const output =
    calibrated ??
    fallbackValue;

  const fallbackUsed =
    calibrated === null &&
    raw !== null;

  return {
    value:
      output,

    metadata:
      createCalibrationMetadataEntry(
        market,
        detailed,
        output,
        fallbackUsed
      )
  };
}

function createCalibrationMetadataEntry(
  market:
    IndependentCalibrationMarket,

  result:
    ProbabilityCalibrationResult,

  output:
    number,

  fallbackUsed:
    boolean
): CalibrationMetadataEntry {
  return {
    market,

    valid:
      result.valid,

    raw:
      result.raw,

    calibrated:
      result.calibrated,

    output:
      roundProbability(
        output
      ),

    applied:
      result.applied,

    fallbackUsed,

    method:
      result.method,

    reason:
      result.reason
  };
}

function createCalibrationMetadata(
  metadata:
    CalibrationMetadata
): CalibrationMetadata {
  /*
   * Helper explícito para centralizar o contrato.
   * Facilita futuras inclusões de sampleSize,
   * versão da curva, liga e bucket histórico.
   */
  return {
    HOME:
      metadata.HOME,

    DRAW:
      metadata.DRAW,

    AWAY:
      metadata.AWAY,

    OVER_1_5:
      metadata.OVER_1_5,

    OVER_2_5:
      metadata.OVER_2_5,

    BTTS_YES:
      metadata.BTTS_YES
  };
}

/* ==========================================
   COERÊNCIA DOS OVERS
========================================== */

function enforceOverHierarchy(
  over15: number,
  over25: number,
  minimumGap = OVER_HIERARCHY_MIN_GAP
): OverHierarchyResult {
  const safeOver15 =
    clampProbability(
      over15
    );

  const safeOver25 =
    clampProbability(
      over25
    );

  const safeGap =
    clamp(
      minimumGap,
      0,
      1
    );

  const gapBefore =
    safeOver15 -
    safeOver25;

  if (gapBefore >= safeGap) {
    return {
      over15:
        safeOver15,

      over25:
        safeOver25,

      adjusted:
        false,

      minimumGap:
        safeGap,

      gapBefore,
      gapAfter:
        gapBefore,

      method:
        "NONE"
    };
  }

  /*
   * Projeção isotônica limitada com gap mínimo.
   *
   * Minimizamos a alteração quadrática conjunta
   * sob a restrição:
   *
   * adjustedOver15 - adjustedOver25 >= gap
   *
   * A solução sem limites é:
   *
   * over15 = (a + b + gap) / 2
   * over25 = (a + b - gap) / 2
   *
   * Depois aplicamos limites [0, 1] preservando
   * a diferença mínima sempre que possível.
   */
  const center =
    (safeOver15 + safeOver25) /
    2;

  let adjustedOver15 =
    center +
    safeGap / 2;

  let adjustedOver25 =
    center -
    safeGap / 2;

  if (adjustedOver15 > 1) {
    adjustedOver15 = 1;
    adjustedOver25 =
      Math.max(
        0,
        1 - safeGap
      );
  }

  if (adjustedOver25 < 0) {
    adjustedOver25 = 0;
    adjustedOver15 =
      Math.min(
        1,
        safeGap
      );
  }

  adjustedOver15 =
    clampProbability(
      adjustedOver15
    );

  adjustedOver25 =
    clampProbability(
      adjustedOver25
    );

  const gapAfter =
    adjustedOver15 -
    adjustedOver25;

  return {
    over15:
      adjustedOver15,

    over25:
      adjustedOver25,

    adjusted:
      true,

    minimumGap:
      safeGap,

    gapBefore,
    gapAfter,

    method:
      "BOUNDED_ISOTONIC_MIN_GAP"
  };
}

/* ==========================================
   CONSTRUÇÃO DOS MAPAS
========================================== */

function buildProbabilityMaps(
  input:
    ProbabilityMapsInput
): ProbabilityMapsResult {
  const {
    normalizedRawResult,
    rawGoals,
    rawBtts,
    calibratedResult,
    coherentGoals,
    calibratedBtts
  } = input;

  const raw =
    buildRawProbabilityMap(
      normalizedRawResult,
      rawGoals,
      rawBtts
    );

  const final =
    buildFinalProbabilityMap(
      calibratedResult,
      coherentGoals,
      calibratedBtts
    );

  return {
    raw,
    final
  };
}

function buildRawProbabilityMap(
  result:
    ResultProbabilities,

  goals:
    GoalsProbabilities,

  btts:
    BttsProbabilities
): ProbabilityMap {
  return {
    HOME:
      result.homeWin,

    DRAW:
      result.draw,

    AWAY:
      result.awayWin,

    OVER_1_5:
      goals.over15,

    OVER_2_5:
      goals.over25,

    BTTS_YES:
      btts.yes,

    BTTS_NO:
      btts.no,

    DOUBLE_CHANCE_1X:
      deriveDoubleChance1X(
        result
      ),

    DOUBLE_CHANCE_X2:
      deriveDoubleChanceX2(
        result
      )
  };
}

function buildFinalProbabilityMap(
  result:
    ResultProbabilities,

  goals:
    OverHierarchyResult,

  btts:
    BttsProbabilities
): ProbabilityMap {
  return {
    HOME:
      result.homeWin,

    DRAW:
      result.draw,

    AWAY:
      result.awayWin,

    OVER_1_5:
      goals.over15,

    OVER_2_5:
      goals.over25,

    BTTS_YES:
      btts.yes,

    BTTS_NO:
      btts.no,

    DOUBLE_CHANCE_1X:
      deriveDoubleChance1X(
        result
      ),

    DOUBLE_CHANCE_X2:
      deriveDoubleChanceX2(
        result
      )
  };
}

/* ==========================================
   DERIVAÇÃO — DUPLA CHANCE
========================================== */

function deriveDoubleChance1X(
  result:
    ResultProbabilities
): number {
  return clampProbability(
    result.homeWin +
    result.draw
  );
}

function deriveDoubleChanceX2(
  result:
    ResultProbabilities
): number {
  return clampProbability(
    result.draw +
    result.awayWin
  );
}

/* ==========================================
   DELTAS DE PROBABILIDADE
========================================== */

function calculateProbabilityDelta(
  raw:
    ProbabilityMap,

  final:
    ProbabilityMap
): ProbabilityDeltaMap {
  return {
    HOME:
      calculateDelta(
        raw.HOME,
        final.HOME
      ),

    DRAW:
      calculateDelta(
        raw.DRAW,
        final.DRAW
      ),

    AWAY:
      calculateDelta(
        raw.AWAY,
        final.AWAY
      ),

    OVER_1_5:
      calculateDelta(
        raw.OVER_1_5,
        final.OVER_1_5
      ),

    OVER_2_5:
      calculateDelta(
        raw.OVER_2_5,
        final.OVER_2_5
      ),

    BTTS_YES:
      calculateDelta(
        raw.BTTS_YES,
        final.BTTS_YES
      ),

    BTTS_NO:
      calculateDelta(
        raw.BTTS_NO,
        final.BTTS_NO
      ),

    DOUBLE_CHANCE_1X:
      calculateDelta(
        raw.DOUBLE_CHANCE_1X,
        final.DOUBLE_CHANCE_1X
      ),

    DOUBLE_CHANCE_X2:
      calculateDelta(
        raw.DOUBLE_CHANCE_X2,
        final.DOUBLE_CHANCE_X2
      )
  };
}

function calculateDelta(
  raw:
    number,

  final:
    number
): number {
  return roundProbability(
    final - raw
  );
}

/* ==========================================
   DEBUG OUTPUT
========================================== */

function createDebugOutput(
  input:
    DebugOutputInput
): ProbabilityPipelineDebug {
  const {
    rawProbabilities,
    finalProbabilities,
    calibratedIndependent,
    calibration,
    normalizedRawResult,
    rawResult,
    coherentGoals,
    warnings
  } = input;

  const calibrationApplied =
    hasAppliedCalibration(
      calibration
    );

  const calibrationFallbackUsed =
    hasCalibrationFallback(
      calibration
    );

  const probabilityDelta =
    calculateProbabilityDelta(
      rawProbabilities,
      finalProbabilities
    );

  const resultNormalizationAdjusted =
    didResultNormalizationAdjust(
      rawResult,
      normalizedRawResult
    );

  return {
    valid:
      true,

    version:
      "V7.1_ELITE",

    source:
      "analytical_model",

    calibrationApplied,
    calibrationFallbackUsed,

    calibration,

    raw:
      roundProbabilityMap(
        rawProbabilities
      ),

    calibratedIndependent:
      roundIndependentValues(
        calibratedIndependent
      ),

    final:
      roundProbabilityMap(
        finalProbabilities
      ),

    probabilityDelta,

    coherence: {
      resultNormalized:
        true,

      resultNormalizationAdjusted,

      bttsDerivedFromYes:
        true,

      doubleChanceDerivedFromResult:
        true,

      overHierarchyAdjusted:
        coherentGoals.adjusted,

      overHierarchyMethod:
        coherentGoals.method,

      overMinimumGap:
        roundProbability(
          coherentGoals.minimumGap
        ),

      overGapBefore:
        roundProbability(
          coherentGoals.gapBefore
        ),

      overGapAfter:
        roundProbability(
          coherentGoals.gapAfter
        )
    },

    warnings: [
      ...warnings
    ]
  };
}

function hasAppliedCalibration(
  calibration:
    CalibrationMetadata
): boolean {
  return getCalibrationEntries(
    calibration
  ).some(
    entry => entry.applied
  );
}

function hasCalibrationFallback(
  calibration:
    CalibrationMetadata
): boolean {
  return getCalibrationEntries(
    calibration
  ).some(
    entry => entry.fallbackUsed
  );
}

function getCalibrationEntries(
  calibration:
    CalibrationMetadata
): CalibrationMetadataEntry[] {
  return [
    calibration.HOME,
    calibration.DRAW,
    calibration.AWAY,
    calibration.OVER_1_5,
    calibration.OVER_2_5,
    calibration.BTTS_YES
  ];
}

function didResultNormalizationAdjust(
  raw:
    ResultProbabilities,

  normalized:
    ResultProbabilities
): boolean {
  const epsilon =
    1e-12;

  return (
    Math.abs(
      raw.homeWin -
      normalized.homeWin
    ) > epsilon ||

    Math.abs(
      raw.draw -
      normalized.draw
    ) > epsilon ||

    Math.abs(
      raw.awayWin -
      normalized.awayWin
    ) > epsilon
  );
}

/* ==========================================
   RESULTADO INVÁLIDO
========================================== */

function createInvalidPipelineResult(
  data: PipelineRecord,
  warnings: string[]
) {
  const invalidCalibration =
    createInvalidCalibrationMetadata();

  const debug:
    ProbabilityPipelineDebug = {
      valid:
        false,

      version:
        "V7.1_ELITE",

      source:
        "analytical_model",

      calibrationApplied:
        false,

      calibrationFallbackUsed:
        false,

      calibration:
        invalidCalibration,

      raw: {
        ...INVALID_PROBABILITIES
      },

      calibratedIndependent: {
        ...ZERO_INDEPENDENT_VALUES
      },

      final: {
        ...INVALID_PROBABILITIES
      },

      probabilityDelta: {
        ...INVALID_PROBABILITIES
      },

      coherence: {
        resultNormalized:
          false,

        resultNormalizationAdjusted:
          false,

        bttsDerivedFromYes:
          false,

        doubleChanceDerivedFromResult:
          false,

        overHierarchyAdjusted:
          false,

        overHierarchyMethod:
          "NONE",

        overMinimumGap:
          OVER_HIERARCHY_MIN_GAP,

        overGapBefore:
          0,

        overGapAfter:
          0
      },

      warnings: [
        ...warnings
      ]
    };

  return {
    ...data,

    probabilityValid:
      false,

    probs: {
      ...INVALID_PROBABILITIES
    },

    debug: {
      ...(data?.debug ?? {}),

      probabilityPipeline:
        debug
    }
  };
}

function createInvalidCalibrationMetadata():
  CalibrationMetadata {
  return {
    HOME:
      createInvalidCalibrationEntry(
        "HOME"
      ),

    DRAW:
      createInvalidCalibrationEntry(
        "DRAW"
      ),

    AWAY:
      createInvalidCalibrationEntry(
        "AWAY"
      ),

    OVER_1_5:
      createInvalidCalibrationEntry(
        "OVER_1_5"
      ),

    OVER_2_5:
      createInvalidCalibrationEntry(
        "OVER_2_5"
      ),

    BTTS_YES:
      createInvalidCalibrationEntry(
        "BTTS_YES"
      )
  };
}

function createInvalidCalibrationEntry(
  market:
    IndependentCalibrationMarket
): CalibrationMetadataEntry {
  return {
    market,

    valid:
      false,

    raw:
      null,

    calibrated:
      null,

    output:
      0,

    applied:
      false,

    fallbackUsed:
      false,

    method:
      "IDENTITY",

    reason:
      "INVALID_PROBABILITY"
  };
}

/* ==========================================
   HELPERS — VALIDAÇÃO
========================================== */

function firstValidProbability(
  values: unknown[]
): number | null {
  for (const value of values) {
    const probability =
      parseProbability(
        value
      );

    if (probability !== null) {
      return probability;
    }
  }

  return null;
}

function parseProbability(
  value: unknown
): number | null {
  /*
   * Number(null), Number("") e Number(false)
   * retornariam zero. Esses valores não indicam
   * uma probabilidade efetivamente fornecida.
   */
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

/* ==========================================
   HELPERS — LIMITES
========================================== */

function clampProbability(
  probability: number
): number {
  return clamp(
    probability,
    0,
    1
  );
}

function clamp(
  value: number,
  minimum: number,
  maximum: number
): number {
  if (!Number.isFinite(value)) {
    return minimum;
  }

  return Math.min(
    maximum,
    Math.max(
      minimum,
      value
    )
  );
}

/* ==========================================
   HELPERS — ARREDONDAMENTO
========================================== */

function roundProbability(
  probability: number,
  decimals = PROBABILITY_DECIMALS
): number {
  if (!Number.isFinite(probability)) {
    return 0;
  }

  const factor =
    10 ** decimals;

  return (
    Math.round(
      probability * factor
    ) / factor
  );
}

function roundIndependentValues(
  values:
    IndependentCalibratedValues
): IndependentCalibratedValues {
  return {
    HOME:
      roundProbability(
        values.HOME
      ),

    DRAW:
      roundProbability(
        values.DRAW
      ),

    AWAY:
      roundProbability(
        values.AWAY
      ),

    OVER_1_5:
      roundProbability(
        values.OVER_1_5
      ),

    OVER_2_5:
      roundProbability(
        values.OVER_2_5
      ),

    BTTS_YES:
      roundProbability(
        values.BTTS_YES
      )
  };
}

function roundProbabilityMap(
  probabilities:
    ProbabilityMap
): ProbabilityMap {
  return {
    HOME:
      roundProbability(
        probabilities.HOME
      ),

    DRAW:
      roundProbability(
        probabilities.DRAW
      ),

    AWAY:
      roundProbability(
        probabilities.AWAY
      ),

    OVER_1_5:
      roundProbability(
        probabilities.OVER_1_5
      ),

    OVER_2_5:
      roundProbability(
        probabilities.OVER_2_5
      ),

    BTTS_YES:
      roundProbability(
        probabilities.BTTS_YES
      ),

    BTTS_NO:
      roundProbability(
        probabilities.BTTS_NO
      ),

    DOUBLE_CHANCE_1X:
      roundProbability(
        probabilities.DOUBLE_CHANCE_1X
      ),

    DOUBLE_CHANCE_X2:
      roundProbability(
        probabilities.DOUBLE_CHANCE_X2
      )
  };
}
