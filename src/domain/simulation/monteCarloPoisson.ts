/* ==========================================
   MONTE CARLO POISSON — QUANTIFY V7
========================================== */

export interface MonteCarloSamplingError {
  homeWin: number;
  draw: number;
  awayWin: number;

  over15: number;
  over25: number;

  bttsYes: number;
}

export interface MonteCarloMatchResult {
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

  iterations: number;

  lambdaHome: number;
  lambdaAway: number;
  totalLambda: number;

  samplingError: MonteCarloSamplingError;
  maxSamplingError: number;

  meta: {
    model: "INDEPENDENT_POISSON";
    usesDixonColes: false;
  };
}

export interface MonteCarloOptions {
  random?: () => number;
}

const MIN_LAMBDA = 0.2;
const MAX_LAMBDA = 3.2;

const DEFAULT_HOME_LAMBDA = 1.32;
const DEFAULT_AWAY_LAMBDA = 1.23;

const DEFAULT_SIMULATIONS = 50_000;
const MIN_SIMULATIONS = 1_000;
const MAX_SIMULATIONS = 500_000;

const RANDOM_EPSILON = 1e-12;

function clamp(
  value: number,
  min: number,
  max: number
): number {
  return Math.max(min, Math.min(max, value));
}

function safeNumber(
  value: unknown,
  fallback: number
): number {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
}

function sanitizeLambda(
  value: unknown,
  fallback: number
): number {
  return clamp(
    safeNumber(value, fallback),
    MIN_LAMBDA,
    MAX_LAMBDA
  );
}

function sanitizeSimulations(
  value: unknown
): number {
  return Math.floor(
    clamp(
      safeNumber(
        value,
        DEFAULT_SIMULATIONS
      ),
      MIN_SIMULATIONS,
      MAX_SIMULATIONS
    )
  );
}

function safeRandom(
  random: () => number
): number {
  return clamp(
    safeNumber(random(), 0.5),
    RANDOM_EPSILON,
    1 - RANDOM_EPSILON
  );
}

function samplePoisson(
  lambda: number,
  random: () => number
): number {
  const threshold = Math.exp(-lambda);

  let product = 1;
  let count = 0;

  do {
    count++;
    product *= safeRandom(random);
  } while (product > threshold);

  return count - 1;
}

function standardError(
  probability: number,
  simulations: number
): number {
  return Math.sqrt(
    Math.max(
      0,
      (
        probability *
        (1 - probability)
      ) / simulations
    )
  );
}

export function monteCarloPoisson(
  lambdaHome: number,
  lambdaAway: number,
  simulations = DEFAULT_SIMULATIONS,
  options: MonteCarloOptions = {}
): MonteCarloMatchResult {
  const safeLambdaHome =
    sanitizeLambda(
      lambdaHome,
      DEFAULT_HOME_LAMBDA
    );

  const safeLambdaAway =
    sanitizeLambda(
      lambdaAway,
      DEFAULT_AWAY_LAMBDA
    );

  const iterations =
    sanitizeSimulations(simulations);

  const random =
    options.random ?? Math.random;

  let homeWinCount = 0;
  let drawCount = 0;
  let awayWinCount = 0;

  let over15Count = 0;
  let over25Count = 0;

  let bttsYesCount = 0;

  for (
    let iteration = 0;
    iteration < iterations;
    iteration++
  ) {
    const homeGoals =
      samplePoisson(
        safeLambdaHome,
        random
      );

    const awayGoals =
      samplePoisson(
        safeLambdaAway,
        random
      );

    const totalGoals =
      homeGoals + awayGoals;

    if (homeGoals > awayGoals) {
      homeWinCount++;
    } else if (homeGoals === awayGoals) {
      drawCount++;
    } else {
      awayWinCount++;
    }

    if (totalGoals >= 2) {
      over15Count++;
    }

    if (totalGoals >= 3) {
      over25Count++;
    }

    if (
      homeGoals > 0 &&
      awayGoals > 0
    ) {
      bttsYesCount++;
    }
  }

  const homeWin =
    homeWinCount / iterations;

  const draw =
    drawCount / iterations;

  const awayWin =
    awayWinCount / iterations;

  const over15 =
    over15Count / iterations;

  const over25 =
    over25Count / iterations;

  const bttsYes =
    bttsYesCount / iterations;

  const bttsNo =
    1 - bttsYes;

  const samplingError: MonteCarloSamplingError = {
    homeWin:
      standardError(homeWin, iterations),

    draw:
      standardError(draw, iterations),

    awayWin:
      standardError(awayWin, iterations),

    over15:
      standardError(over15, iterations),

    over25:
      standardError(over25, iterations),

    bttsYes:
      standardError(bttsYes, iterations)
  };

  return {
    homeWin,
    draw,
    awayWin,

    over15,
    over25,
    under25: 1 - over25,

    bttsYes,
    bttsNo,

    doubleChance1X:
      homeWin + draw,

    doubleChanceX2:
      draw + awayWin,

    iterations,

    lambdaHome:
      safeLambdaHome,

    lambdaAway:
      safeLambdaAway,

    totalLambda:
      safeLambdaHome +
      safeLambdaAway,

    samplingError,

    maxSamplingError:
      Math.max(
        ...Object.values(
          samplingError
        )
      ),

    meta: {
      model:
        "INDEPENDENT_POISSON",

      usesDixonColes:
        false
    }
  };
}