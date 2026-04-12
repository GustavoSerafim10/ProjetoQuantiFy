export function calibrationReport(history: any[]) {

  const buckets = [
    { min: 0.50, max: 0.60, label: "50-60%" },
    { min: 0.60, max: 0.70, label: "60-70%" },
    { min: 0.70, max: 0.80, label: "70-80%" },
    { min: 0.80, max: 1.00, label: "80%+" }
  ];

  const result: any = {};

  for (const bucket of buckets) {

    const bets = history.filter(b =>
      b.probability >= bucket.min &&
      b.probability < bucket.max &&
      b.result
    );

    if (bets.length === 0) {
      result[bucket.label] = {
        bets: 0,
        expected: 0,
        actual: 0,
        diff: 0
      };
      continue;
    }

    const wins = bets.filter(b => b.result === "win").length;

    const avgProb =
      bets.reduce((acc, b) => acc + b.probability, 0) / bets.length;

    const actualWinRate = wins / bets.length;

    result[bucket.label] = {
      bets: bets.length,
      expected: avgProb,
      actual: actualWinRate,
      diff: actualWinRate - avgProb
    };
  }

  return result;
}