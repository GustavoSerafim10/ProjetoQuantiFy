/* ==========================================
   MONTE CARLO POISSON — QUANTIFY V7.1 ELITE
========================================== */

export interface MonteCarloSamplingError {
  homeWin: number;
  draw: number;
  awayWin: number;
  over15: number;
  over25: number;
  under15: number;
  under25: number;
  bttsYes: number;
  bttsNo: number;
  doubleChance1X: number;
  doubleChanceX2: number;
  dnbHome: number;
  dnbAway: number;
}

export interface MonteCarloConfidenceInterval {
  lower: number;
  upper: number;
  margin: number;
}

export interface MonteCarloConfidenceIntervals {
  homeWin: MonteCarloConfidenceInterval;
  draw: MonteCarloConfidenceInterval;
  awayWin: MonteCarloConfidenceInterval;
  over15: MonteCarloConfidenceInterval;
  over25: MonteCarloConfidenceInterval;
  under15: MonteCarloConfidenceInterval;
  under25: MonteCarloConfidenceInterval;
  bttsYes: MonteCarloConfidenceInterval;
  bttsNo: MonteCarloConfidenceInterval;
  doubleChance1X: MonteCarloConfidenceInterval;
  doubleChanceX2: MonteCarloConfidenceInterval;
  dnbHome: MonteCarloConfidenceInterval;
  dnbAway: MonteCarloConfidenceInterval;
}

export interface MonteCarloProbabilitySnapshot {
  homeWin: number;
  draw: number;
  awayWin: number;
  over15: number;
  over25: number;
  under15: number;
  under25: number;
  bttsYes: number;
  bttsNo: number;
  doubleChance1X: number;
  doubleChanceX2: number;
  dnbHome: number;
  dnbAway: number;
}

export interface MonteCarloCheckpoint extends MonteCarloProbabilitySnapshot {
  iteration: number;
  deltaFromPrevious: number;
}

export interface MonteCarloConvergence {
  converged: boolean;
  targetDelta: number;
  maxCheckpointDelta: number;
  stableCheckpointCount: number;
  requiredStableCheckpoints: number;
  checkpoints: MonteCarloCheckpoint[];
}

export type MonteCarloSimulationQuality =
  | "EXCELLENT"
  | "GOOD"
  | "ACCEPTABLE"
  | "LOW"
  | "INVALID";

export interface MonteCarloLambdaDiagnostic {
  raw: unknown;
  sanitized: number;
  valid: boolean;
  fallbackUsed: boolean;
  clampApplied: boolean;
}

export interface MonteCarloSimulationDiagnostic {
  raw: unknown;
  requested: number;
  executed: number;
  valid: boolean;
  fallbackUsed: boolean;
  clampApplied: boolean;
}

export interface MonteCarloMatchResult extends MonteCarloProbabilitySnapshot {
  iterations: number;
  lambdaHome: number;
  lambdaAway: number;
  totalLambda: number;

  samplingError: MonteCarloSamplingError;
  maxSamplingError: number;
  maxStandardError: number;

  confidenceInterval95: MonteCarloConfidenceIntervals;
  convergence: MonteCarloConvergence;
  simulationQuality: MonteCarloSimulationQuality;

  warnings: string[];

  diagnostics: {
    lambdaHome: MonteCarloLambdaDiagnostic;
    lambdaAway: MonteCarloLambdaDiagnostic;
    simulations: MonteCarloSimulationDiagnostic;
    customRandomUsed: boolean;
    randomFailureCount: number;
  };

  meta: {
    version: "V7.1_ELITE";
    model: "INDEPENDENT_POISSON";
    usesDixonColes: false;
    confidenceLevel: 0.95;
  };
}

export interface MonteCarloOptions {
  random?: () => number;
  checkpointInterval?: number;
  convergenceTarget?: number;
  requiredStableCheckpoints?: number;
}

const VERSION = "V7.1_ELITE" as const;

const MIN_LAMBDA = 0.2;
const MAX_LAMBDA = 3.2;

const DEFAULT_HOME_LAMBDA = 1.32;
const DEFAULT_AWAY_LAMBDA = 1.23;

