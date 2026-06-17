export function adjustProbability(
  prob: number,
  calibration: any
) {
  if (!calibration) return prob;

  const buckets = [
    { min: 0.50, max: 0.60, label: "50-60%" },
    { min: 0.60, max: 0.70, label: "60-70%" },
    { min: 0.70, max: 0.80, label: "70-80%" },
    { min: 0.80, max: 0.85, label: "80-85%" },
    { min: 0.85, max: 0.90, label: "85-90%" },
    { min: 0.90, max: 1.01, label: "90%+" }
  ];

  for (const bucket of buckets) {
    if (prob >= bucket.min && prob < bucket.max) {
      const data = calibration[bucket.label];

      if (!data || data.bets < 30) {
        return prob;
      }

      const rawAdjustment = data.diff ?? 0;

      const cappedAdjustment = Math.max(
        -0.08,
        Math.min(0.05, rawAdjustment)
      );

      const severityMultiplier =
        data.status === "OVERESTIMATED" ? 0.55 :
        data.status === "UNDERESTIMATED" ? 0.35 :
        0.25;

      const finalAdjustment = cappedAdjustment * severityMultiplier;

      const adjusted = prob + finalAdjustment;

      return Math.max(
        0.03,
        Math.min(0.95, adjusted)
      );
    }
  }

  return prob;
}