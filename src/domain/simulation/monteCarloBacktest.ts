import { runBacktest } from "../backtest/runBacktest";

/* =========================================================
   MONTE CARLO BACKTEST — QUANTIFY V7.1 ELITE
========================================================= */

/*
 * Responsabilidade:
 *
 * - executar múltiplos backtests independentes;
 * - medir estabilidade do ROI e da banca;
 * - avaliar dispersão, drawdown e risco de ruína;
 * - calcular IC95, percentis, Sharpe, Sortino,
 *   assimetria, curtose e coeficiente de variação;
 * - classificar a qualidade estatística do conjunto;
 * - preservar compatibilidade com a API anterior.
 *
 * Este arquivo NÃO:
 *
 * - altera probabilidades do modelo;
 * - recalibra mercados;
 * - modifica a lógica do runBacktest();
 * - interfere no pipeline pré-live;
 * - toma decisões de entrada;
 * - substitui módulos de Risk, Confidence ou Decision.
 */

/* =========================================================
   TYPES
========================================================= */

export type MonteCarloBacktestQuality =
  | "INSUFFICIENT"
  | "LOW"
  | "MODERATE"
  | "HIGH"
  | "ELITE";

export interface MonteCarloBacktestResult {
  roi: number;
  finalBankroll: number;
  maxDrawdown: number;
  totalBets: number;
}

export interface ConfidenceInterval {
  lower: number;
  upper: number;
  marginOfError: number;
  confidenceLevel: 0.95;
}

export interface PercentileSummary {
  p05: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
}

export interface DistributionSummary {
  count: number;
  mean: number;
  median: number;
  standardDeviation: number;
  minimum: number;
  maximum: number;
  percentiles: PercentileSummary;
  confidenceInterval95: ConfidenceInterval;
  coefficientOfVariation: number | null;
  skewness: number;
  excessKurtosis: number;
}

export interface MonteCarloBacktestDiagnostics {
  valid: boolean;
  statisticallyReliable: boolean;
  profitable: boolean;
  stable: boolean;
  highVariance: boolean;
  acceptableDrawdown: boolean;
  acceptableRuinRisk: boolean;
  sufficientSimulations: boolean;
  sufficientBetVolume: boolean;
  roiConfidenceAboveZero: boolean;
  warnings: string[];
}

export interface MonteCarloBacktestMetadata {
  version: "V7.1_ELITE";
  simulationsRequested: number;
  simulationsCompleted: number;
  matchesPerSimulation: number;
  initialBankroll: number;
  ruinThreshold: number;
  generatedAt: string;
}

export interface MonteCarloBacktestOptions {
  initialBankroll?: number;
  ruinThreshold?: number;
  minimumReliableSimulations?: number;
  minimumReliableTotalBets?: number;
  acceptableAverageDrawdown?: number;
  acceptableRuinRate?: number;
  highVarianceCoefficient?: number;
}

export interface MonteCarloBacktestSummary {
  simulations: MonteCarloBacktestResult[];

  /*
   * Campos legados preservados.
   */
  averageROI: number;
  roiStdDev: number;
  minROI: number;
  maxROI: number;
  positiveRate: number;
  ruinRate: number;
  survivalRate: number;

  averageFinalBankroll: number;
  minFinalBankroll: number;
  maxFinalBankroll: number;

  averageDrawdown: number;

  /*
   * Estatística V7.1 Elite.
   */
  roi: DistributionSummary;
  finalBankroll: DistributionSummary;
  drawdown: DistributionSummary;
  totalBets: DistributionSummary;

  sharpeRatio: number | null;
  sortinoRatio: number | null;

  totalBetsAcrossSimulations: number;
  averageBetsPerSimulation: number;

  probabilityOfProfit: number;
  probabilityOfLoss: number;
  probabilityOfRuin: number;
  probabilityOfSurvival: number;