const DEFAULT_SIMULATIONS = 50_000;
const MIN_SIMULATIONS = 1_000;
const MAX_SIMULATIONS = 500_000;

const DEFAULT_CHECKPOINT_INTERVAL = 10_000;
const MIN_CHECKPOINT_INTERVAL = 1_000;
const DEFAULT_CONVERGENCE_TARGET = 0.0025;
const DEFAULT_REQUIRED_STABLE_CHECKPOINTS = 2;

const RANDOM_EPSILON = 1e-12;
const Z_95 = 1.959963984540054;

interface ParsedNumber {
  value: number;
  valid: boolean;
  fallbackUsed: boolean;
}

interface RandomState {
  failureCount: number;
}

interface SimulationCounts {
  homeWin: number;
  draw: number;
  awayWin: number;
  over15: number;
  over25: number;
  bttsYes: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isMissingNumericValue(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value === "boolean"
  );
}

function parseFiniteNumber(value: unknown, fallback: number): ParsedNumber {
  if (isMissingNumericValue(value)) {
    return { value: fallback, valid: false, fallbackUsed: true };
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return { value: fallback, valid: false, fallbackUsed: true };
  }

  return { value: parsed, valid: true, fallbackUsed: false };
}

function sanitizeLambda(
  value: unknown,
  fallback: number
): MonteCarloLambdaDiagnostic {
  const parsed = parseFiniteNumber(value, fallback);
  const sanitized = clamp(parsed.value, MIN_LAMBDA, MAX_LAMBDA);

  return {
    raw: value,
    sanitized,
    valid: parsed.valid && parsed.value > 0,
    fallbackUsed: parsed.fallbackUsed,
    clampApplied: sanitized !== parsed.value
  };
}

function sanitizeSimulations(value: unknown): MonteCarloSimulationDiagnostic {
  const parsed = parseFiniteNumber(value, DEFAULT_SIMULATIONS);
  const requested = Math.floor(parsed.value);
  const executed = Math.floor(
    clamp(requested, MIN_SIMULATIONS, MAX_SIMULATIONS)
  );

  return {
    raw: value,
    requested,
    executed,
    valid: parsed.valid && requested > 0,
    fallbackUsed: parsed.fallbackUsed,
    clampApplied: executed !== requested
  };
}

function sanitizePositiveInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  const parsed = parseFiniteNumber(value, fallback);
  return Math.floor(clamp(parsed.value, minimum, maximum));
}

function sanitizePositiveNumber(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  const parsed = parseFiniteNumber(value, fallback);
  return clamp(parsed.value, minimum, maximum);
}

function safeRandom(random: () => number, state: RandomState): number {
  try {
    const raw = random();

    if (isMissingNumericValue(raw)) {
      state.failureCount++;
      return 0.5;
    }

    const parsed = Number(raw);

    if (!Number.isFinite(parsed)) {
      state.failureCount++;
      return 0.5;
    }

    if (parsed <= 0 || parsed >= 1) {
      state.failureCount++;
    }

    return clamp(parsed, RANDOM_EPSILON, 1 - RANDOM_EPSILON);
  } catch {
    state.failureCount++;
    return 0.5;
  }
}

function samplePoisson(
  lambda: number,
  random: () => number,
  randomState: RandomState
): number {
  const threshold = Math.exp(-lambda);

  let product = 1;
  let count = 0;

  do {
    count++;
    product *= safeRandom(random, randomState);
  } while (product > threshold);

  return count - 1;
}

