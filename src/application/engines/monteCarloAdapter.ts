import {
  monteCarloPoisson,
  type MonteCarloMatchResult,
  type MonteCarloOptions,
  type MonteCarloSimulationQuality,
  type MonteCarloConvergence,
  type MonteCarloConfidenceIntervals
} from "../../domain/simulation/monteCarloPoisson";

/* ==========================================
   MONTE CARLO ADAPTER — QUANTIFY V7.1 ELITE
========================================== */

export interface RunMonteCarloInput {
  lambdaHome: number;
  lambdaAway: number;

  simulations?: number;
  random?: () => number;

  checkpointInterval?: number;
  convergenceTarget?: number;
  requiredStableCheckpoints?: number;
}

export interface MonteCarloAdapterProbabilities {
  homeWin: number;
  draw: number;
  awayWin: number;

  over15: number;
  over25: number;
  under25: number;

  bttsYes: number;
  bttsNo: number;

  doubleChance1X: number;
  doubleChanceX2: number;
}

export interface MonteCarloAdapterOutput {
  valid: boolean;

  probabilities: MonteCarloAdapterProbabilities;

  homeWinProb: number;
  drawProb: number;
  awayWinProb: number;

  over15Prob: number;
  over25Prob: number;
  under25Prob: number;

  bttsProb: number;
  bttsNoProb: number;

  doubleChance1XProb: number;
  doubleChanceX2Prob: number;

  iterations: number;

  samplingError: MonteCarloMatchResult["samplingError"];
  maxSamplingError: number;
  maxStandardError: number;

  confidenceInterval95: MonteCarloConfidenceIntervals;
  convergence: MonteCarloConvergence;
  simulationQuality: MonteCarloSimulationQuality;

  warnings: string[];
  diagnostics: MonteCarloMatchResult["diagnostics"];

  debug: {
    version: "V7.1_ELITE";
    source: "pipeline_lambdas";
    model: "INDEPENDENT_POISSON";
    usesDixonColes: false;

    lambdaHome: number;
    lambdaAway: number;
    totalLambda: number;

    requestedSimulations: number;
    executedSimulations: number;

    customRandomUsed: boolean;
    invalidReason?: string;
  };
}

const VERSION = "V7.1_ELITE" as const;
const DEFAULT_SIMULATIONS = 50_000;

const ZERO_INTERVAL = {
  lower: 0,
  upper: 0,
  margin: 0
};

const INVALID_PROBABILITIES: MonteCarloAdapterProbabilities = {
  homeWin: 0,
  draw: 0,
  awayWin: 0,
  over15: 0,
  over25: 0,
  under25: 0,
  bttsYes: 0,
  bttsNo: 0,
  doubleChance1X: 0,
  doubleChanceX2: 0
};

const EMPTY_SAMPLING_ERROR: MonteCarloMatchResult["samplingError"] = {
  homeWin: 0,
  draw: 0,
  awayWin: 0,
  over15: 0,
  over25: 0,
  under25: 0,
  bttsYes: 0,
  bttsNo: 0,
  doubleChance1X: 0,
  doubleChanceX2: 0
};

const EMPTY_CONFIDENCE_INTERVALS: MonteCarloConfidenceIntervals = {
  homeWin: { ...ZERO_INTERVAL },
  draw: { ...ZERO_INTERVAL },
  awayWin: { ...ZERO_INTERVAL },
  over15: { ...ZERO_INTERVAL },
  over25: { ...ZERO_INTERVAL },
  under25: { ...ZERO_INTERVAL },
  bttsYes: { ...ZERO_INTERVAL },
  bttsNo: { ...ZERO_INTERVAL },
  doubleChance1X: { ...ZERO_INTERVAL },
  doubleChanceX2: { ...ZERO_INTERVAL }
};

function isMissingNumericValue(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value === "boolean"
  );
}

