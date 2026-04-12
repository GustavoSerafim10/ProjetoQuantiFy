import { logFactorial } from "./distributions/factorial";

/**
 * Poisson Probability Mass Function (PMF)
 * Stable implementation using log-space computation
 */
export function poissonPMF(lambda: number, k: number): number {
  if (lambda <= 0) {
    throw new Error("Lambda must be positive");
  }

  if (k < 0 || !Number.isInteger(k)) {
    throw new Error("k must be a non-negative integer");
  }

  const logProbability =
    k * Math.log(lambda) -
    lambda -
    logFactorial(k);

  return Math.exp(logProbability);
}

/**
 * Poisson Cumulative Distribution Function (CDF)
 */
export function poissonCDF(lambda: number, k: number): number {
  let sum = 0;

  for (let i = 0; i <= k; i++) {
    sum += poissonPMF(lambda, i);
  }

  return sum;
}

/**
 * Generate probability table up to maxGoals
 */
export function poissonTable(lambda: number, maxGoals: number = 10): number[] {
  const probabilities: number[] = [];

  for (let k = 0; k <= maxGoals; k++) {
    probabilities.push(poissonPMF(lambda, k));
  }

  return probabilities;
}