  qualityScore: number;
  quality: MonteCarloBacktestQuality;

  diagnostics: MonteCarloBacktestDiagnostics;
  metadata: MonteCarloBacktestMetadata;
}

/* =========================================================
   CONSTANTS
========================================================= */

const DEFAULT_SIMULATIONS_COUNT = 1000;
const DEFAULT_MATCHES_PER_SIMULATION = 2000;
const DEFAULT_INITIAL_BANKROLL = 1000;

const DEFAULT_MINIMUM_RELIABLE_SIMULATIONS = 300;
const DEFAULT_MINIMUM_RELIABLE_TOTAL_BETS = 3000;

const DEFAULT_ACCEPTABLE_AVERAGE_DRAWDOWN = 0.30;
const DEFAULT_ACCEPTABLE_RUIN_RATE = 0.05;
const DEFAULT_HIGH_VARIANCE_COEFFICIENT = 1.50;

const NORMAL_95_Z_SCORE = 1.959963984540054;

/* =========================================================
   NUMERIC HELPERS
========================================================= */

function clamp(
  value: number,
  minimum: number,
  maximum: number
): number {
  if (!Number.isFinite(value)) {
    return minimum;
  }

  return Math.max(
    minimum,
    Math.min(value, maximum)
  );
}

function parseFiniteNumber(
  value: unknown
): number | null {
  if (
    value === undefined ||
    value === null ||
    value === "" ||
    typeof value === "boolean"
  ) {
    return null;
  }

  const parsed = Number(
    String(value)
      .replace(",", ".")
      .trim()
  );

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function parseNonNegativeNumber(
  value: unknown
): number | null {
  const parsed = parseFiniteNumber(value);

  if (
    parsed === null ||
    parsed < 0
  ) {
    return null;
  }

  return parsed;
}

function normalizeInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  const parsed = parseNonNegativeNumber(value);

  if (parsed === null) {
    return fallback;
  }

  return Math.round(
    clamp(parsed, minimum, maximum)
  );
}

function safeDivide(
  numerator: number,
  denominator: number,
  fallback = 0
): number {
  if (
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    denominator === 0
  ) {
    return fallback;
  }

  const result = numerator / denominator;

  return Number.isFinite(result)
    ? result
    : fallback;
}

function round(
  value: number,
  decimals = 6
): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const factor = 10 ** decimals;

  return Math.round(value * factor) / factor;
}

/* =========================================================
   BASIC STATISTICS
========================================================= */

function mean(values: number[]): number {
  if (!values.length) {
    return 0;
  }

  return (
    values.reduce(
      (sum, value) => sum + value,
      0
    ) / values.length
  );
}

function sampleVariance(
  values: number[]
): number {
  if (values.length < 2) {
    return 0;
  }

  const average = mean(values);

  const squaredDifferences = values.reduce(
    (sum, value) =>
      sum + (value - average) ** 2,
    0
  );

  return squaredDifferences /
    (values.length - 1);
}

function sampleStandardDeviation(
  values: number[]
): number {
  return Math.sqrt(
    Math.max(0, sampleVariance(values))
  );
}

function median(
  values: number[]
): number {
  return percentile(values, 0.5);
}

function percentile(
  values: number[],
  probability: number
): number {
  if (!values.length) {
    return 0;
  }

  const sorted = [...values].sort(
    (a, b) => a - b
  );

  const boundedProbability = clamp(
    probability,
    0,
    1
  );

  const position =
    (sorted.length - 1) *
    boundedProbability;

  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);

  const lower = sorted[lowerIndex] ?? 0;
  const upper = sorted[upperIndex] ?? lower;

  if (lowerIndex === upperIndex) {
    return lower;
  }

  const weight = position - lowerIndex;

  return lower +
    (upper - lower) *
      weight;
}

