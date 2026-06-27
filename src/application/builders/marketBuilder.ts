import type { MarketItem } from "../../shared/types/MarketItem";

type MarketCategory = "RESULT" | "DOUBLE_CHANCE" | "GOALS" | "BTTS";

type MarketConfig = {
  market: string;
  odd: number | undefined;
  category: MarketCategory;
};

export function marketBuilder(data: any): MarketItem[] {
  const odds = data?.odds || {};

  const markets: MarketItem[] = [];

  function add(config: MarketConfig) {
    const { market, odd, category } = config;

    if (
      odd == null ||
      !Number.isFinite(odd) ||
      odd <= 1.01
    ) {
      return;
    }

    markets.push({
      market,
      odd,
      source: "pre-live-input",
      category,
      enabled: true,
      createdAt: Date.now(),
      pipelineHistory: ["marketBuilder"],
      debug: {},
    } as MarketItem);
  }

  const marketMap: MarketConfig[] = [
    // MATCH RESULT
    { market: "HOME_WIN", odd: odds.home, category: "RESULT" },
    { market: "DRAW", odd: odds.draw, category: "RESULT" },
    { market: "AWAY_WIN", odd: odds.away, category: "RESULT" },

    // DOUBLE CHANCE
    { market: "DOUBLE_CHANCE_1X", odd: odds.homeOrDraw, category: "DOUBLE_CHANCE" },
    { market: "DOUBLE_CHANCE_X2", odd: odds.awayOrDraw, category: "DOUBLE_CHANCE" },

    // GOALS
    { market: "OVER_1_5", odd: odds.over15, category: "GOALS" },
    { market: "OVER_2_5", odd: odds.over25, category: "GOALS" },

    // BTTS
    { market: "BTTS_YES", odd: odds.bttsYes, category: "BTTS" },
    { market: "BTTS_NO", odd: odds.bttsNo, category: "BTTS" },
  ];

  marketMap.forEach(add);

  return markets;
}