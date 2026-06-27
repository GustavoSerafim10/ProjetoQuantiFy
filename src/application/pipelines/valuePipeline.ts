import { expectedValue } from "../../domain/value/expectedValue";

const EV_THRESHOLDS: Record<string, { elite: number; operational: number; watchlist: number }> = {
  HOME: { elite: 0.12, operational: 0.08, watchlist: 0.04 },
  DRAW: { elite: 0.18, operational: 0.12, watchlist: 0.06 },
  AWAY: { elite: 0.12, operational: 0.08, watchlist: 0.04 },

  OVER_1_5: { elite: 0.14, operational: 0.09, watchlist: 0.04 },
  OVER_2_5: { elite: 0.13, operational: 0.08, watchlist: 0.04 },

  BTTS_YES: { elite: 0.14, operational: 0.08, watchlist: 0.04 },
  BTTS_NO: { elite: 0.13, operational: 0.08, watchlist: 0.04 },

  DOUBLE_CHANCE_1X: { elite: 0.08, operational: 0.05, watchlist: 0.025 },
  DOUBLE_CHANCE_X2: { elite: 0.08, operational: 0.05, watchlist: 0.025 },
};

const MIN_ODDS: Record<string, number> = {
  HOME: 1.45,
  DRAW: 2.80,
  AWAY: 1.45,

  OVER_1_5: 1.40,
  OVER_2_5: 1.55,

  BTTS_YES: 1.55,
  BTTS_NO: 1.50,

  DOUBLE_CHANCE_1X: 1.30,
  DOUBLE_CHANCE_X2: 1.30,
};

const ODDS_ALIASES: Record<string, string[]> = {
  HOME: ["HOME", "home", "HOME_WIN"],
  DRAW: ["DRAW", "draw"],
  AWAY: ["AWAY", "away", "AWAY_WIN"],

  OVER_1_5: ["OVER_1_5", "over15", "OVER15", "over1_5"],
  OVER_2_5: ["OVER_2_5", "over25", "OVER25", "over2_5"],

  BTTS_YES: ["BTTS_YES", "bttsYes", "BTTSYES"],
  BTTS_NO: ["BTTS_NO", "bttsNo", "BTTSNO"],

  DOUBLE_CHANCE_1X: ["DOUBLE_CHANCE_1X", "homeOrDraw", "1X"],
  DOUBLE_CHANCE_X2: ["DOUBLE_CHANCE_X2", "awayOrDraw", "X2"],
};

function safeNumber(n: any, fallback = 0) {
  const num = Number(n);
  return Number.isFinite(num) ? num : fallback;
}

function getOdd(market: string, odds: Record<string, number>) {
  const aliases = ODDS_ALIASES[market] ?? [market];

  for (const key of aliases) {
    const odd = safeNumber(odds?.[key], 0);

    if (odd > 1.01) return odd;
  }

  return null;
}

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

  if (probability >= 0.84 && odd < 1.42) {
    return "OVERCONFIDENCE_RISK";
  }

  if (odd < 1.40 && ev < 0.16) {
    return "LOW_ODD_FAKE_VALUE";
  }

  if (ev <= 0) {
    return "NEGATIVE_EV";
  }

  return null;
}

export function valuePipeline(
  data: any,
  odds: Record<string, number>
) {
  const probs = data?.probs || {};

  const markets = Object.entries(probs)
    .map(([market, probability]) => {
      const prob = safeNumber(probability, 0);
      const odd = getOdd(market, odds);

      if (!odd || prob <= 0 || prob >= 1) {
        return null;
      }

      const ev = expectedValue(prob, odd);
      const fairOdd = 1 / prob;
      const edge = odd / fairOdd - 1;

      const thresholds =
        EV_THRESHOLDS[market] ??
        { elite: 0.15, operational: 0.10, watchlist: 0.04 };

      const warning = getValueWarning(market, prob, odd, ev);

      let tier = "NO_VALUE";

      if (!warning || warning === "OVERCONFIDENCE_RISK") {
        if (ev >= thresholds.elite) tier = "ELITE";
        else if (ev >= thresholds.operational) tier = "OPERACIONAL";
        else if (ev >= thresholds.watchlist) tier = "WATCHLIST";
      }

      return {
        market,
        probability: Number(prob.toFixed(4)),
        odd,
        fairOdd: Number(fairOdd.toFixed(4)),
        ev: Number(ev.toFixed(4)),
        edge: Number(edge.toFixed(4)),
        tier,
        warning,
      };
    })
    .filter(Boolean);

  return {
    ...data,
    markets,

    debug: {
      ...(data.debug || {}),
      valuePipeline: {
        receivedOdds: odds,
        generatedMarkets: markets.length,
        markets,
      },
    },
  };
}