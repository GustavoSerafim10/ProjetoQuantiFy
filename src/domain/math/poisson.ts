import { logFactorial } from "./distributions/factorial";

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

export function poissonCDF(lambda: number, k: number): number {
  let sum = 0;

  for (let i = 0; i <= k; i++) {
    sum += poissonPMF(lambda, i);
  }

  return Math.max(0, Math.min(sum, 1));
}

export function poissonTable(lambda: number, maxGoals: number = 10): number[] {
  const probabilities: number[] = [];

  for (let k = 0; k <= maxGoals; k++) {
    probabilities.push(poissonPMF(lambda, k));
  }

  const total = probabilities.reduce((acc, p) => acc + p, 0);

  if (!Number.isFinite(total) || total <= 0) {
    return probabilities;
  }

  return probabilities.map(p => p / total);
}