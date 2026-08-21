import type { CanonicalDecisionMarket } from "./types";

/* ==========================================
   MERCADOS
========================================== */

export function parseDecisionMarket(
  value: unknown
): CanonicalDecisionMarket | null {
  const market =
    String(
      value ??
      ""
    )
      .trim()
      .toUpperCase();

  switch (market) {
    case "HOME":
    case "HOME_WIN":
      return "HOME";

    case "DRAW":
      return "DRAW";

    case "AWAY":
    case "AWAY_WIN":
      return "AWAY";

    case "OVER_1_5":
    case "OVER15":
    case "OVER 1.5":
      return "OVER_1_5";

    case "OVER_2_5":
    case "OVER25":
    case "OVER 2.5":
      return "OVER_2_5";

    case "BTTS_YES":
    case "BTTS YES":
      return "BTTS_YES";

    case "BTTS_NO":
    case "BTTS NO":
      return "BTTS_NO";

    case "DOUBLE_CHANCE_1X":
    case "1X":
      return "DOUBLE_CHANCE_1X";

    case "DOUBLE_CHANCE_X2":
    case "X2":
      return "DOUBLE_CHANCE_X2";

    default:
      return null;
  }
}
