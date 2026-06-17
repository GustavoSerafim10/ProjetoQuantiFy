export function calibrationReport(history: any[]) {
  const buckets = [
    { min: 0.50, max: 0.60, label: "50-60%" },
    { min: 0.60, max: 0.70, label: "60-70%" },
    { min: 0.70, max: 0.80, label: "70-80%" },
    { min: 0.80, max: 0.85, label: "80-85%" },
    { min: 0.85, max: 0.90, label: "85-90%" },
    { min: 0.90, max: 1.01, label: "90%+" }
  ];

  const result: any = {};

  for (const bucket of buckets) {
    const bets = history.filter(b =>
      typeof b.probability === "number" &&
      b.probability >= bucket.min &&
      b.probability < bucket.max &&
      (b.result === "win" || b.result === "loss")
    );

    if (bets.length === 0) {
      result[bucket.label] = {
        bets: 0,
        expected: 0,
        actual: 0,
        diff: 0,
        avgOdd: 0,
        profit: 0,
        roi: 0,
        status: "NO_DATA"
      };
      continue;
    }

    const wins = bets.filter(b => b.result === "win").length;

    const avgProb =
      bets.reduce((acc, b) => acc + b.probability, 0) / bets.length;

    const avgOdd =
      bets.reduce((acc, b) => acc + (b.odd ?? b.odds ?? 0), 0) / bets.length;

    const profit = bets.reduce((acc, b) => {
      const odd = b.odd ?? b.odds ?? 0;
      const stake = b.stake ?? 1;

      if (b.result === "win") return acc + stake * (odd - 1);
      if (b.result === "loss") return acc - stake;

      return acc;
    }, 0);

    const totalStake = bets.reduce((acc, b) => acc + (b.stake ?? 1), 0);

    const actualWinRate = wins / bets.length;
    const diff = actualWinRate - avgProb;
    const roi = totalStake > 0 ? profit / totalStake : 0;

    result[bucket.label] = {
      bets: bets.length,
      expected: Number(avgProb.toFixed(4)),
      actual: Number(actualWinRate.toFixed(4)),
      diff: Number(diff.toFixed(4)),
      avgOdd: Number(avgOdd.toFixed(2)),
      profit: Number(profit.toFixed(2)),
      roi: Number(roi.toFixed(4)),
      status:
        diff < -0.08 ? "OVERESTIMATED" :
        diff > 0.08 ? "UNDERESTIMATED" :
        "CALIBRATED"
    };
  }

  return result;
}