function calculatePercentiles(
  values: number[]
): PercentileSummary {
  return {
    p05: percentile(values, 0.05),
    p10: percentile(values, 0.10),
    p25: percentile(values, 0.25),
    p50: percentile(values, 0.50),
    p75: percentile(values, 0.75),
    p90: percentile(values, 0.90),
    p95: percentile(values, 0.95)
  };
}

function confidenceInterval95(
  values: number[]
): ConfidenceInterval {
  if (!values.length) {
    return {
      lower: 0,
      upper: 0,
      marginOfError: 0,
      confidenceLevel: 0.95
    };
  }

  const average = mean(values);

  if (values.length < 2) {
    return {
      lower: average,
      upper: average,
      marginOfError: 0,
      confidenceLevel: 0.95
    };
  }

  const standardError =
    sampleStandardDeviation(values) /
    Math.sqrt(values.length);

  const marginOfError =
    NORMAL_95_Z_SCORE *
    standardError;

  return {
    lower:
      average -
      marginOfError,

    upper:
      average +
      marginOfError,

    marginOfError,
    confidenceLevel: 0.95
  };
}

function coefficientOfVariation(
  values: number[]
): number | null {
  if (!values.length) {
    return null;
  }

  const average = mean(values);
  const standardDeviation =
    sampleStandardDeviation(values);

  if (Math.abs(average) < 1e-12) {
    return null;
  }

  return Math.abs(
    standardDeviation /
    average
  );
}

function skewness(
  values: number[]
): number {
  const count = values.length;

  if (count < 3) {
    return 0;
  }

  const average = mean(values);
  const standardDeviation =
    sampleStandardDeviation(values);

  if (standardDeviation === 0) {
    return 0;
  }

  const standardizedCubeSum =
    values.reduce(
      (sum, value) =>
        sum +
        ((value - average) /
          standardDeviation) ** 3,
      0
    );

  return (
    count /
    ((count - 1) *
      (count - 2))
  ) * standardizedCubeSum;
}

function excessKurtosis(
  values: number[]
): number {
  const count = values.length;

  if (count < 4) {
    return 0;
  }

  const average = mean(values);
  const standardDeviation =
    sampleStandardDeviation(values);

  if (standardDeviation === 0) {
    return 0;
  }

  const fourthMomentSum =
    values.reduce(
      (sum, value) =>
        sum +
        ((value - average) /
          standardDeviation) ** 4,
      0
    );

  const firstTerm =
    (
      count *
      (count + 1)
    ) /
    (
      (count - 1) *
      (count - 2) *
      (count - 3)
    ) *
    fourthMomentSum;

  const secondTerm =
    (
      3 *
      (count - 1) ** 2
    ) /
    (
      (count - 2) *
      (count - 3)
    );

  return firstTerm - secondTerm;
}

function summarizeDistribution(
  values: number[]
): DistributionSummary {
  const cleanValues =
    values.filter(Number.isFinite);

  if (!cleanValues.length) {
    return {
      count: 0,
      mean: 0,
      median: 0,
      standardDeviation: 0,
      minimum: 0,
      maximum: 0,
      percentiles:
        calculatePercentiles([]),
      confidenceInterval95:
        confidenceInterval95([]),
      coefficientOfVariation:
        null,
      skewness: 0,
      excessKurtosis: 0
    };
  }

  return {
    count:
      cleanValues.length,

    mean:
      mean(cleanValues),

    median:
      median(cleanValues),

    standardDeviation:
      sampleStandardDeviation(
        cleanValues
      ),

    minimum:
      Math.min(...cleanValues),

    maximum:
      Math.max(...cleanValues),

    percentiles:
      calculatePercentiles(
        cleanValues
      ),

    confidenceInterval95:
      confidenceInterval95(
        cleanValues
      ),

    coefficientOfVariation:
      coefficientOfVariation(
        cleanValues
      ),

    skewness:
      skewness(cleanValues),

    excessKurtosis:
      excessKurtosis(cleanValues)
  };
}

