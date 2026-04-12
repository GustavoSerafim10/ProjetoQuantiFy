import { logGamma } from "./gamma";

/**
 * Log factorial using Gamma function
 * log(n!) = logGamma(n + 1)
 */
export function logFactorial(n: number): number {
  if (n < 0) {
    throw new Error("Factorial is not defined for negative numbers");
  }

  return logGamma(n + 1);
}

/**
 * Safe factorial (use only for small n)
 */
export function factorial(n: number): number {
  if (n < 0) {
    throw new Error("Factorial is not defined for negative numbers");
  }

  return Math.exp(logFactorial(n));
}