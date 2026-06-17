import { runBacktest } from "../backtest/runBacktest";

interface TuneResult {
  ev: number;
  kelly: number;
  roi: number;
  drawdown: number;
  bets: number;
}

export function autoTune() {

  const evOptions = [0.04, 0.05, 0.06, 0.07];
  const kellyOptions = [0.01, 0.015, 0.02];

  const results: TuneResult[] = [];

for (const ev of evOptions) {
  for (const kelly of kellyOptions) {

    const bt = runBacktest(
      2000,
      1000
    );

    results.push({
      ev,
      kelly,
      roi: bt.roi,
      drawdown: bt.maxDrawdown,
      bets: bt.totalBets
    });
  }
}

  results.sort((a, b) => b.roi - a.roi);

  return {
    best: results[0],
    all: results
  };
}