function probabilitiesFromCounts(
  counts: SimulationCounts,
  iterations: number
): MonteCarloProbabilitySnapshot {
  const denominator = Math.max(iterations, 1);

  const homeWin = counts.homeWin / denominator;
  const draw = counts.draw / denominator;
  const awayWin = counts.awayWin / denominator;

  const over15 = counts.over15 / denominator;
  const over25 = counts.over25 / denominator;
  const bttsYes = counts.bttsYes / denominator;

  const under15 = 1 - over15;
  const under25 = 1 - over25;
  const bttsNo = 1 - bttsYes;

  /*
   * DNB (Empate Anula) é condicional a não empatar: a
   * probabilidade do lado escolhido vencer, dado que a
   * partida não termina empatada. Sem partidas sem empate
   * na amostra (extremamente improvável, mas matematicamente
   * possível com poucas iterações), cai para 0.5 neutro em
   * vez de dividir por zero.
   */
  const noDrawCount =
    counts.homeWin +
    counts.awayWin;

  const dnbHome =
    noDrawCount > 0
      ? counts.homeWin / noDrawCount
      : 0.5;

  const dnbAway =
    noDrawCount > 0
      ? counts.awayWin / noDrawCount
      : 0.5;

  return {
    homeWin,
    draw,
    awayWin,
    over15,
    over25,
    under15,
    under25,
    bttsYes,
    bttsNo,
    doubleChance1X: homeWin + draw,
    doubleChanceX2: draw + awayWin,
    dnbHome,
    dnbAway
  };
}

function standardError(probability: number, simulations: number): number {
  if (simulations <= 0 || !Number.isFinite(probability)) {
    return 0;
  }

  return Math.sqrt(
    Math.max(0, (probability * (1 - probability)) / simulations)
  );
}

function buildSamplingError(
  probabilities: MonteCarloProbabilitySnapshot,
  simulations: number,
  dnbSampleSize: number
): MonteCarloSamplingError {
  return {
    homeWin: standardError(probabilities.homeWin, simulations),
    draw: standardError(probabilities.draw, simulations),
    awayWin: standardError(probabilities.awayWin, simulations),
    over15: standardError(probabilities.over15, simulations),
    over25: standardError(probabilities.over25, simulations),
    under15: standardError(probabilities.under15, simulations),
    under25: standardError(probabilities.under25, simulations),
    bttsYes: standardError(probabilities.bttsYes, simulations),
    bttsNo: standardError(probabilities.bttsNo, simulations),
    doubleChance1X: standardError(
      probabilities.doubleChance1X,
      simulations
    ),
    doubleChanceX2: standardError(
      probabilities.doubleChanceX2,
      simulations
    ),

    /*
     * Amostra efetiva do DNB é só as partidas sem empate,
     * não o total de iterações — usar o total subestimaria
     * o erro padrão real desta probabilidade condicional.
     */
    dnbHome: standardError(probabilities.dnbHome, dnbSampleSize),
    dnbAway: standardError(probabilities.dnbAway, dnbSampleSize)
  };
}

function confidenceInterval95(
  probability: number,
  error: number
): MonteCarloConfidenceInterval {
  const margin = Z_95 * error;

  return {
    lower: clamp(probability - margin, 0, 1),
    upper: clamp(probability + margin, 0, 1),
    margin
  };
}

function buildConfidenceIntervals(
  probabilities: MonteCarloProbabilitySnapshot,
  errors: MonteCarloSamplingError
): MonteCarloConfidenceIntervals {
  return {
    homeWin: confidenceInterval95(probabilities.homeWin, errors.homeWin),
    draw: confidenceInterval95(probabilities.draw, errors.draw),
    awayWin: confidenceInterval95(probabilities.awayWin, errors.awayWin),
    over15: confidenceInterval95(probabilities.over15, errors.over15),
    over25: confidenceInterval95(probabilities.over25, errors.over25),
    under15: confidenceInterval95(probabilities.under15, errors.under15),
    under25: confidenceInterval95(probabilities.under25, errors.under25),
    bttsYes: confidenceInterval95(probabilities.bttsYes, errors.bttsYes),
    bttsNo: confidenceInterval95(probabilities.bttsNo, errors.bttsNo),
    doubleChance1X: confidenceInterval95(
      probabilities.doubleChance1X,
      errors.doubleChance1X
    ),
    doubleChanceX2: confidenceInterval95(
      probabilities.doubleChanceX2,
      errors.doubleChanceX2
    ),
    dnbHome: confidenceInterval95(probabilities.dnbHome, errors.dnbHome),
    dnbAway: confidenceInterval95(probabilities.dnbAway, errors.dnbAway)
  };
}