/* =========================================================
   RISK-ADJUSTED METRICS
========================================================= */

function calculateSharpeRatio(
  returns: number[],
  riskFreeReturn = 0
): number | null {
  if (returns.length < 2) {
    return null;
  }

  const excessReturns =
    returns.map(
      value =>
        value -
        riskFreeReturn
    );

  const denominator =
    sampleStandardDeviation(
      excessReturns
    );

  if (denominator <= 0) {
    return null;
  }

  return mean(excessReturns) /
    denominator;
}

function calculateSortinoRatio(
  returns: number[],
  minimumAcceptableReturn = 0
): number | null {
  if (returns.length < 2) {
    return null;
  }

  const downsideSquared =
    returns.map(returnValue => {
      const downside =
        Math.min(
          0,
          returnValue -
            minimumAcceptableReturn
        );

      return downside ** 2;
    });

  const downsideDeviation =
    Math.sqrt(
      mean(downsideSquared)
    );

  if (downsideDeviation <= 0) {
    return null;
  }

  const excessReturn =
    mean(returns) -
    minimumAcceptableReturn;

  return excessReturn /
    downsideDeviation;
}

/* =========================================================
   INPUT NORMALIZATION
========================================================= */

function normalizeOptions(
  initialBankroll: number,
  options: MonteCarloBacktestOptions
) {
  const resolvedInitialBankroll =
    parseNonNegativeNumber(
      options.initialBankroll
    ) ??
    initialBankroll;

  const requestedRuinThreshold =
    parseNonNegativeNumber(
      options.ruinThreshold
    );

  const ruinThreshold =
    requestedRuinThreshold ??
    resolvedInitialBankroll * 0.5;

  return {
    initialBankroll:
      Math.max(
        1,
        resolvedInitialBankroll
      ),

    ruinThreshold:
      clamp(
        ruinThreshold,
        0,
        Math.max(
          1,
          resolvedInitialBankroll
        )
      ),

    minimumReliableSimulations:
      normalizeInteger(
        options.minimumReliableSimulations,
        DEFAULT_MINIMUM_RELIABLE_SIMULATIONS,
        30,
        100000
      ),

    minimumReliableTotalBets:
      normalizeInteger(
        options.minimumReliableTotalBets,
        DEFAULT_MINIMUM_RELIABLE_TOTAL_BETS,
        100,
        100000000
      ),

    acceptableAverageDrawdown:
      clamp(
        parseFiniteNumber(
          options.acceptableAverageDrawdown
        ) ??
        DEFAULT_ACCEPTABLE_AVERAGE_DRAWDOWN,
        0,
        1
      ),

    acceptableRuinRate:
      clamp(
        parseFiniteNumber(
          options.acceptableRuinRate
        ) ??
        DEFAULT_ACCEPTABLE_RUIN_RATE,
        0,
        1
      ),

    highVarianceCoefficient:
      Math.max(
        0.10,
        parseFiniteNumber(
          options.highVarianceCoefficient
        ) ??
        DEFAULT_HIGH_VARIANCE_COEFFICIENT
      )
  };
}

/* =========================================================
   BACKTEST RESULT NORMALIZATION
========================================================= */

function normalizeBacktestResult(
  rawResult: unknown,
  initialBankroll: number
): MonteCarloBacktestResult | null {
  if (
    typeof rawResult !== "object" ||
    rawResult === null ||
    Array.isArray(rawResult)
  ) {
    return null;
  }

  const result =
    rawResult as Record<
      string,
      unknown
    >;

  const roi =
    parseFiniteNumber(
      result.roi
    );

  const maxDrawdown =
    parseNonNegativeNumber(
      result.maxDrawdown
    );

  const totalBets =
    parseNonNegativeNumber(
      result.totalBets
    );

  const bankrollHistory =
    Array.isArray(
      result.bankrollHistory
    )
      ? result.bankrollHistory
      : [];

  const lastBankrollEntry =
    bankrollHistory.length
      ? bankrollHistory[
          bankrollHistory.length - 1
        ]
      : undefined;

  const finalBankroll =
    parseNonNegativeNumber(
      lastBankrollEntry
    ) ??
    parseNonNegativeNumber(
      result.finalBankroll
    ) ??
    initialBankroll;

  if (
    roi === null ||
    maxDrawdown === null ||
    totalBets === null
  ) {
    return null;
  }

  return {
    roi,
    finalBankroll,
    maxDrawdown:
      clamp(
        maxDrawdown,
        0,
        1
      ),

    totalBets:
      Math.round(
        totalBets
      )
  };
}

