export function adjustProbability(
  prob: number,
  calibration: any
) {

  if (!calibration) return prob;

  const buckets = [
    { min: 0.50, max: 0.60, label: "50-60%" },
    { min: 0.60, max: 0.70, label: "60-70%" },
    { min: 0.70, max: 0.80, label: "70-80%" },
    { min: 0.80, max: 1.00, label: "80%+" }
  ];

  for (const bucket of buckets) {

    if (prob >= bucket.min && prob < bucket.max) {

      const data = calibration[bucket.label];

      if (!data || data.bets < 30) {
        return prob;
      }

      const rawAdjustment = data.diff ?? 0;

      // 🔥 LIMITADOR PROFISSIONAL
      const cappedAdjustment =
        Math.max(-0.05, Math.min(0.05, rawAdjustment));

      // 🔥 APLICA SÓ 35% DO AJUSTE HISTÓRICO
      const finalAdjustment =
        cappedAdjustment * 0.35;

      let adjusted =
        prob + finalAdjustment;

      return Math.max(
        0.01,
        Math.min(0.99, adjusted)
      );
    }
  }

  return prob;
}