export const MarketType = {
  OVER_GOALS: "OVER_GOALS",
  UNDER_GOALS: "UNDER_GOALS",
  BTTS: "BTTS",
  MATCH_RESULT: "MATCH_RESULT",
  CORNERS: "CORNERS",
  CARDS: "CARDS"
} as const;

export type MarketType = typeof MarketType[keyof typeof MarketType];