/* =========================================================
   DIAGNOSTICS
========================================================= */

function buildDiagnostics(params: {
  simulationsCompleted: number;
  totalBetsAcrossSimulations: number;
  averageROI: number;
  roiConfidenceLower: number;
  roiCoefficientOfVariation: number | null;
  averageDrawdown: number;
  ruinRate: number;
  minimumReliableSimulations: number;
  minimumReliableTotalBets: number;
  acceptableAverageDrawdown: number;
  acceptableRuinRate: number;
  highVarianceCoefficient: number;
}): MonteCarloBacktestDiagnostics {
  const warnings: string[] = [];

  const sufficientSimulations =
    params.simulationsCompleted >=
    params.minimumReliableSimulations;

  const sufficientBetVolume =
    params.totalBetsAcrossSimulations >=
    params.minimumReliableTotalBets;

  const profitable =
    params.averageROI > 0;

  const roiConfidenceAboveZero =
    params.roiConfidenceLower > 0;

  const highVariance =
    params.roiCoefficientOfVariation !== null &&
    params.roiCoefficientOfVariation >
      params.highVarianceCoefficient;

  const acceptableDrawdown =
    params.averageDrawdown <=
    params.acceptableAverageDrawdown;

  const acceptableRuinRisk =
    params.ruinRate <=
    params.acceptableRuinRate;

  const statisticallyReliable =
    sufficientSimulations &&
    sufficientBetVolume;

  const stable =
    statisticallyReliable &&
    !highVariance &&
    acceptableDrawdown &&
    acceptableRuinRisk;

  if (!sufficientSimulations) {
    warnings.push(
      "INSUFFICIENT_SIMULATION_COUNT"
    );
  }

  if (!sufficientBetVolume) {
    warnings.push(
      "INSUFFICIENT_TOTAL_BET_VOLUME"
    );
  }

  if (!profitable) {
    warnings.push(
      "NON_POSITIVE_AVERAGE_ROI"
    );
  }

  if (!roiConfidenceAboveZero) {
    warnings.push(
      "ROI_CONFIDENCE_INTERVAL_CROSSES_ZERO"
    );
  }

  if (highVariance) {
    warnings.push(
      "HIGH_ROI_VARIANCE"
    );
  }

  if (!acceptableDrawdown) {
    warnings.push(
      "AVERAGE_DRAWDOWN_ABOVE_LIMIT"
    );
  }

  if (!acceptableRuinRisk) {
    warnings.push(
      "RUIN_RATE_ABOVE_LIMIT"
    );
  }

  return {
    valid:
      params.simulationsCompleted > 0,

    statisticallyReliable,
    profitable,
    stable,
    highVariance,
    acceptableDrawdown,
    acceptableRuinRisk,
    sufficientSimulations,
    sufficientBetVolume,
    roiConfidenceAboveZero,
    warnings: [
      ...new Set(warnings)
    ]
  };
}