function maxProbabilityDelta(
  current: MonteCarloProbabilitySnapshot,
  previous: MonteCarloProbabilitySnapshot
): number {
  const keys: (keyof MonteCarloProbabilitySnapshot)[] = [
    "homeWin",
    "draw",
    "awayWin",
    "over15",
    "over25",
    "under15",
    "under25",
    "bttsYes",
    "bttsNo",
    "doubleChance1X",
    "doubleChanceX2",
    "dnbHome",
    "dnbAway"
  ];

  return Math.max(
    ...keys.map((key) => Math.abs(current[key] - previous[key]))
  );
}

function buildConvergence(
  checkpoints: MonteCarloCheckpoint[],
  targetDelta: number,
  requiredStableCheckpoints: number
): MonteCarloConvergence {
  const deltas = checkpoints
    .slice(1)
    .map((checkpoint) => checkpoint.deltaFromPrevious);

  const maxCheckpointDelta =
    deltas.length > 0 ? Math.max(...deltas) : 0;

  let stableCheckpointCount = 0;

  for (let index = checkpoints.length - 1; index >= 1; index--) {
    if (checkpoints[index].deltaFromPrevious <= targetDelta) {
      stableCheckpointCount++;
    } else {
      break;
    }
  }

  return {
    converged:
      checkpoints.length >= 3 &&
      stableCheckpointCount >= requiredStableCheckpoints,
    targetDelta,
    maxCheckpointDelta,
    stableCheckpointCount,
    requiredStableCheckpoints,
    checkpoints
  };
}

function classifyQuality(
  iterations: number,
  maxStandardError: number,
  convergence: MonteCarloConvergence,
  randomFailureCount: number
): MonteCarloSimulationQuality {
  if (iterations <= 0 || randomFailureCount > 0) {
    return "INVALID";
  }

  if (
    convergence.converged &&
    iterations >= 50_000 &&
    maxStandardError <= 0.0025
  ) {
    return "EXCELLENT";
  }

  if (
    convergence.converged &&
    iterations >= 25_000 &&
    maxStandardError <= 0.0035
  ) {
    return "GOOD";
  }

  if (maxStandardError <= 0.005) {
    return "ACCEPTABLE";
  }

  return iterations >= 10_000 ? "LOW" : "INVALID";
}

function buildWarnings(
  lambdaHome: MonteCarloLambdaDiagnostic,
  lambdaAway: MonteCarloLambdaDiagnostic,
  simulations: MonteCarloSimulationDiagnostic,
  convergence: MonteCarloConvergence,
  randomFailureCount: number
): string[] {
  const warnings: string[] = [];

  if (!lambdaHome.valid) warnings.push("INVALID_HOME_LAMBDA_INPUT");
  if (!lambdaAway.valid) warnings.push("INVALID_AWAY_LAMBDA_INPUT");
  if (lambdaHome.fallbackUsed) warnings.push("HOME_LAMBDA_FALLBACK_USED");
  if (lambdaAway.fallbackUsed) warnings.push("AWAY_LAMBDA_FALLBACK_USED");
  if (lambdaHome.clampApplied) warnings.push("HOME_LAMBDA_CLAMP_APPLIED");
  if (lambdaAway.clampApplied) warnings.push("AWAY_LAMBDA_CLAMP_APPLIED");

  if (!simulations.valid) warnings.push("INVALID_SIMULATIONS_INPUT");
  if (simulations.fallbackUsed) warnings.push("SIMULATIONS_FALLBACK_USED");
  if (simulations.clampApplied) warnings.push("SIMULATIONS_CLAMP_APPLIED");

  if (!convergence.converged) warnings.push("MONTE_CARLO_NOT_CONVERGED");
  if (randomFailureCount > 0) warnings.push("RANDOM_GENERATOR_FAILURE");

  return warnings;
}

