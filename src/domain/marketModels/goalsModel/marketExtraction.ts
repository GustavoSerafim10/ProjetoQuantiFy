import { roundNumber, sanitizeProbability } from "./numericHelpers";
import { type CanonicalMarkets, type MarketDelta } from "./types";

/* ==========================================
   EXTRAÇÃO DOS MERCADOS
========================================== */

export function calculateMarkets(
  matrix: number[][]
): CanonicalMarkets {
  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;

  let over15 = 0;
  let over25 = 0;

  let bttsYes = 0;

  for (
    let homeGoals = 0;
    homeGoals < matrix.length;
    homeGoals++
  ) {
    const row =
      matrix[homeGoals] ?? [];

    for (
      let awayGoals = 0;
      awayGoals < row.length;
      awayGoals++
    ) {
      const probability =
        sanitizeProbability(
          row[awayGoals]
        );

      if (homeGoals > awayGoals) {
        homeWin += probability;
      } else if (
        homeGoals === awayGoals
      ) {
        draw += probability;
      } else {
        awayWin += probability;
      }

      const totalGoals =
        homeGoals +
        awayGoals;

      if (totalGoals >= 2) {
        over15 += probability;
      }

      if (totalGoals >= 3) {
        over25 += probability;
      }

      if (
        homeGoals >= 1 &&
        awayGoals >= 1
      ) {
        bttsYes += probability;
      }
    }
  }

  const safeHomeWin =
    sanitizeProbability(homeWin);

  const safeDraw =
    sanitizeProbability(draw);

  const safeAwayWin =
    sanitizeProbability(awayWin);

  const resultTotal =
    safeHomeWin +
    safeDraw +
    safeAwayWin;

  const normalizedHome =
    resultTotal > 0
      ? safeHomeWin /
        resultTotal
      : 0;

  const normalizedDraw =
    resultTotal > 0
      ? safeDraw /
        resultTotal
      : 0;

  const normalizedAway =
    resultTotal > 0
      ? safeAwayWin /
        resultTotal
      : 0;

  const safeOver15 =
    sanitizeProbability(
      over15
    );

  const safeOver25 =
    sanitizeProbability(
      over25
    );

  const safeBttsYes =
    sanitizeProbability(
      bttsYes
    );

  const under15 =
    sanitizeProbability(
      1 - safeOver15
    );

  const under25 =
    sanitizeProbability(
      1 - safeOver25
    );

  const bttsNo =
    sanitizeProbability(
      1 - safeBttsYes
    );

  return {
    homeWin:
      normalizedHome,

    draw:
      normalizedDraw,

    awayWin:
      normalizedAway,

    over15:
      safeOver15,

    over25:
      safeOver25,

    under15,
    under25,

    bttsYes:
      safeBttsYes,

    bttsNo,

    doubleChance1X:
      sanitizeProbability(
        normalizedHome +
        normalizedDraw
      ),

    doubleChanceX2:
      sanitizeProbability(
        normalizedDraw +
        normalizedAway
      )
  };
}

export function roundMarkets(
  markets: CanonicalMarkets
): CanonicalMarkets {
  return {
    homeWin:
      roundNumber(
        markets.homeWin
      ),

    draw:
      roundNumber(
        markets.draw
      ),

    awayWin:
      roundNumber(
        markets.awayWin
      ),

    over15:
      roundNumber(
        markets.over15
      ),

    over25:
      roundNumber(
        markets.over25
      ),

    under15:
      roundNumber(
        markets.under15
      ),

    under25:
      roundNumber(
        markets.under25
      ),

    bttsYes:
      roundNumber(
        markets.bttsYes
      ),

    bttsNo:
      roundNumber(
        markets.bttsNo
      ),

    doubleChance1X:
      roundNumber(
        markets.doubleChance1X
      ),

    doubleChanceX2:
      roundNumber(
        markets.doubleChanceX2
      )
  };
}

export function calculateMarketDelta(
  before: CanonicalMarkets,
  after: CanonicalMarkets
): MarketDelta {
  return {
    homeWin:
      roundNumber(
        after.homeWin -
        before.homeWin
      ),

    draw:
      roundNumber(
        after.draw -
        before.draw
      ),

    awayWin:
      roundNumber(
        after.awayWin -
        before.awayWin
      ),

    over15:
      roundNumber(
        after.over15 -
        before.over15
      ),

    over25:
      roundNumber(
        after.over25 -
        before.over25
      ),

    under15:
      roundNumber(
        after.under15 -
        before.under15
      ),

    under25:
      roundNumber(
        after.under25 -
        before.under25
      ),

    bttsYes:
      roundNumber(
        after.bttsYes -
        before.bttsYes
      ),

    bttsNo:
      roundNumber(
        after.bttsNo -
        before.bttsNo
      ),

    doubleChance1X:
      roundNumber(
        after.doubleChance1X -
        before.doubleChance1X
      ),

    doubleChanceX2:
      roundNumber(
        after.doubleChanceX2 -
        before.doubleChanceX2
      )
  };
}