function calculateQualityScore(params: {
  averageROI: number;
  positiveRate: number;
  ruinRate: number;
  averageDrawdown: number;
  sharpeRatio: number | null;
  sortinoRatio: number | null;
  roiConfidenceLower: number;
  statisticallyReliable: boolean;
}): number {
  const roiScore =
    clamp(
      (params.averageROI + 0.05) /
      0.25,
      0,
      1
    );

  const positiveRateScore =
    clamp(
      params.positiveRate,
      0,
      1
    );

  const ruinScore =
    1 -
    clamp(
      params.ruinRate /
      0.20,
      0,
      1
    );

  const drawdownScore =
    1 -
    clamp(
      params.averageDrawdown /
      0.60,
      0,
      1
    );

  const sharpeScore =
    params.sharpeRatio === null
      ? 0.35
      : clamp(
          (
            params.sharpeRatio +
            0.5
          ) /
          2.5,
          0,
          1
        );

  const sortinoScore =
    params.sortinoRatio === null
      ? 0.35
      : clamp(
          (
            params.sortinoRatio +
            0.5
          ) /
          3.0,
          0,
          1
        );

  const confidenceScore =
    params.roiConfidenceLower > 0
      ? 1
      : params.averageROI > 0
        ? 0.45
        : 0;

  const reliabilityScore =
    params.statisticallyReliable
      ? 1
      : 0.45;

  const weightedScore =
    roiScore * 0.20 +
    positiveRateScore * 0.15 +
    ruinScore * 0.15 +
    drawdownScore * 0.15 +
    sharpeScore * 0.10 +
    sortinoScore * 0.10 +
    confidenceScore * 0.10 +
    reliabilityScore * 0.05;

  return round(
    clamp(
      weightedScore * 100,
      0,
      100
    ),
    2
  );
}

function classifyQuality(
  score: number,
  diagnostics: MonteCarloBacktestDiagnostics
): MonteCarloBacktestQuality {
  if (
    !diagnostics.valid ||
    !diagnostics.sufficientSimulations ||
    !diagnostics.sufficientBetVolume
  ) {
    return "INSUFFICIENT";
  }

  if (score >= 85) {
    return "ELITE";
  }

  if (score >= 70) {
    return "HIGH";
  }

  if (score >= 50) {
    return "MODERATE";
  }

  return "LOW";
}

/* =========================================================
   EMPTY RESULT
========================================================= */

function emptySummary(params: {
  simulationsRequested: number;
  matchesPerSimulation: number;
  initialBankroll: number;
  ruinThreshold: number;
  warning: string;
}): MonteCarloBacktestSummary {
  const emptyDistribution =
    summarizeDistribution([]);

  return {
    simulations: [],

    averageROI: 0,
    roiStdDev: 0,
    minROI: 0,
    maxROI: 0,
    positiveRate: 0,
    ruinRate: 0,
    survivalRate: 0,

    averageFinalBankroll: 0,
    minFinalBankroll: 0,
    maxFinalBankroll: 0,

    averageDrawdown: 0,

    roi:
      emptyDistribution,

    finalBankroll:
      emptyDistribution,

    drawdown:
      emptyDistribution,

    totalBets:
      emptyDistribution,

    sharpeRatio: null,
    sortinoRatio: null,

    totalBetsAcrossSimulations: 0,
    averageBetsPerSimulation: 0,

    probabilityOfProfit: 0,
    probabilityOfLoss: 0,
    probabilityOfRuin: 0,
    probabilityOfSurvival: 0,

    qualityScore: 0,
    quality: "INSUFFICIENT",

    diagnostics: {
      valid: false,
      statisticallyReliable: false,
      profitable: false,
      stable: false,
      highVariance: false,
      acceptableDrawdown: false,
      acceptableRuinRisk: false,
      sufficientSimulations: false,
      sufficientBetVolume: false,
      roiConfidenceAboveZero: false,
      warnings: [
        params.warning
      ]
    },

    metadata: {
      version: "V7.1_ELITE",
      simulationsRequested:
        params.simulationsRequested,
      simulationsCompleted: 0,
      matchesPerSimulation:
        params.matchesPerSimulation,
      initialBankroll:
        params.initialBankroll,
      ruinThreshold:
        params.ruinThreshold,
      generatedAt:
        new Date().toISOString()
    }
  };
}