export function monteCarloPoisson(
  lambdaHome: number,
  lambdaAway: number,
  simulations = DEFAULT_SIMULATIONS,
  options: MonteCarloOptions = {}
): MonteCarloMatchResult {
  const lambdaHomeDiagnostic = sanitizeLambda(
    lambdaHome,
    DEFAULT_HOME_LAMBDA
  );

  const lambdaAwayDiagnostic = sanitizeLambda(
    lambdaAway,
    DEFAULT_AWAY_LAMBDA
  );

  const simulationDiagnostic = sanitizeSimulations(simulations);

  const safeLambdaHome = lambdaHomeDiagnostic.sanitized;
  const safeLambdaAway = lambdaAwayDiagnostic.sanitized;
  const iterations = simulationDiagnostic.executed;

  const random = options.random ?? Math.random;

  const checkpointInterval = sanitizePositiveInteger(
    options.checkpointInterval,
    DEFAULT_CHECKPOINT_INTERVAL,
    MIN_CHECKPOINT_INTERVAL,
    iterations
  );

  const convergenceTarget = sanitizePositiveNumber(
    options.convergenceTarget,
    DEFAULT_CONVERGENCE_TARGET,
    0.0001,
    0.05
  );

  const requiredStableCheckpoints = sanitizePositiveInteger(
    options.requiredStableCheckpoints,
    DEFAULT_REQUIRED_STABLE_CHECKPOINTS,
    1,
    10
  );

  const counts: SimulationCounts = {
    homeWin: 0,
    draw: 0,
    awayWin: 0,
    over15: 0,
    over25: 0,
    bttsYes: 0
  };

  const checkpoints: MonteCarloCheckpoint[] = [];
  const randomState: RandomState = { failureCount: 0 };

  let previousCheckpoint: MonteCarloProbabilitySnapshot | null = null;

  for (let iteration = 1; iteration <= iterations; iteration++) {
    const homeGoals = samplePoisson(
      safeLambdaHome,
      random,
      randomState
    );

    const awayGoals = samplePoisson(
      safeLambdaAway,
      random,
      randomState
    );

    const totalGoals = homeGoals + awayGoals;

    if (homeGoals > awayGoals) {
      counts.homeWin++;
    } else if (homeGoals === awayGoals) {
      counts.draw++;
    } else {
      counts.awayWin++;
    }

    if (totalGoals >= 2) counts.over15++;
    if (totalGoals >= 3) counts.over25++;

    if (homeGoals > 0 && awayGoals > 0) {
      counts.bttsYes++;
    }

    const isCheckpoint =
      iteration % checkpointInterval === 0 ||
      iteration === iterations;

    if (isCheckpoint) {
      const snapshot = probabilitiesFromCounts(counts, iteration);

      const deltaFromPrevious = previousCheckpoint
        ? maxProbabilityDelta(snapshot, previousCheckpoint)
        : 0;

      checkpoints.push({
        iteration,
        ...snapshot,
        deltaFromPrevious
      });

      previousCheckpoint = snapshot;
    }
  }

  const probabilities = probabilitiesFromCounts(counts, iterations);

  const dnbSampleSize =
    counts.homeWin +
    counts.awayWin;

  const samplingError = buildSamplingError(
    probabilities,
    iterations,
    dnbSampleSize
  );

  const maxStandardError = Math.max(
    ...Object.values(samplingError)
  );

  const confidenceInterval95 = buildConfidenceIntervals(
    probabilities,
    samplingError
  );

  const convergence = buildConvergence(
    checkpoints,
    convergenceTarget,
    requiredStableCheckpoints
  );

  const simulationQuality = classifyQuality(
    iterations,
    maxStandardError,
    convergence,
    randomState.failureCount
  );

  const warnings = buildWarnings(
    lambdaHomeDiagnostic,
    lambdaAwayDiagnostic,
    simulationDiagnostic,
    convergence,
    randomState.failureCount
  );

  return {
    ...probabilities,

    iterations,

    lambdaHome: safeLambdaHome,
    lambdaAway: safeLambdaAway,
    totalLambda: safeLambdaHome + safeLambdaAway,

    samplingError,
    maxSamplingError: maxStandardError,
    maxStandardError,

    confidenceInterval95,
    convergence,
    simulationQuality,
    warnings,

    diagnostics: {
      lambdaHome: lambdaHomeDiagnostic,
      lambdaAway: lambdaAwayDiagnostic,
      simulations: simulationDiagnostic,
      customRandomUsed: typeof options.random === "function",
      randomFailureCount: randomState.failureCount
    },

    meta: {
      version: VERSION,
      model: "INDEPENDENT_POISSON",
      usesDixonColes: false,
      confidenceLevel: 0.95
    }
  };
}
