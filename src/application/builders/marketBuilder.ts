import type { MarketItem } from "../../shared/types/MarketItem";

export function marketBuilder(
  data: any
): MarketItem[] {

  const odds = data.odds || {};

  const markets: MarketItem[] = [];

  function add(
    market: string,
    odd: number | undefined
  ) {
    if (!odd || odd <= 1) return;

    markets.push({
      market,
      odd,
      source: "input"
    });
  }

  /* ===========================
     MATCH RESULT
  ============================ */
  add("HOME_WIN", odds.home);
  add("DRAW", odds.draw);
  add("AWAY_WIN", odds.away);

  /* ===========================
     DOUBLE CHANCE
  ============================ */
  add(
    "DOUBLE_CHANCE_1X",
    odds.homeOrDraw
  );

  add(
    "DOUBLE_CHANCE_X2",
    odds.awayOrDraw
  );

  /* ===========================
     GOALS
  ============================ */
  add("OVER_1_5", odds.over15);
  add("OVER_2_5", odds.over25);

  /* ===========================
     BTTS
  ============================ */
  add("BTTS_YES", odds.bttsYes);
  add("BTTS_NO", odds.bttsNo);

  return markets;
}