/* =========================================================
   MONTE CARLO BACKTEST
========================================================= */

export function runMonteCarloBacktest(
  simulationsCount: number =
    DEFAULT_SIMULATIONS_COUNT,

  matchesPerSimulation: number =
    DEFAULT_MATCHES_PER_SIMULATION,

  options: MonteCarloBacktestOptions = {}
): MonteCarloBacktestSummary {
  const resolvedSimulationsCount =
    normalizeInteger(
      simulationsCount,
      DEFAULT_SIMULATIONS_COUNT,
      1,
      100000
    );

  const resolvedMatchesPerSimulation =
    normalizeInteger(
      matchesPerSimulation,
      DEFAULT_MATCHES_PER_SIMULATION,
      1,
      10000000
    );

  const normalizedOptions =
    normalizeOptions(
      DEFAULT_INITIAL_BANKROLL,
      options
    );

  const {
    initialBankroll,
    ruinThreshold,
    minimumReliableSimulations,
    minimumReliableTotalBets,
    acceptableAverageDrawdown,
    acceptableRuinRate,
    highVarianceCoefficient
  } = normalizedOptions;

  const results:
    MonteCarloBacktestResult[] = [];

  const executionWarnings:
    string[] = [];

  for (
    let index = 0;
    index <
      resolvedSimulationsCount;
    index++
  ) {
    try {
      const rawResult =
        runBacktest(
          resolvedMatchesPerSimulation,
          initialBankroll
        );

      const normalizedResult =
        normalizeBacktestResult(
          rawResult,
          initialBankroll
        );

      if (normalizedResult) {
        results.push(
          normalizedResult
        );
      } else {
        executionWarnings.push(
          `INVALID_BACKTEST_RESULT_AT_SIMULATION_${index + 1}`
        );
      }
    } catch (error) {
      executionWarnings.push(
        `BACKTEST_EXECUTION_ERROR_AT_SIMULATION_${index + 1}`
      );

      console.warn(
        "⚠️ Monte Carlo Backtest execution error",
        {
          simulation:
            index + 1,

          error
        }
      );
    }
  }

  if (!results.length) {
    return emptySummary({
      simulationsRequested:
        resolvedSimulationsCount,

      matchesPerSimulation:
        resolvedMatchesPerSimulation,

      initialBankroll,
      ruinThreshold,

      warning:
        executionWarnings[0] ??
        "NO_VALID_BACKTEST_SIMULATIONS"
    });
  }

  const rois =
    results.map(
      result => result.roi
    );

  const bankrolls =
    results.map(
      result =>
        result.finalBankroll
    );

  const drawdowns =
    results.map(
      result =>
        result.maxDrawdown
    );

  const bets =
    results.map(
      result =>
        result.totalBets
    );

  const roiSummary =
    summarizeDistribution(rois);

  const bankrollSummary =
    summarizeDistribution(bankrolls);

  const drawdownSummary =
    summarizeDistribution(drawdowns);

  const totalBetsSummary =
    summarizeDistribution(bets);

  const totalBetsAcrossSimulations =
    bets.reduce(
      (sum, value) =>
        sum + value,
      0
    );

  const positiveCount =
    rois.filter(
      roi => roi > 0
    ).length;

  const lossCount =
    rois.filter(
      roi => roi < 0
    ).length;

  const ruinCount =
    bankrolls.filter(
      bankroll =>
        bankroll <=
        ruinThreshold
    ).length;

  const positiveRate =
    safeDivide(
      positiveCount,
      results.length
    );

  const lossRate =
    safeDivide(
      lossCount,
      results.length
    );

  const ruinRate =
    safeDivide(
      ruinCount,
      results.length
    );

  const survivalRate =
    1 -
    ruinRate;

  const sharpeRatio =
    calculateSharpeRatio(
      rois
    );

  const sortinoRatio =
    calculateSortinoRatio(
      rois
    );

  const diagnostics =
    buildDiagnostics({
      simulationsCompleted:
        results.length,

      totalBetsAcrossSimulations,

      averageROI:
        roiSummary.mean,

      roiConfidenceLower:
        roiSummary
          .confidenceInterval95
          .lower,

      roiCoefficientOfVariation:
        roiSummary
          .coefficientOfVariation,

      averageDrawdown:
        drawdownSummary.mean,

      ruinRate,

      minimumReliableSimulations,
      minimumReliableTotalBets,
      acceptableAverageDrawdown,
      acceptableRuinRate,
      highVarianceCoefficient
    });

  diagnostics.warnings = [
    ...new Set([
      ...diagnostics.warnings,
      ...executionWarnings
    ])
  ];

  const qualityScore =
    calculateQualityScore({
      averageROI:
        roiSummary.mean,

      positiveRate,
      ruinRate,

      averageDrawdown:
        drawdownSummary.mean,

      sharpeRatio,
      sortinoRatio,

      roiConfidenceLower:
        roiSummary
          .confidenceInterval95
          .lower,

      statisticallyReliable:
        diagnostics
          .statisticallyReliable
    });

  const quality =
    classifyQuality(
      qualityScore,
      diagnostics
    );

  const summary:
    MonteCarloBacktestSummary = {
      simulations:
        results,

      /*
       * Campos legados.
       */
      averageROI:
        roiSummary.mean,

      roiStdDev:
        roiSummary.standardDeviation,

      minROI:
        roiSummary.minimum,

      maxROI:
        roiSummary.maximum,

      positiveRate,
      ruinRate,
      survivalRate,

      averageFinalBankroll:
        bankrollSummary.mean,

      minFinalBankroll:
        bankrollSummary.minimum,

      maxFinalBankroll:
        bankrollSummary.maximum,

      averageDrawdown:
        drawdownSummary.mean,

      /*
       * Estatística V7.1 Elite.
       */
      roi:
        roiSummary,

      finalBankroll:
        bankrollSummary,

      drawdown:
        drawdownSummary,

      totalBets:
        totalBetsSummary,

      sharpeRatio,
      sortinoRatio,

      totalBetsAcrossSimulations,

      averageBetsPerSimulation:
        totalBetsSummary.mean,

      probabilityOfProfit:
        positiveRate,

      probabilityOfLoss:
        lossRate,

      probabilityOfRuin:
        ruinRate,

      probabilityOfSurvival:
        survivalRate,

      qualityScore,
      quality,

      diagnostics,

      metadata: {
        version:
          "V7.1_ELITE",

        simulationsRequested:
          resolvedSimulationsCount,

        simulationsCompleted:
          results.length,

        matchesPerSimulation:
          resolvedMatchesPerSimulation,

        initialBankroll,
        ruinThreshold,

        generatedAt:
          new Date()
            .toISOString()
      }
    };

  console.group(
    "📊 MONTE CARLO BACKTEST — V7.1 ELITE"
  );

  console.log(
    "METADATA:",
    summary.metadata
  );

  console.log(
    "ROI:",
    summary.roi
  );

  console.log(
    "BANKROLL:",
    summary.finalBankroll
  );

  console.log(
    "DRAWDOWN:",
    summary.drawdown
  );

  console.log(
    "RISK-ADJUSTED METRICS:",
    {
      sharpeRatio:
        summary.sharpeRatio,

      sortinoRatio:
        summary.sortinoRatio
    }
  );

  console.log(
    "QUALITY:",
    {
      qualityScore:
        summary.qualityScore,

      quality:
        summary.quality,

      diagnostics:
        summary.diagnostics
    }
  );

  console.groupEnd();

  return summary;
}
