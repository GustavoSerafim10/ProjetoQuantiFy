import { expectedValue } from "../../domain/value/expectedValue";

const EV_THRESHOLDS: Record<string, { elite: number; operational: number }> = {
  HOME: { elite: 0.12, operational: 0.08 },
  DRAW: { elite: 0.18, operational: 0.12 },
  AWAY: { elite: 0.12, operational: 0.08 },

  OVER_1_5: { elite: 0.08, operational: 0.05 },
  OVER_2_5: { elite: 0.12, operational: 0.08 },

  BTTS_YES: { elite: 0.12, operational: 0.08 },
  BTTS_NO: { elite: 0.12, operational: 0.08 },

  DOUBLE_CHANCE_1X: { elite: 0.07, operational: 0.04 },
  DOUBLE_CHANCE_X2: { elite: 0.07, operational: 0.04 },
};

export function valuePipeline(
  data: any,
  odds: Record<string, number>
) {
  const markets = Object.entries(data.probs)
    .map(([market, probability]) => {
      const odd = odds?.[market];
      if (!odd) return null;

      const ev = expectedValue(probability as number, odd);
      const fairOdd = 1 / (probability as number);

      const thresholds =
        EV_THRESHOLDS[market] ??
        { elite: 0.15, operational: 0.10 };

      let tier = "NO_VALUE";

      if (ev >= thresholds.elite) tier = "ELITE";
      else if (ev >= thresholds.operational) tier = "OPERACIONAL";

      return {
        market,
        probability,
        odd,
        fairOdd,
        ev,
        tier
      };
    })
    .filter(Boolean);

  return {
    ...data,
    markets
  };
}