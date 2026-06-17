import { expectedValue } from "../../domain/value/expectedValue";

const EV_THRESHOLDS: Record<string, { elite: number; operational: number }> = {
  HOME: { elite: 0.12, operational: 0.08 },
  DRAW: { elite: 0.18, operational: 0.12 },
  AWAY: { elite: 0.12, operational: 0.08 },

  OVER_1_5: { elite: 0.16, operational: 0.12 },
  OVER_2_5: { elite: 0.13, operational: 0.09 },

  BTTS_YES: { elite: 0.18, operational: 0.12 },
  BTTS_NO: { elite: 0.14, operational: 0.09 },

  DOUBLE_CHANCE_1X: { elite: 0.09, operational: 0.06 },
  DOUBLE_CHANCE_X2: { elite: 0.09, operational: 0.06 },
};

const MIN_ODDS: Record<string, number> = {
  HOME: 1.50,
  DRAW: 2.80,
  AWAY: 1.50,

  OVER_1_5: 1.45,
  OVER_2_5: 1.60,

  BTTS_YES: 1.60,
  BTTS_NO: 1.55,

  DOUBLE_CHANCE_1X: 1.35,
  DOUBLE_CHANCE_X2: 1.35,
};

function getValueWarning(
  market: string,
  probability: number,
  odd: number,
  ev: number
): string | null {
  const minOdd = MIN_ODDS[market] ?? 1.45;

  if (odd < minOdd) {
    return "ODD_TOO_LOW";
  }

  if (probability >= 0.82 && odd < 1.50) {
    return "OVERCONFIDENCE_RISK";
  }

  if (odd < 1.45 && ev < 0.18) {
    return "LOW_ODD_FAKE_VALUE";
  }

  return null;
}

export function valuePipeline(
  data: any,
  odds: Record<string, number>
) {
  const markets = Object.entries(data.probs)
    .map(([market, probability]) => {
      const prob = probability as number;
      const odd = odds?.[market];

      if (!odd || !Number.isFinite(prob) || prob <= 0 || prob >= 1) {
        return null;
      }

      const ev = expectedValue(prob, odd);
      const fairOdd = 1 / prob;

      const thresholds =
        EV_THRESHOLDS[market] ??
        { elite: 0.15, operational: 0.10 };

      const warning = getValueWarning(market, prob, odd, ev);

      let tier = "NO_VALUE";

      if (!warning) {
        if (ev >= thresholds.elite) tier = "ELITE";
        else if (ev >= thresholds.operational) tier = "OPERACIONAL";
      } else {
        if (ev >= thresholds.elite + 0.05 && odd >= (MIN_ODDS[market] ?? 1.45)) {
          tier = "OPERACIONAL";
        }
      }

      return {
        market,
        probability: prob,
        odd,
        fairOdd,
        ev,
        tier,
        warning
      };
    })
    .filter(Boolean);

  return {
    ...data,
    markets
  };
}