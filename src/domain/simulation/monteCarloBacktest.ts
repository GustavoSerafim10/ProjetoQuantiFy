import { runBacktest } from "../backtest/runBacktest";

/* ===============================
   TYPES
=============================== */

export interface MonteCarloBacktestResult {
  roi: number;
  finalBankroll: number;
  maxDrawdown: number;
  totalBets: number;
}

export interface MonteCarloBacktestSummary {
  simulations: MonteCarloBacktestResult[];

  averageROI: number;
  roiStdDev: number;

  minROI: number;
  maxROI: number;

  positiveRate: number;
  ruinRate: number;

  averageFinalBankroll: number;
  minFinalBankroll: number;
  maxFinalBankroll: number;

  averageDrawdown: number;
}

/* ===============================
   STATS
=============================== */

function mean(values: number[]): number {
  if (!values.length) return 0;

  return (
    values.reduce((a, b) => a + b, 0) /
    values.length
  );
}

function std(values: number[]): number {
  if (!values.length) return 0;

  const avg = mean(values);

  const variance =
    values.reduce(
      (acc, v) =>
        acc + (v - avg) ** 2,
      0
    ) / values.length;

  return Math.sqrt(variance);
}

/* ===============================
   MONTE CARLO BACKTEST
=============================== */

export function runMonteCarloBacktest(
  simulationsCount: number = 100,
  matchesPerSimulation: number = 2000
): MonteCarloBacktestSummary {

  const results: MonteCarloBacktestResult[] = [];

  for (let i = 0; i < simulationsCount; i++) {

    const result =
      runBacktest(
        matchesPerSimulation,
        1000
      );

    const finalBankroll =
      result.bankrollHistory.at(-1) ??
      1000;

    results.push({
      roi: result.roi,
      finalBankroll,

      maxDrawdown:
        result.maxDrawdown,

      totalBets:
        result.totalBets
    });
  }

  const rois =
    results.map(r => r.roi);

  const bankrolls =
    results.map(
      r => r.finalBankroll
    );

  const drawdowns =
    results.map(
      r => r.maxDrawdown
    );

  return {
    simulations: results,

    averageROI:
      mean(rois),

    roiStdDev:
      std(rois),

    minROI:
      Math.min(...rois),

    maxROI:
      Math.max(...rois),

    positiveRate:
      rois.filter(
        r => r > 0
      ).length / rois.length,

    ruinRate:
      bankrolls.filter(
        b => b < 500
      ).length / bankrolls.length,

    averageFinalBankroll:
      mean(bankrolls),

    minFinalBankroll:
      Math.min(...bankrolls),

    maxFinalBankroll:
      Math.max(...bankrolls),

    averageDrawdown:
      mean(drawdowns)
  };
}