function safeNumber(value: unknown, fallback: number): number {
  if (isMissingNumericValue(value)) {
    return fallback;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
}

function isValidLambda(value: unknown): boolean {
  if (isMissingNumericValue(value)) {
    return false;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0;
}

function requestedSimulations(value: unknown): number {
  const parsed = Math.floor(
    safeNumber(value, DEFAULT_SIMULATIONS)
  );

  return parsed > 0
    ? parsed
    : DEFAULT_SIMULATIONS;
}

function createInvalidResult(
  input: Partial<RunMonteCarloInput>,
  reason: string
): MonteCarloAdapterOutput {
  const lambdaHome = safeNumber(input.lambdaHome, 0);
  const lambdaAway = safeNumber(input.lambdaAway, 0);
  const requested = requestedSimulations(input.simulations);

  return {
    valid: false,

    probabilities: {
      ...INVALID_PROBABILITIES
    },

    homeWinProb: 0,
    drawProb: 0,
    awayWinProb: 0,

    over15Prob: 0,
    over25Prob: 0,
    under25Prob: 0,

    bttsProb: 0,
    bttsNoProb: 0,

    doubleChance1XProb: 0,
    doubleChanceX2Prob: 0,

    iterations: 0,

    samplingError: {
      ...EMPTY_SAMPLING_ERROR
    },

    maxSamplingError: 0,
    maxStandardError: 0,

    confidenceInterval95:
      EMPTY_CONFIDENCE_INTERVALS,

    convergence: {
      converged: false,
      targetDelta: 0,
      maxCheckpointDelta: 0,
      stableCheckpointCount: 0,
      requiredStableCheckpoints: 0,
      checkpoints: []
    },

    simulationQuality: "INVALID",

    warnings: [reason],

    diagnostics: {
      lambdaHome: {
        raw: input.lambdaHome,
        sanitized: lambdaHome,
        valid: false,
        fallbackUsed: false,
        clampApplied: false
      },

      lambdaAway: {
        raw: input.lambdaAway,
        sanitized: lambdaAway,
        valid: false,
        fallbackUsed: false,
        clampApplied: false
      },

      simulations: {
        raw: input.simulations,
        requested,
        executed: 0,
        valid: false,
        fallbackUsed: false,
        clampApplied: false
      },

      customRandomUsed:
        typeof input.random === "function",

      randomFailureCount: 0
    },

    debug: {
      version: VERSION,
      source: "pipeline_lambdas",
      model: "INDEPENDENT_POISSON",
      usesDixonColes: false,

      lambdaHome,
      lambdaAway,
      totalLambda: lambdaHome + lambdaAway,

      requestedSimulations: requested,
      executedSimulations: 0,

      customRandomUsed:
        typeof input.random === "function",

      invalidReason: reason
    }
  };
}

function adaptResult(
  result: MonteCarloMatchResult,
  requested: number
): MonteCarloAdapterOutput {
  const probabilities: MonteCarloAdapterProbabilities = {
    homeWin: result.homeWin,
    draw: result.draw,
    awayWin: result.awayWin,
    over15: result.over15,
    over25: result.over25,
    under25: result.under25,
    bttsYes: result.bttsYes,
    bttsNo: result.bttsNo,
    doubleChance1X: result.doubleChance1X,
    doubleChanceX2: result.doubleChanceX2
  };

  const valid =
    result.simulationQuality !== "INVALID" &&
    result.diagnostics.randomFailureCount === 0;

  return {
    valid,

    probabilities,

    homeWinProb: probabilities.homeWin,
    drawProb: probabilities.draw,
    awayWinProb: probabilities.awayWin,

    over15Prob: probabilities.over15,
    over25Prob: probabilities.over25,
    under25Prob: probabilities.under25,

    bttsProb: probabilities.bttsYes,
    bttsNoProb: probabilities.bttsNo,

    doubleChance1XProb: probabilities.doubleChance1X,
    doubleChanceX2Prob: probabilities.doubleChanceX2,

    iterations: result.iterations,

    samplingError: result.samplingError,
    maxSamplingError: result.maxSamplingError,
    maxStandardError: result.maxStandardError,

    confidenceInterval95: result.confidenceInterval95,
    convergence: result.convergence,
    simulationQuality: result.simulationQuality,

    warnings: result.warnings,
    diagnostics: result.diagnostics,

    debug: {
      version: VERSION,
      source: "pipeline_lambdas",
      model: "INDEPENDENT_POISSON",
      usesDixonColes: false,

      lambdaHome: result.lambdaHome,
      lambdaAway: result.lambdaAway,
      totalLambda: result.totalLambda,

      requestedSimulations: requested,
      executedSimulations: result.iterations,

      customRandomUsed:
        result.diagnostics.customRandomUsed
    }
  };
}

export function runMonteCarlo(
  input: RunMonteCarloInput
): MonteCarloAdapterOutput {
  if (!input || typeof input !== "object") {
    return createInvalidResult(
      {},
      "MONTE_CARLO_INPUT_MISSING"
    );
  }

  if (!isValidLambda(input.lambdaHome)) {
    return createInvalidResult(
      input,
      "INVALID_PIPELINE_HOME_LAMBDA"
    );
  }

  if (!isValidLambda(input.lambdaAway)) {
    return createInvalidResult(
      input,
      "INVALID_PIPELINE_AWAY_LAMBDA"
    );
  }

  const requested = requestedSimulations(
    input.simulations
  );

  const options: MonteCarloOptions = {};

  if (typeof input.random === "function") {
    options.random = input.random;
  }

  if (input.checkpointInterval !== undefined) {
    options.checkpointInterval =
      input.checkpointInterval;
  }

  if (input.convergenceTarget !== undefined) {
    options.convergenceTarget =
      input.convergenceTarget;
  }

  if (
    input.requiredStableCheckpoints !==
    undefined
  ) {
    options.requiredStableCheckpoints =
      input.requiredStableCheckpoints;
  }

  try {
    const result = monteCarloPoisson(
      Number(input.lambdaHome),
      Number(input.lambdaAway),
      requested,
      options
    );

    return adaptResult(result, requested);
  } catch {
    return createInvalidResult(
      input,
      "MONTE_CARLO_EXECUTION_FAILURE"
    );
  }
}
